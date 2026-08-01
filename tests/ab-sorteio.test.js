import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escolherVariante, hashSessao } from '../functions/_ab-sorteio.js';

const teste = (over = {}) => ({
  slug: 'home-oferta',
  status: 'ativo',
  variantes: [
    { chave: 'a', peso: 50, page_path: '' },
    { chave: 'b', peso: 50, page_path: '/ab/home-oferta/b' },
  ],
  ...over,
});

const ids = (n) => Array.from({ length: n }, (_, i) => `sessao-${i}-${(i * 7919) % 1000}`);

test('o mesmo session_id sempre cai na mesma variante', () => {
  const t = teste();
  const primeira = escolherVariante(t, 'abc-123');
  for (let i = 0; i < 50; i++) {
    assert.equal(escolherVariante(t, 'abc-123'), primeira);
  }
});

test('session_ids diferentes caem em variantes diferentes', () => {
  const t = teste();
  const vistas = new Set(ids(200).map((id) => escolherVariante(t, id)));
  assert.deepEqual([...vistas].sort(), ['a', 'b']);
});

test('10 mil ids distribuem conforme o peso 50/50 (tolerancia 2 pontos)', () => {
  const t = teste();
  const lista = ids(10000);
  const bs = lista.filter((id) => escolherVariante(t, id) === 'b').length;
  const pct = (bs / lista.length) * 100;
  assert.ok(Math.abs(pct - 50) <= 2, `esperado ~50%, veio ${pct.toFixed(2)}%`);
});

test('peso 80/20 e respeitado (tolerancia 2 pontos)', () => {
  const t = teste({
    variantes: [
      { chave: 'a', peso: 80, page_path: '' },
      { chave: 'b', peso: 20, page_path: '/ab/home-oferta/b' },
    ],
  });
  const lista = ids(10000);
  const pct = (lista.filter((id) => escolherVariante(t, id) === 'b').length / lista.length) * 100;
  assert.ok(Math.abs(pct - 20) <= 2, `esperado ~20%, veio ${pct.toFixed(2)}%`);
});

test('o slug muda a divisao: dois testes nao repartem o publico igual', () => {
  const a = teste({ slug: 'teste-um' });
  const b = teste({ slug: 'teste-dois' });
  const lista = ids(1000);
  const iguais = lista.filter((id) => escolherVariante(a, id) === escolherVariante(b, id)).length;
  // Se o slug fosse ignorado, seriam 100% iguais.
  assert.ok(iguais > 350 && iguais < 650, `esperado ~50% de coincidencia, veio ${iguais / 10}%`);
});

test('teste pausado, encerrado, rascunho ou ausente devolve a', () => {
  assert.equal(escolherVariante(teste({ status: 'pausado' }), 'x'), 'a');
  assert.equal(escolherVariante(teste({ status: 'encerrado' }), 'x'), 'a');
  assert.equal(escolherVariante(teste({ status: 'rascunho' }), 'x'), 'a');
  assert.equal(escolherVariante(null, 'x'), 'a');
  assert.equal(escolherVariante(undefined, 'x'), 'a');
});

test('pesos que nao somam 100 devolvem a', () => {
  const t = teste({
    variantes: [
      { chave: 'a', peso: 50, page_path: '' },
      { chave: 'b', peso: 30, page_path: '/ab/home-oferta/b' },
    ],
  });
  assert.equal(escolherVariante(t, 'x'), 'a');
});

test('teste sem as duas variantes devolve a', () => {
  assert.equal(escolherVariante(teste({ variantes: [] }), 'x'), 'a');
  assert.equal(escolherVariante(teste({ variantes: [{ chave: 'a', peso: 100, page_path: '' }] }), 'x'), 'a');
});

test('session_id vazio devolve a', () => {
  assert.equal(escolherVariante(teste(), ''), 'a');
  assert.equal(escolherVariante(teste(), null), 'a');
});

test('hashSessao devolve inteiro nao-negativo e estavel', () => {
  const h = hashSessao('abc', 'slug');
  assert.ok(Number.isInteger(h) && h >= 0);
  assert.equal(h, hashSessao('abc', 'slug'));
  assert.notEqual(h, hashSessao('abd', 'slug'));
});
