// GET /api/conversion?key=...&days=30&funnel=...&only=totals
//
// Conversão por landing page: para cada LP (path normalizado de
// sessions.landing_url), quantos visitantes únicos não-bot chegaram no
// período, quantos viraram lead (>= 1 evento 'Lead' não-bot na sessão) e a
// taxa de conversão. A janela filtra sessions.created_at — coorte por visita:
// lead com evento fora do período mas sessão dentro conta.
//
// Fonte: sessions LEFT JOIN event_log via session_id. Bots ficam fora do
// denominador (e por consequência do numerador) via NOT LIKE em SQL.
//
// `&only=totals` (revisão de 13/09/2026): responde só `{ visitors, leads, rate }`
// somados sobre as mesmas linhas — é o que a Visão geral precisa do PERÍODO
// ANTERIOR para desenhar o delta, e evita a consulta das etapas do formulário
// e a montagem do funil por página. Sem `only`, a resposta é a de sempre.

import { clausulasBotSql, clausulasBotIpSql } from '../_bots.js';
import { montarFunil } from './_funil-etapas.js';
import { respostaJson, respostaEmCache } from './_cache.js';
import { funilDaPagina } from './_funil-paginas.js';
import { listarFunisConhecidos } from './_funil-campanha.js';
import { funilDoLead, carregarMapaCampanhas } from './_funil-lead.js';

// Início da coleta dos degraus novos (CTAClick/FormStep): o funil de
// micro-conversões entrou no ar em 31/08/2026 (spec 2026-08-31). Era lido do
// banco a cada chamada com `SELECT MIN(timestamp) FROM event_log WHERE
// event_name IN (...)` — uma varredura do event_log inteiro para descobrir uma
// data que nunca mais muda. Constante = zero leituras. Meia-noite de Brasília,
// porque é o dia em que o deploy foi feito, na régua do negócio.
const INICIO_COLETA_MS = Date.parse('2026-08-31T00:00:00-03:00');

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!env.DASH_KEY || key !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const { since, until } = resolvePeriod(url, days);
  const soTotais = url.searchParams.get('only') === 'totals';
  // `&by=funnel` (painel por funil da Visão geral, 01/10/2026): devolve também
  // `por_funil`, na MESMA consulta — o GROUP BY ganha o funil do lead da sessão
  // (`lead_funil`). Uma consulta por funil custaria N varreduras.
  const porFunil = url.searchParams.get('by') === 'funnel';

  // Período fechado já respondido antes? Sai sem tocar no D1 (ver _cache.js).
  const emCache = await respostaEmCache(request, { until });
  if (emCache) return emCache;

  // Funil EFETIVO do lead = o declarado no evento (event_log.funnel), com
  // fallback para o da sessão (mesmo padrão do /api/leads, para o total de
  // leads desta tabela bater com o card "Leads por funil" do dashboard).
  const EFFECTIVE_FUNNEL = "COALESCE(NULLIF(e.funnel, ''), s.funnel)";
  const funnel = (url.searchParams.get('funnel') || '').trim();

  // Com &funnel= (e no &by=funnel), numerador e denominador passam pela regra
  // única do funil (_funil-lead.js, spec-funil-pela-utm.md), com a UTM da
  // sessão — a mesma para a visita e para o lead que ela gerou:
  // - denominador: funil da PÁGINA de entrada (_funil-paginas.js) + UTM. Nas
  //   portas da SE a origem decide (bio → aquisição, anúncio → funil da
  //   campanha); página de produto fica no próprio funil;
  // - numerador: o mesmo, partindo do funil do formulário do lead da sessão.
  // Visitante que não converteu não tem funil de evento, e `sessions.funnel` é
  // vazio em 99% das sessões — por isso a página entra no denominador.
  const porOrigem = Boolean(funnel) || porFunil;
  // Preenchido depois da consulta principal (ver carregarRegra).
  let funilDe = () => null;
  const carregarRegra = async () => {
    if (!porOrigem) return;
    // Sem a lista de funis, a regra ainda separa bio, produto e SE.
    const funisConhecidos = await listarFunisConhecidos(env.DB).catch(() => []);
    const mapa = await carregarMapaCampanhas(env.DB, funisConhecidos);
    funilDe = (formulario, campanha) => funilDoLead({ funnel: formulario, utm_campaign: campanha }, mapa, funisConhecidos);
  };
  // Funil da visita, ou null para página que não é de captação.
  const funilDaVisita = (lp, campanha) => {
    const daPagina = funilDaPagina(lp);
    return daPagina ? funilDe(daPagina, campanha) : null;
  };
  const doFunil = (lp, campanha) => {
    if (!funnel) return true;
    return funilDaVisita(lp, campanha) === funnel; // '(sem página)' não tem funil: sai
  };
  // Bio e ManyChat viram um rótulo só, para o GROUP BY não abrir uma linha por
  // variação de bioperfil-*; o resto vai com o nome da campanha. O custo
  // medido em 19/10 é o mesmo de antes (12,9 mil linhas lidas em 30 dias).
  const CAMPANHA_SQL = `CASE WHEN LOWER(COALESCE(s.utm_campaign, '')) LIKE 'bioperfil%'
      OR LOWER(COALESCE(s.utm_source, '')) = 'manychat' THEN 'bioperfil'
      ELSE LOWER(COALESCE(s.utm_campaign, '')) END`;

  // Exclusão de bot: lista única em functions/_bots.js, a mesma que o
  // tracker.js usa na escrita.
  //
  // São DOIS cortes, porque são dois tipos de bot. O de user-agent pega quem se
  // identifica (Googlebot, facebookexternalhit — este último sozinho gerou 25%
  // das sessões da semana de 09/09). O de IP pega quem manda UA de Chrome e
  // passaria liso: 672 das 920 sessões da /lives-semanais-v1 naquela semana,
  // 73%, que vinham para o denominador e dividiam a conversão da LP por ~4.
  //
  // O corte por IP na ESCRITA (middleware, 09/09) só vale para tráfego novo;
  // este aqui é o que limpa o histórico já gravado, sem apagar linha nenhuma.
  const botClauses = clausulasBotSql('s') + '\n' + clausulasBotIpSql('s');

  const binds = [since, until];

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
    // vezes. Eles usam o funil do DENOMINADOR (a página de entrada, doFunil) e
    // não o funil efetivo do evento: `CTAClick` e `FormStart` não carregam
    // `lead_data`, então filtrar pelo funil do evento zeraria todos.
    //
    // `lead_funil` (só no &by=funnel): funil efetivo do lead da sessão, NULL
    // para quem não converteu. Sessão com lead em dois funis cai no do primeiro
    // lead — raro, e sem isso seria uma coluna por funil.
    const grouped = await env.DB.prepare(`
      SELECT
        s.landing_url,
        ${porOrigem ? `(SELECT ${EFFECTIVE_FUNNEL} FROM event_log e
          WHERE e.session_id = s.session_id
            AND e.event_name = 'Lead'
            AND e.is_bot = 0 AND e.is_junk = 0
          ORDER BY e.id LIMIT 1) AS lead_funil,
        ${CAMPANHA_SQL} AS campanha,` : ''}
        COUNT(*) AS visitors,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM event_log e
           WHERE e.session_id = s.session_id
             AND e.event_name = 'Lead'
             AND e.is_bot = 0 AND e.is_junk = 0
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
      GROUP BY s.landing_url${porOrigem ? ', lead_funil, campanha' : ''}
    `).bind(...binds).all();
    await carregarRegra();

    // Re-agregação em JS: grupos crus distintos (querystring, barra final)
    // que normalizam para o mesmo path somam visitors/leads. Correto por
    // construção: cada sessão tem exatamente 1 landing_url, logo os grupos
    // crus são disjuntos — somar não conta ninguém duas vezes.
    const byPath = new Map();
    const degrausPorPath = new Map();
    const funis = new Map();
    for (const row of grouped.results || []) {
      const lp = normalizePath(row.landing_url);
      if (!isKnownPage(lp) || !doFunil(lp, row.campanha)) continue;
      // Funil do lead da sessão pela regra (null = a sessão não converteu).
      const funilLead = porOrigem && row.lead_funil != null ? funilDe(row.lead_funil, row.campanha) : null;
      if (porFunil) {
        // Denominador: todas as visitas das páginas do funil. Numerador: as
        // que viraram lead DAQUELE funil. Página fora de _funil-paginas.js não
        // entra em funil nenhum.
        const f = funilDaVisita(lp, row.campanha);
        if (f) {
          const accF = funis.get(f) || { visitors: 0, leads: 0 };
          accF.visitors += row.visitors;
          if (funilLead === f) accF.leads += row.visitors;
          funis.set(f, accF);
        }
      }
      const acc = byPath.get(lp) || { visitors: 0, leads: 0 };
      acc.visitors += row.visitors;
      // Com &funnel=, só conta o lead daquele funil.
      acc.leads += funnel ? (funilLead === funnel ? row.visitors : 0) : row.leads;
      byPath.set(lp, acc);

      const d = degrausPorPath.get(lp) || { cliques: 0, formStarts: 0, etapas: new Map() };
      d.cliques += row.cliques;
      d.formStarts += row.form_starts;
      degrausPorPath.set(lp, d);
    }

    // Só os totais: soma das mesmas linhas que sairiam em `rows` (mesma
    // whitelist de páginas), para o número bater com o que a Visão geral soma
    // no front a partir de `rows` no período atual.
    if (soTotais) {
      let visitors = 0;
      let leads = 0;
      for (const v of byPath.values()) {
        visitors += v.visitors;
        leads += v.leads;
      }
      return respostaJson(request, {
        visitors,
        leads,
        rate: visitors > 0 ? leads / visitors : 0,
        ...(porFunil ? { por_funil: listaPorFunil(funis) } : {}),
      }, { until, context });
    }

    // --- Etapas do formulário (spec 2026-08-31) ----------------------------
    //
    // Mesmo recorte de sessões da consulta acima (mesma janela, mesmos filtros
    // de bot e de funil), para os números do funil baterem com a linha que ele
    // expande. O funil entra pela página de entrada (doFunil, em JS), como no
    // denominador acima.
    //
    // Esta consulta é barata (157 linhas lidas, medido em 2026-09-04) e não
    // precisou mudar: como o JOIN filtra por `event_name = 'FormStep'`, o
    // otimizador já entra pela tabela pequena (`event_log`) por conta própria,
    // em vez de varrer as sessões da janela.
    const bindsSessao = [since, until];

    const etapasQuery = await env.DB.prepare(`
      SELECT
        s.landing_url,
        e.step AS step,
        ${funnel ? `${CAMPANHA_SQL} AS campanha,` : ''}
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
      GROUP BY s.landing_url, e.step${funnel ? ', campanha' : ''}
    `).bind(...bindsSessao).all();

    // Merge pelo path normalizado, igual ao byPath acima e pelo mesmo motivo:
    // grupos crus distintos que normalizam para o mesmo path são disjuntos.
    // (cliques e form_starts já entraram no degrausPorPath junto com o byPath,
    // porque vêm da mesma consulta.)
    for (const row of etapasQuery.results || []) {
      const lp = normalizePath(row.landing_url);
      if (!isKnownPage(lp) || !doFunil(lp, row.campanha)) continue;
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
        inicioColetaMs: INICIO_COLETA_MS,
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

    return respostaJson(request, {
      days,
      funnel: funnel || null,
      rows,
      ...(porFunil ? { por_funil: listaPorFunil(funis) } : {}),
    }, { until, context });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// `por_funil` do `&by=funnel`: um item por funil da sessão, com a taxa pronta.
function listaPorFunil(funis) {
  return [...funis]
    .map(([funnel, v]) => ({
      funnel,
      visitors: v.visitors,
      leads: v.leads,
      rate: v.visitors > 0 ? v.leads / v.visitors : 0,
    }))
    .sort((a, b) => b.visitors - a.visitors);
}

// Whitelist de paths que são página real do site: rotas Astro atuais
// (src/pages/), legados que ainda recebem tráfego real via redirect 301
// (public/_redirects) e o endpoint funcional /grupo-da-live (redireciona
// pro grupo de WhatsApp). Troca o antigo modelo de blacklist (excluir
// sondas de scanner) porque a lista de sondas sem ponto (/env, /login,
// /admin, /graphql, /rest/*, hashes aleatórios...) é grande demais e
// sempre incompleta — whitelist é o menor conjunto estável.
export const KNOWN_PAGE_PATHS = new Set([
  '/',
  '/lives-semanais-v1',
  '/lives-semanais-v2',
  '/aplicacao-mentoria',
  '/aplicacao-trafego-atacado',
  '/trafego-atacado',
  '/se-v1',
  '/se-v2',
  '/se-v3',
  '/se-v4',
  '/consultoria-gratuita-atacado',
  '/video-workshop-instagram',
  '/vsl',
  '/workshop-gratuito',
  '/workshop-gratuito-v2',
  '/workshop-gratuito-v3',
  '/obrigado-workshop-gratuito',
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
