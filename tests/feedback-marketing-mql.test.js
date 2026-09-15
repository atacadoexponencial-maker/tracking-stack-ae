import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  valoresDeDinheiro,
  faturamentoAcimaDe20Mil,
  ehMql,
  contarMqls,
  NOTA_MQL,
} from '../functions/api/_feedback-marketing-mql.js';
import { CU_FIELD } from '../functions/api/_clickup.js';

const card = (fat, status = 'leads de entrada', campo = {}) => ({
  id: 'x',
  status: { status },
  custom_fields: [{ id: CU_FIELD.faturamento, name: '🤑 Faturamento Mensal', type: 'short_text', value: fat, ...campo }],
});

// TODOS os valores reais do campo "🤑 Faturamento Mensal" nos cards dos últimos
// 90 dias (15/09/2026), com a contagem e o resultado do relatório atual.
const VALORES_REAIS = [
  ['', 224, false],
  ['Menos de 20 Mil', 86, false],
  ['De 20 a 30 Mil', 31, true], // decisão da usuária em 15/09: conta (teto > 20 mil)
  ['De 40 a 75 Mil', 22, true],
  ['De 75 a 100 Mil', 17, true],
  ['De 30 a 40 Mil', 15, true],
  ['De 200 a 300 Mil', 14, true],
  ['De 100 a 150 Mil', 13, true],
  ['De 150 a 200 Mil', 11, true],
  ['De 300 a 500 Mil', 11, true],
  ['Mais de 500Mil', 3, true],
  ['De 100 A 150 Mil', 2, true],
  ['De 20 a 50 Mil', 1, true],
  ['Mais de 500 Mil', 1, true],
  ['De 40 A 75 Mil', 1, true],
  ['Mais de 500mil', 1, true],
];

for (const [valor, cards, esperado] of VALORES_REAIS) {
  test(`valor real "${valor}" (${cards} cards/90d) → ${esperado ? 'MQL' : 'não MQL'}`, () => {
    assert.equal(faturamentoAcimaDe20Mil(valor), esperado);
    assert.equal(ehMql(card(valor)), esperado);
  });
}

test('casos exigidos: faixa alta sim, até 20 mil não, faixa até 20 mil não, acima de 50 mil sim', () => {
  assert.equal(faturamentoAcimaDe20Mil('De 150 a 200 Mil'), true);
  assert.equal(faturamentoAcimaDe20Mil('Até R$ 20 mil'), false);
  assert.equal(faturamentoAcimaDe20Mil('De 10 a 20 mil'), false);
  assert.equal(faturamentoAcimaDe20Mil('Acima de 50 mil'), true);
});

test('milhão vale × 1.000.000 (correção do bug do script)', () => {
  for (const t of ['Mais de 1 Milhão', 'mais de 1 milhao', 'De 1 a 2 milhões', 'Acima de 1 mi']) {
    assert.equal(faturamentoAcimaDe20Mil(t), true, t);
  }
  assert.deepEqual(valoresDeDinheiro('Mais de 1 Milhão'), [1000000]);
});

test('padrões de até R$ 20 mil', () => {
  for (const t of ['menos de 20k', 'Abaixo de R$ 20.000', 'até 20 mil', 'Até de R$20', 'R$ 20.000,00', '20 mil', '20k', ' 20  MIL ']) {
    assert.equal(faturamentoAcimaDe20Mil(t), false, t);
  }
});

test('um número: acima de 20 mil é MQL; 20 mil exatos não', () => {
  assert.equal(faturamentoAcimaDe20Mil('R$ 25.000'), true);
  assert.equal(faturamentoAcimaDe20Mil('30000'), true);
  assert.equal(faturamentoAcimaDe20Mil('Cerca de 20.000 reais'), false);
  assert.equal(faturamentoAcimaDe20Mil('15 mil'), false);
  assert.equal(faturamentoAcimaDe20Mil('1.500,00'), false);
});

test('faixa: basta o teto passar de 20 mil (decisão de 15/09)', () => {
  assert.equal(faturamentoAcimaDe20Mil('10-15 mil'), false);
  assert.equal(faturamentoAcimaDe20Mil('10-20 mil'), false);
  assert.equal(faturamentoAcimaDe20Mil('10 mil - 50 mil'), true);
  assert.equal(faturamentoAcimaDe20Mil('25 mil - 50 mil'), true);
});

test('sem número ou vazio não é MQL', () => {
  for (const t of ['Prefiro não informar', 'muito', '', '   ', null, undefined]) {
    assert.equal(faturamentoAcimaDe20Mil(t), false, String(t));
  }
});

test('valoresDeDinheiro: número perto de texto com "mil" vale mil vezes; formato brasileiro', () => {
  assert.deepEqual(valoresDeDinheiro('De 150 a 200 Mil'), [150000, 200000]);
  assert.deepEqual(valoresDeDinheiro('De 20 a 30 Mil'), [20000, 30000]);
  assert.deepEqual(valoresDeDinheiro('Mais de 500Mil'), [500000]);
  assert.deepEqual(valoresDeDinheiro('R$ 1.500,50'), [1500.5]);
  assert.deepEqual(valoresDeDinheiro('r$ 30'), [30000]);
  assert.deepEqual(valoresDeDinheiro('sem numero'), []);
});

test('ehMql: status desqualificado (qualquer grafia) nunca é MQL', () => {
  assert.equal(ehMql(card('De 200 a 300 Mil')), true);
  for (const s of ['desqualificado', 'Desqualificado', 'DESQUALIFICADO', ' desqualificado ']) {
    assert.equal(ehMql(card('De 200 a 300 Mil', s)), false, s);
  }
  assert.equal(ehMql(card('De 200 a 300 Mil', 'proposta recusada')), true);
});

test('ehMql: card sem faturamento é lead, não MQL', () => {
  assert.equal(ehMql(card(null)), false);
  assert.equal(ehMql(card('')), false);
  assert.equal(ehMql({ id: 'y', status: { status: 'reunião' }, custom_fields: [] }), false);
  assert.equal(ehMql(null), false);
});

test('ehMql: faturamento como dropdown (por orderindex ou id) e pelo nome antigo do campo', () => {
  const options = [{ id: 'op-baixo', name: 'Menos de 20 Mil', orderindex: 0 }, { id: 'op-alto', name: 'De 40 a 75 Mil', orderindex: 1 }];
  assert.equal(ehMql(card(1, 'leads de entrada', { type: 'drop_down', type_config: { options } })), true);
  assert.equal(ehMql(card('op-baixo', 'leads de entrada', { type: 'drop_down', type_config: { options } })), false);
  assert.equal(ehMql(card('De 40 a 75 Mil', 'leads de entrada', { id: 'outro', name: ':money_mouth_face: Faturamento Mensal' })), true);
});

test('contarMqls conta só os MQLs da lista', () => {
  assert.equal(contarMqls([card('De 40 a 75 Mil'), card('Menos de 20 Mil'), card('De 40 a 75 Mil', 'desqualificado'), card(null), card('De 20 a 30 Mil')]), 2);
  assert.equal(contarMqls([]), 0);
});

test('nota do critério', () => {
  assert.equal(NOTA_MQL, 'MQL reflete o status atual do card no CRM, no momento da consulta.');
});
