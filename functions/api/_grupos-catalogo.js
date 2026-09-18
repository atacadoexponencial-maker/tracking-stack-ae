// Catálogo de grupos: escolher da lista em vez de colar JID.
//
// Até 18/09/2026, incluir um grupo na medição era um INSERT no D1 — a lista
// morava em tabela justamente para não exigir deploy, mas isso nunca virou
// "a usuária consegue sozinha".
//
// A regra que carrega o risco desta tela é a da Comunidade: quem clica vê o
// nome da COMUNIDADE, mas quem precisa ser monitorado é o grupo de AVISOS —
// é onde as pessoas estão e de onde vêm os eventos de entrada e saída.
// Cadastrar o pai daria uma medição permanentemente vazia, sem erro nenhum na
// tela. Por isso a correção é feita aqui, e não confiada a quem clica.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { listarGrupos, infoGrupo } from './_evolution-grupos.js';

/** Texto comparável: sem acento e sem caixa. */
export function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function tipoDe(g) {
  if (g.isCommunity) return 'comunidade';
  if (g.isCommunityAnnounce) return 'avisos';
  return 'comum';
}

/**
 * A lista da Evolution cruzada com a allowlist do D1.
 *
 * Ordenada por tamanho porque os grupos da operação têm centenas de pessoas e
 * os de terceiros costumam ser pequenos: o que interessa sobe sozinho, antes
 * de qualquer busca.
 */
export async function catalogo(env, fetchImpl = fetch) {
  const lista = await listarGrupos(env, fetchImpl);
  if (!lista.ok) return { ok: false, erro: lista.erro };

  const { results } = await env.DB.prepare(
    'SELECT group_jid, label, enabled, send_conversion, parent_jid FROM whatsapp_groups_tracked'
  ).all();
  const guardados = new Map((results || []).map((r) => [r.group_jid, r]));

  const grupos = await Promise.all((lista.grupos || []).map(async (g) => {
    // Bug conhecido da Evolution: `fetchAllGroups` às vezes devolve o grupo
    // sem `subject`. Mostrar um item em branco seria pior que gastar uma
    // consulta a mais — mas só para quem veio sem nome.
    let subject = g.subject;
    if (!subject) {
      const info = await infoGrupo(env, g.id, fetchImpl);
      subject = info.ok ? (info.dados?.subject ?? null) : null;
    }
    const guardado = guardados.get(g.id);
    return {
      group_jid: g.id,
      subject: subject || null,
      size: Number.isFinite(Number(g.size)) ? Number(g.size) : 0,
      tipo: tipoDe(g),
      linkedParent: g.linkedParent || null,
      monitorado: !!guardado && !!guardado.enabled,
      envia_meta: !!guardado?.send_conversion,
      // Já normalizado no backend: a tela só compara, não precisa saber que
      // busca em português exige tirar acento.
      busca: `${normalizar(subject)} ${g.id}`,
    };
  }));

  grupos.sort((a, b) => b.size - a.size);
  return { ok: true, grupos };
}

/**
 * Passa a monitorar um grupo. Devolve o JID REALMENTE cadastrado, que pode
 * não ser o que foi pedido (Comunidade → seu grupo de Avisos).
 */
export async function monitorar(env, jidPedido, agora, fetchImpl = fetch) {
  const lista = await listarGrupos(env, fetchImpl);
  if (!lista.ok) return { ok: false, erro: lista.erro };

  const pedido = (lista.grupos || []).find((g) => g.id === jidPedido);
  if (!pedido) return { ok: false, erro: 'Grupo não encontrado na lista do WhatsApp. Atualize a lista e tente de novo.' };

  let alvo = pedido;
  let corrigido = false;

  if (tipoDe(pedido) === 'comunidade') {
    // Quem mede é o Avisos. O pai tem meia dúzia de admins e não recebe as
    // entradas — monitorá-lo daria um gráfico eternamente plano.
    const avisos = (lista.grupos || []).find((g) => g.isCommunityAnnounce && g.linkedParent === pedido.id);
    if (!avisos) {
      return { ok: false, erro: 'Não achei o grupo de avisos desta Comunidade. Escolha o grupo de avisos diretamente na lista.' };
    }
    alvo = avisos;
    corrigido = true;
  }

  const parentJid = alvo.linkedParent || null;
  const label = alvo.subject || pedido.subject || alvo.id;

  // UPSERT: religar um grupo desligado atualiza a linha e aproveita o nome
  // atual; duplicar criaria duas verdades sobre o mesmo grupo.
  await env.DB.prepare(`
    INSERT INTO whatsapp_groups_tracked (group_jid, label, group_name, enabled, send_conversion, parent_jid)
    VALUES (?, ?, ?, 1, 0, ?)
    ON CONFLICT(group_jid) DO UPDATE SET
      enabled = 1,
      label = excluded.label,
      group_name = excluded.group_name,
      parent_jid = COALESCE(excluded.parent_jid, whatsapp_groups_tracked.parent_jid)
  `).bind(alvo.id, label, alvo.subject || null, parentJid).run();

  return { ok: true, group_jid: alvo.id, label, tipo: tipoDe(alvo), corrigido, parent_jid: parentJid };
}

/**
 * Para de monitorar. NÃO apaga: as entradas e saídas já registradas apontam
 * para esta linha, e removê-la faria o histórico perder o rótulo do grupo.
 */
export async function desligar(env, jid) {
  // A conversão ao Meta cai junto: um grupo que não é medido não pode
  // continuar mandando evento para o Pixel por esquecimento.
  const r = await env.DB.prepare(
    'UPDATE whatsapp_groups_tracked SET enabled = 0, send_conversion = 0 WHERE group_jid = ?'
  ).bind(String(jid || '')).run();

  if (r.meta.changes === 0) return { ok: false, erro: 'Esse grupo não está na lista de monitorados.' };
  return { ok: true };
}

/**
 * Liga ou desliga o envio de `EntrouGrupo` ao Meta para um grupo.
 *
 * Ao LIGAR, marca a partir de quando vale. Sem isso, a primeira rodada do sync
 * varreria o histórico inteiro e despejaria meses de entradas antigas no Pixel
 * de uma vez — com data errada e estragando a otimização das campanhas.
 *
 * Ao DESLIGAR, `conversion_since` é preservado: ele é a memória de desde
 * quando aquele grupo já mandou conversão, e reescrevê-lo faria uma religada
 * futura reenviar o intervalo.
 */
export async function alternarMeta(env, jid, ligar, agora) {
  const sql = ligar
    ? 'UPDATE whatsapp_groups_tracked SET send_conversion = 1, conversion_since = COALESCE(conversion_since, ?) WHERE group_jid = ? AND enabled = 1'
    : 'UPDATE whatsapp_groups_tracked SET send_conversion = 0 WHERE group_jid = ?';

  const stmt = ligar
    ? env.DB.prepare(sql).bind(agora, String(jid || ''))
    : env.DB.prepare(sql).bind(String(jid || ''));

  const r = await stmt.run();
  if (r.meta.changes === 0) {
    return { ok: false, erro: ligar ? 'Só dá para ligar a conversão de um grupo que está sendo monitorado.' : 'Esse grupo não está na lista.' };
  }
  return { ok: true };
}
