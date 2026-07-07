// GET /api/conversion?key=...&days=30&funnel=...
//
// Conversão por landing page: para cada LP (path normalizado de
// sessions.landing_url), quantos visitantes únicos não-bot chegaram no
// período, quantos viraram lead (>= 1 evento 'Lead' não-bot na sessão) e a
// taxa de conversão. A janela filtra sessions.created_at — coorte por visita:
// lead com evento fora do período mas sessão dentro conta.
//
// Fonte: sessions LEFT JOIN event_log via session_id. Bots ficam fora do
// denominador (e por consequência do numerador) via NOT LIKE em SQL.

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!env.DASH_KEY || key !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const { since, until } = resolvePeriod(url, days);

  // Funil EFETIVO do lead = o declarado no evento (event_log.funnel), com
  // fallback para o da sessão (mesmo padrão do /api/leads, para o total de
  // leads desta tabela bater com o card "Leads por funil" do dashboard).
  const EFFECTIVE_FUNNEL = "COALESCE(NULLIF(e.funnel, ''), s.funnel)";
  const funnel = (url.searchParams.get('funnel') || '').trim();

  // Com &funnel=, filtra numerador E denominador com semânticas diferentes:
  // - numerador (CASE no SELECT): funil efetivo do lead;
  // - denominador (WHERE): funil first-touch da sessão — visitante que não
  //   converteu não tem funil de evento.
  const numeratorFunnelClause = funnel ? `AND ${EFFECTIVE_FUNNEL} = ?` : '';
  const denominatorFunnelClause = funnel ? 'AND s.funnel = ?' : '';

  // Cláusulas de exclusão de bot geradas a partir de BOT_UA_SUBSTRINGS
  // (literais estáticos do próprio módulo, nunca input do request — sem risco
  // de injeção). LIKE do SQLite é case-insensitive para ASCII, preservando a
  // semântica do flag /i dos regex originais.
  const botClauses = BOT_UA_SUBSTRINGS
    .map((s) => `AND s.user_agent NOT LIKE '%${s}%'`)
    .join('\n          ');

  // Ordem dos binds é posicional na ordem do texto SQL: o funil efetivo do
  // CASE (SELECT) vem ANTES de since/until; o s.funnel = ? vem por último.
  const binds = funnel ? [funnel, since, until, funnel] : [since, until];

  try {
    // Query única: denominador (visitors) e numerador (leads) no mesmo
    // GROUP BY. COUNT(DISTINCT ...) garante máx. 1 lead por sessão mesmo com
    // N eventos 'Lead' (o fan-out do JOIN não infla visitors nem leads).
    const grouped = await env.DB.prepare(`
      SELECT
        s.landing_url,
        COUNT(DISTINCT s.session_id) AS visitors,
        COUNT(DISTINCT CASE WHEN e.id IS NOT NULL ${numeratorFunnelClause} THEN s.session_id END) AS leads
      FROM sessions s
      LEFT JOIN event_log e
        ON e.session_id = s.session_id
       AND e.event_name = 'Lead'
       AND e.is_bot = 0
      WHERE s.created_at >= ? AND s.created_at <= ?
        AND s.user_agent IS NOT NULL AND LENGTH(s.user_agent) >= 10
        ${botClauses}
        ${denominatorFunnelClause}
      GROUP BY s.landing_url
    `).bind(...binds).all();

    // Re-agregação em JS: grupos crus distintos (querystring, barra final)
    // que normalizam para o mesmo path somam visitors/leads. Correto por
    // construção: cada sessão tem exatamente 1 landing_url, logo os grupos
    // crus são disjuntos — somar não conta ninguém duas vezes.
    const byPath = new Map();
    for (const row of grouped.results || []) {
      const lp = normalizePath(row.landing_url);
      if (!isKnownPage(lp)) continue;
      const acc = byPath.get(lp) || { visitors: 0, leads: 0 };
      acc.visitors += row.visitors;
      acc.leads += row.leads;
      byPath.set(lp, acc);
    }

    const rows = [...byPath].map(([lp, v]) => ({
      lp,
      visitors: v.visitors,
      leads: v.leads,
      rate: v.visitors > 0 ? v.leads / v.visitors : 0,
    }));

    // Ordenação depois do merge (o merge muda os totais): visitors desc,
    // empate por lp alfabético.
    rows.sort((a, b) => b.visitors - a.visitors || a.lp.localeCompare(b.lp));

    return json({ days, funnel: funnel || null, rows });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// Replicado de detectBot() em functions/tracker.js (linha ~702). tracker.js
// não pode ser alterado nesta feature — manter em sincronia manualmente.
// Cada substring espelha 1:1 uma alternativa dos regex originais (todos são
// alternâncias de substrings simples, sem âncoras/classes/quantificadores);
// a lista fica completa mesmo com 'bot' subsumindo várias, para
// rastreabilidade com a origem. A regra "UA ausente ou < 10 chars = bot"
// vira IS NOT NULL + LENGTH >= 10 no SQL.
const BOT_UA_SUBSTRINGS = [
  'googlebot', 'google-inspectiontool',
  'bingbot', 'msnbot',
  'facebookexternalhit', 'facebot',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'whatsapp',
  'bot', 'crawler', 'spider', 'scraper', 'headless',
  'python-requests', 'axios', 'node-fetch', 'curl', 'wget', 'httpie',
  'phantomjs', 'selenium', 'puppeteer', 'playwright',
  // Adição LOCAL deste módulo (ALÉM da réplica do detectBot de
  // functions/tracker.js, que não pode ser alterado nesta feature):
  // cobre os UAs 'TLM-Audit-Scanner/1.0' e 'pathscan/1.0' vistos em produção.
  'scan',
];

// Whitelist de paths que são página real do site: rotas Astro atuais
// (src/pages/), legados que ainda recebem tráfego real via redirect 301
// (public/_redirects) e o endpoint funcional /grupo-da-live (redireciona
// pro grupo de WhatsApp). Troca o antigo modelo de blacklist (excluir
// sondas de scanner) porque a lista de sondas sem ponto (/env, /login,
// /admin, /graphql, /rest/*, hashes aleatórios...) é grande demais e
// sempre incompleta — whitelist é o menor conjunto estável.
const KNOWN_PAGE_PATHS = new Set([
  '/',
  '/lives-semanais-v1',
  '/se-v1',
  '/consultoria-gratuita-atacado',
  '/video-workshop-instagram',
  '/vsl',
  '/workshop-gratuito-atacado',
  '/privacy-policy',
  '/obrigada',
  '/calculadora-atacado',
  '/calculadora-atacado/perguntas',
  '/calculadora-atacado/resultado',
  '/obrigado',
  '/obrigado-workshop',
  '/ae-video-workshop',
  '/grupo-da-live',
]);

// '(sem página)' passa direto (não começa com '/'); paths reais só
// aparecem se estiverem na whitelist acima.
function isKnownPage(lp) {
  if (!lp.startsWith('/')) return true; // '(sem página)'
  return KNOWN_PAGE_PATHS.has(lp);
}

// Normaliza landing_url para apenas o path: remove protocolo, domínio, query
// e fragmento; barra final agregada (/pagina/ e /pagina juntas; raiz = '/').
// NULL/vazia/malformada cai no bucket '(sem página)' — nunca lança.
function normalizePath(raw) {
  const value = (raw || '').trim();
  if (!value) return '(sem página)';
  let path;
  try {
    path = new URL(value).pathname;
  } catch {
    try {
      // URL relativa tipo '/pagina?a=b' — resolve contra uma base qualquer.
      path = new URL(value, 'https://x').pathname;
    } catch {
      return '(sem página)';
    }
  }
  return path.replace(/\/+$/, '') || '/';
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
