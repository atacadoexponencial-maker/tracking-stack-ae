// GET /api/painel/home?slug&de&ate — KPIs gerais + fontes de receita + produtos.
import { resolverCliente, json, naoEncontrado, periodos, delta, div, totaisGa4, totaisAds, atualizadoAte, kpi } from './_dados.js';

export async function onRequestGet({ request, env }) {
  const slug = new URL(request.url).searchParams.get('slug');
  const cliente = await resolverCliente(env, slug);
  if (!cliente) return naoEncontrado();
  const p = periodos(request);
  if (!p) return json({ error: 'período inválido' }, 400);

  const [ga, gaAnt, ads, adsAnt] = await Promise.all([
    totaisGa4(env.DB, cliente.id, p.de, p.ate),
    totaisGa4(env.DB, cliente.id, p.antDe, p.antAte),
    totaisAds(env.DB, cliente.id, p.de, p.ate),
    totaisAds(env.DB, cliente.id, p.antDe, p.antAte),
  ]);

  const ticket = div(ga.receita_cents, ga.pedidos);
  const ticketAnt = div(gaAnt.receita_cents, gaAnt.pedidos);
  const tx = div(ga.pedidos * 100, ga.sessoes);
  const txAnt = div(gaAnt.pedidos * 100, gaAnt.sessoes);

  const kpis = [
    kpi('Receita Captada', ga.receita_cents, 'moeda', delta(ga.receita_cents, gaAnt.receita_cents)),
    kpi('Pedidos', ga.pedidos, 'int', delta(ga.pedidos, gaAnt.pedidos)),
    kpi('Ticket Médio', ticket, 'moeda', delta(ticket, ticketAnt)),
    kpi('Tx de Conversão', tx, 'pct', delta(tx, txAnt)),
    kpi('Sessões', ga.sessoes, 'int', delta(ga.sessoes, gaAnt.sessoes)),
    kpi('Novos usuários', ga.novos, 'int', delta(ga.novos, gaAnt.novos)),
  ];

  const temAds = cliente.meta_account_id || cliente.gads_customer_id;
  if (temAds) {
    const roas = div(ga.receita_cents, ads.gasto_cents);
    const roasAnt = div(gaAnt.receita_cents, adsAnt.gasto_cents);
    const cpa = div(ads.gasto_cents, ga.pedidos);
    const cpaAnt = div(adsAnt.gasto_cents, gaAnt.pedidos);
    const cps = div(ads.gasto_cents, ga.sessoes);
    const cpsAnt = div(adsAnt.gasto_cents, gaAnt.sessoes);
    kpis.push(
      kpi('Investimento Total', ads.gasto_cents, 'moeda', delta(ads.gasto_cents, adsAnt.gasto_cents), true),
      kpi('ROAS Geral', roas, 'num', delta(roas, roasAnt)),
      kpi('CPA Geral', cpa, 'moeda', delta(cpa, cpaAnt), true),
      kpi('CPS Geral', cps, 'moeda', delta(cps, cpsAnt), true),
    );
  }

  const [{ results: canais }, { results: canaisAnt }, { results: produtos }] = await Promise.all([
    env.DB.prepare(
      `SELECT canal, SUM(receita_cents) receita_cents, SUM(pedidos) pedidos, SUM(sessoes) sessoes
       FROM ga4_diario WHERE cliente_id = ? AND data BETWEEN ? AND ?
       GROUP BY canal ORDER BY receita_cents DESC LIMIT 10`
    ).bind(cliente.id, p.de, p.ate).all(),
    env.DB.prepare(
      `SELECT canal, SUM(receita_cents) receita_cents FROM ga4_diario
       WHERE cliente_id = ? AND data BETWEEN ? AND ? GROUP BY canal`
    ).bind(cliente.id, p.antDe, p.antAte).all(),
    env.DB.prepare(
      `SELECT produto, SUM(receita_cents) receita_cents FROM ga4_produtos
       WHERE cliente_id = ? AND data BETWEEN ? AND ?
       GROUP BY produto ORDER BY receita_cents DESC LIMIT 8`
    ).bind(cliente.id, p.de, p.ate).all(),
  ]);
  const antPorCanal = Object.fromEntries(canaisAnt.map((c) => [c.canal, c.receita_cents]));

  return json({
    atualizado_ate: await atualizadoAte(env.DB, cliente.id),
    kpis,
    canais: canais.map((c) => ({
      canal: c.canal || '(sem canal)',
      receita_cents: c.receita_cents,
      tx_conversao: div(c.pedidos * 100, c.sessoes) || 0,
      delta_pct: delta(c.receita_cents, antPorCanal[c.canal]),
    })),
    produtos,
  });
}
