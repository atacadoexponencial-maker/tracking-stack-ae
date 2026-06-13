// GET /api/revenue?key=...&days=30
// Returns: { gross, sales, aov, currency, time_series: [{date, revenue, sales}] }
// Source: purchase_log (one row per successful purchase)

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!env.DASH_KEY || key !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  // Período: intervalo explícito (from/to em unix) tem prioridade; senão, últimos `days`.
  const { since, until } = resolvePeriod(url, days);

  try {
    const totals = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(value), 0) as gross,
        COUNT(*) as sales,
        COALESCE(AVG(value), 0) as aov,
        COALESCE(MAX(currency), 'BRL') as currency
      FROM purchase_log
      WHERE created_at >= ? AND created_at <= ?
    `).bind(since, until).first();

    const series = await env.DB.prepare(`
      SELECT
        date(created_at, 'unixepoch') as date,
        COALESCE(SUM(value), 0) as revenue,
        COUNT(*) as sales
      FROM purchase_log
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY date(created_at, 'unixepoch')
      ORDER BY date ASC
    `).bind(since, until).all();

    return json({
      gross: Number(totals?.gross || 0),
      sales: Number(totals?.sales || 0),
      aov: Number(totals?.aov || 0),
      currency: totals?.currency || 'BRL',
      days,
      time_series: series.results || [],
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw || '', 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// Resolve o período da consulta: intervalo explícito from/to (unix) tem
// prioridade; na ausência, cai para os últimos `days`. `until` default = agora.
function resolvePeriod(url, days) {
  const now = Math.floor(Date.now() / 1000);
  const fromTs = parseInt(url.searchParams.get('from') || '', 10);
  const toTs = parseInt(url.searchParams.get('to') || '', 10);
  const since = Number.isFinite(fromTs) && fromTs > 0 ? fromTs : now - days * 86400;
  const until = Number.isFinite(toTs) && toTs > 0 ? toTs : now;
  return { since, until };
}
