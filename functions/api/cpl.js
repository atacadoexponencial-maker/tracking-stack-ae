// GET /api/cpl?key=...&days=30 (ou from=<unix>&to=<unix>)
//
// CPL por funil (a oferta) e por canal (a origem), mais o cruzamento dos dois.
// Todo o cálculo mora em _cpl-calculo.js; aqui só acontece I/O.
//
// Investimento vem de ad_spend (Meta). Leads vêm de event_log com o mesmo
// filtro de validade do /api/leads: não-bot, não-junk, funil efetivo.

import { calcularCpl, montarAvisosCpl } from './_cpl-calculo.js';
import { listarFunisConhecidos } from './_funil-campanha.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const { since, until } = resolvePeriod(url, days);
  const sinceDate = new Date(since * 1000).toISOString().slice(0, 10);
  const untilDate = new Date(until * 1000).toISOString().slice(0, 10);

  const [gastos, leads, overrides, funisConhecidos] = await Promise.all([
    env.DB.prepare(`
      SELECT campaign_id, MAX(campaign_name) AS campaign_name, SUM(spend_cents) AS spend_cents
      FROM ad_spend
      WHERE platform = 'meta' AND date BETWEEN ? AND ?
      GROUP BY campaign_id
    `).bind(sinceDate, untilDate).all(),

    env.DB.prepare(`
      SELECT
        COALESCE(NULLIF(e.funnel, ''), s.funnel) AS funnel,
        s.utm_source,
        s.utm_campaign,
        e.material,
        e.origin
      FROM event_log e
      LEFT JOIN sessions s ON e.session_id = s.session_id
      WHERE e.event_name = 'Lead'
        AND e.timestamp >= ? AND e.timestamp <= ?
        AND e.is_bot = 0
        AND COALESCE(e.is_junk, 0) = 0
    `).bind(since, until).all(),

    env.DB.prepare('SELECT campaign_id, funnel FROM campaign_funnel_map').all(),

    listarFunisConhecidos(env.DB),
  ]);

  const resultado = calcularCpl({
    leads: leads.results || [],
    gastos: gastos.results || [],
    overrides: overrides.results || [],
    funisConhecidos,
  });

  const avisos = montarAvisosCpl({
    por_funil: resultado.por_funil,
    gastos: gastos.results || [],
    leads: leads.results || [],
  });

  return json({ ...resultado, avisos });
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
  const since = Number.isFinite(fromTs) && fromTs > 0 ? fromTs : now - days * 86400;
  const until = Number.isFinite(toTs) && toTs > 0 ? toTs : now;
  return { since, until };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
