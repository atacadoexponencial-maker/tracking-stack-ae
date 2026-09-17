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
  return { condicoes, itens, credenciais, fontes };
}

export async function verificarAlertas(env, agora = Math.floor(Date.now() / 1000), fetchImpl = fetch) {
  const metricas = await metricasSaude(env, agora);
  const doMeta = avaliarCondicoes(metricas, agora);
  const protecoes = await condicoesDasProtecoes(env, agora);
  const condicoes = [...doMeta, ...protecoes.condicoes];
  const r = await processarAlertas(env, { condicoes, metricas, agora, fetchImpl, itens: protecoes.itens });
  return { ...r, condicoes };
}
