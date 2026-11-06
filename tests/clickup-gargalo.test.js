import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linhaGargalo } from '../functions/api/_clickup.js';

test('gargalo de entrada vira a linha do card', () => {
  assert.equal(linhaGargalo('entrada'), 'Gargalo escolhido no site: Entrada de revendedores (entra pouco revendedor novo)');
});

test('gargalo de recompra vira a linha do card', () => {
  assert.equal(linhaGargalo('recompra'), 'Gargalo escolhido no site: Recompra (o revendedor não volta a comprar)');
});

test('chave com espaço ou maiúscula ainda é reconhecida', () => {
  assert.equal(linhaGargalo(' Entrada '), linhaGargalo('entrada'));
});

test('sem gargalo (todas as outras páginas) não acrescenta linha', () => {
  assert.equal(linhaGargalo(undefined), '');
  assert.equal(linhaGargalo(''), '');
});

test('texto livre vindo do navegador nunca entra no card', () => {
  assert.equal(linhaGargalo('qualquer coisa'), '');
  assert.equal(linhaGargalo('<script>'), '');
});
