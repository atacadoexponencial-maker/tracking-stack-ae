// Mídia agendada: classificação, tetos, armazenamento, upload e rota pública.
// Spec: docs/superpowers/specs/2026-09-18-disparos-midia-design.md
//
// KV dublado por um Map — o que importa testar aqui é a REGRA (o que entra, o
// que é recusado, o que some no expurgo), não o KV da Cloudflare. O D1 é
// SQLite de verdade, com a migration 0044 real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  classificar, validarTamanho, guardar, ficha, fichaPorChave,
  lerBytes, apagar, urlPublica, TETOS,
} from '../functions/api/_midia.js';
import { onRequestPost as uploadPost } from '../functions/api/grupos-midia.js';
import { onRequestGet as servirGet } from '../functions/m/[chave].js';

function d1(db) {
  const conv = (b) => b.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  const stmt = (sql, binds = []) => ({
    bind: (...b) => stmt(sql, conv(b)),
    all: async () => ({ results: db.prepare(sql).all(...binds) }),
    first: async () => db.prepare(sql).get(...binds) ?? null,
    run: async () => { const r = db.prepare(sql).run(...binds); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return { prepare: (sql) => stmt(sql) };
}

// KV mínimo: só o que _midia.js usa.
function kv() {
  const m = new Map();
  return {
    _m: m,
    put: async (k, v) => { m.set(k, v); },
    get: async (k) => (m.has(k) ? m.get(k) : null),
    delete: async (k) => { m.delete(k); },
  };
}

const AGORA = 1_789_700_000;

function novoAmbiente() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0044_grupos_midia.sql', import.meta.url), 'utf8'));
  const env = { DB: d1(db), MIDIA: kv(), DASH_KEY: 'k' };
  return { db, env };
}

const bytesDe = (n) => new Uint8Array(n).fill(65);

// --- classificação ---

test('classifica pelo nome do arquivo, não pelo que o navegador disse', () => {
  assert.deepEqual(classificar('aviso.MP4').mediatype, 'video');
  assert.equal(classificar('foto.jpeg').mimetype, 'image/jpeg');
  assert.equal(classificar('catalogo.pdf').mediatype, 'document');
  assert.equal(classificar('nota.m4a').mediatype, 'audio');
});

test('recusa arquivo sem extensão e com extensão desconhecida', () => {
  assert.match(classificar('arquivo').erro, /extens/i);
  assert.match(classificar('arquivo.').erro, /extens/i);
  assert.match(classificar('virus.exe').erro, /não aceito/i);
  assert.match(classificar('').erro, /nome/i);
});

// --- tetos ---

test('cada tipo tem seu teto e a mensagem diz o tamanho e o limite', () => {
  assert.deepEqual(validarTamanho('image', 1000), {});
  const r = validarTamanho('image', TETOS.image + 1);
  assert.match(r.erro, /passa do limite/i);
  assert.match(r.erro, /5,0 MB/);
  assert.equal(validarTamanho('video', TETOS.video).erro, undefined, 'exatamente no teto passa');
  assert.match(validarTamanho('video', TETOS.video + 1).erro, /vídeo/i);
  assert.match(validarTamanho('image', 0).erro, /vazio/i);
});

// --- guardar / ler / apagar ---

test('guardar grava os bytes no KV e a ficha no D1', async () => {
  const { env } = novoAmbiente();
  const { id, chave } = await guardar(env, {
    bytes: bytesDe(10), nome: 'aviso.mp4', mimetype: 'video/mp4', mediatype: 'video',
  }, AGORA);

  assert.ok(id);
  assert.equal(chave.length, 32);
  assert.ok(env.MIDIA._m.has(chave), 'os bytes precisam estar no KV');

  const f = await ficha(env, id);
  assert.equal(f.nome, 'aviso.mp4');
  assert.equal(f.mediatype, 'video');
  assert.equal(f.tamanho, 10);
  assert.equal(f.apagada_em, null);
  assert.equal((await fichaPorChave(env, chave)).id, id);
});

test('cada arquivo ganha uma chave diferente', async () => {
  const { env } = novoAmbiente();
  const a = await guardar(env, { bytes: bytesDe(5), nome: 'a.png', mimetype: 'image/png', mediatype: 'image' }, AGORA);
  const b = await guardar(env, { bytes: bytesDe(5), nome: 'a.png', mimetype: 'image/png', mediatype: 'image' }, AGORA);
  assert.notEqual(a.chave, b.chave);
});

test('apagar tira do KV', async () => {
  const { env } = novoAmbiente();
  const { chave } = await guardar(env, { bytes: bytesDe(5), nome: 'a.png', mimetype: 'image/png', mediatype: 'image' }, AGORA);
  await apagar(env, chave);
  assert.equal(await lerBytes(env, chave), null);
});

test('urlPublica é absoluta, porque quem baixa é a Evolution', () => {
  assert.equal(urlPublica({}, 'abc'), 'https://atacadoexponencial.com/m/abc');
  assert.equal(urlPublica({ SITE_BASE_URL: 'https://x.com/' }, 'abc'), 'https://x.com/m/abc');
});

// --- upload ---

const form = (nome, bytes) => {
  const fd = new FormData();
  fd.append('arquivo', new File([bytes], nome));
  return fd;
};
const reqUpload = (chave, fd) => new Request(`https://exemplo.com/api/grupos-midia?key=${chave}`, { method: 'POST', body: fd });

test('upload sem a chave do dash é 401', async () => {
  const { env } = novoAmbiente();
  const r = await uploadPost({ request: reqUpload('errada', form('a.png', bytesDe(4))), env });
  assert.equal(r.status, 401);
});

test('upload sem arquivo é 400', async () => {
  const { env } = novoAmbiente();
  const r = await uploadPost({ request: new Request('https://exemplo.com/api/grupos-midia?key=k', { method: 'POST', body: new FormData() }), env });
  assert.equal(r.status, 400);
});

test('upload recusa extensão desconhecida com 415', async () => {
  const { env } = novoAmbiente();
  const r = await uploadPost({ request: reqUpload('k', form('virus.exe', bytesDe(4))), env });
  assert.equal(r.status, 415);
  assert.match((await r.json()).error, /não aceito/i);
});

test('upload recusa arquivo grande demais com 413', async () => {
  const { env } = novoAmbiente();
  const r = await uploadPost({ request: reqUpload('k', form('foto.png', bytesDe(TETOS.image + 1))), env });
  assert.equal(r.status, 413);
  assert.match((await r.json()).error, /passa do limite/i);
});

test('upload bom devolve a ficha com a URL pronta', async () => {
  const { env } = novoAmbiente();
  const r = await uploadPost({ request: reqUpload('k', form('aviso.mp4', bytesDe(100))), env });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.mediatype, 'video');
  assert.equal(j.nome, 'aviso.mp4');
  assert.equal(j.tamanho, 100);
  assert.match(j.url, /^https:\/\/.+\/m\/[0-9a-f]{32}$/);
});

// --- rota pública ---

const reqServir = (chave, qs = '') => new Request(`https://exemplo.com/m/${chave}${qs}`);

test('a rota pública serve o arquivo com o Content-Type guardado', async () => {
  const { env } = novoAmbiente();
  const { chave } = await guardar(env, { bytes: bytesDe(7), nome: 'aviso.mp4', mimetype: 'video/mp4', mediatype: 'video' }, AGORA);
  const r = await servirGet({ request: reqServir(chave), env, params: { chave } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Content-Type'), 'video/mp4');
  assert.match(r.headers.get('Content-Disposition'), /aviso\.mp4/);
  assert.equal((await r.arrayBuffer()).byteLength, 7);
});

test('a rota pública ignora query desconhecida (a Evolution acrescenta ?timestamp=)', async () => {
  const { env } = novoAmbiente();
  const { chave } = await guardar(env, { bytes: bytesDe(7), nome: 'nota.mp3', mimetype: 'audio/mpeg', mediatype: 'audio' }, AGORA);
  const r = await servirGet({ request: reqServir(chave, '?timestamp=1789700000123'), env, params: { chave } });
  assert.equal(r.status, 200);
});

test('chave inexistente é 404', async () => {
  const { env } = novoAmbiente();
  const r = await servirGet({ request: reqServir('naoexiste'), env, params: { chave: 'naoexiste' } });
  assert.equal(r.status, 404);
});

test('mídia expurgada é 404 mesmo se o byte tiver sobrado no KV', async () => {
  const { db, env } = novoAmbiente();
  const { chave } = await guardar(env, { bytes: bytesDe(7), nome: 'a.png', mimetype: 'image/png', mediatype: 'image' }, AGORA);
  db.prepare('UPDATE whatsapp_group_media SET apagada_em = ? WHERE chave = ?').run(AGORA, chave);
  const r = await servirGet({ request: reqServir(chave), env, params: { chave } });
  assert.equal(r.status, 404);
});
