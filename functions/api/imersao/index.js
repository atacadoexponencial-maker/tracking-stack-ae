// GET /api/imersao?key=...  → Visão geral do lançamento da Imersão 2027
//
// Spec spec-imersao-2027.md, série S8. Regras em ../_imersao.js; o dash só
// desenha (public/dash/imersao.js). Sem nenhum ingresso pago em
// imersao_vendas, responde com os dados de exemplo (`exemplo: true`).
//
// Nesta série os dados reais trazem só as vendas: tráfego, inícios de
// checkout, visualizações e Meet entram com a ligação da Zouti/Meta/Meet
// (fora da S8) e, até lá, aparecem como "—".
import { calcularVisao, metasDasLinhas, metasEfetivas } from '../_imersao.js';
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
  const salvas = metasDasLinhas(linhasMetas.results);
  const lista = vendas.results || [];
  const temIngresso = lista.some((v) => v.produto === 'ingresso' && v.situacao === 'paga');
  if (!temIngresso) {
    return { exemplo: true, agora: AGORA_EXEMPLO, metas: metasEfetivas(salvas, METAS_EXEMPLO), dados: dadosDeExemplo() };
  }
  return {
    exemplo: false,
    agora: agoraReal,
    metas: metasEfetivas(salvas),
    dados: {
      vendas: lista.map((v) => ({ ...v, valor: (Number(v.valor_centavos) || 0) / 100 })),
      trafego: null,
      visualizacoes: null,
      inicios_checkout: null,
      anuncios: [],
      meet: null,
    },
  };
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
