// GET /api/painel/funil?slug&de&ate — etapas somadas + taxas com deltas.
import { resolverCliente, json, naoEncontrado, periodos, delta, div, atualizadoAte, kpi } from './_dados.js';

async function somaFunil(db, clienteId, de, ate) {
  return db.prepare(
    `SELECT COALESCE(SUM(sessoes),0) sessoes, COALESCE(SUM(carrinho),0) carrinho,
            COALESCE(SUM(checkout),0) checkout, COALESCE(SUM(pedidos),0) pedidos
     FROM ga4_funil WHERE cliente_id = ? AND data BETWEEN ? AND ?`
  ).bind(clienteId, de, ate).first();
}

export async function onRequestGet({ request, env }) {
  const slug = new URL(request.url).searchParams.get('slug');
  const cliente = await resolverCliente(env, slug);
  if (!cliente) return naoEncontrado();
  const p = periodos(request);
  if (!p) return json({ error: 'período inválido' }, 400);

  const [f, fAnt] = await Promise.all([
    somaFunil(env.DB, cliente.id, p.de, p.ate),
    somaFunil(env.DB, cliente.id, p.antDe, p.antAte),
  ]);

  const taxa = (x) => [div(x.carrinho * 100, x.sessoes), div(x.checkout * 100, x.carrinho), div(x.pedidos * 100, x.checkout), div(x.pedidos * 100, x.sessoes)];
  const t = taxa(f), tAnt = taxa(fAnt);

  return json({
    atualizado_ate: await atualizadoAte(env.DB, cliente.id),
    etapas: [
      { nome: 'Sessões', valor: f.sessoes },
      { nome: 'Adições ao carrinho', valor: f.carrinho },
      { nome: 'Checkout', valor: f.checkout },
      { nome: 'Pedidos', valor: f.pedidos },
    ],
    kpis: [
      kpi('Carrinho × Sessões', t[0], 'pct', delta(t[0], tAnt[0])),
      kpi('Checkout × Carrinho', t[1], 'pct', delta(t[1], tAnt[1])),
      kpi('Pedidos × Checkout', t[2], 'pct', delta(t[2], tAnt[2])),
      kpi('Pedidos × Sessões', t[3], 'pct', delta(t[3], tAnt[3])),
    ],
  });
}
