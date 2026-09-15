import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolverPeriodo,
  limitesDoPeriodoUnix,
  ERRO_DATA_INVALIDA,
  ERRO_FIM_ANTES_DO_INICIO,
  ERRO_FUTURO,
  ERRO_LIMITE,
  AVISO_PARCIAL,
} from '../functions/api/_feedback-marketing-periodo.js';

const unix = (iso) => Date.parse(iso) / 1000;
// Terça 15/09/2026, 08:30 de Brasília — horário do job diário.
const TERCA = unix('2026-09-15T11:30:00Z');
// Segunda 14/09/2026, 08:30 de Brasília.
const SEGUNDA = unix('2026-09-14T11:30:00Z');

test('sem período: ontem, marcado como padrão', () => {
  assert.deepEqual(resolverPeriodo({}, TERCA), {
    ok: true,
    periodo: { inicio: '2026-09-14', fim: '2026-09-14', dias: 1, rotulo: '14/09', padrao: true, parcial: false },
    avisos: [],
  });
  assert.equal(resolverPeriodo({ inicio: '', fim: '  ' }, TERCA).periodo.padrao, true);
  assert.equal(resolverPeriodo({ inicio: null, fim: null }, TERCA).periodo.inicio, '2026-09-14');
});

test('sem período na segunda-feira: sexta a domingo', () => {
  assert.deepEqual(resolverPeriodo({}, SEGUNDA).periodo,
    { inicio: '2026-09-11', fim: '2026-09-13', dias: 3, rotulo: '11/09 a 13/09', padrao: true, parcial: false });
});

test('dia da semana e hoje vêm de Brasília, não de UTC', () => {
  // Segunda 00:30 em Brasília (03:30 UTC): já é segunda.
  assert.equal(resolverPeriodo({}, unix('2026-09-14T03:30:00Z')).periodo.inicio, '2026-09-11');
  // Domingo 23:30 em Brasília (segunda 02:30 UTC): ainda é domingo → sábado.
  assert.deepEqual(
    [resolverPeriodo({}, unix('2026-09-14T02:30:00Z')).periodo.inicio, resolverPeriodo({}, unix('2026-09-14T02:30:00Z')).periodo.dias],
    ['2026-09-12', 1],
  );
});

test('uma data só é aquele dia; duas datas são intervalo inclusivo', () => {
  assert.deepEqual(resolverPeriodo({ inicio: '2026-09-10' }, TERCA).periodo,
    { inicio: '2026-09-10', fim: '2026-09-10', dias: 1, rotulo: '10/09', padrao: false, parcial: false });
  assert.equal(resolverPeriodo({ fim: '2026-09-10' }, TERCA).periodo.inicio, '2026-09-10');
  assert.deepEqual(resolverPeriodo({ inicio: '2026-09-07', fim: '2026-09-13' }, TERCA).periodo,
    { inicio: '2026-09-07', fim: '2026-09-13', dias: 7, rotulo: '07/09 a 13/09', padrao: false, parcial: false });
  // Virada de mês e de ano.
  assert.equal(resolverPeriodo({ inicio: '2025-12-30', fim: '2026-01-02' }, TERCA).periodo.dias, 4);
});

test('formato inválido e data inexistente: mesma mensagem', () => {
  for (const inicio of ['14/09/2026', '2026-9-14', 'abc', '2026-09-31', '2026-02-29', '2026-13-01', '2026-00-10']) {
    assert.deepEqual(resolverPeriodo({ inicio }, TERCA), { ok: false, erro: ERRO_DATA_INVALIDA }, inicio);
  }
  assert.deepEqual(resolverPeriodo({ inicio: '2026-09-01', fim: '2026-09-31' }, TERCA), { ok: false, erro: ERRO_DATA_INVALIDA });
  // 29/02 existe em ano bissexto.
  assert.equal(resolverPeriodo({ inicio: '2024-02-29' }, TERCA).ok, true);
});

test('fim antes do início e fim no futuro são recusados', () => {
  assert.deepEqual(resolverPeriodo({ inicio: '2026-09-14', fim: '2026-09-13' }, TERCA), { ok: false, erro: ERRO_FIM_ANTES_DO_INICIO });
  assert.deepEqual(resolverPeriodo({ inicio: '2026-09-14', fim: '2026-09-16' }, TERCA), { ok: false, erro: ERRO_FUTURO });
  assert.deepEqual(resolverPeriodo({ inicio: '2026-09-16' }, TERCA), { ok: false, erro: ERRO_FUTURO });
});

test('até 92 dias inclusive; 93 é recusado', () => {
  const r92 = resolverPeriodo({ inicio: '2026-06-15', fim: '2026-09-14' }, TERCA);
  assert.deepEqual([r92.ok, r92.periodo.dias], [true, 92]);
  assert.deepEqual(resolverPeriodo({ inicio: '2026-06-14', fim: '2026-09-14' }, TERCA), { ok: false, erro: ERRO_LIMITE });
});

test('período que inclui hoje é parcial e traz o aviso', () => {
  const r = resolverPeriodo({ inicio: '2026-09-14', fim: '2026-09-15' }, TERCA);
  assert.deepEqual([r.ok, r.periodo.parcial, r.avisos], [true, true, [AVISO_PARCIAL]]);
  assert.equal(resolverPeriodo({ inicio: '2026-09-15' }, TERCA).periodo.parcial, true);
});

test('limites em unix: da meia-noite de Brasília do início à do dia seguinte ao fim', () => {
  assert.deepEqual(limitesDoPeriodoUnix({ inicio: '2026-09-11', fim: '2026-09-13' }), {
    desde: unix('2026-09-11T03:00:00Z'),
    ate: unix('2026-09-14T03:00:00Z'),
  });
  assert.deepEqual(limitesDoPeriodoUnix({ inicio: '2026-12-31', fim: '2026-12-31' }), {
    desde: unix('2026-12-31T03:00:00Z'),
    ate: unix('2027-01-01T03:00:00Z'),
  });
});
