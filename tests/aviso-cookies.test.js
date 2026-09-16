import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarSituacaoAviso } from '../functions/_aviso-cookies.js';

test('situações válidas passam como estão', () => {
  assert.equal(normalizarSituacaoAviso('aviso exibido'), 'aviso exibido');
  assert.equal(normalizarSituacaoAviso('aviso fechado'), 'aviso fechado');
});

test('maiúsculas e espaços não quebram', () => {
  assert.equal(normalizarSituacaoAviso('  Aviso Fechado '), 'aviso fechado');
});

test('ausente ou desconhecido vira unknown, sem recusar o evento', () => {
  for (const v of [undefined, null, '', 'granted', 'unknown', 'aviso aceito', 42]) {
    assert.equal(normalizarSituacaoAviso(v), 'unknown', String(v));
  }
});
