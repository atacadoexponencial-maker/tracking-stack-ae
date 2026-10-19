// Funil do lead pela origem nas portas da SE (spec-funil-pela-utm.md, S3-01).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { funilDoLead, mapaCampanhas } from '../functions/api/_funil-lead.js';
import { calcularCpl } from '../functions/api/_cpl-calculo.js';

const FUNIS = ['aplicacao-mentoria', 'calculadora', 'iscas-manychat', 'lives-semanais-v1', 'sessao-estrategica', 'trafego-atacado', 'workshop'];
const CAMPANHAS = [
  { campaign_id: '1', campaign_name: 'ae_leads_publico-frio_evento-lead_sessao-estrategica' },
  { campaign_id: '2', campaign_name: 'ae_leads_publico-frio_evento-ra_sessao-estrategica' },
  { campaign_id: '3', campaign_name: 'ae_leads_publico-frio_evento-lead_lives-semanais' },
  { campaign_id: '4', campaign_name: 'ae_leads_publico-frio_evento-lead_workshops-gratuitos' },
];
const OVERRIDES = [{ campaign_id: '4', funnel: 'workshop' }];
const MAPA = mapaCampanhas({ campanhas: CAMPANHAS, overrides: OVERRIDES, funisConhecidos: FUNIS });
const funil = (lead) => funilDoLead(lead, MAPA, FUNIS);

const BIO = { utm_source: 'organico', utm_campaign: 'bioperfil-felipe' };
const SE_ADS = { utm_source: 'facebookads', utm_campaign: 'ae_leads_publico-frio_evento-lead_sessao-estrategica' };
const funisDoCpl = (leads) => calcularCpl({ leads, gastos: [], overrides: OVERRIDES, funisConhecidos: FUNIS, campanhas: CAMPANHAS })
  .por_funil.map((r) => r.funnel);

test('CA-S3-01 aplicação vinda da bio conta como aquisição e aplicacao-mentoria não vira funil', () => {
  const lead = { funnel: 'aplicacao-mentoria', ...BIO };
  assert.equal(funil(lead), 'aquisicao');
  assert.deepEqual(funisDoCpl([lead]), ['aquisicao']);
});

test('CA-S3-02 home vinda da bio conta como aquisição', () => {
  assert.equal(funil({ funnel: 'sessao-estrategica', utm_source: 'organico', utm_campaign: 'bioperfil-atacadoexponencial' }), 'aquisicao');
});

test('CA-S3-03 isca do ManyChat conta como aquisição, com ou sem UTM', () => {
  const semUtm = { funnel: 'iscas-manychat', material: 'icp' };
  const comUtm = { funnel: 'iscas-manychat', material: 'icp', utm_source: 'manychat', utm_campaign: 'x' };
  const soFonte = { funnel: 'iscas-manychat', utm_source: 'manychat' };
  assert.equal(funil(semUtm), 'aquisicao');
  assert.equal(funil(comUtm), 'aquisicao');
  assert.equal(funil(soFonte), 'aquisicao');
  assert.ok(!funisDoCpl([semUtm, comUtm]).includes('iscas-manychat'));
});

test('CA-S3-04 aplicação vinda de anúncio de SE conta como sessão estratégica', () => {
  assert.equal(funil({ funnel: 'aplicacao-mentoria', utm_source: 'facebookads', utm_campaign: 'ae_leads_publico-frio_evento-ra_sessao-estrategica' }), 'sessao-estrategica');
});

test('CA-S3-05 porta da SE vinda de anúncio das lives conta nas lives', () => {
  assert.equal(funil({ funnel: 'sessao-estrategica', utm_source: 'facebookads', utm_campaign: 'ae_leads_publico-frio_evento-lead_lives-semanais' }), 'lives-semanais-v1');
});

test('CA-S3-06 ajuste manual da campanha vale para o lead', () => {
  const lead = { funnel: 'sessao-estrategica', utm_source: 'facebookads', utm_campaign: 'ae_leads_publico-frio_evento-lead_workshops-gratuitos' };
  assert.equal(funil(lead), 'workshop');
  // Sem o ajuste, a regra automática não reconhece e cai na SE.
  assert.equal(funilDoLead(lead, mapaCampanhas({ campanhas: CAMPANHAS, funisConhecidos: FUNIS }), FUNIS), 'sessao-estrategica');
});

test('CA-S3-07 sem origem reconhecível vai para sessão estratégica', () => {
  assert.equal(funil({ funnel: 'aplicacao-mentoria' }), 'sessao-estrategica');
  assert.equal(funil({ funnel: 'aplicacao-mentoria', utm_source: 'facebookads', utm_campaign: '{{campaign.name}}' }), 'sessao-estrategica');
  assert.equal(funil({ funnel: 'aplicacao-mentoria', utm_source: 'facebookads', utm_campaign: 'ae_leads_campanha-que-nao-existe' }), 'sessao-estrategica');
});

test('CA-S3-08 workshop fica no workshop venha de onde vier', () => {
  assert.equal(funil({ funnel: 'workshop', ...SE_ADS }), 'workshop');
  assert.equal(funil({ funnel: 'workshop', ...BIO }), 'workshop');
});

test('CA-S3-09 lives, tráfego atacado e calculadora ficam no próprio funil', () => {
  for (const f of ['lives-semanais-v1', 'trafego-atacado', 'calculadora']) {
    assert.equal(funil({ funnel: f, ...SE_ADS }), f);
    assert.equal(funil({ funnel: f, ...BIO }), f);
  }
});
