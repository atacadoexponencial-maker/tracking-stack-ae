import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAIS, FUNIL_MATERIAIS, materialPorSlug } from '../src/data/materiais.js';

test('slug válido devolve o material com o destino', () => {
  const m = materialPorSlug('icp');
  assert.ok(m, 'o material do ICP precisa existir no catálogo');
  assert.equal(m.slug, 'icp');
  assert.match(m.destino, /^https:\/\//);
});

test('slug é case-insensitive e tolera espaços', () => {
  assert.equal(materialPorSlug(' ICP ')?.slug, 'icp');
});

test('slug desconhecido, vazio ou ausente devolve null', () => {
  assert.equal(materialPorSlug('nao-existe'), null);
  assert.equal(materialPorSlug(''), null);
  assert.equal(materialPorSlug(undefined), null);
  assert.equal(materialPorSlug(null), null);
});

test('todos os slugs do catálogo são únicos', () => {
  const slugs = MATERIAIS.map((m) => m.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('toda entrada tem os campos que a página e o tracker consomem', () => {
  for (const m of MATERIAIS) {
    assert.ok(m.slug && typeof m.slug === 'string', `slug ausente em ${JSON.stringify(m)}`);
    assert.equal(m.slug, m.slug.toLowerCase(), `slug precisa ser minúsculo: ${m.slug}`);
    assert.ok(m.titulo, `titulo ausente em ${m.slug}`);
    assert.ok(m.subtitulo, `subtitulo ausente em ${m.slug}`);
    assert.match(m.destino, /^https:\/\//, `destino inválido em ${m.slug}`);
  }
});

test('o funil das iscas é o mesmo para todos os materiais', () => {
  assert.equal(FUNIL_MATERIAIS, 'iscas-manychat');
});
