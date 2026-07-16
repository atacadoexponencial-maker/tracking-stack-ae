// GET /api/painel/receita?slug&de&ate — receita por dia + KPIs por fonte.
// Fonte sem conta cadastrada não aparece (decisão da spec).
import { resolverCliente, json, naoEncontrado, periodos, delta, div, totaisGa4, totaisAds, atualizadoAte, kpi } from './_dados.js';

export async function onRequestGet({ request, env }) {
  const slug = new URL(request.url).searchParams.get('slug');
  const cliente = await resolverCliente(env, slug);
  if (!cliente) return naoEncontrado();
  const p = periodos(request);
  if (!p) return json({ error: 'período inválido' }, 400);

  const { results: porDia } = await env.DB.prepare(
    `SELECT data, SUM(receita_cents) receita_cents FROM ga4_diario
     WHERE cliente_id = ? AND data BETWEEN ? AND ? GROUP BY data ORDER BY data`
  ).bind(cliente.id, p.de, p.ate).all();

  const fontes = [];

  if (cliente.ga4_property_id) {
    const [ga, ant] = await Promise.all([
      totaisGa4(env.DB, cliente.id, p.de, p.ate),
      totaisGa4(env.DB, cliente.id, p.antDe, p.antAte),
    ]);
    const ticket = div(ga.receita_cents, ga.pedidos), ticketAnt = div(ant.receita_cents, ant.pedidos);
    const tx = div(ga.pedidos * 100, ga.sessoes), txAnt = div(ant.pedidos * 100, ant.sessoes);
    fontes.push({ id: 'ga4', titulo: 'Google Analytics', kpis: [
      kpi('Receita', ga.receita_cents, 'moeda', delta(ga.receita_cents, ant.receita_cents)),
      kpi('Pedidos', ga.pedidos, 'int', delta(ga.pedidos, ant.pedidos)),
      kpi('Ticket Médio', ticket, 'moeda', delta(ticket, ticketAnt)),
      kpi('Sessões', ga.sessoes, 'int', delta(ga.sessoes, ant.sessoes)),
      kpi('Tx de Conversão', tx, 'pct', delta(tx, txAnt)),
    ]});
  }

  if (cliente.meta_account_id) {
    const [m, ant] = await Promise.all([
      totaisAds(env.DB, cliente.id, p.de, p.ate, 'meta'),
      totaisAds(env.DB, cliente.id, p.antDe, p.antAte, 'meta'),
    ]);
    const roas = div(m.receita_cents, m.gasto_cents), roasAnt = div(ant.receita_cents, ant.gasto_cents);
    const cpm = div(m.gasto_cents * 1000, m.impressoes), cpmAnt = div(ant.gasto_cents * 1000, ant.impressoes);
    const ctr = div(m.cliques * 100, m.impressoes), ctrAnt = div(ant.cliques * 100, ant.impressoes);
    const cpc = div(m.gasto_cents, m.cliques), cpcAnt = div(ant.gasto_cents, ant.cliques);
    fontes.push({ id: 'meta', titulo: 'Meta Ads', kpis: [
      kpi('Investimento', m.gasto_cents, 'moeda', delta(m.gasto_cents, ant.gasto_cents), true),
      kpi('Receita atribuída', m.receita_cents, 'moeda', delta(m.receita_cents, ant.receita_cents)),
      kpi('ROAS', roas, 'num', delta(roas, roasAnt)),
      kpi('CPM', cpm, 'moeda', delta(cpm, cpmAnt), true),
      kpi('CTR', ctr, 'pct', delta(ctr, ctrAnt)),
      kpi('CPC', cpc, 'moeda', delta(cpc, cpcAnt), true),
    ]});
  }

  if (cliente.gads_customer_id) {
    const [g, ant] = await Promise.all([
      totaisAds(env.DB, cliente.id, p.de, p.ate, 'google'),
      totaisAds(env.DB, cliente.id, p.antDe, p.antAte, 'google'),
    ]);
    const cpc = div(g.gasto_cents, g.cliques), cpcAnt = div(ant.gasto_cents, ant.cliques);
    const cpa = div(g.gasto_cents, g.conversoes), cpaAnt = div(ant.gasto_cents, ant.conversoes);
    fontes.push({ id: 'google', titulo: 'Google Ads', kpis: [
      kpi('Investimento', g.gasto_cents, 'moeda', delta(g.gasto_cents, ant.gasto_cents), true),
      kpi('Impressões', g.impressoes, 'int', delta(g.impressoes, ant.impressoes)),
      kpi('Cliques', g.cliques, 'int', delta(g.cliques, ant.cliques)),
      kpi('CPC', cpc, 'moeda', delta(cpc, cpcAnt), true),
      kpi('Conversões', g.conversoes, 'num', delta(g.conversoes, ant.conversoes)),
      kpi('CPA', cpa, 'moeda', delta(cpa, cpaAnt), true),
    ]});
  }

  return json({ atualizado_ate: await atualizadoAte(env.DB, cliente.id), por_dia: porDia, fontes });
}
