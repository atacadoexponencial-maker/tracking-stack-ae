import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vidaRestanteFbc, fbcValido, fbclidValido, FBC_VALIDADE_MS } from '../functions/_fbc.js';

const AGORA = 1_789_600_000_000;
// Formato de um fbclid real (147 caracteres, sufixo _aem_)
const FBCLID = 'IwcGRvZgRleHRuA2FlbQIxMQBzcnRjBmFwcF9pZAwyNTYyODEwNDA1NTgAAR7x9-4nPGrZSNdyVV9H7EExhV7HEprZ-8chz8wA0DjNOtgdSUdsDyly7ip99Q_aem_PGwqJf3eNPt2q8I6HR6TqA';

test('fbc recém-criado tem os 90 dias inteiros', () => {
  assert.equal(vidaRestanteFbc(`fb.1.${AGORA}.${FBCLID}`, AGORA), FBC_VALIDADE_MS);
});

test('fbc com 89 dias ainda vale; com 90 dias não vale mais', () => {
  const dia = 24 * 3600 * 1000;
  assert.equal(fbcValido(`fb.1.${AGORA - 89 * dia}.${FBCLID}`, AGORA), true);
  assert.equal(fbcValido(`fb.1.${AGORA - 90 * dia}.${FBCLID}`, AGORA), false);
});

test('fbc malformado não vale', () => {
  for (const v of ['', null, 'fb.1.x', 'xx.1.123.abc', 'fb.1.abc.def']) {
    assert.equal(fbcValido(v, AGORA), false, String(v));
  }
});

test('fbc com sufixo do Parameter Builder continua legível', () => {
  assert.equal(fbcValido(`fb.1.${AGORA}.${FBCLID}.AQ`, AGORA), true);
});

test('fbclid de exemplo ou de teste não vale, nem dentro do fbc', () => {
  for (const v of ['fbclid', 'auditoria', 'abc123', '', null, 'IwAR 123%20abcdefghijklmnop']) {
    assert.equal(fbclidValido(v), false, String(v));
  }
  assert.equal(fbcValido(`fb.1.${AGORA}.fbclid`, AGORA), false);
});

test('fbclid real vale, inclusive o reescrito pelo WhatsApp', () => {
  assert.equal(fbclidValido(FBCLID), true);
  assert.equal(fbclidValido('IwAR7evGlVsvJQGF7smeIB6eX5WM-ylHEuSy58qFnLoi5EmUyK8BfYAA3pRCUGZw_wapm_Fbdm_UsdReeegra3zfmt9w_waaem_JKJ98RdeS2ieC7SuN1K5Mg'), true);
});
