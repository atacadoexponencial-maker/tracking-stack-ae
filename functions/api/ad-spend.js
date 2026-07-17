// GET /api/ad-spend?key=...&days=30 (ou from=<unix>&to=<unix>)
//
// Quebra por campanha da tabela `ad_spend` (sincronizada do Meta pelo
// /api/sync/meta-ads) para a seção Meta Ads do dashboard. Endpoint ADITIVO
// do redesign do /dash (issue 109) — nenhum endpoint existente foi alterado.
//
// Resposta: { rows: [{ campaign_id, campaign_name, spend, impressions,
//             clicks, cpc, cpm }], total_spend, currency }

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!env.DASH_KEY || key !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const { since, until } = resolvePeriod(url, days);
  const sinceDate = new Date(since * 1000).toISOString().slice(0, 10);
  const untilDate = new Date(until * 1000).toISOString().slice(0, 10);

  const { results } = await env.DB.prepare(
    `SELECT campaign_id, MAX(campaign_name) AS campaign_name,
            SUM(spend_cents) AS spend_cents,
            SUM(impressions) AS impressions, SUM(clicks) AS clicks,
            MAX(currency) AS currency
     FROM ad_spend
     WHERE platform = 'meta' AND date BETWEEN ? AND ?
     GROUP BY campaign_id
     ORDER BY spend_cents DESC
     LIMIT 100`
  ).bind(sinceDate, untilDate).all();

  let totalSpend = 0;
  const rows = results.map((r) => {
    totalSpend += r.spend_cents;
    return {
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name || r.campaign_id,
      spend: r.spend_cents / 100,
      impressions: r.impressions,
      clicks: r.clicks,
      cpc: r.clicks ? r.spend_cents / 100 / r.clicks : null,
      cpm: r.impressions ? (r.spend_cents / 100 / r.impressions) * 1000 : null,
    };
  });

  return json({
    rows,
    total_spend: totalSpend / 100,
    currency: results[0]?.currency || 'BRL',
  });
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
