// GET /api/agenda/taxas?key=...&from=&to=[&antFrom=&antTo=]
//
// Cada recorte traz também `crm` / `crm_total` (leads novos, MQLs e SQLs por
// funil e no total), lidos na mesma ida ao CRM, para os quadros da Visão geral
// da reunião (spec-visao-geral-reuniao-semanal.md).
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
import { reunioesAgendadas, emailsComReuniao, funisDasReunioes } from '../_reunioes-agendadas.js';
import { CORTE_CALENDLY, DURACAO_CALENDLY } from '../_agenda-regras.js';
import { ymdBrt } from '../_data-brt.js';
import { respostaEmCache, respostaJson } from '../_cache.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

/**
 * { funil_tracking: { leads_novos, mqls, sqls, mqls_com_reuniao } } a partir dos
 * blocos do relatório. sqls: cards com o campo "🏆 SQL" (série S4). mqls_com_reuniao: cards MQL do período cujo e-mail tem
 * reunião agendada desde `de` (MQL → RA por coorte, spec-reunioes-calendly.md).
 */
export async function lerCrm(env, de, ate, agora) {
  try {
    const r = resolverPeriodo({ inicio: ymdBrt(de), fim: ymdBrt(Math.min(ate, agora)) }, agora);
    if (!r.ok) return null;
    const relatorio = await montarFeedback(env, r.periodo, [], { emailsMql: true, contarSql: true, contarFaixas: true });
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
      porFunil[chave] = porFunil[chave] || { leads_novos: 0, mqls: 0, sqls: 0, mqls_com_reuniao: 0, emails: [], faixas: { abaixo: 0, acima: 0, nao_informado: 0 } };
      for (const k of Object.keys(porFunil[chave].faixas)) porFunil[chave].faixas[k] += (b.faixas && b.faixas[k]) || 0;
      porFunil[chave].leads_novos += m.novos_leads;
      porFunil[chave].mqls += m.mqls;
      porFunil[chave].sqls += b.sqls || 0;
      porFunil[chave].emails.push(...(b.emails_mql || []));
    }
    // Um card por MQL: o mesmo e-mail em dois cards conta duas vezes, como no denominador.
    const com = await emailsComReuniao(env.DB, Object.values(porFunil).flatMap((x) => x.emails), de);
    for (const x of Object.values(porFunil)) {
      x.mqls_com_reuniao = x.emails.filter((e) => e && com.has(e)).length;
      delete x.emails;
    }
    return porFunil;
  } catch (e) {
    console.error('agenda/taxas: CRM', e.message);
    return null;
  }
}

/**
 * { funil: { agendadas, ocorridas, realizadas, faltas } }. Agendadas vêm de
 * reunioesAgendadas (agenda própria + Calendly, spec-reunioes-calendly.md);
 * ocorridas, realizadas e faltas da agenda própria e, desde 19/10/2026, das
 * consultorias do Calendly com a presença marcada à mão no dash (série S4).
 */
export async function lerAgenda(env, de, ate, agora) {
  const r = await env.DB.prepare(
    `SELECT COALESCE(funil, '') AS funil,
            SUM(CASE WHEN inicio >= ?1 AND inicio <= ?2 AND fim < ?3 AND situacao != 'cancelada' THEN 1 ELSE 0 END) AS ocorridas,
            SUM(CASE WHEN inicio >= ?1 AND inicio <= ?2 AND situacao = 'realizada' THEN 1 ELSE 0 END) AS realizadas,
            SUM(CASE WHEN inicio >= ?1 AND inicio <= ?2 AND situacao = 'faltou' THEN 1 ELSE 0 END) AS faltas
       FROM agenda_reunioes
      WHERE comercial = 1 AND is_teste = 0 AND tipo_id NOT IN (SELECT id FROM agenda_tipos WHERE teste = 1)
      GROUP BY funil`,
  ).bind(de, ate, agora).all();
  const porFunil = {};
  for (const x of r.results || []) {
    if (x.ocorridas) porFunil[x.funil] = { agendadas: 0, ocorridas: x.ocorridas, realizadas: x.realizadas, faltas: x.faltas };
  }
  for (const c of await calendlyOcorridas(env.DB, de, ate, agora)) {
    porFunil[c.funil] = porFunil[c.funil] || { agendadas: 0, ocorridas: 0, realizadas: 0, faltas: 0 };
    porFunil[c.funil].ocorridas += 1;
    if (c.presenca === 'realizada') porFunil[c.funil].realizadas += 1;
    if (c.presenca === 'faltou') porFunil[c.funil].faltas += 1;
  }
  for (const { funil } of await reunioesAgendadas(env.DB, de, ate)) {
    porFunil[funil] = porFunil[funil] || { agendadas: 0, ocorridas: 0, realizadas: 0, faltas: 0 };
    porFunil[funil].agendadas += 1;
  }
  return porFunil;
}

/**
 * Números do CRM para os quadros da Visão geral da reunião (série S4): por
 * funil { leads_novos, mqls, sqls } e a soma de todos os funis. null = CRM não lido.
 */
// Níveis de qualificação só da Sessão Estratégica: o workshop não pede faturamento.
export const QUALIFICACAO_FUNIL = 'sessao-estrategica';

export function numerosDoCrm(crm) {
  if (!crm) return { crm: null, crm_total: null, qualificacao: null, qualificacao_funil: QUALIFICACAO_FUNIL };
  const porFunil = {};
  const total = { leads_novos: 0, mqls: 0, sqls: 0 };
  for (const [f, x] of Object.entries(crm)) {
    porFunil[f] = { leads_novos: x.leads_novos, mqls: x.mqls, sqls: x.sqls || 0 };
    for (const k of Object.keys(total)) total[k] += porFunil[f][k];
  }
  const fx = (crm[QUALIFICACAO_FUNIL] && crm[QUALIFICACAO_FUNIL].faixas) || { abaixo: 0, acima: 0, nao_informado: 0 };
  const qualificacao = { ...fx, total: fx.abaixo + fx.acima + fx.nao_informado };
  return { crm: porFunil, crm_total: total, qualificacao, qualificacao_funil: QUALIFICACAO_FUNIL };
}

// Consultorias do Calendly que já passaram da hora no período, com o funil do
// lead e a presença marcada (null = sem presença). Erro: nenhuma.
async function calendlyOcorridas(DB, de, ate, agora) {
  try {
    const { results } = await DB.prepare(`
      SELECT email, agendou_em, presenca FROM calendly_consultorias
       WHERE situacao = 'ativa' AND inicio >= ? AND inicio >= ? AND inicio <= ? AND COALESCE(fim, inicio + ?) < ?`,
    ).bind(CORTE_CALENDLY, de, ate, DURACAO_CALENDLY, agora).all();
    const lista = results || [];
    const funis = await funisDasReunioes(DB, lista.map((c) => ({ email: c.email, quando: c.agendou_em, funil: '' })));
    return lista.map((c, i) => ({ funil: funis[i].funil, presenca: c.presenca }));
  } catch (e) {
    console.error('agenda/taxas: Calendly', e.message);
    return [];
  }
}

async function recorte(env, de, ate, agora, funisComAgenda) {
  const [crm, agenda] = await Promise.all([lerCrm(env, de, ate, agora), lerAgenda(env, de, ate, agora)]);
  return { ...taxasPorFunil({ crm, agenda, funisComAgenda }), crm_lido: crm !== null, ...numerosDoCrm(crm) };
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
