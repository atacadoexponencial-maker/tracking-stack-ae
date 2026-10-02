// GET /api/agenda/taxas?key=...&from=&to=[&antFrom=&antTo=]
//
// Taxas de passagem da Visão geral (pedido de 02/10): Lead → MQL, MQL → RA,
// RA → RR e no-show, no total e por funil, no período e no anterior.
//
// Leads novos e MQL saem de `montarFeedback`, a mesma função do relatório de
// marketing e das Metas: os números nunca divergem entre as telas. MQL é o
// status ATUAL do card no CRM. Reuniões vêm da agenda própria (comerciais, sem
// teste). CRM fora do ar deixa Lead → MQL e MQL → RA em null, nunca 0.
import { montarFeedback } from '../feedback-marketing.js';
import { resolverPeriodo } from '../_feedback-marketing-periodo.js';
import { taxasPorFunil } from '../_agenda-funil.js';
import { ymdBrt } from '../_data-brt.js';
import { respostaEmCache, respostaJson } from '../_cache.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

/** { funil_tracking: { leads_novos, mqls } } a partir dos blocos do relatório. */
async function lerCrm(env, de, ate, agora) {
  try {
    const r = resolverPeriodo({ inicio: ymdBrt(de), fim: ymdBrt(Math.min(ate, agora)) }, agora);
    if (!r.ok) return null;
    const relatorio = await montarFeedback(env, r.periodo, []);
    const funis = (await env.DB.prepare('SELECT nome, posicao, funil_tracking FROM funis_relatorio').all()).results || [];
    const porFunil = {};
    for (const b of relatorio.blocos || []) {
      const m = b.metricas || {};
      if (typeof m.novos_leads !== 'number' || typeof m.mqls !== 'number') {
        // Bloco de lead sem leitura do CRM: o recorte inteiro fica sem MQL.
        if (m.novos_leads === null) return null;
        continue;
      }
      const f = funis.find((x) => x.nome === b.nome && x.posicao === b.posicao);
      const chave = (f && f.funil_tracking) || b.nome;
      porFunil[chave] = porFunil[chave] || { leads_novos: 0, mqls: 0 };
      porFunil[chave].leads_novos += m.novos_leads;
      porFunil[chave].mqls += m.mqls;
    }
    return porFunil;
  } catch (e) {
    console.error('agenda/taxas: CRM', e.message);
    return null;
  }
}

/** { funil: { agendadas, ocorridas, realizadas, faltas } } da agenda própria. */
async function lerAgenda(env, de, ate, agora) {
  const r = await env.DB.prepare(
    `SELECT COALESCE(funil, '') AS funil,
            SUM(CASE WHEN criado_em >= ?1 AND criado_em <= ?2 THEN 1 ELSE 0 END) AS agendadas,
            SUM(CASE WHEN inicio >= ?1 AND inicio <= ?2 AND fim < ?3 AND situacao != 'cancelada' THEN 1 ELSE 0 END) AS ocorridas,
            SUM(CASE WHEN inicio >= ?1 AND inicio <= ?2 AND situacao = 'realizada' THEN 1 ELSE 0 END) AS realizadas,
            SUM(CASE WHEN inicio >= ?1 AND inicio <= ?2 AND situacao = 'faltou' THEN 1 ELSE 0 END) AS faltas
       FROM agenda_reunioes
      WHERE comercial = 1 AND is_teste = 0
      GROUP BY funil`,
  ).bind(de, ate, agora).all();
  return Object.fromEntries((r.results || [])
    .filter((x) => x.agendadas || x.ocorridas)
    .map((x) => [x.funil, { agendadas: x.agendadas, ocorridas: x.ocorridas, realizadas: x.realizadas, faltas: x.faltas }]));
}

async function recorte(env, de, ate, agora, funisComAgenda) {
  const [crm, agenda] = await Promise.all([lerCrm(env, de, ate, agora), lerAgenda(env, de, ate, agora)]);
  return { ...taxasPorFunil({ crm, agenda, funisComAgenda }), crm_lido: crm !== null };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  const agora = Math.floor(Date.now() / 1000);
  const p = url.searchParams;
  const ate = Number(p.get('to')) || agora;
  const de = Number(p.get('from')) || ate - 30 * 86400;
  const antAte = Number(p.get('antTo')) || de - 1;
  const antDe = Number(p.get('antFrom')) || antAte - (ate - de);
  // Período que já fechou não muda: o CRM é lido uma vez e a resposta fica
  // guardada (mesmo cache dos outros endpoints com período, _cache.js). O
  // período com hoje sempre lê na hora.
  const emCache = await respostaEmCache(request, { until: ate });
  if (emCache) return emCache;
  const tipos = (await env.DB.prepare('SELECT DISTINCT funil FROM agenda_tipos WHERE comercial = 1 AND funil IS NOT NULL').all()).results || [];
  const funisComAgenda = tipos.map((t) => t.funil);
  const [atual, anterior] = await Promise.all([
    recorte(env, de, ate, agora, funisComAgenda),
    recorte(env, antDe, antAte, agora, funisComAgenda),
  ]);
  return respostaJson(request, { atual, anterior }, { until: ate, context });
}
