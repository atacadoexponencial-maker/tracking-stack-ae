import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOTES, VALOR_CHEIO, loteVigente, textoProximo } from '../src/data/lotes-workshop.js';

// Instantes de Brasília escritos com deslocamento explícito: viram epoch em ms,
// que é fuso-agnóstico por construção.
const em = (iso) => Date.parse(`${iso}-03:00`);

test('antes de 10/08 já mostra o Lote 0, não "encerrado" nem vazio', () => {
  const r = loteVigente(em('2026-08-09T23:59:59'));
  assert.equal(r.estado, 'aberto');
  assert.equal(r.rotulo, 'Lote 0');
  assert.equal(r.valor, 'R$ 27');
  assert.equal(r.proximoValor, 'R$ 97');
});

test('10/08 00:00:00 exato continua no Lote 0 — a abertura não é virada visível', () => {
  const r = loteVigente(em('2026-08-10T00:00:00'));
  assert.equal(r.rotulo, 'Lote 0');
  assert.equal(r.valor, 'R$ 27');
});

test('19/08 23:59:59 ainda é Lote 0', () => {
  const r = loteVigente(em('2026-08-19T23:59:59'));
  assert.equal(r.rotulo, 'Lote 0');
  assert.equal(r.valor, 'R$ 27');
});

test('20/08 00:00:00 exato já é Lote 1 — início inclusivo, fim exclusivo', () => {
  const r = loteVigente(em('2026-08-20T00:00:00'));
  assert.equal(r.rotulo, 'Lote 1');
  assert.equal(r.valor, 'R$ 97');
  assert.equal(r.proximoValor, 'R$ 147');
});

test('29/08 23:59:59 ainda é Lote 1', () => {
  assert.equal(loteVigente(em('2026-08-29T23:59:59')).rotulo, 'Lote 1');
});

test('30/08 00:00:00 exato já é Lote 2 e não há próximo valor', () => {
  const r = loteVigente(em('2026-08-30T00:00:00'));
  assert.equal(r.rotulo, 'Lote 2');
  assert.equal(r.valor, 'R$ 147');
  assert.equal(r.proximoValor, null);
});

test('09/09 17:59:59 ainda vende: Lote 2 aberto', () => {
  const r = loteVigente(em('2026-09-09T17:59:59'));
  assert.equal(r.estado, 'aberto');
  assert.equal(r.valor, 'R$ 147');
});

test('09/09 18:00:00 exato encerra as vendas, sem preço', () => {
  const r = loteVigente(em('2026-09-09T18:00:00'));
  assert.equal(r.estado, 'encerrado');
  assert.equal(r.valor, undefined);
  assert.equal(r.rotulo, undefined);
});

test('qualquer instante depois de 09/09 18:00 continua encerrado', () => {
  assert.equal(loteVigente(em('2026-12-25T10:00:00')).estado, 'encerrado');
});

test('cada lote começa exatamente onde o anterior termina — sem buraco nem sobreposição', () => {
  for (let i = 1; i < LOTES.length; i += 1) {
    assert.equal(LOTES[i].inicio, LOTES[i - 1].fim);
  }
  for (const lote of LOTES) {
    assert.match(lote.inicio, /-03:00$/);
    assert.match(lote.fim, /-03:00$/);
  }
});

test('um e só um lote vigente por instante, varrendo as fronteiras', () => {
  const instantes = LOTES.flatMap((l) => [Date.parse(l.inicio) - 1, Date.parse(l.inicio), Date.parse(l.fim) - 1]);
  for (const ms of instantes) {
    const r = loteVigente(ms);
    assert.equal(r.estado, 'aberto');
    const casam = LOTES.filter((l) => Date.parse(l.inicio) <= ms && ms < Date.parse(l.fim));
    // Antes do primeiro início nenhum lote casa e a função devolve o Lote 0.
    if (casam.length === 1) assert.equal(r.rotulo, casam[0].rotulo);
    else assert.equal(r.rotulo, 'Lote 0');
    assert.ok(casam.length <= 1);
  }
});

test('agora inválido (NaN) cai no primeiro lote, nunca em encerrado', () => {
  assert.equal(loteVigente(NaN).rotulo, 'Lote 0');
  assert.equal(loteVigente(undefined).estado, 'aberto');
  assert.equal(loteVigente(Number.POSITIVE_INFINITY).rotulo, 'Lote 0');
});

test('o valor cheio é a ancoragem fixa e não é nenhum dos lotes', () => {
  assert.equal(VALOR_CHEIO, 'R$ 297');
  assert.ok(!LOTES.some((l) => l.valor === VALOR_CHEIO));
});

test('valores em formato brasileiro, com R$ e sem centavos', () => {
  for (const lote of LOTES) assert.match(lote.valor, /^R\$ \d+$/);
  assert.match(VALOR_CHEIO, /^R\$ \d+$/);
});

test('texto do próximo lote sai pronto e some quando não há próximo', () => {
  assert.equal(textoProximo('R$ 97', 'Lote 0'), 'Depois do Lote 0, o valor sobe para R$ 97');
  assert.equal(textoProximo('R$ 147', 'Lote 1'), 'Depois do Lote 1, o valor sobe para R$ 147');
  assert.equal(textoProximo(null, 'Lote 2'), null);
});

test('o resultado independe do fuso do processo — só o epoch importa', () => {
  const alvo = em('2026-08-20T00:00:00');
  const original = process.env.TZ;
  const esperado = loteVigente(alvo);
  for (const tz of ['UTC', 'Europe/Lisbon', 'Pacific/Kiritimati', 'America/Sao_Paulo']) {
    process.env.TZ = tz;
    const r = loteVigente(alvo);
    assert.deepEqual(r, esperado);
    assert.equal(r.rotulo, 'Lote 1');
  }
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});
