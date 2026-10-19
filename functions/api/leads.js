// GET /api/leads?key=...&days=30&limit=100[&funnel=...][&only=funnelCounts][&with=funnels]
//
// Returns Lead events joined to their originating session so each row carries
// its UTMs / fbclid / gclid. This is the "where did my leads come from" view
// — the whole reason the tracking stack persists anything at all.
//
// Source: event_log (Lead events only) LEFT JOIN sessions via session_id.
// Bots are excluded by default; pass include_bots=1 to see them.
//
// Contrato (revisão de 13/09/2026, economia do D1):
//   - sem parâmetros extras: `{ days, funnel, funnelCounts, materialCounts, leads }`;
//   - `&with=funnels`: acrescenta `funnels` (todos os funis da história — só a
//     aba Leads precisa, para o seletor, e só na primeira vez);
//   - `&only=funnelCounts`: responde só `{ funnelCounts }` (é o que a Visão
//     geral pede do período anterior e o que a aba Meta Ads usa para o CPL).
//   `summary` (leads por utm_source) saiu: o dashboard nunca leu esse campo e
//   ele custava uma varredura extra do event_log a cada abertura.

import { clausulasBotIpSql } from '../_bots.js';
import { listarFunisConhecidos } from './_funil-campanha.js';
import { funilDoLead, carregarMapaCampanhas, funisDoSeletor } from './_funil-lead.js';
import { respostaJson, respostaEmCache } from './_cache.js';

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
  const soFunnelCounts = url.searchParams.get('only') === 'funnelCounts';
  const comFunnels = url.searchParams.get('with') === 'funnels';

  // Período fechado já respondido antes? Sai sem tocar no D1 (ver _cache.js).
  const emCache = await respostaEmCache(request, { until });
  if (emCache) return emCache;

  // Bot por user-agent (is_bot, decidido na escrita) E por IP (lista de
  // _bots.js, aplicada na leitura sobre a sessão do lead — é o que limpa o
  // histórico anterior ao bloqueio de 09/09). `include_bots=1` desliga os dois.
  const botClause = includeBots ? '' : 'AND e.is_bot = 0\n' + clausulasBotIpSql('s');
  // Testes internos (is_junk = 1, ver migration 0022) nunca entram nas métricas.
  // Diferente de is_bot, não há flag para reincluir: se precisar auditar um
  // teste, consulte o D1 direto — o dado continua lá, só não é contado.
  const junkClause = 'AND e.is_junk = 0';

  // Filtro opcional de funil. Funil ausente = todos os funis. A lista de
  // funis disponíveis é devolvida em `funnels` (só com `&with=funnels`) para o
  // dashboard popular o seletor.
  // Funil do FORMULÁRIO = o declarado no evento (event_log.funnel), com
  // fallback para o da sessão (sessions.funnel) nas linhas históricas gravadas
  // antes da coluna existir. COALESCE(NULLIF(...)) trata tanto NULL quanto ''.
  // O funil que o dash mostra sai dele + UTM da sessão pela regra única de
  // _funil-lead.js (spec-funil-pela-utm.md): nas portas da SE quem decide é a
  // origem. Por isso o filtro e as contagens são feitos em JS, não em SQL.
  const EFFECTIVE_FUNNEL = "COALESCE(NULLIF(e.funnel, ''), s.funnel)";
  const funnel = (url.searchParams.get('funnel') || '').trim();

  try {
    // Contagens por funil e por material numa consulta só (antes eram duas
    // varreduras do mesmo recorte). `GROUP BY funil, material` devolve poucas
    // dezenas de linhas; o resto é somado em JS:
    //   - funnelCounts IGNORA o &funnel= de propósito (a ideia é ver a
    //     distribuição entre todos os funis) e inclui o balde '' para a soma
    //     fechar com o KPI total;
    //   - materialCounts RESPEITA o &funnel= (issue 150) e só olha linhas com
    //     material — todas as iscas do ManyChat dividem o mesmo funil, então o
    //     que separa uma da outra é event_log.material.
    // Não dá para derivar isto das linhas de `leads`: o dashboard pede
    // `limit=1` só para ler as contagens, e mesmo com `limit=500` uma lista
    // truncada contaria a menos.
    const funisConhecidos = await listarFunisConhecidos(env.DB);
    const mapa = await carregarMapaCampanhas(env.DB, funisConhecidos);
    const funilDe = (l) => funilDoLead(l, mapa, funisConhecidos);

    const contagens = await env.DB.prepare(`
      SELECT
        COALESCE(${EFFECTIVE_FUNNEL}, '') AS funnel,
        COALESCE(e.material, '') AS material,
        s.utm_source,
        s.utm_campaign,
        COUNT(*) AS count
      FROM event_log e
      LEFT JOIN sessions s ON e.session_id = s.session_id
      WHERE e.event_name = 'Lead'
        AND e.timestamp >= ? AND e.timestamp <= ?
        AND e.is_bot = 0
        AND e.is_junk = 0
        ${clausulasBotIpSql('s')}
      GROUP BY 1, 2, 3, 4
    `).bind(since, until).all();

    const porFunil = new Map();
    const porMaterial = new Map();
    for (const r of contagens.results || []) {
      const n = Number(r.count) || 0;
      const f = funilDe(r);
      porFunil.set(f, (porFunil.get(f) || 0) + n);
      if (r.material && (!funnel || f === funnel)) {
        porMaterial.set(r.material, (porMaterial.get(r.material) || 0) + n);
      }
    }
    const ordenar = (mapa, chave) => [...mapa]
      .map(([k, count]) => ({ [chave]: k, count }))
      .sort((a, b) => b.count - a.count);
    const funnelCounts = ordenar(porFunil, 'funnel');
    const materialCounts = ordenar(porMaterial, 'material');

    if (soFunnelCounts) {
      return respostaJson(request, { funnelCounts }, { until, context });
    }

    const [rows, funnels] = await Promise.all([
      env.DB.prepare(`
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
        e.origin,
        e.material,
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
          WHERE st.task_id = d.task_id
          ORDER BY COALESCE(st.hist_date, st.recebido_em) DESC, st.id DESC LIMIT 1) AS crm_status
      FROM event_log e
      LEFT JOIN sessions s ON e.session_id = s.session_id
      LEFT JOIN lead_dispatch d ON d.event_id = e.event_id
      WHERE e.event_name = 'Lead'
        AND e.timestamp >= ? AND e.timestamp <= ?
        ${botClause}
        ${junkClause}
      ORDER BY e.timestamp DESC
      ${funnel ? '' : 'LIMIT ?'}
    `).bind(since, until, ...(funnel ? [] : [limit])).all(),

      // Lista de funis para o seletor do dashboard: independente do período e
      // do filtro, para o dropdown não perder opção ao trocar a data. Sai dos
      // mesmos funis que o CPL usa, passados pela regra (porta não é funil).
      Promise.resolve(comFunnels ? funisDoSeletor(funisConhecidos) : null),
    ]);

    // Com filtro de funil a consulta vem sem LIMIT (o funil é decidido aqui):
    // filtra e só então corta. São centenas de leads por período, não milhares.
    const leads = (rows.results || [])
      .map((l) => ({ ...l, formulario: l.funnel || null, funnel: funilDe(l), pagina: paginaDe(l.landing_url) }))
      .filter((l) => !funnel || l.funnel === funnel)
      .slice(0, limit);

    const resposta = {
      days,
      funnel: funnel || null,
      funnelCounts,
      materialCounts,
      leads,
    };
    if (funnels) resposta.funnels = funnels;

    return respostaJson(request, resposta, { until, context });
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

// Path da página de entrada, sem querystring nem barra final ("/" fica "/").
function paginaDe(landingUrl) {
  if (!landingUrl) return null;
  try {
    const path = new URL(landingUrl, 'https://x').pathname;
    return path.length > 1 ? path.replace(/\/+$/, '') : path;
  } catch {
    return null;
  }
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
