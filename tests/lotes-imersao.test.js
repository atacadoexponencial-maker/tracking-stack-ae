import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOTES_IMERSAO, VALOR_CHEIO_IMERSAO } from '../src/data/lotes-imersao.js';
import { loteVigente, textoProximo, fracaoDecorrida, LOTES } from '../src/data/lotes-workshop.js';

// Instantes de Brasília com deslocamento explícito: epoch em ms, sem fuso.
const em = (iso) => Date.parse(`${iso}-03:00`);
const vigente = (iso) => loteVigente(em(iso), LOTES_IMERSAO);

test('tabela: 7 lotes contíguos (o fim de um é o início do seguinte)', () => {
  assert.equal(LOTES_IMERSAO.length, 7);
  for (let i = 0; i < LOTES_IMERSAO.length - 1; i += 1) {
    assert.equal(LOTES_IMERSAO[i].fim, LOTES_IMERSAO[i + 1].inicio);
  }
});

test('preço riscado é R$ 97', () => {
  assert.equal(VALOR_CHEIO_IMERSAO, 'R$ 97');
});

// Cada virada às 23:59 do dia da tabela: 23:58:59 ainda no lote, 23:59 no seguinte.
const viradas = [
  ['2026-11-22', 'Lote 01', 'R$ 29', 'Lote 02', 'R$ 35'],
  ['2026-11-25', 'Lote 02', 'R$ 35', 'Lote 03', 'R$ 39'],
  ['2026-11-29', 'Lote 03', 'R$ 39', 'Lote 04', 'R$ 45'],
  ['2026-12-02', 'Lote 04', 'R$ 45', 'Lote 05', 'R$ 49'],
  ['2026-12-06', 'Lote 05', 'R$ 49', 'Lote 06', 'R$ 55'],
  ['2026-12-09', 'Lote 06', 'R$ 55', 'Lote 07', 'R$ 59'],
];
for (const [dia, antes, valorAntes, depois, valorDepois] of viradas) {
  test(`${dia} 23:58:59 é ${antes} (${valorAntes}); 23:59 já é ${depois} (${valorDepois})`, () => {
    const a = vigente(`${dia}T23:58:59`);
    assert.equal(a.rotulo, antes);
    assert.equal(a.valor, valorAntes);
    assert.equal(a.proximoValor, valorDepois);
    const d = vigente(`${dia}T23:59:00`);
    assert.equal(d.rotulo, depois);
    assert.equal(d.valor, valorDepois);
  });
}

test('hoje (09/11) está no Lote 01 a R$ 29', () => {
  const r = vigente('2026-11-09T18:00:00');
  assert.equal(r.estado, 'aberto');
  assert.equal(r.rotulo, 'Lote 01');
  assert.equal(r.valor, 'R$ 29');
});

test('lote 07 vale até 12/12 9h29:59 e é o último (sem próximo preço)', () => {
  const r = vigente('2026-12-12T09:29:59');
  assert.equal(r.rotulo, 'Lote 07');
  assert.equal(r.valor, 'R$ 59');
  assert.equal(r.ultimo, true);
  assert.equal(r.proximoValor, null);
  assert.equal(textoProximo(r.proximoValor, r.rotulo), null);
});

test('12/12 às 9h30, início do evento, as vendas encerram', () => {
  assert.deepEqual(vigente('2026-12-12T09:30:00'), { estado: 'encerrado' });
  assert.deepEqual(vigente('2026-12-13T12:00:00'), { estado: 'encerrado' });
});

test('texto do próximo lote no preço', () => {
  const r = vigente('2026-11-10T12:00:00');
  assert.equal(textoProximo(r.proximoValor, r.rotulo), 'Depois do Lote 01, o valor sobe para R$ 35');
});

test('barra de progresso: metade do lote dá 0.5, fora do lote fica entre 0 e 1', () => {
  const r = vigente('2026-11-12T00:00:00');
  const meio = (r.inicioMs + r.fimMs) / 2;
  assert.equal(fracaoDecorrida(r.inicioMs, r.fimMs, meio), 0.5);
  assert.equal(fracaoDecorrida(r.inicioMs, r.fimMs, r.inicioMs - 1000), 0);
  assert.equal(fracaoDecorrida(r.inicioMs, r.fimMs, r.fimMs + 1000), 1);
  assert.equal(fracaoDecorrida(NaN, r.fimMs, meio), 0);
  assert.equal(fracaoDecorrida(10, 10, 10), 0);
});

test('sem tabela, loteVigente continua usando os lotes da Black', () => {
  const r = loteVigente(Date.parse('2026-08-20T12:00:00-03:00'));
  assert.equal(r.rotulo, LOTES[0].rotulo);
});
