// GET /api/painel/conversao?slug&de&ate — KPIs de engajamento + canais + origem/mídia.
import { resolverCliente, json, naoEncontrado, periodos, delta, div, totaisGa4, atualizadoAte, kpi } from './_dados.js';

async function agrupar(db, clienteId, de, ate, dim) {
  const { results } = await db.prepare(
    `SELECT ${dim} nome, SUM(usuarios) usuarios, SUM(novos_usuarios) novos, SUM(sessoes) sessoes,
            SUM(pedidos) pedidos, SUM(receita_cents) receita_cents
     FROM ga4_diario WHERE cliente_id = ? AND data BETWEEN ? AND ?
     GROUP BY ${dim} ORDER BY receita_cents DESC LIMIT 40`
  ).bind(clienteId, de, ate).all();
  return results;
}

const linha = (l, antMap) => ({
  nome: l.nome || '(não definido)',
  usuarios: l.usuarios, novos: l.novos,
  tx_conversao: div(l.pedidos * 100, l.sessoes) || 0,
  pedidos: l.pedidos,
  ticket_cents: div(l.receita_cents, l.pedidos) || 0,
  receita_cents: l.receita_cents,
  delta_pct: delta(l.receita_cents, antMap[l.nome]),
});

export async function onRequestGet({ request, env }) {
  const slug = new URL(request.url).searchParams.get('slug');
  const cliente = await resolverCliente(env, slug);
  if (!cliente) return naoEncontrado();
  const p = periodos(request);
  if (!p) return json({ error: 'período inválido' }, 400);

  const DIM_OM = "origem || ' / ' || midia";
  const [ga, ant, canais, canaisAnt, om, omAnt] = await Promise.all([
    totaisGa4(env.DB, cliente.id, p.de, p.ate),
    totaisGa4(env.DB, cliente.id, p.antDe, p.antAte),
    agrupar(env.DB, cliente.id, p.de, p.ate, 'canal'),
    agrupar(env.DB, cliente.id, p.antDe, p.antAte, 'canal'),
    agrupar(env.DB, cliente.id, p.de, p.ate, DIM_OM),
    agrupar(env.DB, cliente.id, p.antDe, p.antAte, DIM_OM),
  ]);

  const mapa = (arr) => Object.fromEntries(arr.map((x) => [x.nome, x.receita_cents]));
  const ticket = div(ga.receita_cents, ga.pedidos), ticketAnt = div(ant.receita_cents, ant.pedidos);
  const tx = div(ga.pedidos * 100, ga.sessoes), txAnt = div(ant.pedidos * 100, ant.sessoes);
  const eng = div(ga.engajadas * 100, ga.sessoes), engAnt = div(ant.engajadas * 100, ant.sessoes);

  return json({
    atualizado_ate: await atualizadoAte(env.DB, cliente.id),
    kpis: [
      kpi('Pedidos', ga.pedidos, 'int', delta(ga.pedidos, ant.pedidos)),
      kpi('Ticket Médio', ticket, 'moeda', delta(ticket, ticketAnt)),
      kpi('Tx de Conversão', tx, 'pct', delta(tx, txAnt)),
      kpi('Total de usuários', ga.usuarios, 'int', delta(ga.usuarios, ant.usuarios)),
      kpi('Sessões', ga.sessoes, 'int', delta(ga.sessoes, ant.sessoes)),
      kpi('Sessões engajadas', ga.engajadas, 'int', delta(ga.engajadas, ant.engajadas)),
      kpi('Tx de Engajamento', eng, 'pct', delta(eng, engAnt)),
    ],
    canais: canais.map((l) => linha(l, mapa(canaisAnt))),
    origem_midia: om.map((l) => linha(l, mapa(omAnt))),
  });
}
