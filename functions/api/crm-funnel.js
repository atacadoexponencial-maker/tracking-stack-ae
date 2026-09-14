// GET /api/crm-funnel?key=...&days=30 (ou from/to unix)
//
// Métricas da ponte tracking↔ClickUp (spec 2026-07-17):
//   novos × retornando × falhas (lead_dispatch, por período)
//   por_origem: novos/retornando por utm_source (join event_log→sessions)
//   por_status: distribuição atual dos leads do período pelos estágios do CRM
//
// Todas as contagens excluem leads de teste (is_junk = 1, migration 0022) e bots
// (is_bot = 1), pelo mesmo critério de /api/leads — senão este card diverge da
// lista de leads. O event_log entra como LEFT JOIN, então COALESCE(...,0) garante
// que um lead_dispatch sem evento correspondente não seja descartado: só os
// testes/bots conhecidos saem da conta.
//
// O período é medido pelo `event_log.timestamp` (quando a pessoa virou lead), NÃO
// pelo `lead_dispatch.criado_em` (quando o card foi tocado no ClickUp). Os dois
// são o mesmo segundo para leads do site, mas divergem nos leads do formulário
// nativo do Meta, que chegam pelo coletor até 15 min depois — e chegaram com ~29h
// de atraso no backfill de 28/07, jogando 2 retornos do dia 27 para o dia 28 e
// fazendo este card mostrar 7 contra os 5 da lista de leads. `criado_em` fica como
// fallback para os dispatches sem evento (ex.: workshop direto).
//
// O fallback é escrito como `(e.timestamp BETWEEN ...) OR (e.id IS NULL AND
// d.criado_em BETWEEN ...)` e NÃO como `COALESCE(e.timestamp, d.criado_em)
// BETWEEN ...` (revisão de 13/09/2026): o COALESCE esconde a coluna do
// otimizador e obriga a varrer lead_dispatch inteiro a cada abertura; a forma
// aberta deixa o SQLite usar idx_event_log_timestamp / idx_lead_dispatch_criado.
// Resultado idêntico — é a mesma condição, só que legível pelo índice.
//
// Totais por PESSOA (COUNT DISTINCT task_id), não por envio: quem volta três
// vezes no período gera três `comentado` no mesmo card, e a contagem por linha
// dizia "3 retornando" para 1 lead. Falha não tem task_id, então segue por linha.

import { clausulasBotIpSql } from '../_bots.js';
import { respostaJson, respostaEmCache } from './_cache.js';

// Recorte de período compartilhado pelas três consultas (4 binds: since, until,
// since, until).
const PERIODO = `((e.timestamp BETWEEN ? AND ?) OR (e.id IS NULL AND d.criado_em BETWEEN ? AND ?))`;

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const { since, until } = resolvePeriod(url, days);

  // Período fechado já respondido antes? Sai sem tocar no D1 (ver _cache.js).
  const emCache = await respostaEmCache(request, { until });
  if (emCache) return emCache;

  const bindsPeriodo = [since, until, since, until];

  const totais = await env.DB.prepare(
    `SELECT
       COUNT(DISTINCT CASE WHEN d.resultado = 'criado' THEN d.task_id END) AS novos,
       COUNT(DISTINCT CASE WHEN d.resultado = 'comentado' THEN d.task_id END) AS retornando,
       SUM(CASE WHEN d.resultado = 'falha' THEN 1 ELSE 0 END) AS falhas
     FROM lead_dispatch d
     LEFT JOIN event_log e ON e.event_id = d.event_id
     WHERE ${PERIODO}
       AND COALESCE(e.is_junk, 0) = 0 AND COALESCE(e.is_bot, 0) = 0`
  ).bind(...bindsPeriodo).first();

  // A sessão entra no JOIN para a origem; já que está aqui, o corte por IP de
  // bot (_bots.js) sai de graça. O COALESCE dentro da cláusula mantém o
  // dispatch sem sessão (LEFT JOIN) — só o IP conhecido de bot cai.
  const { results: porOrigem } = await env.DB.prepare(
    `SELECT COALESCE(s.utm_source, '(direto)') AS origem,
            COUNT(DISTINCT CASE WHEN d.resultado = 'criado' THEN d.task_id END) AS novos,
            COUNT(DISTINCT CASE WHEN d.resultado = 'comentado' THEN d.task_id END) AS retornando
     FROM lead_dispatch d
     LEFT JOIN event_log e ON e.event_id = d.event_id
     LEFT JOIN sessions s ON s.session_id = e.session_id
     WHERE ${PERIODO} AND d.resultado != 'falha'
       AND COALESCE(e.is_junk, 0) = 0 AND COALESCE(e.is_bot, 0) = 0
       ${clausulasBotIpSql('s')}
     GROUP BY origem ORDER BY (novos + retornando) DESC LIMIT 20`
  ).bind(...bindsPeriodo).all();

  // Estágio ATUAL das tarefas tocadas no período. "Atual" = a mudança de
  // estágio mais recente pelo relógio do ClickUp (`hist_date`, unix em
  // segundos, migration 0037), não pela ordem de chegada do webhook: o ClickUp
  // retenta e não garante ordem. Linhas anteriores à migration têm hist_date
  // NULL → caem para `recebido_em` (mesma unidade), com `id` de desempate.
  // A subconsulta filtra por task_id (índice idx_crm_status_task) e ordena só
  // as poucas linhas daquela task — não varre a tabela.
  const { results: porStatus } = await env.DB.prepare(
    `SELECT st.status, COUNT(DISTINCT d.task_id) AS leads
     FROM lead_dispatch d
     JOIN crm_status_log st ON st.task_id = d.task_id
       AND st.id = (SELECT id FROM crm_status_log
                     WHERE task_id = d.task_id
                     ORDER BY COALESCE(hist_date, recebido_em) DESC, id DESC LIMIT 1)
     LEFT JOIN event_log e ON e.event_id = d.event_id
     WHERE ${PERIODO} AND d.task_id IS NOT NULL
       AND COALESCE(e.is_junk, 0) = 0 AND COALESCE(e.is_bot, 0) = 0
     GROUP BY st.status ORDER BY leads DESC`
  ).bind(...bindsPeriodo).all();

  return respostaJson(request, { ...totais, por_origem: porOrigem, por_status: porStatus }, { until, context });
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw || '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function resolvePeriod(url, days) {
  const now = Math.floor(Date.now() / 1000);
  const fromTs = parseInt(url.searchParams.get('from') || '', 10);
  const toTs = parseInt(url.searchParams.get('to') || '', 10);
  return {
    since: Number.isFinite(fromTs) && fromTs > 0 ? fromTs : now - days * 86400,
    until: Number.isFinite(toTs) && toTs > 0 ? toTs : now,
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
