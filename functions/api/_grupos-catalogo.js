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

// A cada quanto tempo o cron atualiza a cópia local sozinho. Seis horas porque
// a lista de grupos quase não muda, e cada atualização custa ~46s da Evolution.
export const VALIDADE_SEG = 6 * 3600;

/**
 * Busca a lista na Evolution e grava a cópia local. É a operação LENTA
 * (~46s para 123 grupos), e por isso só roda em segundo plano ou quando
 * alguém pede explicitamente — nunca ao abrir a tela.
 */
export async function atualizarCatalogo(env, agora, fetchImpl = fetch) {
  const lista = await listarGrupos(env, fetchImpl);
  if (!lista.ok) return { ok: false, erro: lista.erro };

  const linhas = await Promise.all((lista.grupos || []).map(async (g) => {
    // Bug conhecido da Evolution: `fetchAllGroups` às vezes devolve o grupo
    // sem `subject`. Mostrar um item em branco seria pior que gastar uma
    // consulta a mais — mas só para quem veio sem nome.
    let subject = g.subject;
    if (!subject) {
      const info = await infoGrupo(env, g.id, fetchImpl);
      subject = info.ok ? (info.dados?.subject ?? null) : null;
    }
    return {
      group_jid: g.id,
      subject: subject || null,
      size: Number.isFinite(Number(g.size)) ? Number(g.size) : 0,
      tipo: tipoDe(g),
      linked_parent: g.linkedParent || null,
      busca: `${normalizar(subject)} ${g.id}`,
    };
  }));

  for (const l of linhas) {
    await env.DB.prepare(`
      INSERT INTO whatsapp_groups_catalogo (group_jid, subject, size, tipo, linked_parent, busca, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(group_jid) DO UPDATE SET
        subject = excluded.subject, size = excluded.size, tipo = excluded.tipo,
        linked_parent = excluded.linked_parent, busca = excluded.busca,
        atualizado_em = excluded.atualizado_em
    `).bind(l.group_jid, l.subject, l.size, l.tipo, l.linked_parent, l.busca, agora).run();
  }

  // Grupo do qual o número saiu some da lista: manter seria oferecer para
  // monitorar algo que não existe mais.
  await env.DB.prepare('DELETE FROM whatsapp_groups_catalogo WHERE atualizado_em < ?').bind(agora).run();

  return { ok: true, total: linhas.length };
}

/** Atualiza só se a cópia local já estiver velha. Usado pelo cron. */
export async function talvezAtualizar(env, agora, fetchImpl = fetch) {
  const r = await env.DB.prepare('SELECT MAX(atualizado_em) AS em FROM whatsapp_groups_catalogo').first();
  if (r?.em && agora - r.em < VALIDADE_SEG) return { pulou: true };
  return atualizarCatalogo(env, agora, fetchImpl);
}

/**
 * A cópia local cruzada com a allowlist. É LEITURA DE BANCO, instantânea —
 * a tela nunca espera a Evolution.
 *
 * Ordenada por tamanho, mas sem ilusão: medido em produção, os maiores são de
 * TERCEIROS (1.134 e 1.025 membros) e os da operação vêm depois (533 e 207).
 * Quem realmente encontra o grupo é a busca e o filtro de Comunidades — a
 * ordem serve só para não começar pelos grupos de 3 pessoas.
 */
export async function catalogo(env) {
  const { results } = await env.DB.prepare(`
    SELECT c.group_jid, c.subject, c.size, c.tipo, c.linked_parent, c.busca, c.atualizado_em,
           t.enabled, t.send_conversion
    FROM whatsapp_groups_catalogo c
    LEFT JOIN whatsapp_groups_tracked t ON t.group_jid = c.group_jid
    ORDER BY c.size DESC
  `).all();

  const grupos = (results || []).map((g) => ({
    group_jid: g.group_jid,
    subject: g.subject,
    size: g.size,
    tipo: g.tipo,
    linkedParent: g.linked_parent,
    busca: g.busca,
    monitorado: !!g.enabled,
    envia_meta: !!g.send_conversion,
  }));

  return { ok: true, grupos, atualizado_em: results?.[0]?.atualizado_em ?? null };
}

/**
 * Passa a monitorar um grupo. Devolve o JID REALMENTE cadastrado, que pode
 * não ser o que foi pedido (Comunidade → seu grupo de Avisos).
 */
export async function monitorar(env, jidPedido, agora) {
  const pedido = await env.DB.prepare('SELECT * FROM whatsapp_groups_catalogo WHERE group_jid = ?')
    .bind(String(jidPedido || '')).first();
  if (!pedido) return { ok: false, erro: 'Grupo não encontrado na lista. Clique em "Atualizar lista" e tente de novo.' };

  let alvo = pedido;
  let corrigido = false;

  if (pedido.tipo === 'comunidade') {
    // Quem mede é o Avisos. O pai tem meia dúzia de admins e não recebe as
    // entradas — monitorá-lo daria um gráfico eternamente plano, sem erro
    // nenhum na tela.
    const avisos = await env.DB.prepare(
      "SELECT * FROM whatsapp_groups_catalogo WHERE tipo = 'avisos' AND linked_parent = ?"
    ).bind(pedido.group_jid).first();
    if (!avisos) {
      return { ok: false, erro: 'Não achei o grupo de avisos desta Comunidade. Escolha o grupo de avisos diretamente na lista.' };
    }
    alvo = avisos;
    corrigido = true;
  }

  const parentJid = alvo.linked_parent || null;
  const label = alvo.subject || pedido.subject || alvo.group_jid;

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
  `).bind(alvo.group_jid, label, alvo.subject || null, parentJid).run();

  return { ok: true, group_jid: alvo.group_jid, label, tipo: alvo.tipo, corrigido, parent_jid: parentJid };
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
