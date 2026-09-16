import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vidaRestanteFbc, fbcValido, FBC_VALIDADE_MS } from '../functions/_fbc.js';

const AGORA = 1_789_600_000_000;

test('fbc recém-criado tem os 90 dias inteiros', () => {
  assert.equal(vidaRestanteFbc(`fb.1.${AGORA}.IwAR123`, AGORA), FBC_VALIDADE_MS);
});

test('fbc com 89 dias ainda vale; com 90 dias não vale mais', () => {
  const dia = 24 * 3600 * 1000;
  assert.equal(fbcValido(`fb.1.${AGORA - 89 * dia}.x`, AGORA), true);
  assert.equal(fbcValido(`fb.1.${AGORA - 90 * dia}.x`, AGORA), false);
});

test('fbc malformado não vale', () => {
  for (const v of ['', null, 'fb.1.x', 'xx.1.123.abc', 'fb.1.abc.def']) {
    assert.equal(fbcValido(v, AGORA), false, String(v));
  }
});

test('fbclid com pontos ou sufixo do Parameter Builder continua legível', () => {
  assert.equal(fbcValido(`fb.1.${AGORA}.IwAR.abc.AQ`, AGORA), true);
});
