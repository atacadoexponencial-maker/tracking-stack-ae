// GET /api/lead-journey?key=...&email=...&external_id=...
//
// Monta a JORNADA NO SITE de um lead: a linha do tempo dos pontos de contato
// dele com o site — visitas (tabela sessions), conversões de lead (event_log)
// e compras (purchase_log) — ordenados no tempo, cada um com a sua origem.
//
// Resolução de identidade (v1, somente site):
//   - Parte do external_id informado (cookie first-party do lead clicado).
//   - Expande para todos os external_id de sessões ligadas a algum evento Lead
//     com o mesmo e-mail (capta visitas do mesmo lead em navegadores diferentes).
//   - Conversões (leads/compras) são ligadas pelo e-mail.
//
// Resposta: {
//   email, external_ids,
//   summary: { visits, leads, purchases, first_touch, last_touch },
//   touchpoints: [{ kind:'visit'|'lead'|'purchase', ts, ...campos }]
// }

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!env.DASH_KEY || key !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const email = (url.searchParams.get('email') || '').trim();
  const givenExternalId = (url.searchParams.get('external_id') || '').trim();
  const sessionId = (url.searchParams.get('session_id') || '').trim();

  if (!email && !givenExternalId && !sessionId) {
    return json({ error: 'Informe email, external_id ou session_id' }, 400);
  }

  try {
    // --- Resolução de identidade: conjunto de external_ids ---
    const externalIds = new Set();
    if (givenExternalId) externalIds.add(givenExternalId);

    if (sessionId) {
      const s = await env.DB.prepare(
        'SELECT external_id FROM sessions WHERE session_id = ?'
      ).bind(sessionId).first();
      if (s && s.external_id) externalIds.add(s.external_id);
    }

    if (email) {
      const linked = await env.DB.prepare(`
        SELECT DISTINCT s.external_id
        FROM event_log e
        JOIN sessions s ON e.session_id = s.session_id
        WHERE e.raw_email = ? AND s.external_id IS NOT NULL AND s.external_id != ''
      `).bind(email).all();
      for (const r of linked.results || []) if (r.external_id) externalIds.add(r.external_id);
    }

    const extArr = [...externalIds];

    // --- Visitas (sessions) por external_id ---
    let visits = [];
    if (extArr.length) {
      const ph = extArr.map(() => '?').join(',');
      const v = await env.DB.prepare(`
        SELECT session_id, external_id, created_at,
               utm_source, utm_medium, utm_campaign, utm_content, utm_term,
               fbclid, gclid, referrer, landing_url
        FROM sessions
        WHERE external_id IN (${ph})
        ORDER BY created_at ASC
      `).bind(...extArr).all();
      visits = v.results || [];
    }

    // --- Conversões de lead (event_log) pelo e-mail ---
    let leads = [];
    if (email) {
      const l = await env.DB.prepare(`
        SELECT event_name, timestamp, raw_email, meta_response_ok
        FROM event_log
        WHERE raw_email = ? AND lower(event_name) = 'lead'
        ORDER BY timestamp ASC
      `).bind(email).all();
      leads = l.results || [];
    }

    // --- Compras (purchase_log) pelo e-mail ---
    let purchases = [];
    if (email) {
      const p = await env.DB.prepare(`
        SELECT created_at, value, currency, product_name,
               utm_source, utm_campaign
        FROM purchase_log
        WHERE raw_email = ?
        ORDER BY created_at ASC
      `).bind(email).all();
      purchases = p.results || [];
    }

    // --- Montar e ordenar a linha do tempo ---
    const touchpoints = [];
    for (const v of visits) {
      touchpoints.push({
        kind: 'visit',
        ts: Number(v.created_at),
        utm_source: v.utm_source || '',
        utm_medium: v.utm_medium || '',
        utm_campaign: v.utm_campaign || '',
        utm_content: v.utm_content || '',
        utm_term: v.utm_term || '',
        has_fbclid: !!v.fbclid,
        has_gclid: !!v.gclid,
        referrer: v.referrer || '',
        landing_url: v.landing_url || '',
      });
    }
    for (const l of leads) {
      touchpoints.push({
        kind: 'lead',
        ts: Number(l.timestamp),
        meta_ok: l.meta_response_ok === 1,
      });
    }
    for (const p of purchases) {
      touchpoints.push({
        kind: 'purchase',
        ts: Number(p.created_at),
        value: Number(p.value || 0),
        currency: p.currency || 'BRL',
        product_name: p.product_name || '',
        utm_source: p.utm_source || '',
        utm_campaign: p.utm_campaign || '',
      });
    }
    touchpoints.sort((a, b) => a.ts - b.ts);

    return json({
      email,
      external_ids: extArr,
      summary: {
        visits: visits.length,
        leads: leads.length,
        purchases: purchases.length,
        first_touch: touchpoints.length ? touchpoints[0].ts : null,
        last_touch: touchpoints.length ? touchpoints[touchpoints.length - 1].ts : null,
      },
      touchpoints,
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
