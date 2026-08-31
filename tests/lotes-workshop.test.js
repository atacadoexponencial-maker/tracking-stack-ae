import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOTES,
  VALOR_CHEIO,
  loteVigente,
  textoProximo,
  formatarRestante,
  textoContador,
} from '../src/data/lotes-workshop.js';

// Instantes de Brasília escritos com deslocamento explícito: viram epoch em ms,
// que é fuso-agnóstico por construção.
const em = (iso) => Date.parse(`${iso}-03:00`);

test('antes de 10/08 já mostra o Lote 1, não "encerrado" nem vazio', () => {
  const r = loteVigente(em('2026-08-09T23:59:59'));
  assert.equal(r.estado, 'aberto');
  assert.equal(r.rotulo, 'Lote 1');
  assert.equal(r.valor, 'R$ 27');
  assert.equal(r.proximoValor, 'R$ 47');
});

test('10/08 00:00:00 exato continua no Lote 1 — a abertura não é virada visível', () => {
  const r = loteVigente(em('2026-08-10T00:00:00'));
  assert.equal(r.rotulo, 'Lote 1');
  assert.equal(r.valor, 'R$ 27');
});

// A virada é às 23:59 do último dia, não à meia-noite do dia seguinte. Os três
// pares abaixo travam o minuto exato de cada troca: um segundo antes ainda é o
// lote velho, no segundo cheio já é o novo.
test('02/09 23:58:59 ainda é Lote 1', () => {
  const r = loteVigente(em('2026-09-02T23:58:59'));
  assert.equal(r.rotulo, 'Lote 1');
  assert.equal(r.valor, 'R$ 27');
});

test('02/09 23:59:00 exato já é Lote 2 — início inclusivo, fim exclusivo', () => {
  const r = loteVigente(em('2026-09-02T23:59:00'));
  assert.equal(r.rotulo, 'Lote 2');
  assert.equal(r.valor, 'R$ 47');
  assert.equal(r.proximoValor, 'R$ 67');
});

test('09/09 23:58:59 ainda é Lote 2', () => {
  assert.equal(loteVigente(em('2026-09-09T23:58:59')).rotulo, 'Lote 2');
});

test('09/09 23:59:00 exato já é Lote 3', () => {
  const r = loteVigente(em('2026-09-09T23:59:00'));
  assert.equal(r.rotulo, 'Lote 3');
  assert.equal(r.valor, 'R$ 67');
  assert.equal(r.proximoValor, 'R$ 97');
});

test('16/09 23:58:59 ainda é Lote 3', () => {
  assert.equal(loteVigente(em('2026-09-16T23:58:59')).rotulo, 'Lote 3');
});

test('16/09 23:59:00 exato já é Lote 4 e não há próximo valor', () => {
  const r = loteVigente(em('2026-09-16T23:59:00'));
  assert.equal(r.rotulo, 'Lote 4');
  assert.equal(r.valor, 'R$ 97');
  assert.equal(r.proximoValor, null);
});

// O último minuto do dia da virada pertence ao lote NOVO. É consequência direta
// de virar às 23:59 e está aqui para ninguém "consertar" achando que é bug.
test('no minuto final do dia da virada o preço já é o do lote seguinte', () => {
  assert.equal(loteVigente(em('2026-09-02T23:59:59')).rotulo, 'Lote 2');
  assert.equal(loteVigente(em('2026-09-09T23:59:59')).rotulo, 'Lote 3');
  assert.equal(loteVigente(em('2026-09-16T23:59:59')).rotulo, 'Lote 4');
});

test('23/09 19:59:59 ainda vende: Lote 4 aberto', () => {
  const r = loteVigente(em('2026-09-23T19:59:59'));
  assert.equal(r.estado, 'aberto');
  assert.equal(r.valor, 'R$ 97');
});

// O workshop começa às 19h e as vendas só fecham às 20h: a primeira hora da
// aula ainda vende, de propósito.
test('19h05, com a aula já rolando, a página continua vendendo', () => {
  assert.equal(loteVigente(em('2026-09-23T19:05:00')).estado, 'aberto');
});

test('23/09 20:00:00 exato encerra as vendas, sem preço', () => {
  const r = loteVigente(em('2026-09-23T20:00:00'));
  assert.equal(r.estado, 'encerrado');
  assert.equal(r.valor, undefined);
  assert.equal(r.rotulo, undefined);
});

test('qualquer instante depois de 23/09 20:00 continua encerrado', () => {
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

test('são quatro lotes, com preços estritamente crescentes', () => {
  assert.equal(LOTES.length, 4);
  const numero = (v) => Number(v.replace(/\D/g, ''));
  for (let i = 1; i < LOTES.length; i += 1) {
    assert.ok(
      numero(LOTES[i].valor) > numero(LOTES[i - 1].valor),
      `${LOTES[i].rotulo} (${LOTES[i].valor}) deveria custar mais que ${LOTES[i - 1].rotulo} (${LOTES[i - 1].valor})`
    );
  }
});

test('os rótulos são Lote 1 a Lote 4, na ordem', () => {
  assert.deepEqual(
    LOTES.map((l) => l.rotulo),
    ['Lote 1', 'Lote 2', 'Lote 3', 'Lote 4']
  );
});

test('um e só um lote vigente por instante, varrendo as fronteiras', () => {
  const instantes = LOTES.flatMap((l) => [Date.parse(l.inicio) - 1, Date.parse(l.inicio), Date.parse(l.fim) - 1]);
  for (const ms of instantes) {
    const r = loteVigente(ms);
    assert.equal(r.estado, 'aberto');
    const casam = LOTES.filter((l) => Date.parse(l.inicio) <= ms && ms < Date.parse(l.fim));
    // Antes do primeiro início nenhum lote casa e a função devolve o Lote 1.
    if (casam.length === 1) assert.equal(r.rotulo, casam[0].rotulo);
    else assert.equal(r.rotulo, 'Lote 1');
    assert.ok(casam.length <= 1);
  }
});

test('agora inválido (NaN) cai no primeiro lote, nunca em encerrado', () => {
  assert.equal(loteVigente(NaN).rotulo, 'Lote 1');
  assert.equal(loteVigente(undefined).estado, 'aberto');
  assert.equal(loteVigente(Number.POSITIVE_INFINITY).rotulo, 'Lote 1');
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
  assert.equal(textoProximo('R$ 47', 'Lote 1'), 'Depois do Lote 1, o valor sobe para R$ 47');
  assert.equal(textoProximo('R$ 97', 'Lote 3'), 'Depois do Lote 3, o valor sobe para R$ 97');
  assert.equal(textoProximo(null, 'Lote 4'), null);
});

test('o resultado independe do fuso do processo — só o epoch importa', () => {
  const alvo = em('2026-09-02T23:59:00');
  const original = process.env.TZ;
  const esperado = loteVigente(alvo);
  for (const tz of ['UTC', 'Europe/Lisbon', 'Pacific/Kiritimati', 'America/Sao_Paulo']) {
    process.env.TZ = tz;
    const r = loteVigente(alvo);
    assert.deepEqual(r, esperado);
    assert.equal(r.rotulo, 'Lote 2');
  }
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});

// ---------------------------------------------------------------------------
// Contador de virada de lote (a spec proibia contador até 2026-08-12, quando a
// usuária revogou a regra — ver "Fora de escopo" em spec.md).
// ---------------------------------------------------------------------------

test('o estado aberto carrega o instante do fim e se é o último lote', () => {
  const r = loteVigente(em('2026-08-12T10:00:00'));
  assert.equal(r.fimMs, em('2026-09-02T23:59:00'));
  assert.equal(r.ultimo, false);

  const ultimo = loteVigente(em('2026-09-20T10:00:00'));
  assert.equal(ultimo.rotulo, 'Lote 4');
  assert.equal(ultimo.fimMs, em('2026-09-23T20:00:00'));
  assert.equal(ultimo.ultimo, true);
});

test('formata o restante escondendo as unidades que não importam mais', () => {
  const seg = (n) => n * 1000;
  assert.equal(formatarRestante(seg(5 * 86400 + 12 * 3600 + 47 * 60 + 9)), '05d 12h 47m 09s');
  assert.equal(formatarRestante(seg(12 * 3600 + 47 * 60 + 9)), '12h 47m 09s');
  assert.equal(formatarRestante(seg(47 * 60 + 9)), '47m 09s');
  assert.equal(formatarRestante(seg(9)), '09s');
});

test('prazo vencido ou valor inválido não vira contador', () => {
  assert.equal(formatarRestante(0), null);
  assert.equal(formatarRestante(-1), null);
  assert.equal(formatarRestante(NaN), null);
  assert.equal(formatarRestante(undefined), null);
  assert.equal(formatarRestante(Number.POSITIVE_INFINITY), null);
});

test('o contador conta segundo a segundo — 1000ms muda o texto', () => {
  const base = 3 * 3600 * 1000;
  assert.notEqual(formatarRestante(base), formatarRestante(base - 1000));
});

test('rótulo do contador anuncia o próximo preço, menos no último lote', () => {
  assert.equal(textoContador(loteVigente(em('2026-08-12T10:00:00'))), 'Sobe para R$ 47 em');
  assert.equal(textoContador(loteVigente(em('2026-09-05T10:00:00'))), 'Sobe para R$ 67 em');
  // Último lote: o prazo leva ao fim das vendas, não a um preço maior.
  assert.equal(textoContador(loteVigente(em('2026-09-20T10:00:00'))), 'Vendas encerram em');
});

test('vendas encerradas não têm contador', () => {
  assert.equal(textoContador(loteVigente(em('2026-09-23T20:00:00'))), null);
  assert.equal(textoContador(null), null);
  assert.equal(textoContador(undefined), null);
});

test('o alvo do contador é sempre a fronteira do lote vigente', () => {
  for (const l of LOTES) {
    const meio = (Date.parse(l.inicio) + Date.parse(l.fim)) / 2;
    assert.equal(loteVigente(meio).fimMs, Date.parse(l.fim));
  }
});
