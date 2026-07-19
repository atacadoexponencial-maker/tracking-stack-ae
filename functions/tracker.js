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
    const userData = body.user_data || {};

    // --- Session enrichment from D1 ---
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

    // --- Resolve fbp/fbc with fallback chain ---
    const fbp = validateFbCookie(userData.fbp) || validateFbCookie(cookies['_fbp']) || validateFbCookie(sessionData.fbp) || '';
    const fbc = validateFbCookie(sessionData.fbc) || validateFbCookie(cookies['_fbc']) || validateFbCookie(userData.fbc) || '';
    const externalId = userData.external_id || cookies['_krob_eid'] || sessionData.external_id || '';

    // Track sources for analytics
    const fbpSource = userData.fbp ? 'pixel_js'
      : (cookies['_fbp'] ? 'middleware_http'
        : (sessionData.fbp ? 'tracker_http' : 'none'));
    const fbcSource = sessionData.fbc ? 'middleware_http'
      : (cookies['_fbc'] ? 'middleware_http'
        : (userData.fbc ? 'pixel_js' : 'none'));
    const fbclidSource = sessionData.fbclid ? 'server_middleware'
      : (userData.fbc ? 'client_url' : 'none');
    const pixelWasBlocked = (!userData.fbp && !userData.fbc) ? 1 : 0;

    // --- GA4 cookie parsing (READ ONLY) ---
    const gaClientIdFromCookie = extractGA4ClientId(cookies['_ga'] || '');
    const gaClientId = gaClientIdFromCookie
      || userData.ga_client_id
      || `${Date.now()}.${Math.floor(Math.random() * 1000000000)}`;
    const gaClientIdFallback = (!gaClientIdFromCookie && !userData.ga_client_id) ? 1 : 0;

    const gaSessionId = extractGA4SessionId(cookies) || body.event_time?.toString() || '';
    const gaCookiePresent = cookies['_ga'] ? 1 : 0;

    // --- PII normalization + SHA-256 hashing ---
    async function sha256(value) {
      if (!value) return '';
      const normalized = value.toLowerCase().trim();
      const encoded = new TextEncoder().encode(normalized);
      const buffer = await crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    // Meta CAPI expects phone digits INCLUDING country code + area code
    // (ex: `16505554444` or `5511987654321`). Users typing their own
    // number into a lead form almost never include the country code, so
    // we prepend a default. `countryCode` defaults to 55 (Brazil);
    // recipients elsewhere set `env.DEFAULT_COUNTRY_CODE` — see the
    // "decisions the recipient must make" table in CLAUDE.md.
    //
    // Detection is length-based and best-effort. A recipient whose
    // audience mixes country codes (rare for the target audience) gets
    // marginal mismatches; fixing that requires a real phone-parsing
    // library which is too heavy for an edge worker.
    function normalizePhone(ph, countryCode) {
      if (!ph) return '';
      const cc = String(countryCode || '55');
      const digits = ph.replace(/\D/g, '').replace(/^0+/, '');
      if (!digits) return '';
      // Already starts with the configured country code at a plausible
      // total length → leave as-is.
      if (digits.startsWith(cc) && digits.length >= cc.length + 8 && digits.length <= cc.length + 11) {
        return digits;
      }
      // Plausibly a locally-formatted number (no country code yet) → prepend.
      if (digits.length >= 8 && digits.length <= 11) {
        return cc + digits;
      }
      // Any other length (likely an already-international foreign number
      // whose country code isn't our default) → leave untouched.
      return digits;
    }

    // Meta Advanced Matching spec for fn/ln is lowercase only — do NOT
    // strip punctuation/accents. Meta's graph preserves apostrophes,
    // hyphens, and diacritics; stripping them breaks hash matches for
    // names like "O'Brien", "Garcia-Rodriguez", "João".
    function normalizeName(name) {
      if (!name) return '';
      return name.trim().toLowerCase();
    }

    const hashedEm = await sha256(userData.em);
    const hashedFn = await sha256(normalizeName(userData.fn));
    const hashedLn = await sha256(normalizeName(userData.ln));
    const hashedPh = await sha256(normalizePhone(userData.ph, env.DEFAULT_COUNTRY_CODE));
    const hashedExternalId = await sha256(externalId);

    // --- Bot detection ---
    const { isBot, botReason } = detectBot(userAgent);

    // --- Fan out to ad platforms (skipped for bot UAs) ---
    // Bots still get logged to event_log so the dashboard's bot-filter
    // tracking-health metric stays accurate; only the outbound CAPI /
    // GA4 fires are suppressed. Without this gate, every link-unfurl
    // crawl (WhatsApp preview, Slackbot, facebookexternalhit, etc.)
    // would burn a Meta CAPI event and pollute the Pixel.
    // Funil efetivo do evento (mesma regra do dashboard): o funil declarado pelo
    // formulário NESTE evento tem prioridade; cai para o funil da sessão.
    const eventFunnel = ((body.lead_data && body.lead_data.funnel) || '').toLowerCase().trim();
    const effectiveFunnel = eventFunnel || (sessionData.funnel || '');

    // Pixel 2 (conta de anúncios nova, em migração): recebe só PageView e Lead.
    // Fica ativo apenas enquanto META_PIXEL_ID_2/META_ACCESS_TOKEN_2 existirem
    // no env — remover as vars desliga sem mexer no código.
    const eventNameLc = (body.event_name || '').toLowerCase();
    const pixel2Eligible = eventNameLc === 'pageview' || eventNameLc === 'lead';

    const results = isBot ? [] : await Promise.allSettled([
      sendToMeta({ body, clientIp, userAgent, fbp, fbc, hashedEm, hashedFn, hashedLn, hashedPh, hashedExternalId, sessionData, env, pixelId: env.META_PIXEL_ID, accessToken: env.META_ACCESS_TOKEN }),
      sendToGA4({ body, gaClientId, gaSessionId, hashedEm, sessionData, funnel: effectiveFunnel, env }),
      pixel2Eligible
        ? sendToMeta({ body, clientIp, userAgent, fbp, fbc, hashedEm, hashedFn, hashedLn, hashedPh, hashedExternalId, sessionData, env, pixelId: env.META_PIXEL_ID_2, accessToken: env.META_ACCESS_TOKEN_2 })
        : Promise.resolve({ skipped: 'pixel2: evento fora do escopo', payload: null, response: null }),
    ]);

    // --- Parse Meta result ---
    let metaStatusCode = 0, metaResponseOk = 0, metaResponseBody = '', metaPayloadSent = null;
    if (results[0]?.status === 'fulfilled' && results[0].value) {
      const v = results[0].value;
      metaPayloadSent = v.payload;
      if (v.skipped) {
        metaResponseBody = `skipped: ${v.skipped}`;
      } else if (v.response) {
        metaStatusCode = v.response.status;
        metaResponseOk = v.response.ok ? 1 : 0;
        try { metaResponseBody = await v.response.text(); } catch (e) { metaResponseBody = `Read error: ${e.message}`; }
      }
    } else if (results[0]?.status === 'rejected') {
      metaResponseBody = `Fetch error: ${results[0].reason?.message || 'unknown'}`;
    }

    // --- Parse GA4 result ---
    let ga4StatusCode = 0, ga4ResponseOk = 0, ga4ResponseBody = '', ga4PayloadSent = null;
    if (results[1]?.status === 'fulfilled' && results[1].value) {
      const v = results[1].value;
      ga4PayloadSent = v.payload;
      if (v.skipped) {
        ga4ResponseBody = `skipped: ${v.skipped}`;
      } else if (v.response) {
        ga4StatusCode = v.response.status;
        ga4ResponseOk = v.response.ok ? 1 : 0;
        try { ga4ResponseBody = await v.response.text(); } catch (e) { ga4ResponseBody = `Read error: ${e.message}`; }
      }
    } else if (results[1]?.status === 'rejected') {
      ga4ResponseBody = `Fetch error: ${results[1].reason?.message || 'unknown'}`;
    }

    // --- Parse Meta pixel 2 result (não vai ao D1; só alimenta o alerta) ---
    let meta2StatusCode = 0, meta2ResponseOk = 0, meta2ResponseBody = '';
    if (results[2]?.status === 'fulfilled' && results[2].value) {
      const v = results[2].value;
      if (v.skipped) {
        meta2ResponseBody = `skipped: ${v.skipped}`;
        // Skip não é falha para o pixel 2: evento fora do escopo, ou vars _2
        // ausentes (= integração desligada de propósito, ao contrário do pixel 1
        // onde env sumido é morte silenciosa e alerta).
        meta2ResponseOk = 1;
      } else if (v.response) {
        meta2StatusCode = v.response.status;
        meta2ResponseOk = v.response.ok ? 1 : 0;
        try { meta2ResponseBody = await v.response.text(); } catch (e) { meta2ResponseBody = `Read error: ${e.message}`; }
      }
    } else if (results[2]?.status === 'rejected') {
      meta2ResponseBody = `Fetch error: ${results[2].reason?.message || 'unknown'}`;
    }

    // --- Alerta crítico (camada A): Meta recusou uma conversão real ---
    // Em waitUntil próprio para não atrasar a resposta ao navegador. A regra
    // (só lead/purchase, não-bot, throttle 1h) fica em maybeAlertMetaFailure.
    // Pixel 2 tem chave de throttle própria para uma falha não silenciar a outra.
    context.waitUntil(maybeAlertMetaFailure({
      eventName: body.event_name, isBot, metaResponseOk, metaStatusCode, metaResponseBody, env,
    }));
    context.waitUntil(maybeAlertMetaFailure({
      eventName: body.event_name, isBot, metaResponseOk: meta2ResponseOk, metaStatusCode: meta2StatusCode, metaResponseBody: meta2ResponseBody, env,
      throttleKey: 'meta_capi_2', label: 'Meta CAPI (pixel 2)',
    }));

    // --- Encaminhar lead ao CRM (fan-out desacoplado; destino trocável) ---
    // O site fala apenas com /tracker. O destino do CRM (n8n hoje, que leva
    // ao ClickUp) vem de env e pode ser trocado/removido sem alterar o front.
    // Cada funil tem seu próprio webhook: 'workshop' usa um, o diagnóstico o
    // padrão. Só dispara para eventos de Lead, em background.
    if ((body.event_name || '').toLowerCase() === 'lead') {
      // ClickUp DIRETO na API (sem n8n) para TODOS os funis — inclusive
      // 'workshop', que antes ia a um workflow n8n hoje desativado (leads se
      // perdiam; ver spec ponte-tracking-clickup). sendToClickUp faz
      // busca→cria/comenta, retry, log em D1 (lead_dispatch) + alerta.
      context.waitUntil(sendToClickUp({
        leadData: body.lead_data || {}, sessionData, env,
        eventId: body.event_id || '',
      }));

      // Demais destinos desacoplados (inalterados): CRM Supabase + barramento
      // WhatsApp (n8n). Cada um dispara independente; se um falhar, os outros seguem.
      const crmDestinations = [
        { url: env.LEAD_WEBHOOK_URL_CRM, token: env.LEAD_WEBHOOK_TOKEN_CRM, label: 'Supabase/CRM' },
        // Barramento de leads (n8n → WhatsApp): recebe TODOS os leads; a decisão
        // de qual funil dispara WhatsApp fica 100% no n8n (Switch por funnel).
        { url: env.LEAD_WEBHOOK_URL_WHATSAPP, token: env.LEAD_WEBHOOK_TOKEN_WHATSAPP, label: 'WhatsApp barramento' },
      ];
      for (const dest of crmDestinations) {
        if (!dest.url) continue;
        context.waitUntil(sendToCRM({
          leadData: body.lead_data || {},
          sessionData, fbc, externalId,
          url: dest.url, token: dest.token,
          label: dest.label, env,
        }));
      }

      // Persiste o funil declarado pela LP em sessions.funnel — é a fonte do
      // filtro de funil no dashboard. A sessão já existe (criada pelo middleware
      // no pageview). Só preenche se ainda estiver vazio: preserva o first-touch
      // de um eventual ?funnel= já capturado e não sobrescreve em re-submits.
      const declaredFunnel = ((body.lead_data && body.lead_data.funnel) || '').toLowerCase().trim();
      if (declaredFunnel && sessionId && env.DB) {
        context.waitUntil((async () => {
          try {
            await env.DB.prepare(
              `UPDATE sessions SET funnel = CASE WHEN funnel IS NULL OR funnel = '' THEN ? ELSE funnel END WHERE session_id = ?`
            ).bind(declaredFunnel, sessionId).run();
          } catch (e) {
            console.error('Funnel persist error:', e.message);
          }
        })());
      }
    }

    const rawEmail = userData.em || '';

    // --- Log to D1 (background) ---
    // Skip PageView: conversions fire regardless of this log, and the health
    // dashboard only reports Lead/Purchase. Dropping PageView cuts ~70% of
    // event_log writes so per-instance D1 stays healthy long-term.
    const loggedEventName = (body.event_name || '').toLowerCase();
    const shouldLogEvent = loggedEventName !== 'pageview' && loggedEventName !== 'page_view';
    const browserInfo = parseBrowser(userAgent);
    // Funil declarado pelo formulário NESTE evento (não o da sessão). É o que o
    // dashboard usa para categorizar o lead — imune a `&funnel=` errado na URL
    // do anúncio ou a cookie reaproveitado entre funis. Vazio em eventos sem
    // lead_data (ex.: InitiateCheckout).
    const loggedFunnel = ((body.lead_data && body.lead_data.funnel) || '').toLowerCase().trim();
    context.waitUntil(
      (async () => {
        try {
          if (env.DB && shouldLogEvent) {
            await env.DB.prepare(`
              INSERT INTO event_log (
                session_id, event_name, event_id, timestamp,
                browser, browser_version, os, is_mobile,
                pixel_was_blocked, fbp_source, fbc_source, fbclid_source,
                ga_cookie_present, ga_client_id_fallback, itp_cookie_extended,
                is_bot, bot_reason, consent_status,
                sent_to_meta, meta_status_code, meta_response_ok, meta_response_body, meta_payload_sent,
                sent_to_ga4, ga4_status_code, ga4_response_ok, ga4_response_body, ga4_payload_sent,
                has_email, has_phone, has_name,
                raw_email, funnel
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              sessionId, body.event_name, body.event_id, body.event_time,
              browserInfo.browser, browserInfo.version, browserInfo.os, browserInfo.isMobile ? 1 : 0,
              pixelWasBlocked, fbpSource, fbcSource, fbclidSource,
              gaCookiePresent, gaClientIdFallback, fbpSource === 'middleware_http' ? 1 : 0,
              isBot ? 1 : 0, botReason, body.consent_status || 'unknown',
              isBot ? 0 : 1, metaStatusCode, metaResponseOk, metaResponseBody, metaPayloadSent ?? null,
              isBot ? 0 : 1, ga4StatusCode, ga4ResponseOk, ga4ResponseBody, ga4PayloadSent ?? null,
              hashedEm ? 1 : 0, hashedPh ? 1 : 0, (hashedFn || hashedLn) ? 1 : 0,
              rawEmail, loggedFunnel
            ).run();
          }
        } catch (e) {
          console.error('D1 log error:', e.message);
        }
      })()
    );

    // --- Roteamento pós-captação (regra de negócio, no backend) ---
    // Funil 'workshop' segue para a página do vídeo do workshop. A live semanal
    // ('lives-semanais-v1') manda o inscrito direto ao grupo de WhatsApp da live
    // (env LEAD_REDIRECT_LIVE). O funil 'trafego-atacado' roteia pela faixa de
    // investimento em tráfego (issue 72): até R$ 1.500/mês vai ao WhatsApp
    // do time (mensagem própria); as demais faixas vão ao Calendly do serviço,
    // independente do faturamento (issue 70). No diagnóstico, leads de baixo
    // faturamento ("Menos de 20 Mil") vão ao WhatsApp dos especialistas; os
    // demais ao agendamento (Calendly).
    // Destinos por env. O front só executa o redirect.
    let leadRedirect = null;
    const leadFunnel = ((body.lead_data && body.lead_data.funnel) || 'diagnostico').toLowerCase();
    if ((body.event_name || '').toLowerCase() === 'lead') {
      if (leadFunnel === 'workshop') {
        leadRedirect = env.LEAD_REDIRECT_WORKSHOP || '/video-workshop-instagram';
      } else if (leadFunnel === 'lives-semanais-v1') {
        leadRedirect = env.LEAD_REDIRECT_LIVE || '/obrigada';
      } else if (leadFunnel === 'trafego-atacado') {
        // Roteia pelo texto da faixa (mesmo padrão do faturamento abaixo).
        // Investimento vazio cai no Calendly — não perde lead qualificado.
        const investimento = (body.lead_data?.investimento || '').toLowerCase();
        const baixoInvestimento =
          investimento.includes('não invisto') || investimento.includes('até r$ 1.500');
        leadRedirect = baixoInvestimento
          ? (env.LEAD_REDIRECT_WHATSAPP_TRAFEGO || env.LEAD_REDIRECT_WHATSAPP || '')
          : (env.LEAD_REDIRECT_CALENDLY_TRAFEGO || 'https://calendly.com/gruposete/aplicacao-trafego-pago');
      } else {
        const faturamento = (body.lead_data?.faturamento || '').toLowerCase();
        const baixoTicket = faturamento.includes('menos de 20');
        leadRedirect = baixoTicket
          ? (env.LEAD_REDIRECT_WHATSAPP || '')
          : (env.LEAD_REDIRECT_CALENDLY || '');
      }
    }

    return new Response(JSON.stringify({ ok: true, redirect: leadRedirect }), {
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

// -------------------------------------------------------
// META CAPI
// -------------------------------------------------------
// Recebe pixelId/accessToken explícitos para suportar múltiplos pixels
// (pixel principal e o da conta nova em migração) com a mesma função.
async function sendToMeta({ body, clientIp, userAgent, fbp, fbc, hashedEm, hashedFn, hashedLn, hashedPh, hashedExternalId, sessionData, env, pixelId, accessToken }) {
  if (!pixelId || !accessToken) {
    return { skipped: 'missing meta env', payload: null, response: null };
  }

  const metaUserData = {
    client_ip_address: clientIp,
    client_user_agent: userAgent,
  };

  if (hashedEm) metaUserData.em = [hashedEm];
  if (hashedFn) metaUserData.fn = [hashedFn];
  if (hashedLn) metaUserData.ln = [hashedLn];
  if (hashedPh) metaUserData.ph = [hashedPh];
  if (hashedExternalId) metaUserData.external_id = [hashedExternalId];
  if (fbp) metaUserData.fbp = fbp;
  if (fbc) metaUserData.fbc = fbc;

  const payload = {
    data: [{
      event_name: body.event_name,
      event_time: body.event_time,
      event_id: body.event_id,
      event_source_url: body.event_source_url || '',
      action_source: 'website',
      user_data: metaUserData,
    }],
  };

  if (env.META_TEST_EVENT_CODE) {
    payload.test_event_code = env.META_TEST_EVENT_CODE;
  }

  const payloadJson = JSON.stringify(payload);
  const response = await fetch(`https://graph.facebook.com/v25.0/${pixelId}/events?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payloadJson,
  });
  return { payload: payloadJson, response };
}

// -------------------------------------------------------
// GA4 MEASUREMENT PROTOCOL — CONVERSIONS ONLY
// -------------------------------------------------------
async function sendToGA4({ body, gaClientId, gaSessionId, hashedEm, sessionData, funnel, env }) {
  if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) {
    return { skipped: 'missing ga4 env', payload: null, response: null };
  }

  const eventName = (body.event_name || '').toLowerCase();
  if (eventName === 'pageview' || eventName === 'page_view') {
    return { skipped: 'pageview', payload: null, response: null };
  }

  const ga4EventName = eventName === 'lead' ? 'generate_lead'
    : eventName === 'purchase' ? 'purchase'
    : eventName === 'initiatecheckout' ? 'begin_checkout'
    : eventName;

  // Params base + enriquecimento com funil/UTMs para permitir breakdown por
  // criativo (utm_content) e por funil dentro do GA4. Só inclui o que existe —
  // nada de `undefined` no payload.
  const params = {
    session_id: gaSessionId,
    engagement_time_msec: 100,
    page_location: body.event_source_url || '',
  };
  const utm = sessionData || {};
  if (funnel) params.funnel = funnel;
  if (utm.utm_source) params.utm_source = utm.utm_source;
  if (utm.utm_medium) params.utm_medium = utm.utm_medium;
  if (utm.utm_campaign) params.utm_campaign = utm.utm_campaign;
  if (utm.utm_content) params.utm_content = utm.utm_content;
  if (utm.utm_term) params.utm_term = utm.utm_term;

  const payload = {
    client_id: gaClientId,
    events: [{
      name: ga4EventName,
      params,
    }],
  };

  if (hashedEm) {
    payload.user_properties = { email: { value: hashedEm } };
  }

  const payloadJson = JSON.stringify(payload);
  const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payloadJson,
  });
  return { payload: payloadJson, response };
}

// -------------------------------------------------------
// CRM FORWARD — encaminha o lead para um webhook configurável
// (hoje n8n → ClickUp). Dados crus do formulário + atribuição da sessão.
// -------------------------------------------------------
async function sendToCRM({ leadData, sessionData, fbc, externalId, url, token, label, env }) {
  try {
    const payload = {
      ...leadData,
      // UTMs também no TOPO do payload (além de dentro de `attribution`).
      // Aditivo e seguro: o ClickUp continua lendo `attribution.utm_*`; a
      // ingestão do Supabase, que espera `utm_source` na raiz, passa a achar.
      // Sem isso, os leads chegavam ao Supabase com a coluna UTM vazia mesmo
      // com o dado existindo na sessão.
      utm_source: sessionData.utm_source || '',
      utm_medium: sessionData.utm_medium || '',
      utm_campaign: sessionData.utm_campaign || '',
      utm_content: sessionData.utm_content || '',
      utm_term: sessionData.utm_term || '',
      attribution: {
        utm_source: sessionData.utm_source || '',
        utm_medium: sessionData.utm_medium || '',
        utm_campaign: sessionData.utm_campaign || '',
        utm_content: sessionData.utm_content || '',
        utm_term: sessionData.utm_term || '',
        fbclid: sessionData.fbclid || '',
        gclid: sessionData.gclid || '',
        fbc: fbc || '',
        external_id: externalId || '',
        landing_url: sessionData.landing_url || '',
        referrer: sessionData.referrer || '',
      },
    };
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['x-webhook-token'] = token;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    // Antes, um 500 do webhook passava como sucesso silencioso. Continua sem
    // travar o lead (best-effort), mas agora alerta — com throttle por destino.
    if (!response.ok) {
      console.error(`CRM forward (${label}) HTTP ${response.status}`);
      await sendThrottledAlert(
        `crm_forward:${label}`,
        `⚠️ Forward de lead p/ ${label} falhou: status ${response.status}`,
        env
      );
    }
  } catch (e) {
    console.error('CRM forward error:', e.message);
    await sendThrottledAlert(
      `crm_forward:${label}`,
      `⚠️ Forward de lead p/ ${label} falhou: ${e.message || e}`,
      env
    );
  }
}

// -------------------------------------------------------
// CLICKUP — cria/atualiza o lead DIRETO na API (substitui o n8n)
// Fluxo: normaliza telefone → busca task por telefone OU email → se existe,
// muda status + comenta; se não, cria com os custom fields. Escritas com 1
// retry; falha persistente grava em D1 clickup_sync_failures + alerta WhatsApp.
// Notifica o comercial (Evolution API) em ambos os casos. Tudo best-effort:
// roda em waitUntil e nunca trava a resposta do /tracker.
// -------------------------------------------------------
const CLICKUP_API = 'https://api.clickup.com/api/v2';

// IDs dos custom fields da lista (🤑 CRM). Ver spec 2026-07-02.
const CU_FIELD = {
  nome: '7f70363f-9fc4-4d34-aab1-0a81d4a6f45d',
  email: '24f5a3d3-e21e-4e08-b396-8a4ce2133a98',
  instagram: '3f24aa2d-050f-4be2-ab63-09b91307919b',
  faturamento: '97d8308d-d6b2-4dd6-9bd7-76f6662d5de2',
  whatsapp: '754a41c9-2835-48d5-a70e-8b61841e0037',
  justificativa: 'bc6b9579-de7c-4256-b649-b99d95132fa4',
  objetivo: '64e17f77-689c-487a-b8f3-8878df137a27',
  cargo: '150014bc-01ca-466f-90b6-9711ec19408e',
  investimento: '1e87bc05-95ba-444c-a728-eddf5fb603de', // 💵 Investimento em Tráfego (short_text)
  funil: 'a663b002-661c-4dc1-86c3-612e94f3a447',
  produto: '6fd27248-beb5-49e1-9626-f1ab7ed81e5a',
  utmSource: '64ffa839-dac1-4995-9cbb-7bd50f9dc5d5',
  utmMedium: 'e367ce2e-a06c-43b6-ac9b-0feb4923f007',
  utmContent: '5710cb4d-a375-464b-8ac6-5267745eaddc',
  utmCampaign: '78b59aa4-6e98-4555-bbbf-5a0259309eb0', // "utm_campaing" (nome com typo na lista)
};
const CU_DEFAULT_LIST = '205126080'; // 🤑 CRM — fallback se CLICKUP_LIST_ID não estiver setado
const CU_PRODUTO_AE = '6cf677ce-5592-4ff7-9f63-d18d52d42be5';
const CU_PRODUTO_ACELERACAO = '5a98b2d7-bfe0-4c29-9de4-2c15721bd9a7'; // ACELERAÇÃO
const CU_FUNIL_SESSAO = 'a158d342-c1ac-4705-a6da-ce39019f0a2a'; // SESSÃO ESTRATÉGICA
const CU_FUNIL_LIVES = 'e6893b0b-5a69-4f48-9c99-a3c0a415a118';  // LIVES SEMANAIS
const CU_FUNIL_APLICACAO = '51f77888-2ba1-4f83-9b33-d8ef516b80be'; // APLICAÇÃO
const CU_FUNIL_WORKSHOP = 'b5e04cdb-f62d-4159-b89b-751726a61831'; // WORKSHOP
const CU_FUNIL_TRAFEGO = 'f88ef3e2-2928-439b-83ad-c7ff55083f60'; // TRAFEGO PAGO

// Funil do site → opção do dropdown 🔻 Funil. Fallback SESSÃO ESTRATÉGICA
// (preserva o comportamento do n8n, que carimbava tudo como SE).
function mapFunnelToOption(funnel) {
  const f = (funnel || '').toLowerCase();
  if (f === 'lives-semanais-v1') return CU_FUNIL_LIVES;
  if (f === 'trafego-atacado') return CU_FUNIL_TRAFEGO; // APLICAÇÃO ficou exclusiva da mentoria
  if (f === 'workshop') return CU_FUNIL_WORKSHOP;
  return CU_FUNIL_SESSAO;
}

// Funil do site → opção do dropdown 🛒 Produto. O serviço de gestão de
// tráfego é ACELERAÇÃO; os demais funis seguem no default AE (issue 70).
function mapProdutoToOption(funnel) {
  return (funnel || '').toLowerCase() === 'trafego-atacado' ? CU_PRODUTO_ACELERACAO : CU_PRODUTO_AE;
}

// Mesma normalização do n8n: dígitos, sem zeros à esquerda, prefixa 55, com '+'.
function toClickUpPhone(ph) {
  const digits = (ph || '').toString().replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  return '+' + (digits.startsWith('55') ? digits : '55' + digits);
}

function clickupFetch(path, options, env) {
  return fetch(`${CLICKUP_API}${path}`, {
    ...options,
    headers: {
      Authorization: env.CLICKUP_API_TOKEN,
      'Content-Type': 'application/json',
      ...(options && options.headers),
    },
  });
}

// Busca uma task na lista pelo custom field (telefone ou email). Read-only:
// o chamador trata falha como "não achou" — nunca pode travar o lead.
async function searchClickUpTask(fieldId, value, env) {
  if (!value) return null;
  const cf = encodeURIComponent(JSON.stringify([{ field_id: fieldId, operator: '=', value }]));
  const listId = env.CLICKUP_LIST_ID || CU_DEFAULT_LIST;
  const res = await clickupFetch(`/list/${listId}/task?custom_fields=${cf}`, { method: 'GET' }, env);
  if (!res.ok) throw new Error(`ClickUp search ${res.status}`);
  const data = await res.json();
  return (data.tasks && data.tasks[0]) || null;
}

// Executa uma chamada de escrita com 1 retry em erro transitório
// (429 / 5xx / erro de rede). Erros não-transitórios (ex.: 401) não repetem.
async function clickupWrite(fn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res, netErr;
    try { res = await fn(); } catch (e) { netErr = e; }
    if (!netErr && res.ok) return res;
    const status = res ? res.status : 0;
    const retriable = !!netErr || status === 429 || status >= 500;
    if (retriable && attempt === 1) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    // Anexa o status HTTP no erro pra quem chama poder reagir (ex.: fallback no 400).
    throw netErr || Object.assign(new Error(`ClickUp write ${status}`), { status });
  }
}

// Dispatch-first (issue 126): grava 'pendente' COM o payload antes de tentar o
// ClickUp; o desfecho atualiza a mesma linha. O que ficar pendente/falha é
// re-tentado pelo /api/sync/crm-retry usando o lead_json guardado.
// Best-effort: falha aqui nunca afeta o lead nem o envio em si.
async function criarDispatchPendente(env, { eventId, email, phone, funnel, leadJson }) {
  try {
    if (!env.DB) return null;
    const r = await env.DB.prepare(
      `INSERT INTO lead_dispatch (event_id, email, phone, funnel, resultado, lead_json, criado_em)
       VALUES (?, ?, ?, ?, 'pendente', ?, strftime('%s','now'))`
    ).bind(eventId || '', email || '', phone || '', funnel || '', leadJson || null).run();
    return r.meta.last_row_id;
  } catch (e) {
    console.error('lead_dispatch insert error:', e.message);
    return null;
  }
}

async function atualizarDispatch(env, id, { resultado, taskId = null, taskUrl = null, erro = null }) {
  try {
    if (!env.DB || !id) return;
    // Sucesso descarta o payload (não precisamos mais dele); falha mantém p/ retry.
    const limpaJson = resultado === 'falha' ? '' : ', lead_json = NULL';
    await env.DB.prepare(
      `UPDATE lead_dispatch SET resultado = ?, task_id = ?, task_url = ?, erro = ?${limpaJson} WHERE id = ?`
    ).bind(resultado, taskId, taskUrl, erro, id).run();
  } catch (e) {
    console.error('lead_dispatch update error:', e.message);
  }
}

// Grava o lead que não conseguiu ir pro ClickUp — nada se perde.
async function logClickUpFailure(leadData, phone, email, error, env) {
  try {
    if (!env.DB) return;
    await env.DB.prepare(
      `INSERT INTO clickup_sync_failures (phone, email, lead_json, error) VALUES (?, ?, ?, ?)`
    ).bind(
      phone || '', email || '', JSON.stringify(leadData || {}),
      (error && error.message) ? error.message : String(error || '')
    ).run();
  } catch (e) {
    console.error('clickup_sync_failures insert error:', e.message);
  }
}

// Envia texto pela Evolution API. Best-effort: engole qualquer erro.
async function sendEvolutionMessage(apikey, number, text, env) {
  try {
    if (!env.EVOLUTION_API_URL || !apikey || !number) return;
    await fetch(env.EVOLUTION_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey },
      body: JSON.stringify({ number, text }),
    });
  } catch (e) {
    console.error('Evolution send error:', e.message);
  }
}

// --- Alertas críticos (camada A) com throttle ---
// No máximo 1 alerta por tipo a cada 1h, controlado na tabela alert_throttle
// do D1 — plataforma fora do ar não pode virar spam no WhatsApp da usuária.
// FAIL-OPEN: se a consulta/gravação no D1 falhar, envia mesmo assim (melhor
// alerta duplicado que silêncio).
const ALERT_THROTTLE_SECONDS = 3600;

async function sendThrottledAlert(type, text, env) {
  try {
    if (env.DB) {
      const now = Math.floor(Date.now() / 1000);
      const row = await env.DB.prepare(
        'SELECT last_sent FROM alert_throttle WHERE alert_type = ?'
      ).bind(type).first();
      if (row && now - row.last_sent < ALERT_THROTTLE_SECONDS) return; // já alertou nesta janela
      await env.DB.prepare(
        `INSERT INTO alert_throttle (alert_type, last_sent) VALUES (?, ?)
         ON CONFLICT(alert_type) DO UPDATE SET last_sent = excluded.last_sent`
      ).bind(type, now).run();
    }
  } catch (e) {
    console.error('alert_throttle D1 error:', e.message); // fail-open: envia assim mesmo
  }
  await sendEvolutionMessage(env.EVOLUTION_APIKEY_ALERTA, env.EVOLUTION_NUMERO_ALERTA, text, env);
}

// Camada A — Meta CAPI: alerta quando um Lead/Purchase REAL (não-bot) não foi
// aceito pelo Meta, qualquer que seja a razão: erro HTTP, fetch rejeitado ou
// skip por env ausente (META_PIXEL_ID/token sumiram = morte silenciosa —
// metaResponseOk fica 0 em todos esses casos). PageView e bots não alertam.
// Roda em waitUntil: nunca atrasa a resposta do /tracker.
async function maybeAlertMetaFailure({ eventName, isBot, metaResponseOk, metaStatusCode, metaResponseBody, env, throttleKey = 'meta_capi', label = 'Meta CAPI' }) {
  const name = (eventName || '').toLowerCase();
  if (isBot) return;
  if (name !== 'lead' && name !== 'purchase') return;
  if (metaResponseOk === 1) return;
  await sendThrottledAlert(
    throttleKey,
    `⚠️ ${label} falhou num ${eventName}: status ${metaStatusCode} — ${(metaResponseBody || '').slice(0, 180)}`,
    env
  );
}

function buildLeadNotif(header, { nome, phoneE164, email, instagram, faturamento }) {
  const digits = (phoneE164 || '').replace(/\D/g, '');
  return `${header}\n\n*Nome:* ${nome}\n*Número:* ${phoneE164}\n*Whatsapp:* https://wa.me/${digits}\n*Email:* ${email}\n*Instagram:* ${instagram}\n*Faturamento:* ${faturamento}`;
}

export async function sendToClickUp({ leadData, sessionData, env, eventId = '', dispatchId = null }) {
  if (!env.CLICKUP_API_TOKEN) return; // sem token não dá pra falar com o ClickUp
  const listId = env.CLICKUP_LIST_ID || CU_DEFAULT_LIST;

  const nome = (leadData.nome || '').toString().trim();
  const email = (leadData.email || '').toString().trim();
  const instagram = (leadData.instagram || '').toString().trim();
  const faturamento = (leadData.faturamento || '').toString().trim();
  const justificativa = (leadData.justificativa || '').toString().trim();
  const objetivo = (leadData.objetivo || '').toString().trim();
  const cargo = (leadData.cargo || '').toString().trim();
  const investimento = (leadData.investimento || '').toString().trim();
  const phoneE164 = toClickUpPhone(leadData.telefone);
  const funnel = (leadData.funnel || '').toString().toLowerCase();

  const utm = sessionData || {};
  const utmSource = utm.utm_source || '';
  const utmMedium = utm.utm_medium || '';
  const utmContent = utm.utm_content || '';
  const utmCampaign = utm.utm_campaign || '';

  // Dispatch-first: registro 'pendente' com o payload ANTES de tentar (issue
  // 126). No retry, a linha já existe e chega via dispatchId.
  if (!dispatchId) {
    dispatchId = await criarDispatchPendente(env, {
      eventId, email, phone: phoneE164, funnel,
      leadJson: JSON.stringify({
        leadData,
        sessionData: { utm_source: utmSource, utm_medium: utmMedium, utm_content: utmContent, utm_campaign: utmCampaign },
      }),
    });
  }

  // --- Dedup (telefone OU email). Read-only: falha vira "não achou". ---
  let existing = null;
  try {
    existing = await searchClickUpTask(CU_FIELD.whatsapp, phoneE164, env);
    if (!existing && email) existing = await searchClickUpTask(CU_FIELD.email, email, env);
  } catch (e) {
    console.error('ClickUp search error:', e.message);
  }

  try {
    if (existing) {
      // --- Task existente: muda status (secundário) + comenta (principal) ---
      const taskId = existing.id;
      try {
        await clickupWrite(() => clickupFetch(`/task/${taskId}`, {
          method: 'PUT', body: JSON.stringify({ status: 'LEADS DE ENTRADA' }),
        }, env));
      } catch (e) {
        console.error('ClickUp status error:', e.message); // não trava o comentário
      }
      const comentario =
        `Lead Voltou ao CRM:\n\nNovos Dados:\nNome: ${nome}\nTelefone: ${phoneE164}\n` +
        `E-mail: ${email}\nInstagram: ${instagram}\nFaturamento: ${faturamento}\n` +
        `Cargo: ${cargo}\nInvestimento em Tráfego: ${investimento}\nJustificativa: ${justificativa}\nObjetivo: ${objetivo}\n\n` +
        `${utmSource} - ${utmMedium} - ${utmContent}`;
      await clickupWrite(() => clickupFetch(`/task/${taskId}/comment`, {
        method: 'POST', body: JSON.stringify({ comment_text: comentario }),
      }, env));
      await atualizarDispatch(env, dispatchId, { resultado: 'comentado', taskId, taskUrl: existing.url || `https://app.clickup.com/t/${taskId}` });
      await sendEvolutionMessage(env.EVOLUTION_APIKEY_NOTIF, env.EVOLUTION_NUMERO_NOTIF,
        buildLeadNotif('*Voltou ao CRM 🎉*', { nome, phoneE164, email, instagram, faturamento }), env);
    } else {
      // --- Lead inédito: cria a task com os custom fields ---
      const customFields = [];
      const push = (id, value) => { if (value) customFields.push({ id, value }); };
      push(CU_FIELD.nome, nome);
      push(CU_FIELD.email, email);
      push(CU_FIELD.instagram, instagram);
      push(CU_FIELD.faturamento, faturamento);
      push(CU_FIELD.whatsapp, phoneE164);
      push(CU_FIELD.justificativa, justificativa);
      push(CU_FIELD.objetivo, objetivo);
      push(CU_FIELD.cargo, cargo);
      push(CU_FIELD.investimento, investimento);
      customFields.push({ id: CU_FIELD.funil, value: mapFunnelToOption(funnel) });
      customFields.push({ id: CU_FIELD.produto, value: mapProdutoToOption(funnel) });
      push(CU_FIELD.utmSource, utmSource);
      push(CU_FIELD.utmMedium, utmMedium);
      push(CU_FIELD.utmContent, utmContent);
      push(CU_FIELD.utmCampaign, utmCampaign);

      // Link da jornada no /dash (a seção Jornada aceita ?email= pré-preenchido).
      const linkJornada = email
        ? `Jornada completa: https://atacadoexponencial.com/dash/?jornada=${encodeURIComponent(email)}#jornada`
        : '';

      const name = nome || email || 'Lead sem nome';
      const createTask = (body) => clickupWrite(() => clickupFetch(`/list/${listId}/task`, {
        method: 'POST', body: JSON.stringify(body),
      }, env));
      let criada = null;
      try {
        criada = await createTask({ name, custom_fields: customFields, description: linkJornada });
      } catch (e) {
        // Telefone fora do padrão faz o campo phone do ClickUp responder 400 e
        // derrubar a task inteira. Tenta UMA vez sem o whatsapp, com o número
        // cru na description pro comercial validar. Se falhar de novo (ou o 400
        // for por outra causa), propaga pro catch de fora (log D1 + alerta).
        const temWhatsapp = customFields.some((f) => f.id === CU_FIELD.whatsapp);
        if (e.status !== 400 || !temWhatsapp) throw e;
        console.error('ClickUp create 400 com whatsapp — repetindo sem o campo phone');
        criada = await createTask({
          name,
          custom_fields: customFields.filter((f) => f.id !== CU_FIELD.whatsapp),
          description: `${linkJornada ? linkJornada + '\n' : ''}WhatsApp (não validado pelo ClickUp): ${leadData.telefone}`,
        });
      }
      let novaTask = null;
      try { novaTask = await criada.json(); } catch {}
      await atualizarDispatch(env, dispatchId, {
        resultado: 'criado',
        taskId: novaTask && novaTask.id, taskUrl: novaTask && (novaTask.url || `https://app.clickup.com/t/${novaTask.id}`),
      });
      await sendEvolutionMessage(env.EVOLUTION_APIKEY_NOTIF, env.EVOLUTION_NUMERO_NOTIF,
        buildLeadNotif('*Novo lead no CRM 🎉*', { nome, phoneE164, email, instagram, faturamento }), env);
    }
  } catch (e) {
    // Escrita principal falhou após o retry → não perder o lead.
    console.error('ClickUp write error:', e.message);
    await atualizarDispatch(env, dispatchId, { resultado: 'falha', erro: e.message });
    await logClickUpFailure(leadData, phoneE164, email, e, env);
    // Alerta agora passa pelo throttle (1/h) como os demais da camada A; os
    // leads em si continuam TODOS em clickup_sync_failures — nada se perde.
    await sendThrottledAlert('clickup_write',
      `Erro ao criar lead no ClickUp: ${e.message || e}`, env);
  }
}

// -------------------------------------------------------
// HELPERS
// -------------------------------------------------------

function validateFbCookie(value) {
  if (!value) return '';
  const parts = value.split('.');
  if (parts.length < 4 || parts.length > 5) return '';
  if (parts[0] !== 'fb') return '';
  if (!/^\d+$/.test(parts[1])) return '';
  if (!/^\d+$/.test(parts[2])) return '';
  if (!parts[3]) return '';
  return value;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) cookies[name.trim()] = rest.join('=');
  });
  return cookies;
}

function extractGA4ClientId(gaCookie) {
  if (!gaCookie) return '';
  const parts = gaCookie.split('.');
  return parts.length >= 4 ? `${parts[2]}.${parts[3]}` : '';
}

function extractGA4SessionId(cookies) {
  for (const [name, value] of Object.entries(cookies)) {
    if (name.startsWith('_ga_') && name !== '_ga') {
      if (!value) continue;
      if (value.startsWith('GS2')) {
        const mainPart = value.split('.').slice(2).join('.');
        const segments = mainPart.split('$');
        for (const seg of segments) {
          if (seg.startsWith('s') && seg.length > 1) {
            const candidate = seg.slice(1);
            if (/^\d+$/.test(candidate)) return candidate;
          }
        }
      } else {
        const parts = value.split('.');
        if (parts.length >= 3) {
          const candidate = parts[2];
          if (/^\d+$/.test(candidate)) return candidate;
        }
      }
    }
  }
  return '';
}

function detectBot(userAgent) {
  if (!userAgent || userAgent.length < 10) {
    return { isBot: true, botReason: 'Missing or short user-agent' };
  }
  const patterns = [
    { p: /googlebot|google-inspectiontool/i, r: 'Googlebot' },
    { p: /bingbot|msnbot/i, r: 'Bingbot' },
    { p: /facebookexternalhit|facebot/i, r: 'Facebook crawler' },
    { p: /twitterbot/i, r: 'Twitter crawler' },
    { p: /linkedinbot/i, r: 'LinkedIn crawler' },
    { p: /slackbot/i, r: 'Slackbot' },
    { p: /whatsapp/i, r: 'WhatsApp preview' },
    { p: /bot|crawler|spider|scraper|headless/i, r: 'Generic bot' },
    { p: /python-requests|axios|node-fetch|curl|wget|httpie/i, r: 'HTTP library' },
    { p: /phantomjs|selenium|puppeteer|playwright/i, r: 'Automation tool' },
  ];
  for (const { p, r } of patterns) {
    if (p.test(userAgent)) return { isBot: true, botReason: r };
  }
  return { isBot: false, botReason: '' };
}

function parseBrowser(ua) {
  const r = { browser: 'Unknown', version: '', os: 'Unknown', isMobile: false };
  if (!ua) return r;
  r.isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  if (/Edg\//i.test(ua)) { r.browser = 'Edge'; r.version = ua.match(/Edg\/([\d.]+)/)?.[1] || ''; }
  else if (/OPR\//i.test(ua)) { r.browser = 'Opera'; r.version = ua.match(/OPR\/([\d.]+)/)?.[1] || ''; }
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) { r.browser = 'Chrome'; r.version = ua.match(/Chrome\/([\d.]+)/)?.[1] || ''; }
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) { r.browser = 'Safari'; r.version = ua.match(/Version\/([\d.]+)/)?.[1] || ''; }
  else if (/Firefox\//i.test(ua)) { r.browser = 'Firefox'; r.version = ua.match(/Firefox\/([\d.]+)/)?.[1] || ''; }
  if (/Windows/i.test(ua)) r.os = 'Windows';
  else if (/Mac OS X/i.test(ua)) r.os = 'macOS';
  else if (/iPhone|iPad/i.test(ua)) r.os = 'iOS';
  else if (/Android/i.test(ua)) r.os = 'Android';
  else if (/Linux/i.test(ua)) r.os = 'Linux';
  return r;
}
