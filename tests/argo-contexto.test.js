import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarContexto, montarContexto, montarItem, diasDesde, eventosNoPeriodo, hojeBrt } from '../functions/api/_argo-contexto.js';

const HOJE = '2026-10-04';
const linha = (o) => ({ id: 1, tipo: 'prioridade', titulo: 'SE é prioridade', texto: '', funil: null, inicio: null, fim: null,
  validade_dias: 30, revisado_em: '2026-10-01T15:00:00Z', arquivado_em: null, ...o });

test('validar: criar exige tipo e título', () => {
  assert.equal(validarContexto({ acao: 'criar', titulo: 'x' }).erro, 'Escolha o tipo do item.');
  assert.equal(validarContexto({ acao: 'criar', tipo: 'oferta', titulo: '   ' }).erro, 'Escreva um título.');
  const ok = validarContexto({ acao: 'criar', tipo: 'oferta', titulo: ' Workshop a R$ 47 ', texto: ' x ' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.valores, { tipo: 'oferta', titulo: 'Workshop a R$ 47', texto: 'x', funil: null, inicio: null, fim: null, validade_dias: 30 });
});

test('validar: evento exige as duas datas e fim depois do início', () => {
  assert.equal(validarContexto({ acao: 'criar', tipo: 'evento', titulo: 'Live' }).erro, 'Evento precisa de data de início e de fim.');
  assert.equal(validarContexto({ acao: 'criar', tipo: 'evento', titulo: 'Live', inicio: '2026-10-07', fim: '2026-10-06' }).erro, 'A data de fim é antes do início.');
  assert.equal(validarContexto({ acao: 'criar', tipo: 'evento', titulo: 'Live', inicio: '07/10/2026', fim: '2026-10-07' }).ok, false);
  const ok = validarContexto({ acao: 'criar', tipo: 'evento', titulo: 'Live', inicio: '2026-10-07', fim: '2026-10-07' });
  assert.equal(ok.valores.inicio, '2026-10-07');
});

test('validar: datas de item que não é evento são ignoradas', () => {
  const r = validarContexto({ acao: 'criar', tipo: 'oferta', titulo: 'x', inicio: '2026-10-07', fim: '2026-10-08' });
  assert.equal(r.valores.inicio, null);
  assert.equal(r.valores.fim, null);
});

test('validar: validade só da lista, ações conhecidas, id positivo', () => {
  assert.equal(validarContexto({ acao: 'criar', tipo: 'oferta', titulo: 'x', validade_dias: 45 }).erro, 'Validade inválida.');
  assert.equal(validarContexto({ acao: 'apagar', id: 1 }).erro, 'Ação desconhecida.');
  assert.equal(validarContexto({ acao: 'revisar', id: 'abc' }).erro, 'Item inválido.');
  assert.deepEqual(validarContexto({ acao: 'arquivar', id: 7 }), { ok: true, acao: 'arquivar', id: 7, valores: null });
  assert.equal(validarContexto(null).ok, false);
});

test('dias desde a revisão contam no fuso de Brasília', () => {
  // 03/10 23h30 BRT = 04/10 02h30 UTC: revisado "ontem" em Brasília.
  assert.equal(diasDesde('2026-10-04T02:30:00Z', HOJE), 1);
  assert.equal(diasDesde('2026-10-04T12:00:00Z', HOJE), 0);
});

test('situação: em dia, revisar, terminado e arquivado', () => {
  assert.equal(montarItem(linha({}), HOJE).situacao, 'em_dia');
  assert.equal(montarItem(linha({ revisado_em: '2026-08-24T12:00:00Z' }), HOJE).situacao, 'revisar');
  assert.equal(montarItem(linha({ tipo: 'evento', inicio: '2026-09-23', fim: '2026-09-23', revisado_em: '2026-01-01T12:00:00Z' }), HOJE).situacao, 'terminado');
  assert.equal(montarItem(linha({ arquivado_em: '2026-10-02T12:00:00Z', revisado_em: '2026-01-01T12:00:00Z' }), HOJE).situacao, 'arquivado');
  // Evento que termina hoje ainda vale.
  assert.equal(montarItem(linha({ tipo: 'evento', inicio: '2026-10-04', fim: '2026-10-04' }), HOJE).situacao, 'em_dia');
});

test('datas do Postgres (Date) viram ISO de dia', () => {
  const i = montarItem(linha({ tipo: 'evento', inicio: new Date('2026-10-07T00:00:00Z'), fim: new Date('2026-10-08T00:00:00Z') }), HOJE);
  assert.equal(i.inicio, '2026-10-07');
  assert.equal(i.fim, '2026-10-08');
});

test('lista: revisar primeiro, terminados e arquivados à parte, resumo', () => {
  const r = montarContexto([
    linha({ id: 1 }),
    linha({ id: 2, revisado_em: '2026-08-24T12:00:00Z' }),
    linha({ id: 3, tipo: 'evento', inicio: '2026-09-23', fim: '2026-09-23' }),
    linha({ id: 4, arquivado_em: '2026-10-02T12:00:00Z' }),
  ], HOJE);
  assert.deepEqual(r.valendo.map((i) => i.id), [2, 1]);
  assert.deepEqual(r.terminados.map((i) => i.id), [3]);
  assert.deepEqual(r.arquivados.map((i) => i.id), [4]);
  assert.deepEqual(r.resumo, { valendo: 2, revisar: 1, terminados: 1 });
});

test('eventos no período: toca a semana por qualquer ponta', () => {
  const itens = montarContexto([
    linha({ id: 1, tipo: 'evento', inicio: '2026-09-30', fim: '2026-10-01' }),
    linha({ id: 2, tipo: 'evento', inicio: '2026-10-05', fim: '2026-10-06' }),
    linha({ id: 3, tipo: 'evento', inicio: '2026-09-27', fim: '2026-09-28' }),
  ], HOJE);
  const todos = [...itens.valendo, ...itens.terminados];
  assert.deepEqual(eventosNoPeriodo(todos, '2026-09-28', '2026-10-04').map((i) => i.id).sort(), [1, 3]);
});

test('hoje em Brasília', () => {
  assert.equal(hojeBrt(Date.parse('2026-10-05T02:00:00Z')), '2026-10-04');
});
