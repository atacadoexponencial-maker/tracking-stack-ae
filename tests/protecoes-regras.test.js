import { test } from 'node:test';
import assert from 'node:assert/strict';
import { examinarForma, situacaoDoItem, MOTIVOS, CATALOGO } from '../functions/api/_credenciais.js';
import { lerHorario, desvioMin, somarEvento, juntar, avaliarFonte, medianaAproximada, horasInteiras, ehSuspeito } from '../functions/api/_horario-fontes.js';

// --- credenciais ---

const obrig = { nome: 'X', obrigatoria: true };

test('critério 1: BOM no começo é caractere invisível (o incidente de 30/07)', () => {
  assert.deepEqual(examinarForma('﻿2800317883678788', { formato: 'numerico' }), ['invisivel']);
});

test('critério 2: largura zero no meio, quebra de linha no fim e aspas', () => {
  assert.deepEqual(examinarForma('abc​def'), ['invisivel']);
  assert.deepEqual(examinarForma('token\n'), ['pontas']);
  assert.deepEqual(examinarForma('"token"'), ['aspas']);
});

test('vários defeitos aparecem juntos, na ordem da spec', () => {
  assert.deepEqual(examinarForma('﻿ "tok" '), ['invisivel', 'pontas', 'aspas']);
});

test('formato conhecido', () => {
  assert.deepEqual(examinarForma('abc', { formato: 'numerico' }), ['formato']);
  assert.deepEqual(examinarForma('http://x', { formato: 'https' }), ['formato']);
  assert.deepEqual(examinarForma('G-3C24BQVR59', { formato: 'ga4' }), []);
});

test('critério 3: obrigatória ausente é problema; opcional ausente não se aplica', () => {
  assert.deepEqual(situacaoDoItem(obrig, examinarForma(undefined), undefined).motivos, [MOTIVOS.ausente]);
  assert.equal(situacaoDoItem({ obrigatoria: false }, examinarForma(undefined), undefined).situacao, 'nao_se_aplica');
  assert.equal(situacaoDoItem(obrig, examinarForma('   '), undefined).motivos[0], MOTIVOS.vazia);
});

test('critério 4: recusada é problema; sem resposta só vira problema na 2ª rodada automática', () => {
  assert.equal(situacaoDoItem(obrig, [], 'recusada').motivos[0], MOTIVOS.recusada);
  const r1 = situacaoDoItem(obrig, [], 'sem_resposta', { automatica: true, naoConfirmadoAntes: 0 });
  assert.equal(r1.situacao, 'nao_confirmado');
  assert.equal(situacaoDoItem(obrig, [], 'sem_resposta', { automatica: true, naoConfirmadoAntes: 1 }).situacao, 'problema');
});

test('sem teste de aceitação e forma limpa: ok, conferida só a forma', () => {
  const r = situacaoDoItem(obrig, [], undefined);
  assert.deepEqual([r.situacao, r.nota], ['ok', 'Conferida só a forma.']);
});

test('catálogo não repete nome', () => {
  const nomes = CATALOGO.map((c) => c.nome);
  assert.equal(new Set(nomes).size, nomes.length);
});

// --- horário ---

test('lerHorario: unix, ISO com fuso e texto sem fuso (lido como UTC)', () => {
  assert.equal(lerHorario(1789600000), 1789600000000);
  assert.equal(lerHorario('2026-09-16T12:00:00-03:00'), Date.parse('2026-09-16T15:00:00Z'));
  assert.equal(lerHorario('2026-09-16 12:00:00'), Date.parse('2026-09-16T12:00:00Z'));
  assert.equal(lerHorario('lixo'), null);
  assert.equal(lerHorario(''), null);
});

test('horas inteiras e suspeito por fonte', () => {
  assert.equal(horasInteiras(181), 3);
  assert.equal(horasInteiras(170), 0);
  assert.equal(ehSuspeito('clickup', 11), true);
  assert.equal(ehSuspeito('greenn', 20), false);
  assert.equal(ehSuspeito('greenn', -6), true, 'mais de 5 min no futuro');
});

test('critério 9: fonte com horário de Brasília marcado como UTC vira suspeito de ~3 h', () => {
  let r;
  for (let i = 0; i < 8; i++) r = somarEvento(r, 'greenn', 180 + (i % 2));
  const a = avaliarFonte(r);
  assert.equal(a.situacao, 'suspeito');
  assert.match(a.diagnostico, /3 h atrasados/);
});

test('critério 11: uma reentrega com 2 dias de atraso não torna a fonte suspeita', () => {
  let r;
  for (let i = 0; i < 9; i++) r = somarEvento(r, 'greenn', 1);
  r = somarEvento(r, 'greenn', 2 * 24 * 60);
  assert.equal(r.suspeitos, 1);
  assert.equal(avaliarFonte(r).situacao, 'normal');
});

test('pouco volume e eventos sem horário', () => {
  let r;
  for (let i = 0; i < 3; i++) r = somarEvento(r, 'clickup', 200);
  r = somarEvento(r, 'clickup', null);
  assert.equal(r.sem_horario, 1);
  assert.equal(avaliarFonte(r).situacao, 'pouco_volume');
});

test('mediana alta sem horas inteiras também é suspeita', () => {
  let r;
  for (let i = 0; i < 6; i++) r = somarEvento(r, 'clickup', 45);
  const a = avaliarFonte(r);
  assert.equal(a.situacao, 'suspeito');
  assert.equal(medianaAproximada(r.hist), 60);
});

test('juntar resumos de várias horas', () => {
  const a = somarEvento(undefined, 'greenn', 180);
  const b = somarEvento(undefined, 'greenn', 180);
  assert.deepEqual(juntar([a, b]).horas, { 3: 2 });
  assert.equal(desvioMin(0, 3 * 3600 * 1000), 180);
});
