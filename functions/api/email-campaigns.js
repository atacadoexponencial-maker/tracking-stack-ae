// GET /api/email-campaigns?key=...&days=30 (ou from=<unix>&to=<unix>)
//
// Desempenho por campanha de email do GoHighLevel para a aba Email do dash.
// Lê SÓ do D1 (`email_campaign_stats`, alimentada pelo /api/sync/ghl-email) —
// não toca o GHL no caminho da requisição. Filtra por data de envio (sent_at).
//
// Taxas (mesmo denominador do GHL): abertura/clique sobre entregues, bounce
// sobre enviados. delivered/sent = 0 → taxa nula (evita divisão por zero).
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const { since, until } = resolvePeriod(url, days);
  // sent_at é ISO 8601 em UTC → comparação lexicográfica bate com a ordem temporal.
  const desdeISO = new Date(since * 1000).toISOString();
  const ateISO = new Date(until * 1000).toISOString();

  const { results } = await env.DB.prepare(
    `SELECT source_id, name, subject, from_email, sent_at,
            sent, delivered, opened, clicked, bounced, unsubscribed
     FROM email_campaign_stats
     WHERE sent_at >= ? AND sent_at <= ?
     ORDER BY sent_at DESC
     LIMIT 200`
  ).bind(desdeISO, ateISO).all();

  const rows = (results || []).map((r) => ({
    source_id: r.source_id,
    name: r.name,
    subject: r.subject,
    sent_at: r.sent_at,
    sent: r.sent,
    delivered: r.delivered,
    opened: r.opened,
    clicked: r.clicked,
    bounced: r.bounced,
    unsubscribed: r.unsubscribed,
    open_rate: r.delivered ? (r.opened / r.delivered) * 100 : null,
    click_rate: r.delivered ? (r.clicked / r.delivered) * 100 : null,
    bounce_rate: r.sent ? (r.bounced / r.sent) * 100 : null,
  }));

  const last = await env.DB.prepare(
    `SELECT MAX(synced_at) AS ultimo FROM email_campaign_stats`
  ).first();

  return json({ rows, last_synced_at: last?.ultimo || null });
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
