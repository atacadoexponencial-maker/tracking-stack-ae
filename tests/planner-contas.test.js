// Testes das contas do planner (issue 301).

import test from 'node:test';
import assert from 'node:assert/strict';

import { somaDaBase, fraseDaBase, textoDoMinimo } from '../src/scripts/planner-contas.js';

test('40 ativos, 60 novos e 20 reativados dão 120', () => {
  assert.equal(somaDaBase(['40', '60', '20']), 120);
});

test('campo vazio conta como zero, sem quebrar a conta', () => {
  assert.equal(somaDaBase(['40', '', '20']), 60);
});

test('tudo vazio não vira zero', () => {
  assert.equal(somaDaBase(['', '', '']), null);
  assert.equal(fraseDaBase('{total} contra {ativos}', null, ''), '');
});

test('a frase troca total e ativos', () => {
  assert.equal(fraseDaBase('{total} contra {ativos}', 1200, '40'), '1.200 contra 40');
});

test('pedido mínimo sai na unidade escolhida', () => {
  assert.equal(textoDoMinimo('30', 'pecas'), '30 peças');
  assert.equal(textoDoMinimo('1500', 'reais'), 'R$ 1.500,00');
  assert.equal(textoDoMinimo('30', ''), '30');
  assert.equal(textoDoMinimo('', 'pecas'), '');
});
