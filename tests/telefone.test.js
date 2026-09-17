import { test } from 'node:test';
import assert from 'node:assert/strict';
import { padronizarTelefone, variantesTelefone } from '../functions/_telefone.js';

const dig = (v) => padronizarTelefone(v).digitos;
const sit = (v) => padronizarTelefone(v).situacao;

test('critério 14: formas do mesmo celular viram 5511987654321', () => {
  for (const v of ['(11) 98765-4321', '11987654321', '5511987654321', '551187654321', '+55 11 8765-4321', '+55 (11) 98765-4321', '0055 11 98765 4321']) {
    assert.equal(dig(v), '5511987654321', v);
    assert.equal(sit(v), 'celular', v);
  }
});

test('caso real do nono dígito (WhatsApp × formulário)', () => {
  assert.equal(dig('558496078857'), dig('+5584996078857'));
  assert.equal(dig('558496078857'), '5584996078857');
});

test('fixo recebe 55 e não recebe nono dígito', () => {
  assert.equal(dig('(11) 3456-7890'), '551134567890');
  assert.equal(sit('(11) 3456-7890'), 'fixo');
  assert.equal(dig('551134567890'), '551134567890');
});

test('zero de discagem e código de operadora são removidos', () => {
  assert.equal(dig('011987654321'), '5511987654321');
  assert.equal(dig('0 15 11 98765-4321'), '5511987654321');
});

test('critério 15: estrangeiro preservado, impossível fica como veio', () => {
  assert.deepEqual([dig('+1 415 555 0100'), sit('+1 415 555 0100')], ['14155550100', 'estrangeiro']);
  assert.deepEqual([dig('123'), sit('123')], ['123', 'impossivel']);
  assert.deepEqual([dig('55001234567890'), sit('55001234567890')], ['55001234567890', 'impossivel']);
});

test('DDD inexistente num número com cara de brasileiro é impossível', () => {
  assert.equal(sit('5520987654321'), 'impossivel');
  assert.equal(sit('20987654321'), 'impossivel');
});

test('todos os dígitos iguais é impossível; ausente é ausente', () => {
  assert.equal(sit('99999999999'), 'impossivel');
  assert.deepEqual([dig(''), sit(null)], ['', 'ausente']);
});

test('variantes: celular traz a forma sem o 9 para achar lead antigo', () => {
  assert.deepEqual(variantesTelefone('(11) 98765-4321'), ['5511987654321', '551187654321']);
  assert.deepEqual(variantesTelefone('(11) 3456-7890'), ['551134567890']);
  assert.deepEqual(variantesTelefone(''), []);
});
