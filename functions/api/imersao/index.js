// GET /api/imersao?key=...  → Visão geral do lançamento da Imersão 2027
//
// Spec spec-imersao-2027.md, série S8. Regras em ../_imersao.js; o dash só
// desenha (public/dash/imersao.js). Sem nenhum ingresso pago em
// imersao_vendas, responde com os dados de exemplo (`exemplo: true`).
//
// Com venda real, o tráfego vem do Meta (ad_spend, campanhas da Imersão) e as
// visitas da página vêm do tracking do site (sessions), issue S11-01. Inícios
// de checkout (a Zouti não envia), ranking por anúncio (a coleta do Meta é por
// campanha) e Meet seguem como "—".
import {
  calcularVisao, metasDasLinhas, metasEfetivas, trafegoDasLinhas, visitasDasLinhas,
  TRECHO_CAMPANHA_IMERSAO, PAGINA_IMERSAO, PRIMEIRO_DIA, DIA_EVENTO,
} from '../_imersao.js';
import { ymdBrt } from '../_data-brt.js';
import { normalizePath } from '../conversion.js';
import { clausulasBotSql, clausulasBotIpSql } from '../../_bots.js';
import { dadosDeExemplo, AGORA_EXEMPLO, METAS_EXEMPLO } from '../_imersao-exemplo.js';

const json = (dados, status = 200) => Response.json(dados, { status });
export const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

/** Dados, metas e "hoje" do lançamento: reais se houver ingresso pago, senão o exemplo. */
export async function carregarDados(env, agoraReal = Math.floor(Date.now() / 1000)) {
  const [linhasMetas, vendas] = await Promise.all([
    env.DB.prepare('SELECT campo, valor FROM imersao_metas').all(),
    env.DB.prepare(`SELECT id, produto, valor_centavos, pago_em, email, telefone,
                           utm_source, utm_medium, utm_campaign, utm_content, situacao
                      FROM imersao_vendas`).all(),
  ]);
  // Cadastros da janela antes do checkout (S10-05). Sem a tabela, a aba segue
  // funcionando com zero cadastros.
  const cadastros = await env.DB.prepare('SELECT email, telefone FROM imersao_cadastros').all()
    .then((r) => r.results || [])
    .catch((e) => { console.error('[imersao] falha ao ler os cadastros:', e?.message || e); return []; });
  const salvas = metasDasLinhas(linhasMetas.results);
  const lista = vendas.results || [];
  const temIngresso = lista.some((v) => v.produto === 'ingresso' && v.situacao === 'paga');
  if (!temIngresso) {
    return { exemplo: true, agora: AGORA_EXEMPLO, metas: metasEfetivas(salvas, METAS_EXEMPLO), dados: dadosDeExemplo() };
  }
  const [trafego, visitas, visitasAnuncio] = await Promise.all([
    lerTrafego(env, agoraReal), lerVisitas(env, agoraReal), lerVisitasAnuncio(env),
  ]);
  return {
    exemplo: false,
    agora: agoraReal,
    metas: metasEfetivas(salvas),
    dados: {
      vendas: lista.map((v) => ({ ...v, valor: (Number(v.valor_centavos) || 0) / 100 })),
      trafego,
      visualizacoes: visitas ? visitas.visualizacoes : null,
      visitas_por_dia: visitas ? visitas.visitas_por_dia : null,
      visitas_anuncio: visitasAnuncio,
      inicios_checkout: null,
      anuncios: [],
      meet: null,
      cadastros,
    },
  };
}

/**
 * Investimento, impressões e cliques das campanhas da Imersão (S11-01).
 * `ad_spend.date` já é dia de Brasília. Falha na leitura vira null ("—"): o
 * resto da aba continua de pé.
 */
async function lerTrafego(env, agora) {
  try {
    const r = await env.DB.prepare(`
      SELECT date, spend_cents, impressions, clicks
        FROM ad_spend
       WHERE platform = 'meta' AND date >= ? AND date <= ?
         AND instr(lower(COALESCE(campaign_name, '')), ?) > 0
    `).bind(PRIMEIRO_DIA, DIA_EVENTO, TRECHO_CAMPANHA_IMERSAO).all();
    return trafegoDasLinhas(r.results, ymdBrt(agora));
  } catch (e) {
    console.error('[imersao] falha ao ler o gasto do Meta:', e?.message || e);
    return null;
  }
}

/**
 * Visitas da página da Imersão por dia (S11-01): uma sessão = uma visita, com
 * os mesmos cortes de bot da aba de conversão. O LIKE só reduz as linhas; o
 * path exato é conferido em visitasDasLinhas.
 */
async function lerVisitas(env, agora) {
  const desde = Date.parse(`${PRIMEIRO_DIA}T00:00:00-03:00`) / 1000;
  try {
    const r = await env.DB.prepare(`
      SELECT date(s.created_at, 'unixepoch', '-3 hours') AS dia, s.landing_url, COUNT(*) AS n
        FROM sessions s
       WHERE s.created_at >= ?
         AND s.landing_url LIKE ?
         AND s.user_agent IS NOT NULL AND LENGTH(s.user_agent) >= 10
         ${clausulasBotSql('s')}
         ${clausulasBotIpSql('s')}
       GROUP BY dia, s.landing_url
    `).bind(desde, `%${PAGINA_IMERSAO}%`).all();
    return visitasDasLinhas(r.results, ymdBrt(agora));
  } catch (e) {
    console.error('[imersao] falha ao ler as visitas da página:', e?.message || e);
    return null;
  }
}

/**
 * Visitas da página que chegaram de anúncio da Imersão (S12-01): sessão com
 * `utm_campaign` contendo o mesmo trecho do gasto. É o numerador do connect
 * rate. Leitura separada das visitas por dia para que uma falha aqui só faça o
 * connect rate voltar às visitas da página.
 */
async function lerVisitasAnuncio(env) {
  const desde = Date.parse(`${PRIMEIRO_DIA}T00:00:00-03:00`) / 1000;
  try {
    const r = await env.DB.prepare(`
      SELECT s.landing_url, COUNT(*) AS n
        FROM sessions s
       WHERE s.created_at >= ?
         AND s.landing_url LIKE ?
         AND instr(lower(COALESCE(s.utm_campaign, '')), ?) > 0
         AND s.user_agent IS NOT NULL AND LENGTH(s.user_agent) >= 10
         ${clausulasBotSql('s')}
         ${clausulasBotIpSql('s')}
       GROUP BY s.landing_url
    `).bind(desde, `%${PAGINA_IMERSAO}%`, TRECHO_CAMPANHA_IMERSAO).all();
    return (r.results || [])
      .filter((l) => normalizePath(l.landing_url) === PAGINA_IMERSAO)
      .reduce((s, l) => s + (Number(l.n) || 0), 0);
  } catch (e) {
    console.error('[imersao] falha ao ler as visitas de anúncio:', e?.message || e);
    return null;
  }
}

export async function montarResposta(env) {
  const c = await carregarDados(env);
  return calcularVisao(c.dados, c.metas, c.agora, { exemplo: c.exemplo });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  try {
    return json(await montarResposta(env));
  } catch {
    return json({ erro: 'Não foi possível montar a Imersão 2027 agora.' }, 500);
  }
}
