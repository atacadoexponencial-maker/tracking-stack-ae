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

import { clausulasBotSql } from '../_bots.js';
import { montarFunil } from './_funil-etapas.js';

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

  // Exclusão de bot: lista única em functions/_bots.js, a mesma que o
  // tracker.js usa na escrita.
  const botClauses = clausulasBotSql('s');

  // Ordem dos binds é posicional na ordem do texto SQL: o funil efetivo do
  // CASE (SELECT) vem ANTES de since/until; o s.funnel = ? vem por último.
  const binds = funnel ? [funnel, since, until, funnel] : [since, until];

  try {
    // Query única: denominador (visitors), numerador (leads) e os degraus
    // intermediários do funil, todos no mesmo GROUP BY.
    //
    // ⚠️ CUSTO DE D1 — não reescrever isto com COUNT(DISTINCT)/LEFT JOIN.
    // A forma anterior (LEFT JOIN + dois COUNT(DISTINCT)) obrigava o SQLite a
    // montar três TEMP B-TREE sobre as ~37 mil sessões da janela: cada linha
    // custava ~15 leituras em CADA b-tree, ou seja ~45 linhas lidas por sessão
    // — 1,68 MILHÃO de linhas lidas por chamada, medido pelo `d1 insights`.
    // Uma única abertura desta aba consumia quase a cota diária inteira do
    // plano gratuito (5 M). Detalhes: incidente de 2026-09-04.
    //
    // `EXISTS` correlacionado dá o mesmo resultado sem b-tree temporário:
    // como cada sessão é UMA linha de `sessions`, "existe ≥ 1 evento" é
    // equivalente ao COUNT(DISTINCT session_id) que protegia do fan-out do
    // JOIN, e `COUNT(*)` basta para visitors. O GROUP BY sai de graça do
    // índice idx_sessions_lp_created (migration 0036). Confira com
    // EXPLAIN QUERY PLAN: não pode aparecer nenhum "USE TEMP B-TREE".
    //
    // Os degraus (cliques/form_starts) eram uma segunda varredura das mesmas
    // sessões, com o mesmo recorte — foram fundidos aqui para não pagar duas
    // vezes. Eles usam o funil do DENOMINADOR (`s.funnel`, first-touch da
    // sessão) e não o funil efetivo do evento: `CTAClick` e `FormStart` não
    // carregam `lead_data`, então filtrar pelo funil do evento zeraria todos.
    const grouped = await env.DB.prepare(`
      SELECT
        s.landing_url,
        COUNT(*) AS visitors,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM event_log e
           WHERE e.session_id = s.session_id
             AND e.event_name = 'Lead'
             AND e.is_bot = 0 AND e.is_junk = 0
             ${numeratorFunnelClause}
        ) THEN 1 ELSE 0 END) AS leads,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM event_log e
           WHERE e.session_id = s.session_id
             AND e.event_name IN ('CTAClick', 'InitiateCheckout')
             AND e.is_bot = 0 AND e.is_junk = 0
        ) THEN 1 ELSE 0 END) AS cliques,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM event_log e
           WHERE e.session_id = s.session_id
             AND e.event_name = 'FormStart'
             AND e.is_bot = 0 AND e.is_junk = 0
        ) THEN 1 ELSE 0 END) AS form_starts
      FROM sessions s
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
    const degrausPorPath = new Map();
    for (const row of grouped.results || []) {
      const lp = normalizePath(row.landing_url);
      if (!isKnownPage(lp)) continue;
      const acc = byPath.get(lp) || { visitors: 0, leads: 0 };
      acc.visitors += row.visitors;
      acc.leads += row.leads;
      byPath.set(lp, acc);

      const d = degrausPorPath.get(lp) || { cliques: 0, formStarts: 0, etapas: new Map() };
      d.cliques += row.cliques;
      d.formStarts += row.form_starts;
      degrausPorPath.set(lp, d);
    }

    // --- Etapas do formulário (spec 2026-08-31) ----------------------------
    //
    // Mesmo recorte de sessões da consulta acima (mesma janela, mesmos filtros
    // de bot e de funil), para os números do funil baterem com a linha que ele
    // expande. Usa `s.funnel` (first-touch da sessão) pelo mesmo motivo dos
    // demais degraus: `FormStep` não carrega `lead_data`.
    //
    // Esta consulta é barata (157 linhas lidas, medido em 2026-09-04) e não
    // precisou mudar: como o JOIN filtra por `event_name = 'FormStep'`, o
    // otimizador já entra pela tabela pequena (`event_log`) por conta própria,
    // em vez de varrer as sessões da janela.
    const bindsSessao = funnel ? [since, until, funnel] : [since, until];

    const etapasQuery = await env.DB.prepare(`
      SELECT
        s.landing_url,
        e.step AS step,
        COUNT(DISTINCT s.session_id) AS sessoes
      FROM sessions s
      JOIN event_log e
        ON e.session_id = s.session_id
       AND e.event_name = 'FormStep'
       AND e.is_bot = 0
       AND e.is_junk = 0
       AND e.step IS NOT NULL
      WHERE s.created_at >= ? AND s.created_at <= ?
        AND s.user_agent IS NOT NULL AND LENGTH(s.user_agent) >= 10
        ${botClauses}
        ${denominatorFunnelClause}
      GROUP BY s.landing_url, e.step
    `).bind(...bindsSessao).all();

    // Início da coleta: primeiro evento novo do SITE INTEIRO. Sem filtro de
    // página, de funil nem de período — é o que mantém a data FIXA. Calculada
    // dentro do filtro, ela mudaria conforme o que o usuário escolhesse na
    // tela, virando um número sem significado.
    const coleta = await env.DB.prepare(`
      SELECT MIN(timestamp) AS inicio
        FROM event_log
       WHERE event_name IN ('CTAClick', 'FormStep')
    `).first();
    // `timestamp` e `created_at` são segundos no D1; o funil trabalha em ms.
    const inicioColetaMs = Number.isFinite(Number(coleta?.inicio))
      ? Number(coleta.inicio) * 1000
      : null;

    // Merge pelo path normalizado, igual ao byPath acima e pelo mesmo motivo:
    // grupos crus distintos que normalizam para o mesmo path são disjuntos.
    // (cliques e form_starts já entraram no degrausPorPath junto com o byPath,
    // porque vêm da mesma consulta.)
    for (const row of etapasQuery.results || []) {
      const lp = normalizePath(row.landing_url);
      if (!isKnownPage(lp)) continue;
      const acc = degrausPorPath.get(lp) || { cliques: 0, formStarts: 0, etapas: new Map() };
      acc.etapas.set(row.step, (acc.etapas.get(row.step) || 0) + row.sessoes);
      degrausPorPath.set(lp, acc);
    }

    const rows = [...byPath].map(([lp, v]) => {
      const d = degrausPorPath.get(lp) || { cliques: 0, formStarts: 0, etapas: new Map() };
      const funil = montarFunil({
        visitantes: v.visitors,
        cliques: d.cliques,
        formStarts: d.formStarts,
        etapas: [...d.etapas].map(([step, sessoes]) => ({ step, sessoes })),
        leads: v.leads,
        inicioColetaMs,
        periodoInicioMs: since * 1000,
      });
      return {
        lp,
        visitors: v.visitors,
        leads: v.leads,
        rate: v.visitors > 0 ? v.leads / v.visitors : 0,
        funil: funil.degraus,
        avisoInicioColetaMs: funil.avisoInicioColetaMs,
      };
    });

    // Ordenação depois do merge (o merge muda os totais): visitors desc,
    // empate por lp alfabético.
    rows.sort((a, b) => b.visitors - a.visitors || a.lp.localeCompare(b.lp));

    return json({ days, funnel: funnel || null, rows });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

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
  '/lives-semanais-v2',
  '/aplicacao-mentoria',
  '/aplicacao-trafego-atacado',
  '/trafego-atacado',
  '/se-v1',
  '/se-v2',
  '/consultoria-gratuita-atacado',
  '/video-workshop-instagram',
  '/vsl',
  '/workshop-gratuito-atacado',
  '/obrigada',
  '/calculadora-atacado',
  '/calculadora-atacado/perguntas',
  '/calculadora-atacado/resultado',
  '/obrigado',
  '/obrigado-workshop',
  '/ae-video-workshop',
  '/grupo-da-live',
  '/workshop-black-exponencial-2026',
  '/obrigado-black-exponencial',
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
