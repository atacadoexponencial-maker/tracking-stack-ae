// Ponte: movimentação nos grupos de WhatsApp → ManyChat.
//
// Quem ENTRA num grupo configurado aqui vira contato no ManyChat, ganha a tag
// do grupo e recebe o fluxo de boas-vindas. Quem SAI mantém a tag do grupo e
// ganha a tag de saída — sem mensagem nenhuma. Substitui a importação manual
// que foi feita à mão em 09/09/2026 (tag `grupolive-manual`, 193 pessoas).
//
// Chamada pelo webhook dos grupos (functions/api/webhooks/whatsapp-grupo.js)
// DEPOIS de o evento estar gravado no D1 e a resposta ter saído, dentro de
// `waitUntil`: falha aqui não pode custar a gravação nem segurar o n8n. Por
// isso nada nesta ponte lança.
//
// Prefixo "_": o Cloudflare Pages não transforma em rota.

import { inscreverComTag, buscarInscrito, aplicarTag, removerTag } from './_manychat.js';
import { telefoneDoJid, comNonoDigito } from './_grupo-conversao.js';

// Um grupo por entrada. Ligar um grupo novo é acrescentar uma linha aqui —
// nada mais no código precisa mudar.
//
// Os ids vêm da conta real do ManyChat. Para descobrir os de uma turma nova:
//   GET https://api.manychat.com/fb/page/getTags   → id das tags
//   GET https://api.manychat.com/fb/page/getFlows  → `ns` dos fluxos
//
// A tag `grupolive-manual` (96185696), da importação de 09/09, NÃO é lida nem
// escrita por esta ponte — fica como registro histórico daquele envio.
export const GRUPOS = {
  // "Lives Semanais" (tags e fluxo criados em 2026-09-17)
  '120363427499061913@g.us': {
    rotulo: 'live semanal',
    rotuloComArtigo: 'da live semanal', // entra no comentário do ClickUp
    tagGrupo: 96802043,          // grupo-live-semanal
    tagSaiu: 96802046,           // saiu-grupo-live
    tagBoasVindasEnviada: 96802947, // boas-vindas-enviada-live
    fluxoBoasVindas: 'content20260917172557_668685', // "Boas-vindas Live Semanal"
    consentimento: 'entrada no grupo de WhatsApp da live semanal',
  },
  // "Workshops" (tags e fluxo criados em 2026-09-17)
  '120363380235066572@g.us': {
    rotulo: 'workshop',
    rotuloComArtigo: 'do workshop',
    tagGrupo: 96806964,          // grupo-workshop
    tagSaiu: 96806965,           // saiu-grupo-workshop
    tagBoasVindasEnviada: 96806966, // boas-vindas-enviada-workshop
    fluxoBoasVindas: 'content20260917184437_180652', // "Boas-vidas Grupo Workshop"
    consentimento: 'entrada no grupo de WhatsApp do workshop',
  },
};

export function configDoGrupo(groupJid) {
  return GRUPOS[groupJid] || null;
}

// Telefone no log só com os 4 últimos dígitos: o suficiente para conferir um
// caso com a pessoa na mão, longe de virar lista de telefones no log do Pages.
function mascarar(telefone) {
  const t = String(telefone || '');
  return t ? `•••••${t.slice(-4)}` : '(sem telefone)';
}

function log(rotulo, desfecho, detalhe) {
  console.error(`grupos-manychat [${rotulo}] —`, desfecho, detalhe);
}

// Entrada: inscreve (ou acha), tagueia, dispara o fluxo e — só se o fluxo for
// aceito — aplica a tag de controle. Tudo isso é o `inscreverComTag`, que já é
// exatamente essa sequência. Depois, o caso "voltou": tira a tag de saída.
async function tratarEntrada(telefone, cfg, env) {
  const r = await inscreverComTag({
    telefone,
    tagId: cfg.tagGrupo,
    flowNs: cfg.fluxoBoasVindas,
    tagEnviadoId: cfg.tagBoasVindasEnviada,
    consentimento: cfg.consentimento,
    env,
  });

  // Nome não vai: só 7 de 193 participantes tinham `pushName` em 09/09, e o
  // evento da Evolution não traz nome nenhum.

  if (r.subscriberId) {
    // Quem saiu e voltou: a tag de saída deixa de valer. Best-effort — falhar
    // aqui não desfaz nem repete a mensagem que já saiu.
    const falha = await removerTag(r.subscriberId, cfg.tagSaiu, env);
    if (falha) log(cfg.rotulo, 'voltou_tag_saida_nao_removida', { telefone: mascarar(telefone), falha });
  }

  return r.ok ? r.motivo : `entrada_${r.motivo}`;
}

// Saída: NUNCA cria contato. Quem não está no ManyChat (ou é inencontrável,
// caso de quem nasceu só com WhatsApp) fica de fora, e isso vai para o log.
async function tratarSaida(telefone, cfg, env) {
  const id = await buscarInscrito('phone', telefone, env);
  if (!id) return 'saida_sem_inscrito';
  const falha = await aplicarTag(id, cfg.tagSaiu, env);
  return falha ? `saida_erro: ${falha}` : 'saida_tagueada';
}

/**
 * Trata as linhas NOVAS de um evento de um grupo configurado em `GRUPOS`.
 *
 * `linhas` é o que `classificarEvento` produziu, já filtrado pelo webhook para
 * conter só o que entrou agora no D1 — é essa filtragem que garante que uma
 * reentrega do n8n não dispare o fluxo duas vezes.
 *
 * Devolve o resumo `{ inscrito, ja_existia_tagueado, saida_tagueada, ... }`,
 * usado no log. Nunca lança.
 */
export async function pontearGrupo(env, linhas, groupJid) {
  const resumo = {};
  const conta = (d) => { resumo[d] = (resumo[d] || 0) + 1; };

  const cfg = configDoGrupo(groupJid);
  if (!cfg) return {};

  if (!env?.MANYCHAT_API) {
    log(cfg.rotulo, 'sem_config', { motivo: 'MANYCHAT_API ausente', linhas: linhas?.length || 0 });
    return { sem_config: linhas?.length || 0 };
  }

  // Um contato por vez: a API do ManyChat não tem operação em lote, e em série
  // o erro de um participante não atrapalha os outros.
  for (const linha of linhas || []) {
    const telefone = comNonoDigito(telefoneDoJid(linha.participantJid));
    if (!telefone) {
      // Participante que chega só como "@lid": sem número não há como
      // inscrever. Acontece com frequência desde 09/09 e é perda conhecida.
      conta('sem_telefone');
      log(cfg.rotulo, 'sem_telefone', { acao: linha.action });
      continue;
    }

    let desfecho;
    try {
      desfecho = linha.action === 'entrou'
        ? await tratarEntrada(telefone, cfg, env)
        : await tratarSaida(telefone, cfg, env);
    } catch (e) {
      desfecho = 'erro';
      log(cfg.rotulo, 'erro', { acao: linha.action, telefone: mascarar(telefone), erro: String(e?.message || e).slice(0, 200) });
    }

    conta(desfecho.split(':')[0]);
    // O caminho feliz não gera linha por pessoa — só o resumo no fim.
    if (!['inscrito', 'ja_existia_tagueado', 'saida_tagueada'].includes(desfecho)) {
      log(cfg.rotulo, desfecho, { acao: linha.action, telefone: mascarar(telefone) });
    }
  }

  log(cfg.rotulo, 'resumo', resumo);
  return resumo;
}
