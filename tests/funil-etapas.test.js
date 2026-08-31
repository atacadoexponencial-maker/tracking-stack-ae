import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarFunil, avisoInicioColeta } from '../functions/api/_funil-etapas.js';

// Funil realista de uma LP com formulário de 3 etapas.
const COMPLETO = {
  visitantes: 1000,
  cliques: 320,
  formStarts: 180,
  etapas: [
    { step: 1, sessoes: 140 },
    { step: 2, sessoes: 95 },
  ],
  leads: 70,
};

const chaves = (r) => r.degraus.map((d) => d.chave);
const numeros = (r) => r.degraus.map((d) => d.sessoes);

test('degraus saem na ordem do funil, com as etapas no meio', () => {
  const r = montarFunil(COMPLETO);
  assert.deepEqual(chaves(r), ['visita', 'clique', 'formStart', 'etapa-1', 'etapa-2', 'lead']);
  assert.deepEqual(numeros(r), [1000, 320, 180, 140, 95, 70]);
});

test('a passagem é sobre o degrau anterior, não sobre o total', () => {
  const r = montarFunil(COMPLETO);
  const porChave = Object.fromEntries(r.degraus.map((d) => [d.chave, d.passagem]));
  assert.equal(porChave.visita, null); // o primeiro degrau não tem de onde cair
  assert.equal(porChave.clique, 320 / 1000);
  assert.equal(porChave.formStart, 180 / 320);
  assert.equal(porChave['etapa-1'], 140 / 180);
  assert.equal(porChave['etapa-2'], 95 / 140);
  assert.equal(porChave.lead, 70 / 95);
});

test('a maior queda é a MENOR passagem — onde mais gente desiste', () => {
  const r = montarFunil(COMPLETO);
  const marcados = r.degraus.filter((d) => d.maiorQueda);
  assert.equal(marcados.length, 1);
  // 320/1000 = 32% é a menor de todas.
  assert.equal(marcados[0].chave, 'clique');
});

test('só os degraus novos levam a marca de novo — os antigos têm histórico real', () => {
  const r = montarFunil(COMPLETO);
  const novos = r.degraus.filter((d) => d.novo).map((d) => d.chave);
  assert.deepEqual(novos, ['clique', 'etapa-1', 'etapa-2']);
});

// ---------------------------------------------------------------------------
// Normalização: a tela nunca exibe um funil que cresce.
// ---------------------------------------------------------------------------

test('funil que sobe é normalizado — etapa perdida não vira degrau menor que o lead', () => {
  // 110 leads com só 95 na etapa 2: um FormStep se perdeu por falha de rede.
  const r = montarFunil({ ...COMPLETO, leads: 110 });
  const nums = numeros(r);
  for (let i = 1; i < nums.length; i += 1) {
    assert.ok(nums[i] <= nums[i - 1], `degrau ${i} (${nums[i]}) maior que o anterior (${nums[i - 1]})`);
  }
  // A etapa 2 sobe para o valor do lead; o que veio depois dela não diminui.
  assert.equal(nums[nums.length - 1], 110);
  assert.equal(nums[nums.length - 2], 110);
});

test('a normalização se propaga para a esquerda, não só um degrau', () => {
  const r = montarFunil({ visitantes: 0, cliques: 0, formStarts: 0, etapas: [], leads: 50 });
  assert.deepEqual(numeros(r), [50, 50, 50, 50]);
});

test('funil já decrescente não é alterado pela normalização', () => {
  assert.deepEqual(numeros(montarFunil(COMPLETO)), [1000, 320, 180, 140, 95, 70]);
});

// ---------------------------------------------------------------------------
// Bordas aritméticas: a tela prefere um funil incompleto a uma tela quebrada.
// ---------------------------------------------------------------------------

test('degrau anterior zerado devolve passagem null, nunca Infinity nem NaN', () => {
  const r = montarFunil({ visitantes: 0, cliques: 0, formStarts: 0, etapas: [], leads: 0 });
  for (const d of r.degraus) {
    assert.equal(d.passagem, null);
    assert.equal(d.sessoes, 0);
  }
});

test('números ausentes ou inválidos do banco viram 0, sem lançar', () => {
  const r = montarFunil({
    visitantes: null,
    cliques: undefined,
    formStarts: NaN,
    etapas: [{ step: 1, sessoes: null }],
    leads: 'abc',
  });
  assert.deepEqual(numeros(r), [0, 0, 0, 0, 0]);
});

test('chamada sem argumento nenhum não quebra', () => {
  const r = montarFunil();
  assert.deepEqual(chaves(r), ['visita', 'clique', 'formStart', 'lead']);
  assert.equal(r.avisoInicioColetaMs, null);
});

// ---------------------------------------------------------------------------
// Etapas: descobertas a partir do dado, nunca de uma lista escrita à mão.
// ---------------------------------------------------------------------------

test('formulário de etapa única não gera degrau de etapa (não exibir lista vazia)', () => {
  const r = montarFunil({ ...COMPLETO, etapas: [] });
  assert.deepEqual(chaves(r), ['visita', 'clique', 'formStart', 'lead']);
});

test('etapas fora de ordem são ordenadas por step', () => {
  const r = montarFunil({
    ...COMPLETO,
    etapas: [{ step: 3, sessoes: 80 }, { step: 1, sessoes: 140 }, { step: 2, sessoes: 95 }],
  });
  assert.deepEqual(chaves(r), ['visita', 'clique', 'formStart', 'etapa-1', 'etapa-2', 'etapa-3', 'lead']);
});

test('buraco na numeração usa o que existe, sem inventar nem reindexar', () => {
  const r = montarFunil({ ...COMPLETO, etapas: [{ step: 1, sessoes: 140 }, { step: 3, sessoes: 80 }] });
  // A etapa 3 continua se chamando 3: reindexar mentiria sobre qual etapa é qual.
  assert.deepEqual(chaves(r), ['visita', 'clique', 'formStart', 'etapa-1', 'etapa-3', 'lead']);
});

test('formulário com 4 etapas aparece inteiro, sem mudar código', () => {
  const r = montarFunil({
    ...COMPLETO,
    etapas: [1, 2, 3, 4].map((step) => ({ step, sessoes: 200 - step * 10 })),
  });
  assert.equal(r.degraus.filter((d) => d.chave.startsWith('etapa-')).length, 4);
});

test('etapa sem step utilizável é descartada, não vira etapa-NaN', () => {
  const r = montarFunil({ ...COMPLETO, etapas: [{ sessoes: 10 }, { step: 'x', sessoes: 10 }, { step: 1, sessoes: 140 }] });
  assert.deepEqual(chaves(r).filter((c) => c.startsWith('etapa-')), ['etapa-1']);
});

// ---------------------------------------------------------------------------
// Aviso de início da coleta (decisão 7 da spec).
// ---------------------------------------------------------------------------

const em = (iso) => Date.parse(`${iso}-03:00`);

test('avisa quando o período consultado começa ANTES do início da coleta', () => {
  const r = montarFunil({
    ...COMPLETO,
    inicioColetaMs: em('2026-09-05T00:00:00'),
    periodoInicioMs: em('2026-07-01T00:00:00'),
  });
  assert.equal(r.avisoInicioColetaMs, em('2026-09-05T00:00:00'));
});

test('período inteiramente dentro da coleta não leva aviso', () => {
  const r = montarFunil({
    ...COMPLETO,
    inicioColetaMs: em('2026-09-05T00:00:00'),
    periodoInicioMs: em('2026-09-10T00:00:00'),
  });
  assert.equal(r.avisoInicioColetaMs, null);
});

test('período que começa no instante exato da coleta não leva aviso', () => {
  const alvo = em('2026-09-05T00:00:00');
  assert.equal(avisoInicioColeta(alvo, alvo), null);
});

test('sem nenhum evento novo gravado ainda, não há data para anunciar', () => {
  const r = montarFunil({
    visitantes: 800,
    cliques: 0,
    formStarts: 120,
    etapas: [],
    leads: 40,
    inicioColetaMs: null,
    periodoInicioMs: em('2026-07-01T00:00:00'),
  });
  assert.equal(r.avisoInicioColetaMs, null);
  // E o funil continua de pé, com os degraus novos zerados (normalizados).
  assert.equal(r.degraus.length, 4);
});

test('instantes inválidos não viram aviso', () => {
  assert.equal(avisoInicioColeta(NaN, 1), null);
  assert.equal(avisoInicioColeta(1, NaN), null);
  assert.equal(avisoInicioColeta(undefined, undefined), null);
  assert.equal(avisoInicioColeta(null, 1), null);
});

// ---------------------------------------------------------------------------
// Pureza: o módulo não pode ler relógio nem I/O — é o que o torna testável.
// ---------------------------------------------------------------------------

test('a mesma entrada devolve sempre a mesma saída', () => {
  const entrada = { ...COMPLETO, inicioColetaMs: em('2026-09-05T00:00:00'), periodoInicioMs: em('2026-07-01T00:00:00') };
  assert.deepEqual(montarFunil(entrada), montarFunil(entrada));
});

test('a entrada não é mutada — o array de etapas do chamador fica intacto', () => {
  const etapas = [{ step: 2, sessoes: 95 }, { step: 1, sessoes: 140 }];
  montarFunil({ ...COMPLETO, etapas });
  assert.deepEqual(etapas.map((e) => e.step), [2, 1]);
});
