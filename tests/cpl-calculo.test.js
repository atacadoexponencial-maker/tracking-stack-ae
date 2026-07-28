import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularCpl } from '../functions/api/_cpl-calculo.js';

const FUNIS = ['lives-semanais-v1', 'sessao-estrategica', 'trafego-atacado', 'aplicacao-mentoria'];

function cenario(extra = {}) {
  return {
    funisConhecidos: FUNIS,
    gastos: [
      { campaign_id: '1', campaign_name: 'ae_leads_publico-frio_evento-lead_sessao-estrategica', spend_cents: 200000 },
      { campaign_id: '2', campaign_name: 'ae_leads_publico-frio_evento-lead_trafego-pago', spend_cents: 100000 },
      { campaign_id: '3', campaign_name: 'Post do Instagram: no atacado...', spend_cents: 20000 },
    ],
    overrides: [],
    leads: [
      { funnel: 'sessao-estrategica', utm_source: 'facebookads', utm_campaign: 'ae_leads_x' },
      { funnel: 'sessao-estrategica', utm_source: 'facebookads', utm_campaign: 'ae_leads_x' },
      { funnel: 'sessao-estrategica', utm_source: '', utm_campaign: '' },
      { funnel: 'aplicacao-mentoria', utm_source: 'organico', utm_campaign: 'bioperfil-felipe' },
      { funnel: 'iscas-manychat', material: 'icp', utm_source: '', utm_campaign: '' },
    ],
    ...extra,
  };
}

const linha = (rows, chave, valor) => rows.find((r) => r[chave] === valor);

test('CPL por funil divide gasto da campanha pelos leads do funil', () => {
  const r = calcularCpl(cenario());
  const se = linha(r.por_funil, 'funnel', 'sessao-estrategica');
  assert.equal(se.spend, 2000);
  assert.equal(se.leads, 3);
  assert.ok(Math.abs(se.cpl - 666.6667) < 0.001);
});

test('campanha que o automático não resolve cai em sem-funil com o gasto visível', () => {
  const r = calcularCpl(cenario());
  const sem = linha(r.por_funil, 'funnel', 'sem-funil');
  assert.equal(sem.spend, 1000);
});

test('override manual tira a campanha do balde e leva para o funil certo', () => {
  const r = calcularCpl(cenario({ overrides: [{ campaign_id: '2', funnel: 'trafego-atacado' }] }));
  assert.equal(linha(r.por_funil, 'funnel', 'sem-funil'), undefined);
  assert.equal(linha(r.por_funil, 'funnel', 'trafego-atacado').spend, 1000);
});

test('funil com gasto e zero lead devolve cpl null, nunca Infinity', () => {
  const r = calcularCpl(cenario({ overrides: [{ campaign_id: '2', funnel: 'trafego-atacado' }] }));
  const ta = linha(r.por_funil, 'funnel', 'trafego-atacado');
  assert.equal(ta.leads, 0);
  assert.equal(ta.cpl, null);
});

test('impulsionamento vira o funil aquisicao', () => {
  const r = calcularCpl(cenario());
  assert.equal(linha(r.por_funil, 'funnel', 'aquisicao').spend, 200);
});

test('invariante: soma do gasto das linhas por funil = total do periodo', () => {
  const r = calcularCpl(cenario());
  const soma = r.por_funil.reduce((s, l) => s + l.spend, 0);
  assert.equal(soma, r.total_investimento);
  assert.equal(r.total_investimento, 3200);
});

test('por canal separa bio, manychat, meta-ads e direto', () => {
  const r = calcularCpl(cenario());
  assert.equal(linha(r.por_canal, 'canal', 'meta-ads').leads, 2);
  assert.equal(linha(r.por_canal, 'canal', 'bio').leads, 1);
  assert.equal(linha(r.por_canal, 'canal', 'manychat').leads, 1);
  assert.equal(linha(r.por_canal, 'canal', 'direto').leads, 1);
});

test('gasto do meta vai todo para o canal meta-ads, menos o impulsionamento', () => {
  const r = calcularCpl(cenario());
  assert.equal(linha(r.por_canal, 'canal', 'meta-ads').spend, 3000);
  assert.equal(linha(r.por_canal, 'canal', 'bio').spend, 0);
});

test('aquisicao vem fora de por_canal, com leads de bio+manychat e marcado como estimativa', () => {
  const r = calcularCpl(cenario());
  assert.equal(r.aquisicao_estimativa.spend, 200);
  assert.equal(r.aquisicao_estimativa.leads, 2);
  assert.equal(r.aquisicao_estimativa.cpl, 100);
  assert.equal(r.aquisicao_estimativa.estimado, true);
  assert.equal(linha(r.por_canal, 'canal', 'aquisicao'), undefined);
});

test('aquisicao sem lead de bio nem manychat devolve cpl null', () => {
  const r = calcularCpl(cenario({ leads: [{ funnel: 'sessao-estrategica', utm_source: 'facebookads' }] }));
  assert.equal(r.aquisicao_estimativa.leads, 0);
  assert.equal(r.aquisicao_estimativa.cpl, null);
});

test('cruzado separa o mesmo funil por canal', () => {
  const r = calcularCpl(cenario({
    leads: [
      { funnel: 'aplicacao-mentoria', utm_source: 'organico', utm_campaign: 'bioperfil-felipe' },
      { funnel: 'aplicacao-mentoria', utm_source: 'facebookads', utm_campaign: 'ae_x' },
      { funnel: 'aplicacao-mentoria', utm_source: 'facebookads', utm_campaign: 'ae_x' },
    ],
  }));
  const bio = r.cruzado.find((c) => c.funnel === 'aplicacao-mentoria' && c.canal === 'bio');
  const pago = r.cruzado.find((c) => c.funnel === 'aplicacao-mentoria' && c.canal === 'meta-ads');
  assert.equal(bio.leads, 1);
  assert.equal(pago.leads, 2);
});

test('lead sem funil cai em sem-funil em vez de sumir', () => {
  const r = calcularCpl(cenario({ leads: [{ funnel: '', utm_source: '' }] }));
  assert.equal(linha(r.por_funil, 'funnel', 'sem-funil').leads, 1);
  assert.equal(r.total_leads, 1);
});

test('entradas vazias nao quebram', () => {
  const r = calcularCpl({ leads: [], gastos: [], overrides: [], funisConhecidos: [] });
  assert.deepEqual(r.por_funil, []);
  assert.equal(r.total_investimento, 0);
  assert.equal(r.total_leads, 0);
  assert.equal(r.aquisicao_estimativa.cpl, null);
});
