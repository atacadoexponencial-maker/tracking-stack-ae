import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { periodoFechado, respostaJson, respostaEmCache, MAX_AGE_SEGUNDOS } from '../functions/api/_cache.js';

const AGORA = Math.floor(Date.now() / 1000);
const ONTEM = AGORA - 2 * 86400; // com folga: sempre antes da meia-noite de hoje em BRT
const REQ = new Request('https://x.test/api/conversion?from=1&to=2&key=abc');

// `caches` de mentira, com a mesma cara do Cloudflare (match/put por Request).
let guardado;
beforeEach(() => {
  guardado = new Map();
  globalThis.caches = {
    default: {
      async match(req) { return guardado.get(req.url) || null; },
      async put(req, res) { guardado.set(req.url, res); },
    },
  };
});
afterEach(() => { delete globalThis.caches; });

test('periodoFechado: só quando o fim é anterior à meia-noite de hoje em Brasília', () => {
  assert.equal(periodoFechado(ONTEM), true);
  assert.equal(periodoFechado(AGORA), false);
  assert.equal(periodoFechado(AGORA + 86400), false);
  assert.equal(periodoFechado(undefined), false);
  assert.equal(periodoFechado(0), false);
  assert.equal(periodoFechado('abc'), false);
});

test('período aberto: resposta sem Cache-Control e nada guardado', async () => {
  const r = respostaJson(REQ, { a: 1 }, { until: AGORA });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Cache-Control'), null);
  assert.equal(r.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(await r.json(), { a: 1 });
  assert.equal(guardado.size, 0);
});

test('período fechado: navegador recebe private e o cache guarda uma cópia public', async () => {
  const r = respostaJson(REQ, { a: 1 }, { until: ONTEM });
  assert.equal(r.headers.get('Cache-Control'), `private, max-age=${MAX_AGE_SEGUNDOS}`);
  assert.equal(r.headers.get('X-Cache'), 'MISS');
  assert.deepEqual(await r.json(), { a: 1 });

  const copia = guardado.get(REQ.url);
  assert.ok(copia, 'a cópia precisa ir para o caches.default');
  // A Cache API do Cloudflare não armazena `private`: a cópia sai `public`.
  assert.equal(copia.headers.get('Cache-Control'), `public, max-age=${MAX_AGE_SEGUNDOS}`);
  assert.deepEqual(await copia.json(), { a: 1 });
});

test('erro nunca entra no cache, mesmo em período fechado', async () => {
  const r = respostaJson(REQ, { error: 'x' }, { until: ONTEM, status: 500 });
  assert.equal(r.status, 500);
  assert.equal(r.headers.get('Cache-Control'), null);
  assert.equal(guardado.size, 0);
});

test('respostaEmCache devolve a cópia guardada como private, e null quando não há', async () => {
  assert.equal(await respostaEmCache(REQ, { until: ONTEM }), null);
  respostaJson(REQ, { b: 2 }, { until: ONTEM });
  const hit = await respostaEmCache(REQ, { until: ONTEM });
  assert.ok(hit);
  assert.equal(hit.headers.get('Cache-Control'), `private, max-age=${MAX_AGE_SEGUNDOS}`);
  assert.equal(hit.headers.get('X-Cache'), 'HIT');
  assert.deepEqual(await hit.json(), { b: 2 });
});

test('respostaEmCache não consulta o cache para o período corrente', async () => {
  respostaJson(REQ, { b: 2 }, { until: ONTEM });
  assert.equal(await respostaEmCache(REQ, { until: AGORA }), null);
});

test('waitUntil do context recebe a gravação', async () => {
  const promessas = [];
  const context = { waitUntil: (p) => promessas.push(p) };
  respostaJson(REQ, { c: 3 }, { until: ONTEM, context });
  assert.equal(promessas.length, 1);
  await Promise.all(promessas);
  assert.ok(guardado.get(REQ.url));
});

test('sem `caches` no ambiente o helper continua respondendo', async () => {
  delete globalThis.caches;
  const r = respostaJson(REQ, { d: 4 }, { until: ONTEM });
  assert.equal(r.headers.get('Cache-Control'), `private, max-age=${MAX_AGE_SEGUNDOS}`);
  assert.deepEqual(await r.json(), { d: 4 });
  assert.equal(await respostaEmCache(REQ, { until: ONTEM }), null);
});
