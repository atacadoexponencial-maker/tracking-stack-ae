import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverFunilAuto, FUNIL_SEM_CLASSIFICACAO } from '../functions/api/_funil-campanha.js';

// Os funis que existem de verdade no D1 hoje.
const FUNIS = ['lives-semanais-v1', 'sessao-estrategica', 'workshop', 'trafego-atacado', 'aplicacao-mentoria', 'iscas-manychat'];

test('último segmento igual ao funil casa', () => {
  assert.equal(resolverFunilAuto('ae_leads_publico-frio_evento-lead_sessao-estrategica', FUNIS), 'sessao-estrategica');
  assert.equal(resolverFunilAuto('ae_leads_publico-frio_form-nativo_sessao-estrategica', FUNIS), 'sessao-estrategica');
});

test('último segmento como prefixo casa com o sufixo de versão', () => {
  assert.equal(resolverFunilAuto('ae_leads_publico-frio_evento-lead_lives-semanais', FUNIS), 'lives-semanais-v1');
});

test('nome sem underscore é impulsionamento', () => {
  assert.equal(resolverFunilAuto('Post do Instagram: No atacado, a primeira compra...', FUNIS), 'aquisicao');
  assert.equal(resolverFunilAuto('Publicação impulsionada', FUNIS), 'aquisicao');
});

test('trafego-pago não casa com trafego-atacado — exige override manual', () => {
  assert.equal(resolverFunilAuto('ae_leads_publico-frio_evento-lead_trafego-pago', FUNIS), null);
});

test('prefixo só casa em fronteira de hífen', () => {
  // 'workshop' não pode casar um funil hipotético 'workshopping'
  assert.equal(resolverFunilAuto('ae_leads_x_workshop', ['workshopping']), null);
  assert.equal(resolverFunilAuto('ae_leads_x_workshop', ['workshop-vip']), 'workshop-vip');
});

test('igualdade exata ganha de prefixo quando os dois existem', () => {
  assert.equal(resolverFunilAuto('ae_x_workshop', ['workshop-vip', 'workshop']), 'workshop');
});

test('entre dois prefixos, vence o mais curto', () => {
  assert.equal(resolverFunilAuto('ae_x_lives-semanais', ['lives-semanais-v2-turbo', 'lives-semanais-v1']), 'lives-semanais-v1');
});

test('nome vazio ou nulo devolve null', () => {
  assert.equal(resolverFunilAuto('', FUNIS), null);
  assert.equal(resolverFunilAuto(null, FUNIS), null);
  assert.equal(resolverFunilAuto('ae_leads_', FUNIS), null);
});

test('lista de funis vazia devolve null sem quebrar', () => {
  assert.equal(resolverFunilAuto('ae_x_sessao-estrategica', []), null);
});

test('comparação ignora caixa e devolve o slug como está no banco', () => {
  assert.equal(resolverFunilAuto('AE_X_Sessao-Estrategica', FUNIS), 'sessao-estrategica');
});

test('FUNIL_SEM_CLASSIFICACAO é o rótulo do balde', () => {
  assert.equal(FUNIL_SEM_CLASSIFICACAO, 'sem-funil');
});
