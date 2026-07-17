// GET /api/painel/criativos?slug&de&ate — criativos Meta Ads agregados no período.
import { resolverCliente, json, naoEncontrado, periodos, div, atualizadoAte } from './_dados.js';

export async function onRequestGet({ request, env }) {
  const slug = new URL(request.url).searchParams.get('slug');
  const cliente = await resolverCliente(env, slug);
  if (!cliente) return naoEncontrado();
  const p = periodos(request);
  if (!p) return json({ error: 'período inválido' }, 400);

  if (!cliente.meta_account_id) {
    return json({ atualizado_ate: await atualizadoAte(env.DB, cliente.id), criativos: [] });
  }

  const { results } = await env.DB.prepare(
    `SELECT ad_id, MAX(ad_nome) ad_nome,
            MAX(CASE WHEN thumbnail_url != '' THEN thumbnail_url END) thumbnail_url,
            SUM(gasto_cents) gasto_cents, SUM(alcance) alcance, AVG(frequencia) frequencia,
            SUM(impressoes) impressoes, SUM(cliques) cliques, SUM(pedidos) pedidos, SUM(receita_cents) receita_cents
     FROM criativos_diario WHERE cliente_id = ? AND data BETWEEN ? AND ?
     GROUP BY ad_id ORDER BY gasto_cents DESC LIMIT 50`
  ).bind(cliente.id, p.de, p.ate).all();

  return json({
    atualizado_ate: await atualizadoAte(env.DB, cliente.id),
    criativos: results.map((c) => ({
      ad_nome: c.ad_nome, thumbnail_url: c.thumbnail_url || '',
      gasto_cents: c.gasto_cents, receita_cents: c.receita_cents, pedidos: c.pedidos,
      alcance: c.alcance, frequencia: c.frequencia || 0, cliques: c.cliques,
      sessoes: null, ctr: div(c.cliques * 100, c.impressoes) || 0,
    })),
  });
}
