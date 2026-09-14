import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ymdBrt, inicioDoDiaBrt, meiaNoiteHojeBrt } from '../functions/api/_data-brt.js';

// 2026-09-01T02:30:00Z = 31/08 23:30 em Brasília. É o caso que a conversão em
// UTC errava: o dia "virava" três horas antes do que o negócio considera.
const NOITE_DE_31 = Date.parse('2026-09-01T02:30:00Z') / 1000;

test('ymdBrt devolve o dia de Brasília, não o dia UTC', () => {
  assert.equal(ymdBrt(NOITE_DE_31), '2026-08-31');
  assert.equal(new Date(NOITE_DE_31 * 1000).toISOString().slice(0, 10), '2026-09-01', 'o UTC diria dia 1');
});

test('ymdBrt na virada exata: 03:00Z já é o dia seguinte em Brasília', () => {
  assert.equal(ymdBrt(Date.parse('2026-09-01T03:00:00Z') / 1000), '2026-09-01');
  assert.equal(ymdBrt(Date.parse('2026-09-01T02:59:59Z') / 1000), '2026-08-31');
});

test('ymdBrt aceita string numérica e rejeita lixo sem lançar', () => {
  assert.equal(ymdBrt(String(NOITE_DE_31)), '2026-08-31');
  assert.equal(ymdBrt('abc'), null);
  assert.equal(ymdBrt(undefined), null);
});

test('inicioDoDiaBrt é a meia-noite de Brasília em unix (03:00Z)', () => {
  assert.equal(inicioDoDiaBrt('2026-09-13'), Date.parse('2026-09-13T03:00:00Z') / 1000);
  assert.equal(inicioDoDiaBrt('13/09/2026'), null);
  assert.equal(inicioDoDiaBrt(null), null);
});

test('ymdBrt e inicioDoDiaBrt fecham o ciclo', () => {
  const inicio = inicioDoDiaBrt('2026-08-31');
  assert.equal(ymdBrt(inicio), '2026-08-31');
  assert.equal(ymdBrt(inicio - 1), '2026-08-30');
});

test('meiaNoiteHojeBrt usa o instante injetado', () => {
  // 13/09 01:00 em Brasília (04:00Z): a meia-noite de "hoje" é 13/09 03:00Z.
  const agora = Date.parse('2026-09-13T04:00:00Z') / 1000;
  assert.equal(meiaNoiteHojeBrt(agora), Date.parse('2026-09-13T03:00:00Z') / 1000);
  // 13/09 00:30Z ainda é 12/09 21:30 em Brasília: a meia-noite é a de 12/09.
  const antes = Date.parse('2026-09-13T00:30:00Z') / 1000;
  assert.equal(meiaNoiteHojeBrt(antes), Date.parse('2026-09-12T03:00:00Z') / 1000);
});
