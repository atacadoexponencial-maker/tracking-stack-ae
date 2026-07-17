// GET /api/leads?key=...&days=30&limit=100
//
// Returns Lead events joined to their originating session so each row carries
// its UTMs / fbclid / gclid. This is the "where did my leads come from" view
// — the whole reason the tracking stack persists anything at all.
//
// Source: event_log (Lead events only) LEFT JOIN sessions via session_id.
// Bots are excluded by default; pass include_bots=1 to see them.

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!env.DASH_KEY || key !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const limit = clampInt(url.searchParams.get('limit'), 100, 1, 500);
  const includeBots = url.searchParams.get('include_bots') === '1';
  const { since, until } = resolvePeriod(url, days);

  const botClause = includeBots ? '' : 'AND e.is_bot = 0';

  // Filtro opcional de funil (não é UTM). Funil ausente = todos os funis
  // (comportamento original). A lista de funis disponíveis é devolvida em
  // `funnels` para o dashboard popular o seletor automaticamente.
  // Funil EFETIVO do lead = o declarado no evento (event_log.funnel), com
  // fallback para o da sessão (sessions.funnel) nas linhas históricas gravadas
  // antes da coluna existir. Usar o da sessão sozinho categorizava errado:
  // o funil da sessão é first-touch por cookie (400 dias) e pode vir de um
  // `&funnel=` errado na URL do anúncio. COALESCE(NULLIF(...)) trata tanto NULL
  // quanto '' (a coluna nasce com DEFAULT '').
  const EFFECTIVE_FUNNEL = "COALESCE(NULLIF(e.funnel, ''), s.funnel)";
  const funnel = (url.searchParams.get('funnel') || '').trim();
  let funnelClause = '';
  const funnelBinds = [];
  if (funnel) {
    funnelClause = `AND ${EFFECTIVE_FUNNEL} = ?`;
    funnelBinds.push(funnel);
  }

  try {
    const rows = await env.DB.prepare(`
      SELECT
        e.event_id,
        e.timestamp,
        e.session_id,
        e.raw_email,
        e.browser,
        e.os,
        e.is_mobile,
        e.is_bot,
        e.bot_reason,
        e.meta_status_code,
        e.meta_response_ok,
        e.meta_response_body,
        e.meta_payload_sent,
        e.ga4_status_code,
        e.ga4_response_ok,
        e.ga4_response_body,
        e.ga4_payload_sent,
        e.fbp_source,
        e.fbc_source,
        e.fbclid_source,
        s.utm_source,
        s.utm_medium,
        s.utm_campaign,
        s.utm_content,
        s.utm_term,
        s.fbclid,
        s.gclid,
        s.referrer,
        s.landing_url,
        ${EFFECTIVE_FUNNEL} AS funnel,
        d.resultado AS crm_resultado,
        d.task_url AS crm_task_url,
        (SELECT status FROM crm_status_log st
          WHERE st.task_id = d.task_id ORDER BY st.id DESC LIMIT 1) AS crm_status
      FROM event_log e
      LEFT JOIN sessions s ON e.session_id = s.session_id
      LEFT JOIN lead_dispatch d ON d.event_id = e.event_id
      WHERE e.event_name = 'Lead'
        AND e.timestamp >= ? AND e.timestamp <= ?
        ${botClause}
        ${funnelClause}
      ORDER BY e.timestamp DESC
      LIMIT ?
    `).bind(since, until, ...funnelBinds, limit).all();

    // Summary counts grouped by utm_source for the summary card above the table.
    const summary = await env.DB.prepare(`
      SELECT
        COALESCE(NULLIF(s.utm_source, ''), '(direct)') as utm_source,
        COUNT(*) as count
      FROM event_log e
      LEFT JOIN sessions s ON e.session_id = s.session_id
      WHERE e.event_name = 'Lead'
        AND e.timestamp >= ? AND e.timestamp <= ?
        AND e.is_bot = 0
        ${funnelClause}
      GROUP BY utm_source
      ORDER BY count DESC
    `).bind(since, until, ...funnelBinds).all();

    // Lista de funis disponíveis para o seletor do dashboard. Independente do
    // período e do filtro atual, para o dropdown ficar estável (não some uma
    // opção ao trocar a data). Apenas funis efetivamente capturados.
    const funnels = await env.DB.prepare(`
      SELECT DISTINCT ${EFFECTIVE_FUNNEL} as funnel
      FROM event_log e
      LEFT JOIN sessions s ON e.session_id = s.session_id
      WHERE e.event_name = 'Lead'
        AND e.is_bot = 0
        AND ${EFFECTIVE_FUNNEL} IS NOT NULL AND ${EFFECTIVE_FUNNEL} != ''
      ORDER BY funnel
    `).all();

    // Contagem de leads por funil no período, para o bloco "Leads por funil" do
    // dashboard. Respeita o período (since/until) e exclui bots, mas IGNORA o
    // filtro &funnel= de propósito: a ideia é ver a distribuição entre todos os
    // funis. Inclui o bucket sem funil ('') para a soma fechar com o KPI total.
    const funnelCounts = await env.DB.prepare(`
      SELECT COALESCE(${EFFECTIVE_FUNNEL}, '') as funnel, COUNT(*) as count
      FROM event_log e
      LEFT JOIN sessions s ON e.session_id = s.session_id
      WHERE e.event_name = 'Lead'
        AND e.timestamp >= ? AND e.timestamp <= ?
        AND e.is_bot = 0
      GROUP BY COALESCE(${EFFECTIVE_FUNNEL}, '')
      ORDER BY count DESC
    `).bind(since, until).all();

    return json({
      days,
      funnel: funnel || null,
      funnels: (funnels.results || []).map(r => r.funnel),
      funnelCounts: (funnelCounts.results || []).map(r => ({ funnel: r.funnel, count: r.count })),
      leads: rows.results || [],
      summary: summary.results || [],
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
