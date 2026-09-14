// GET /api/events?key=...&limit=100&offset=0[&event=Lead][&from=<unix>&to=<unix>]
//
// Lista de eventos crus (aba Eventos) + saúde do tracking.
//
// Os agregados (`summary`, `recovery`, `browsers`) eram TRÊS varreduras do
// event_log inteiro por abertura — sem recorte de período nenhum, sobre uma
// tabela que só cresce. Passaram a ser UMA consulta, agrupada por (browser,
// is_bot, is_junk), sobre os últimos 30 dias (ou o from/to recebido); os três
// blocos são somados em JS a partir dessas poucas linhas. Mesma forma de
// resposta de antes: o dashboard não muda.

import { respostaJson, respostaEmCache } from './_cache.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  // Simple auth via query param
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!env.DASH_KEY || key !== env.DASH_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const eventFilter = url.searchParams.get('event') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  // Janela dos agregados: from/to explícitos ou os últimos 30 dias. A lista de
  // eventos (paginada por limit/offset) não é recortada — ela já sai do índice
  // de timestamp, mais recente primeiro.
  const agora = Math.floor(Date.now() / 1000);
  const fromTs = parseInt(url.searchParams.get('from') || '', 10);
  const toTs = parseInt(url.searchParams.get('to') || '', 10);
  const since = Number.isFinite(fromTs) && fromTs > 0 ? fromTs : agora - 30 * 86400;
  const until = Number.isFinite(toTs) && toTs > 0 ? toTs : agora;

  // Período fechado já respondido antes? Sai sem tocar no D1 (ver _cache.js).
  const emCache = await respostaEmCache(request, { until });
  if (emCache) return emCache;

  try {
    let query = `
      SELECT
        rowid, session_id, event_name, event_id, timestamp,
        browser, os, is_mobile,
        pixel_was_blocked, fbp_source, fbc_source, fbclid_source,
        is_bot, bot_reason,
        sent_to_meta, meta_response_ok,
        has_email, raw_email,
        meta_response_body
      FROM event_log
    `;
    const bindings = [];

    if (eventFilter) {
      query += ` WHERE event_name = ?`;
      bindings.push(eventFilter);
    }

    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const { results } = await env.DB.prepare(query).bind(...bindings).all();

    // Uma consulta para os três agregados. Cada linha é um (browser, is_bot,
    // is_junk) com todas as somas que os blocos precisam; a separação
    // "summary/recovery contam bots, browsers não" acontece em JS.
    const { results: grupos } = await env.DB.prepare(`
      SELECT
        browser,
        COALESCE(is_bot, 0) AS is_bot,
        COALESCE(is_junk, 0) AS is_junk,
        COUNT(*) AS total,
        SUM(CASE WHEN meta_response_ok = 1 THEN 1 ELSE 0 END) AS meta_ok,
        SUM(CASE WHEN meta_response_ok = 0 THEN 1 ELSE 0 END) AS meta_fail,
        SUM(CASE WHEN pixel_was_blocked = 1 THEN 1 ELSE 0 END) AS blocked,
        SUM(CASE WHEN fbp_source = 'pixel_js' THEN 1 ELSE 0 END) AS fbp_from_pixel,
        SUM(CASE WHEN fbp_source = 'middleware_http' THEN 1 ELSE 0 END) AS fbp_from_middleware,
        SUM(CASE WHEN fbp_source = 'tracker_http' THEN 1 ELSE 0 END) AS fbp_from_session,
        SUM(CASE WHEN fbp_source = 'none' THEN 1 ELSE 0 END) AS fbp_none,
        SUM(CASE WHEN fbc_source = 'middleware_http' THEN 1 ELSE 0 END) AS fbc_from_middleware,
        SUM(CASE WHEN fbclid_source = 'server_middleware' THEN 1 ELSE 0 END) AS fbclid_from_server
      FROM event_log
      WHERE event_name = 'Lead'
        AND timestamp >= ? AND timestamp <= ?
      GROUP BY browser, COALESCE(is_bot, 0), COALESCE(is_junk, 0)
    `).bind(since, until).all();

    const { summary, recovery, browsers } = agregarSaude(grupos || []);

    // Heartbeat do backup externo (gravado pelo cron da VPS em config_kv).
    let backup = null;
    try {
      const row = await env.DB.prepare(
        "SELECT valor FROM config_kv WHERE chave = 'ultimo_backup'"
      ).first();
      backup = row ? row.valor : null;
    } catch (_) {}

    return respostaJson(request, {
      events: results,
      summary,
      recovery,
      browsers,
      backup,
    }, { until, context });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// Soma as linhas (browser, is_bot, is_junk) nos três blocos que o dashboard lê:
//   summary  — total/meta_ok/meta_fail/bots dos Lead (inclui bots, como antes);
//   recovery — o que o server-side recuperou, só entre não-bots (como antes);
//   browsers — por navegador, só não-bot e não-junk (como antes).
// Função pura, sem D1: é o que permite testar a agregação com `node --test`.
export function agregarSaude(grupos) {
  const n = (v) => Number(v) || 0;
  const somaRec = {
    total_events: 0, real_events: 0, adblock_recovered: 0, itp_recovered: 0,
    fbp_from_pixel: 0, fbp_from_middleware: 0, fbp_from_session: 0, fbp_none: 0,
    fbc_from_middleware: 0, fbclid_from_server: 0,
  };
  const somaSum = { event_name: 'Lead', total: 0, meta_ok: 0, meta_fail: 0, bots: 0 };
  const porBrowser = new Map();

  for (const g of grupos) {
    const total = n(g.total);
    const ehBot = n(g.is_bot) === 1;
    const ehJunk = n(g.is_junk) === 1;

    somaSum.total += total;
    somaSum.meta_ok += n(g.meta_ok);
    somaSum.meta_fail += n(g.meta_fail);
    if (ehBot) somaSum.bots += total;

    somaRec.total_events += total;
    if (!ehBot) {
      somaRec.real_events += total;
      somaRec.adblock_recovered += n(g.blocked);
      somaRec.itp_recovered += n(g.fbp_from_middleware);
      somaRec.fbp_from_pixel += n(g.fbp_from_pixel);
      somaRec.fbp_from_middleware += n(g.fbp_from_middleware);
      somaRec.fbp_from_session += n(g.fbp_from_session);
      somaRec.fbp_none += n(g.fbp_none);
      somaRec.fbc_from_middleware += n(g.fbc_from_middleware);
      somaRec.fbclid_from_server += n(g.fbclid_from_server);
    }

    if (!ehBot && !ehJunk) {
      const chave = g.browser == null ? null : g.browser;
      const b = porBrowser.get(chave) || { browser: chave, total: 0, blocked: 0, itp_recovered: 0 };
      b.total += total;
      b.blocked += n(g.blocked);
      b.itp_recovered += n(g.fbp_from_middleware);
      porBrowser.set(chave, b);
    }
  }

  const browsers = [...porBrowser.values()].sort((a, b) => b.total - a.total);
  // `summary` era o resultado de um GROUP BY event_name filtrado em 'Lead':
  // lista com uma linha quando há evento, vazia quando não há.
  const summary = somaSum.total > 0 ? [somaSum] : [];
  return { summary, recovery: somaRec, browsers };
}
