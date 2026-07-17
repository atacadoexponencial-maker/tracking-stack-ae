// GET /api/crm-funnel?key=...&days=30 (ou from/to unix)
//
// Métricas da ponte tracking↔ClickUp (spec 2026-07-17):
//   novos × retornando × falhas (lead_dispatch, por período)
//   por_origem: novos/retornando por utm_source (join event_log→sessions)
//   por_status: distribuição atual dos leads do período pelos estágios do CRM
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const { since, until } = resolvePeriod(url, days);

  const totais = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN resultado = 'criado' THEN 1 ELSE 0 END) AS novos,
       SUM(CASE WHEN resultado = 'comentado' THEN 1 ELSE 0 END) AS retornando,
       SUM(CASE WHEN resultado = 'falha' THEN 1 ELSE 0 END) AS falhas
     FROM lead_dispatch WHERE criado_em BETWEEN ? AND ?`
  ).bind(since, until).first();

  const { results: porOrigem } = await env.DB.prepare(
    `SELECT COALESCE(s.utm_source, '(direto)') AS origem,
            SUM(CASE WHEN d.resultado = 'criado' THEN 1 ELSE 0 END) AS novos,
            SUM(CASE WHEN d.resultado = 'comentado' THEN 1 ELSE 0 END) AS retornando
     FROM lead_dispatch d
     LEFT JOIN event_log e ON e.event_id = d.event_id
     LEFT JOIN sessions s ON s.session_id = e.session_id
     WHERE d.criado_em BETWEEN ? AND ? AND d.resultado != 'falha'
     GROUP BY origem ORDER BY (novos + retornando) DESC LIMIT 20`
  ).bind(since, until).all();

  // Estágio ATUAL (último status recebido) das tarefas tocadas no período.
  const { results: porStatus } = await env.DB.prepare(
    `SELECT st.status, COUNT(DISTINCT d.task_id) AS leads
     FROM lead_dispatch d
     JOIN crm_status_log st ON st.task_id = d.task_id
       AND st.id = (SELECT MAX(id) FROM crm_status_log WHERE task_id = d.task_id)
     WHERE d.criado_em BETWEEN ? AND ? AND d.task_id IS NOT NULL
     GROUP BY st.status ORDER BY leads DESC`
  ).bind(since, until).all();

  return json({ ...totais, por_origem: porOrigem, por_status: porStatus });
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
