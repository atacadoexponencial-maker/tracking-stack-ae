// Aba Cloudflare: uso de hoje contra o teto (spec-uso-cloudflare.md, issue S1-02).
//
// A Cloudflare é simulada (fetch injetado) e o cache também (objeto em
// memória), porque `caches` só existe no runtime da Cloudflare. A tela só copia
// o que /api/cloudflare-uso devolve, então a resposta é o que se confere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerUso, faixaDoUso, MOTIVOS } from '../functions/api/_cloudflare-uso.js';
import { onRequestGet } from '../functions/api/cloudflare-uso.js';

const ENV = { DASH_KEY: 'chave-do-dash-789', CF_ANALYTICS_TOKEN: 'token-de-teste' };
const TRACKING = 'pages-worker--14963629-production';
const PAINEL = 'pages-worker--16433236-production';
// 15/10/2026 17:05 UTC = 14:05 em Brasília.
const AGORA = Date.UTC(2026, 9, 15, 17, 5);

const linha = (scriptName, requests) => ({ dimensions: { scriptName }, sum: { requests } });
const dia = (date, requests) => ({ dimensions: { date }, sum: { requests } });

// `extra` traz as partes da S1-03 (pagesDias, pagesEstouros, workersDias, workersEstouros).
function cloudflareFalsa(pages, workers = [], extra = {}) {
  const f = async (url, init) => {
    f.chamadas += 1;
    f.consulta = JSON.parse(init.body).query;
    return new Response(JSON.stringify({ data: { viewer: { accounts: [{ pages, workers, ...extra }] } }, errors: null }), { status: 200 });
  };
  f.chamadas = 0;
  return f;
}

function cacheEmMemoria() {
  let guardado = null;
  return { async ler() { return guardado; }, async gravar(d) { guardado = d; }, get guardado() { return guardado; } };
}

const CAMPOS_DE_NUMERO = ['teto', 'hoje', 'projetos', 'requisicoes', 'porcentagem', 'restam'];

test('CA-S1-01: a barra de hoje soma todos os projetos da conta (30.000 + 5.000 = 35.000 de 100.000, 35%)', async () => {
  const fetchFn = cloudflareFalsa([linha(TRACKING, 29000), linha(TRACKING, 1000), linha(PAINEL, 5000)]);
  const d = await lerUso({ env: ENV, fetchFn, cache: cacheEmMemoria(), agoraMs: AGORA });
  assert.equal(d.hoje.requisicoes, 35000);
  assert.equal(d.teto, 100000);
  assert.equal(d.hoje.porcentagem, 35);
  assert.equal(d.hoje.restam, 65000);
});

test('CA-S1-01: Workers soltos da conta também entram no total', async () => {
  const fetchFn = cloudflareFalsa([linha(TRACKING, 30000)], [linha('meu-worker', 5000)]);
  const d = await lerUso({ env: ENV, fetchFn, cache: cacheEmMemoria(), agoraMs: AGORA });
  assert.equal(d.hoje.requisicoes, 35000);
});

test('CA-S1-03: consumo de hoje por projeto, do maior para o menor, somando o total', async () => {
  const fetchFn = cloudflareFalsa([linha(PAINEL, 5000), linha(TRACKING, 30000)]);
  const d = await lerUso({ env: ENV, fetchFn, cache: cacheEmMemoria(), agoraMs: AGORA });
  assert.deepEqual(d.projetos, [
    { nome: 'tracking-ae', requisicoes: 30000 },
    { nome: 'painel-atacadoexponencial', requisicoes: 5000 },
  ]);
  assert.equal(d.projetos.reduce((s, p) => s + p.requisicoes, 0), d.hoje.requisicoes);
});

test('CA-S1-07: o horário da última leitura sai em Brasília ("14:05")', async () => {
  const d = await lerUso({ env: ENV, fetchFn: cloudflareFalsa([linha(TRACKING, 10)]), cache: cacheEmMemoria(), agoraMs: AGORA });
  assert.equal(d.lido_as, '14:05');
});

test('CA-S1-08: abrir de novo em menos de 15 minutos não consulta a Cloudflare e mantém o horário', async () => {
  const fetchFn = cloudflareFalsa([linha(TRACKING, 1000)]);
  const cache = cacheEmMemoria();
  const primeira = await lerUso({ env: ENV, fetchFn, cache, agoraMs: AGORA });
  const segunda = await lerUso({ env: ENV, fetchFn, cache, agoraMs: AGORA + 10 * 60 * 1000 });
  assert.equal(fetchFn.chamadas, 1);
  assert.equal(segunda.lido_as, primeira.lido_as);
  assert.equal(segunda.hoje.requisicoes, 1000);
  const depois = await lerUso({ env: ENV, fetchFn, cache, agoraMs: AGORA + 16 * 60 * 1000 });
  assert.equal(fetchFn.chamadas, 2);
  assert.equal(depois.lido_as, '14:21');
});

test('CA-S1-09: sem a chave do dash, ou com chave errada, a resposta é recusa e não traz números', async () => {
  for (const q of ['', '?key=', '?key=errada', '?key=chave-do-dash-78']) {
    const fetchFn = cloudflareFalsa([linha(TRACKING, 1000)]);
    const r = await onRequestGet({ request: new Request('https://x.com/api/cloudflare-uso' + q), env: ENV }, { fetchFn, cache: cacheEmMemoria() });
    assert.equal(r.status, 401, q);
    const corpo = await r.json();
    for (const c of CAMPOS_DE_NUMERO) assert.equal(c in corpo, false, `${q}: ${c}`);
    assert.equal(fetchFn.chamadas, 0, q);
  }
  const r = await onRequestGet({ request: new Request('https://x.com/api/cloudflare-uso?key=chave-do-dash-789'), env: ENV },
    { fetchFn: cloudflareFalsa([linha(TRACKING, 1000)]), cache: cacheEmMemoria(), agoraMs: AGORA });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).hoje.requisicoes, 1000);
});

test('CA-S1-10: falha na Cloudflare vira "indisponível" com o motivo, sem nenhum número, e não fica guardada', async () => {
  const casos = [
    ['fora do ar', async () => { throw new Error('rede'); }, MOTIVOS.foraDoAr],
    ['HTTP 500', async () => new Response('erro', { status: 500 }), MOTIVOS.foraDoAr],
    ['HTTP 401', async () => new Response('{}', { status: 401 }), MOTIVOS.recusada],
    ['token inválido (400 + Authentication failed)', async () => new Response(JSON.stringify({ success: false, errors: [{ code: 9106, message: 'Authentication failed (status: 400)' }] }), { status: 400 }), MOTIVOS.recusada],
  ];
  for (const [nome, fetchFn, motivo] of casos) {
    const cache = cacheEmMemoria();
    const d = await lerUso({ env: ENV, fetchFn, cache, agoraMs: AGORA });
    assert.equal(d.indisponivel, true, nome);
    assert.equal(d.motivo, motivo, nome);
    for (const c of CAMPOS_DE_NUMERO) assert.equal(c in d, false, `${nome}: ${c}`);
    assert.equal(cache.guardado, null, nome);
  }
  const semToken = await lerUso({ env: { DASH_KEY: 'x' }, fetchFn: cloudflareFalsa([]), cache: cacheEmMemoria(), agoraMs: AGORA });
  assert.deepEqual(semToken, { indisponivel: true, motivo: MOTIVOS.semCredencial });
});

test('CA-S1-13: a barra muda de cor perto do teto (59.999 folga, 60.000 e 80.000 atenção, 80.001 perto do teto)', async () => {
  const esperado = [
    [59999, 'folga', 'folga'],
    [60000, 'atencao', 'atenção'],
    [80000, 'atencao', 'atenção'],
    [80001, 'perto', 'perto do teto'],
  ];
  for (const [n, faixa, palavra] of esperado) {
    assert.deepEqual(faixaDoUso(n), { faixa, palavra }, String(n));
    const d = await lerUso({ env: ENV, fetchFn: cloudflareFalsa([linha(TRACKING, n)]), cache: cacheEmMemoria(), agoraMs: AGORA });
    assert.equal(d.hoje.faixa, faixa, String(n));
    assert.equal(d.hoje.palavra, palavra, String(n));
  }
});

// ---------------------------------------------------------------- S1-03

test('CA-S1-02: logo depois das 21h de Brasília a barra mostra só o dia novo e o dia que terminou vai para a lista', async () => {
  const agora = Date.UTC(2026, 9, 16, 0, 30); // 21h30 de 15/10 em Brasília
  const fetchFn = cloudflareFalsa([linha(TRACKING, 500)], [], {
    pagesDias: [dia('2026-10-15', 80000), dia('2026-10-16', 500)],
  });
  const d = await lerUso({ env: ENV, fetchFn, cache: cacheEmMemoria(), agoraMs: agora });
  assert.equal(d.hoje.requisicoes, 500);
  assert.equal(d.hoje.zera_as, '21h de Brasília');
  const ultimo = d.dias[d.dias.length - 1];
  const anterior = d.dias[d.dias.length - 2];
  assert.deepEqual(ultimo, { dia: '2026-10-16', requisicoes: 500, estouros: 0 });
  assert.deepEqual(anterior, { dia: '2026-10-15', requisicoes: 80000, estouros: 0 });
  // A parte de hoje da consulta começa às 00:00 UTC de 16/10 (21h de 15/10 em Brasília).
  assert.match(fetchFn.consulta, /datetime_geq: "2026-10-16T00:00:00.000Z"/);
});

test('CA-S1-04: lista dos últimos 30 dias com total e estouros de CPU, e o teto de referência', async () => {
  const fetchFn = cloudflareFalsa([linha(TRACKING, 4000)], [], {
    pagesDias: [dia('2026-10-12', 9000), dia('2026-10-14', 7852)],
    workersDias: [dia('2026-10-12', 649)],
    pagesEstouros: [dia('2026-10-12', 874)],
  });
  const d = await lerUso({ env: ENV, fetchFn, cache: cacheEmMemoria(), agoraMs: AGORA });
  assert.equal(d.dias.length, 30);
  assert.equal(d.dias[0].dia, '2026-09-16');
  assert.equal(d.dias[29].dia, '2026-10-15');
  assert.deepEqual(d.dias.find((x) => x.dia === '2026-10-12'), { dia: '2026-10-12', requisicoes: 9649, estouros: 874 });
  assert.equal(d.teto, 100000);
  // Os estouros vêm filtrados por status; os dias, agrupados só por data.
  assert.match(fetchFn.consulta, /status: "exceededResources"/);
});

test('CA-S1-05: dia sem nenhuma requisição aparece como zero e não some da lista', async () => {
  const fetchFn = cloudflareFalsa([], [], { pagesDias: [dia('2026-10-01', 9000), dia('2026-10-03', 9100)] });
  const d = await lerUso({ env: ENV, fetchFn, cache: cacheEmMemoria(), agoraMs: AGORA });
  assert.equal(d.dias.length, 30);
  assert.deepEqual(d.dias.find((x) => x.dia === '2026-10-02'), { dia: '2026-10-02', requisicoes: 0, estouros: 0 });
  assert.equal(d.indisponivel, undefined);
});

test('CA-S1-06: total acumulado do mês, só do dia 1º até hoje, sem barra nem porcentagem', async () => {
  const fetchFn = cloudflareFalsa([], [], {
    pagesDias: [dia('2026-09-30', 99999), dia('2026-10-01', 100000), dia('2026-10-15', 50000)],
    pagesEstouros: [dia('2026-09-30', 777), dia('2026-10-01', 2000), dia('2026-10-15', 1000)],
  });
  const d = await lerUso({ env: ENV, fetchFn, cache: cacheEmMemoria(), agoraMs: AGORA });
  assert.deepEqual(d.mes, { requisicoes: 150000, estouros: 3000 });
});

test('CA-S1-06: no dia 31 o mês ainda soma desde o dia 1º, mesmo fora dos 30 dias da lista', async () => {
  const agora = Date.UTC(2026, 9, 31, 12, 0);
  const fetchFn = cloudflareFalsa([], [], { pagesDias: [dia('2026-10-01', 1000), dia('2026-10-31', 2000)] });
  const d = await lerUso({ env: ENV, fetchFn, cache: cacheEmMemoria(), agoraMs: agora });
  assert.equal(d.dias[0].dia, '2026-10-02');
  assert.deepEqual(d.mes, { requisicoes: 3000, estouros: 0 });
  assert.match(fetchFn.consulta, /datetime_geq: "2026-10-01T00:00:00.000Z"/);
});
