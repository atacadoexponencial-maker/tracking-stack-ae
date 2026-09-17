// Ponte: movimentação nos grupos de WhatsApp → comentário no card do ClickUp.
//
// Existe para o COMERCIAL: quando um lead que já está no CRM entra (ou sai) de
// um grupo, o card dele ganha um comentário dizendo isso, com data e hora.
// O comentário notifica quem é responsável pelo card e fica no histórico — é a
// jornada do lead, que hoje só existia no dashboard.
//
// Decisões da usuária (2026-09-17):
//   - SÓ comentário. Nada de etiqueta, nada de mudar estágio.
//   - TODA entrada e TODA saída viram comentário, inclusive de quem entra toda
//     semana: é justamente a recorrência que o comercial quer enxergar.
//   - NUNCA cria card. Quem entrou no grupo e não é lead fica de fora — a LP
//     nova da live não tem formulário, então isso é comum e é esperado.
//
// Os grupos participantes são os mesmos de `_grupos-manychat.js` (GRUPOS).
//
// Roda no mesmo `waitUntil` da ponte do ManyChat, depois da gravação no D1.
// Nada aqui lança: falha no ClickUp não pode custar o evento.

import { searchClickUpTaskPorTelefone, clickupFetch, clickupWrite, CU_FIELD } from './_clickup.js';
import { telefoneDoJid, comNonoDigito } from './_grupo-conversao.js';
import { configDoGrupo } from './_grupos-manychat.js';

const FUSO_BRT = 'America/Sao_Paulo';

// "17/09/2026 às 14h59" — a hora importa porque o comercial usa isso para saber
// se a pessoa entrou antes ou depois de uma conversa.
function momentoBrt(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const data = d.toLocaleDateString('pt-BR', { timeZone: FUSO_BRT });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: FUSO_BRT, hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora.replace(':', 'h')}`;
}

function textoDoComentario(action, iso, rotulo) {
  const quando = momentoBrt(iso);
  const quandoTexto = quando ? ` em ${quando}` : '';
  return action === 'entrou'
    ? `📥 Entrou no grupo de WhatsApp ${rotulo}${quandoTexto}.`
    : `📤 Saiu do grupo de WhatsApp ${rotulo}${quandoTexto}.`;
}

function mascarar(telefone) {
  const t = String(telefone || '');
  return t ? `•••••${t.slice(-4)}` : '(sem telefone)';
}

function log(rotulo, desfecho, detalhe) {
  console.error(`grupos-crm [${rotulo}] —`, desfecho, detalhe);
}

/**
 * Comenta no card de quem já é lead. `linhas` é o que o webhook acabou de
 * gravar (só as linhas novas), `occurredAt` é o instante do evento em ISO e
 * `groupJid` diz de qual grupo se trata (o rótulo entra no texto).
 *
 * Devolve o resumo por desfecho, usado no log. Nunca lança.
 */
export async function registrarNoCrm(env, linhas, occurredAt, groupJid) {
  const resumo = {};
  const conta = (d) => { resumo[d] = (resumo[d] || 0) + 1; };

  // Rótulo do grupo: a mesma configuração que a ponte do ManyChat usa, para os
  // dois nunca discordarem sobre quais grupos participam.
  const cfg = configDoGrupo(groupJid);
  if (!cfg) return {};
  const rotulo = cfg.rotuloComArtigo;

  if (!env?.CLICKUP_API_TOKEN) {
    log(cfg.rotulo, 'sem_config', { motivo: 'CLICKUP_API_TOKEN ausente', linhas: linhas?.length || 0 });
    return { sem_config: linhas?.length || 0 };
  }

  for (const linha of linhas || []) {
    // Mesma regra de telefone do resto da casa: o WhatsApp entrega a maioria
    // dos números da live sem o nono dígito e o card está gravado com ele.
    const telefone = comNonoDigito(telefoneDoJid(linha.participantJid));
    if (!telefone) {
      conta('sem_telefone');
      continue;
    }

    try {
      // Busca no ClickUp, não na nossa tabela de leads: assim também acha quem
      // virou card por outro caminho (formulário nativo do Meta, card manual).
      const card = await searchClickUpTaskPorTelefone(CU_FIELD.whatsapp, telefone, env);
      if (!card) {
        // Entrou no grupo e não é lead: o caso mais comum desde que a LP da
        // live ficou sem formulário. Não cria card — decisão da usuária.
        conta('nao_e_lead');
        continue;
      }

      await clickupWrite(() => clickupFetch(`/task/${card.id}/comment`, {
        method: 'POST',
        body: JSON.stringify({ comment_text: textoDoComentario(linha.action, occurredAt, rotulo) }),
      }, env));
      conta('comentado');
    } catch (e) {
      conta('erro');
      log(cfg.rotulo, 'erro', {
        acao: linha.action,
        telefone: mascarar(telefone),
        erro: String(e?.message || e).slice(0, 200),
      });
    }
  }

  log(cfg.rotulo, 'resumo', resumo);
  return resumo;
}
