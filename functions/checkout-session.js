export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const clientIp =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const userAgent = request.headers.get('user-agent') || '';
    const cookies = parseCookies(request.headers.get('Cookie') || '');

    const trk = body.trk;
    if (!trk) {
      return new Response(JSON.stringify({ error: 'Missing trk' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enrich with D1 session data (server-captured fbp/fbc are more reliable)
    let sessionData = {};
    const sessionId = cookies['_krob_sid'] || '';
    if (sessionId && env.DB) {
      try {
        const row = await env.DB.prepare(
          'SELECT * FROM sessions WHERE session_id = ?'
        ).bind(sessionId).first();
        if (row) sessionData = row;
      } catch (e) {
        console.error('D1 session lookup error:', e.message);
      }
    }

    // Priority: client cookies (set by Pixel JS) → D1 session (middleware) → body fallback
    const fbp = cookies['_fbp'] || sessionData.fbp || body.fbp || '';
    const fbc = cookies['_fbc'] || sessionData.fbc || body.fbc || '';
    const externalId = cookies['_krob_eid'] || sessionData.external_id || body.external_id || '';
    const gclid = sessionData.gclid || body.gclid || '';
    const gbraid = body.gbraid || '';
    const wbraid = body.wbraid || '';
    // Extract GA4 client_id from _ga cookie (format: GA1.1.{timestamp}.{random})
    const gaCookie = cookies['_ga'] || '';
    const gaClientId = gaCookie ? gaCookie.split('.').slice(-2).join('.') : '';
    const now = Math.floor(Date.now() / 1000);

    // UTMs: o que a página mandou no body, senão os da sessão do middleware.
    // Até 13/09/2026 só o body valia — e a LP paga lê os UTMs da URL ATUAL,
    // então quem voltou à página sem eles (link salvo, histórico, retorno do
    // checkout) mandava tudo vazio, mesmo com a origem inteira guardada em
    // `sessions` pelo middleware. A venda chegava sem campanha e caía fora do
    // ROAS. A sessão é first-touch, logo o fallback devolve a origem real.
    const utmSource = body.utm_source || sessionData.utm_source || '';
    const utmMedium = body.utm_medium || sessionData.utm_medium || '';
    const utmCampaign = body.utm_campaign || sessionData.utm_campaign || '';
    const utmContent = body.utm_content || sessionData.utm_content || '';
    const utmTerm = body.utm_term || sessionData.utm_term || '';

    if (env.DB) {
      // DO NOTHING no lugar do INSERT OR REPLACE: o `trk` é gerado uma vez por
      // clique de checkout, e a página reenvia o mesmo `trk` a cada recarga.
      // O REPLACE reescrevia a linha inteira (created_at inclusive) e, pior,
      // deletava e reinseria — o webhook da Greenn que chegasse no meio
      // não achava a sessão. A primeira gravação é a que tem a atribuição
      // certa; as seguintes não trazem nada novo.
      await env.DB.prepare(`
        INSERT INTO checkout_sessions (
          trk, session_id, ip_address, user_agent, external_id,
          fbp, fbc, gclid, gbraid, wbraid, ga_client_id,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          event_source_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(trk) DO NOTHING
      `).bind(
        trk, sessionId, clientIp, userAgent, externalId,
        fbp, fbc, gclid, gbraid, wbraid, gaClientId,
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
        body.event_source_url || '', now
      ).run();
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) cookies[name.trim()] = rest.join('=');
  });
  return cookies;
}
