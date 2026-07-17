// GET /api/painel/metas?slug&de&ate — meta do mês (do fim do período) vs
// realizado, com projeção diária calculada (nada é digitado duas vezes).
import { resolverCliente, json, naoEncontrado, periodos, div, totaisGa4, totaisAds, atualizadoAte, kpi } from './_dados.js';

export async function onRequestGet({ request, env }) {
  const slug = new URL(request.url).searchParams.get('slug');
  const cliente = await resolverCliente(env, slug);
  if (!cliente) return naoEncontrado();
  const p = periodos(request);
  if (!p) return json({ error: 'período inválido' }, 400);

  const mes = p.ate.slice(0, 7);
  const mesDe = `${mes}-01`;
  const diasNoMes = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
  const mesAte = `${mes}-${String(diasNoMes).padStart(2, '0')}`;

  const meta = await env.DB.prepare(
    'SELECT meta_faturamento_cents, meta_investimento_cents, taxa_projetada FROM metas WHERE cliente_id = ? AND mes = ?'
  ).bind(cliente.id, mes).first();

  const [ga, ads, { results: diario }, { results: adsDiario }] = await Promise.all([
    totaisGa4(env.DB, cliente.id, mesDe, mesAte),
    totaisAds(env.DB, cliente.id, mesDe, mesAte),
    env.DB.prepare(
      `SELECT data, SUM(receita_cents) receita_cents, SUM(sessoes) sessoes, SUM(pedidos) pedidos
       FROM ga4_diario WHERE cliente_id = ? AND data BETWEEN ? AND ? GROUP BY data ORDER BY data DESC LIMIT 31`
    ).bind(cliente.id, mesDe, mesAte).all(),
    env.DB.prepare(
      `SELECT data, SUM(gasto_cents) gasto_cents FROM ads_diario
       WHERE cliente_id = ? AND data BETWEEN ? AND ? GROUP BY data`
    ).bind(cliente.id, mesDe, mesAte).all(),
  ]);
  const gastoPorDia = Object.fromEntries(adsDiario.map((a) => [a.data, a.gasto_cents]));

  const txAtual = div(ga.pedidos * 100, ga.sessoes);
  const kpis = [];
  if (meta) {
    const projetadoDia = Math.round(meta.meta_faturamento_cents / diasNoMes);
    kpis.push(
      kpi('Meta de Faturamento', meta.meta_faturamento_cents, 'moeda'),
      kpi('Faturamento Captado', ga.receita_cents, 'moeda'),
      kpi('% Atingimento (Faturamento)', div(ga.receita_cents * 100, meta.meta_faturamento_cents), 'pct'),
      kpi('Meta de Investimento', meta.meta_investimento_cents, 'moeda'),
      kpi('Investimento', ads.gasto_cents, 'moeda'),
      kpi('% Atingimento (Investimento)', div(ads.gasto_cents * 100, meta.meta_investimento_cents), 'pct'),
      kpi('Taxa Projetada', meta.taxa_projetada, 'pct'),
      kpi('Taxa Atual', txAtual, 'pct'),
    );
    return json({
      atualizado_ate: await atualizadoAte(env.DB, cliente.id),
      mes, kpis,
      diario: diario.map((d) => ({
        data: d.data,
        projetado_cents: projetadoDia,
        realizado_cents: d.receita_cents,
        gasto_cents: gastoPorDia[d.data] || 0,
        sessoes: d.sessoes,
        pedidos: d.pedidos,
        roas: div(d.receita_cents, gastoPorDia[d.data]),
      })),
    });
  }

  // Sem meta cadastrada para o mês: mostra só o realizado.
  kpis.push(
    kpi('Faturamento Captado', ga.receita_cents, 'moeda'),
    kpi('Investimento', ads.gasto_cents, 'moeda'),
    kpi('Taxa Atual', txAtual, 'pct'),
  );
  return json({ atualizado_ate: await atualizadoAte(env.DB, cliente.id), mes, kpis, diario: [], sem_meta: true });
}
