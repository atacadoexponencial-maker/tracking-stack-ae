// Ponte: movimentação no grupo da live semanal → ManyChat.
//
// Quem ENTRA no grupo vira contato no ManyChat, ganha a tag de pertencimento e
// recebe o fluxo de boas-vindas. Quem SAI mantém a tag de pertencimento e ganha
// a tag de saída — sem mensagem nenhuma. Substitui a importação manual que foi
// feita à mão em 09/09/2026 (tag `grupolive-manual`, 193 pessoas).
//
// Chamada pelo webhook dos grupos (functions/api/webhooks/whatsapp-grupo.js)
// DEPOIS de o evento estar gravado no D1 e a resposta ter saído, dentro de
// `waitUntil`: falha aqui não pode custar a gravação nem segurar o n8n. Por
// isso nada nesta ponte lança.
//
// Prefixo "_": o Cloudflare Pages não transforma em rota.

import { inscreverComTag, buscarInscrito, aplicarTag, removerTag } from './_manychat.js';
import { telefoneDoJid, comNonoDigito } from './_grupo-conversao.js';

// Identificadores da live semanal na conta real do ManyChat (criados em
// 2026-09-17). Para descobrir os de uma turma nova:
//   GET https://api.manychat.com/fb/page/getTags   → id das tags
//   GET https://api.manychat.com/fb/page/getFlows  → `ns` dos fluxos
export const GRUPO_LIVE_JID = '120363427499061913@g.us';
export const TAG_GRUPO_LIVE = 96802043;        // grupo-live-semanal
export const TAG_SAIU_GRUPO = 96802046;        // saiu-grupo-live
export const TAG_BOAS_VINDAS_ENVIADA = 96802947; // boas-vindas-enviada-live
export const FLUXO_BOAS_VINDAS = 'content20260917172557_668685'; // "Boas-vindas Live Semanal"
// A tag `grupolive-manual` (96185696), da importação de 09/09, NÃO é lida nem
// escrita por esta ponte — fica como registro histórico daquele envio.

const CONSENTIMENTO = 'entrada no grupo de WhatsApp da live semanal';

// Telefone no log só com os 4 últimos dígitos: o suficiente para conferir um
// caso com a pessoa na mão, longe de virar lista de telefones no log do Pages.
function mascarar(telefone) {
  const t = String(telefone || '');
  return t ? `•••••${t.slice(-4)}` : '(sem telefone)';
}

function log(desfecho, detalhe) {
  console.error('grupo-live-manychat —', desfecho, detalhe);
}

// Entrada: inscreve (ou acha), tagueia, dispara o fluxo e — só se o fluxo for
// aceito — aplica a tag de controle. Tudo isso é o `inscreverComTag`, que já é
// exatamente essa sequência. Depois, o caso "voltou": tira a tag de saída.
async function tratarEntrada(telefone, env) {
  const r = await inscreverComTag({
    telefone,
    tagId: TAG_GRUPO_LIVE,
    flowNs: FLUXO_BOAS_VINDAS,
    tagEnviadoId: TAG_BOAS_VINDAS_ENVIADA,
    consentimento: CONSENTIMENTO,
    env,
  });

  // Nome não vai: só 7 de 193 participantes tinham `pushName` em 09/09, e o
  // evento da Evolution não traz nome nenhum.

  if (r.subscriberId) {
    // Quem saiu e voltou: a tag de saída deixa de valer. Best-effort — falhar
    // aqui não desfaz nem repete a mensagem que já saiu.
    const falha = await removerTag(r.subscriberId, TAG_SAIU_GRUPO, env);
    if (falha) log('voltou_tag_saida_nao_removida', { telefone: mascarar(telefone), falha });
  }

  return r.ok ? r.motivo : `entrada_${r.motivo}`;
}

// Saída: NUNCA cria contato. Quem não está no ManyChat (ou é inencontrável,
// caso de quem nasceu só com WhatsApp) fica de fora, e isso vai para o log.
async function tratarSaida(telefone, env) {
  const id = await buscarInscrito('phone', telefone, env);
  if (!id) return 'saida_sem_inscrito';
  const falha = await aplicarTag(id, TAG_SAIU_GRUPO, env);
  return falha ? `saida_erro: ${falha}` : 'saida_tagueada';
}

/**
 * Trata as linhas NOVAS de um evento do grupo da live.
 *
 * `linhas` é o que `classificarEvento` produziu, já filtrado pelo webhook para
 * conter só o que entrou agora no D1 — é essa filtragem que garante que uma
 * reentrega do n8n não dispare o fluxo duas vezes.
 *
 * Devolve o resumo `{ inscrito, ja_existia_tagueado, saida_tagueada, ... }`,
 * usado no log. Nunca lança.
 */
export async function pontearGrupoLive(env, linhas) {
  const resumo = {};
  const conta = (d) => { resumo[d] = (resumo[d] || 0) + 1; };

  if (!env?.MANYCHAT_API) {
    log('sem_config', { motivo: 'MANYCHAT_API ausente', linhas: linhas?.length || 0 });
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
      log('sem_telefone', { acao: linha.action });
      continue;
    }

    let desfecho;
    try {
      desfecho = linha.action === 'entrou'
        ? await tratarEntrada(telefone, env)
        : await tratarSaida(telefone, env);
    } catch (e) {
      desfecho = 'erro';
      log('erro', { acao: linha.action, telefone: mascarar(telefone), erro: String(e?.message || e).slice(0, 200) });
    }

    conta(desfecho.split(':')[0]);
    // O caminho feliz não gera linha por pessoa — só o resumo no fim.
    if (!['inscrito', 'ja_existia_tagueado', 'saida_tagueada'].includes(desfecho)) {
      log(desfecho, { acao: linha.action, telefone: mascarar(telefone) });
    }
  }

  log('resumo', resumo);
  return resumo;
}
