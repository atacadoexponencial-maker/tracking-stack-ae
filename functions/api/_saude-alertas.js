// Junta as três fontes de condição de alerta e manda para o Slack
// (spec-capi-reenvio-monitoramento.md + spec-protecoes-integracoes.md, módulo 4).
//
// Usado pela rotina periódica (/api/sync/meta-reenvio) e pelo "Checar agora"
// da aba, para o alerta sair na hora depois de uma checagem manual.

import { metricasSaude } from './_meta-fila.js';
import { avaliarCondicoes } from './_meta-envio.js';
import { processarAlertas } from './_meta-alerta.js';
import { lerCredenciais } from './_credenciais-checagem.js';
import { avaliarFontes } from './_horario-registro.js';
import { resumoProblema } from './_credenciais.js';
import { falhasRecentes } from './_email-agenda.js';

/** Condições e itens de credenciais e horário (sem valor de segredo, sem dado pessoal). */
export async function condicoesDasProtecoes(env, agora) {
  const condicoes = [];
  const itens = {};
  const { itens: credenciais } = await lerCredenciais(env);
  const comProblema = credenciais.filter((c) => c.situacao === 'problema');
  if (comProblema.length) {
    condicoes.push('credencial_problema');
    itens.credencial_problema = comProblema.map((c) => resumoProblema(c.nome, c.motivos));
  }
  const fontes = await avaliarFontes(env, agora);
  const suspeitas = fontes.filter((f) => f.situacao === 'suspeito');
  if (suspeitas.length) {
    condicoes.push('horario_suspeito');
    itens.horario_suspeito = suspeitas.map((f) => `${f.rotulo}: ${f.diagnostico}`);
  }
  // Agenda própria (spec-agenda-propria.md, módulo 1): agenda conectada cuja
  // última leitura falhou. Sem ela a página de agendamento não oferece horário.
  const agendas = await agendasComProblema(env);
  if (agendas.length) {
    condicoes.push('agenda_problema');
    itens.agenda_problema = agendas;
  }
  // E-mails da agenda (spec-email-proprio.md, módulo 3): falhou ou voltou nas
  // últimas 24 h. Itens sem dado pessoal.
  const emails = await falhasRecentes(env, agora);
  if (emails.length) {
    condicoes.push('email_agenda_falha');
    itens.email_agenda_falha = emails;
  }
  return { condicoes, itens, credenciais, fontes };
}

async function agendasComProblema(env) {
  try {
    const r = await env.DB.prepare(
      `SELECT nome, conta_email, ultimo_erro FROM agenda_calendarios
        WHERE ultimo_erro IS NOT NULL
          AND id IN (SELECT destino_cal FROM agenda_tipos WHERE ativo = 1
                     UNION SELECT value FROM agenda_tipos, json_each(agenda_tipos.conflito_cals_json) WHERE ativo = 1)`,
    ).all();
    return (r.results || []).map((a) => `${a.nome} (${a.conta_email}): ${a.ultimo_erro}`);
  } catch {
    // Tabela ainda não criada (migration 0047 não aplicada): não é alerta.
    return [];
  }
}

export async function verificarAlertas(env, agora = Math.floor(Date.now() / 1000), fetchImpl = fetch) {
  const metricas = await metricasSaude(env, agora);
  const doMeta = avaliarCondicoes(metricas, agora);
  const protecoes = await condicoesDasProtecoes(env, agora);
  const condicoes = [...doMeta, ...protecoes.condicoes];
  const r = await processarAlertas(env, { condicoes, metricas, agora, fetchImpl, itens: protecoes.itens });
  return { ...r, condicoes };
}
