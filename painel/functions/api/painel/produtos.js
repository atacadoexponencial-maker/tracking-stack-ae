// GET /api/painel/produtos?slug&de&ate — receita e pedidos por produto.
import { resolverCliente, json, naoEncontrado, periodos, atualizadoAte } from './_dados.js';

export async function onRequestGet({ request, env }) {
  const slug = new URL(request.url).searchParams.get('slug');
  const cliente = await resolverCliente(env, slug);
  if (!cliente) return naoEncontrado();
  const p = periodos(request);
  if (!p) return json({ error: 'período inválido' }, 400);

  const { results: produtos } = await env.DB.prepare(
    `SELECT produto, SUM(receita_cents) receita_cents, SUM(pedidos) pedidos
     FROM ga4_produtos WHERE cliente_id = ? AND data BETWEEN ? AND ?
     GROUP BY produto ORDER BY receita_cents DESC LIMIT 100`
  ).bind(cliente.id, p.de, p.ate).all();

  return json({ atualizado_ate: await atualizadoAte(env.DB, cliente.id), produtos });
}
