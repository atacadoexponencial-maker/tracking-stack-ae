import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconhecerCampanha, listarConflitosCampanhas } from '../functions/api/_funis-relatorio-conflitos.js';

// Cadastro inicial (migration 0040), só com o que o reconhecimento usa.
const SE = { id: 1, nome: 'SE', funil_tracking: 'sessao-estrategica', trecho_campanha: null };
const LIVE = { id: 2, nome: 'LIVE', funil_tracking: 'lives-semanais-v1', trecho_campanha: null };
const WO = { id: 3, nome: 'WO PAGO', funil_tracking: null, trecho_campanha: 'workshop-pago' };
const AQ = { id: 4, nome: 'AQUISIÇÃO', funil_tracking: 'aquisicao', trecho_campanha: null };
const ATIVOS = [SE, LIVE, WO, AQ];
const CONHECIDOS = ['aplicacao-mentoria', 'diagnostico', 'lives-semanais-v1', 'sessao-estrategica', 'trafego-atacado', 'workshop'];
const ctx = (extra = {}) => ({ funisAtivos: ATIVOS, funisConhecidos: CONHECIDOS, ...extra });

test('reconhece pela regra automática, pelo trecho e pelo impulsionamento', () => {
  const se = reconhecerCampanha('ae_leads_publico-frio_conversao_sessao-estrategica', ctx());
  assert.deepEqual([se.blocos.map((b) => b.nome), se.reconhecida_por, se.motivo], [['SE'], 'automatica', null]);

  const live = reconhecerCampanha('ae_leads_publico-frio_evento-lead_lives-semanais', ctx());
  assert.deepEqual([live.blocos.map((b) => b.nome), live.funil_tracking], [['LIVE'], 'lives-semanais-v1']);

  const wo = reconhecerCampanha('ae_vendas-WORKSHOP-PAGO-23-09_publico-frio', ctx());
  assert.deepEqual([wo.blocos.map((b) => b.nome), wo.reconhecida_por], [['WO PAGO'], 'trecho']);

  const post = reconhecerCampanha('Post do Instagram: live de terça', ctx());
  assert.deepEqual([post.blocos.map((b) => b.nome), post.reconhecida_por], [['AQUISIÇÃO'], 'impulsionamento']);
});

test('classificação manual vence o trecho', () => {
  const r = reconhecerCampanha('ae_vendas-workshop-pago-23-09_publico-frio', ctx({ override: 'sessao-estrategica' }));
  assert.deepEqual([r.blocos.map((b) => b.nome), r.reconhecida_por], [['SE'], 'manual']);
});

test('funil reconhecido sem bloco ativo, manual para funil não cadastrado e nada reconhecido viram conflito', () => {
  assert.equal(reconhecerCampanha('ae_leads_frio_conversao_trafego-atacado', ctx()).motivo, 'funil trafego-atacado não cadastrado no relatório');
  assert.equal(reconhecerCampanha('qualquer_coisa', ctx({ override: 'workshop' })).motivo, 'funil workshop não cadastrado no relatório');
  assert.equal(reconhecerCampanha('ae_leads_frio_conversao_inexistente', ctx()).motivo, 'nenhum funil reconhecido');
});

test('nome com o trecho de dois funis ativos é conflito, nunca o primeiro que casou', () => {
  const outro = { id: 5, nome: 'MENTORIA', funil_tracking: 'aplicacao-mentoria', trecho_campanha: 'mentoria-paga' };
  const r = reconhecerCampanha('ae_vendas-workshop-pago_mentoria-paga', ctx({ funisAtivos: [...ATIVOS, outro] }));
  assert.equal(r.blocos.length, 2);
  assert.equal(r.motivo, 'casou com mais de um funil');
});

test('conflitos: só campanhas com investimento, fora de exatamente um bloco, maior valor primeiro', () => {
  const gastos = [
    { campaign_id: '1', campaign_name: 'ae_leads_frio_conversao_sessao-estrategica', spend_cents: 15000 },
    { campaign_id: '2', campaign_name: 'ae_leads_frio_conversao_trafego-atacado', spend_cents: 4210 },
    { campaign_id: '3', campaign_name: 'ae_leads_frio_conversao_inexistente', spend_cents: 9999 },
    { campaign_id: '4', campaign_name: 'ae_leads_frio_conversao_outra', spend_cents: 0 },
    { campaign_id: '5', campaign_name: null, spend_cents: 100 },
    { campaign_id: '6', campaign_name: 'ae_vendas-workshop-pago_publico', spend_cents: 700 },
  ];
  const overrides = [{ campaign_id: '6', funnel: 'workshop' }];
  assert.deepEqual(listarConflitosCampanhas(gastos, ctx({ overrides })), [
    { campanha: 'ae_leads_frio_conversao_inexistente', valor: 99.99, motivo: 'nenhum funil reconhecido' },
    { campanha: 'ae_leads_frio_conversao_trafego-atacado', valor: 42.1, motivo: 'funil trafego-atacado não cadastrado no relatório' },
    { campanha: 'ae_vendas-workshop-pago_publico', valor: 7, motivo: 'funil workshop não cadastrado no relatório' },
    { campanha: '5', valor: 1, motivo: 'nenhum funil reconhecido' },
  ]);
});

test('conflitos: sem funil ativo, toda campanha com investimento aparece; sem gasto, lista vazia', () => {
  const gastos = [{ campaign_id: '1', campaign_name: 'ae_leads_frio_conversao_sessao-estrategica', spend_cents: 100 }];
  assert.equal(listarConflitosCampanhas(gastos, ctx({ funisAtivos: [] })).length, 1);
  assert.deepEqual(listarConflitosCampanhas([], ctx()), []);
  assert.deepEqual(listarConflitosCampanhas(null), []);
});
