// Biblioteca de imagens dos e-mails (issue 392): tipo e medidas pelos bytes,
// limites, trava de apagar imagem em uso e endereço público que continua
// respondendo depois de apagada.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import * as rota from '../functions/api/email/imagens.js';
import * as publica from '../functions/email/i/[arquivo].js';
import { identificar } from '../functions/api/_email-imagens.js';

let db, env, kv;

// Cabeçalhos mínimos de cada formato (só o que a leitura de medidas usa).
const png = (w, h, extra = 0) => {
  const b = new Uint8Array(33 + extra);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h);
  return b;
};
const gif = (w, h) => { const b = new Uint8Array(13); b.set([...'GIF89a'].map((c) => c.charCodeAt(0))); new DataView(b.buffer).setUint16(6, w, true); new DataView(b.buffer).setUint16(8, h, true); return b; };
const jpg = (w, h) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...new Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const webp = (w, h) => {
  const b = new Uint8Array(30);
  b.set([...'RIFF'].map((c) => c.charCodeAt(0))); b.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8);
  const l = w - 1, a = h - 1;
  b.set([l & 255, (l >> 8) & 255, (l >> 16) & 255, a & 255, (a >> 8) & 255, (a >> 16) & 255], 24);
  return b;
};

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const f of ['0050_email.sql', '0051_email_modelos.sql', '0060_email_imagens.sql']) db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  const mapa = new Map();
  kv = { mapa, put: async (k, v) => { mapa.set(k, new Uint8Array(v)); }, get: async (k) => (mapa.has(k) ? mapa.get(k).buffer : null) };
  env = { DB: d1(db), DASH_KEY: 'k', EMAIL_IMAGENS: kv };
});

const subir = async (bytes, nome = 'foto.png') => {
  const fd = new FormData();
  fd.append('arquivo', new File([bytes], nome));
  const r = await rota.onRequestPost({ request: new Request('https://x.com/api/email/imagens?key=k', { method: 'POST', body: fd }), env });
  return { status: r.status, corpo: await r.json() };
};
const acao = async (corpo) => {
  const r = await rota.onRequestPost({ request: new Request('https://x.com/api/email/imagens?key=k', { method: 'POST', body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' } }), env });
  return { status: r.status, corpo: await r.json() };
};
const lista = async (qs = '') => (await (await rota.onRequestGet({ request: new Request(`https://x.com/api/email/imagens?key=k${qs}`), env })).json()).imagens;
const abrir = (caminho) => publica.onRequestGet({ request: new Request(`https://x.com${caminho}`), env, params: { arquivo: caminho.split('/').pop() } });

test('tipo e medidas vêm dos bytes, não do nome', () => {
  assert.deepEqual(identificar(png(1200, 630)), { extensao: 'png', largura: 1200, altura: 630 });
  assert.deepEqual(identificar(gif(600, 200)), { extensao: 'gif', largura: 600, altura: 200 });
  assert.deepEqual(identificar(jpg(800, 450)), { extensao: 'jpg', largura: 800, altura: 450 });
  assert.deepEqual(identificar(webp(1000, 500)), { extensao: 'webp', largura: 1000, altura: 500 });
  assert.equal(identificar(new TextEncoder().encode('%PDF-1.4 qualquer coisa')), null);
});

test('subir: guarda no KV e na ficha, devolve endereço público; recusa formato e peso', async () => {
  let r = await subir(png(1200, 630), 'Banner Workshop.png');
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const f = r.corpo.imagem;
  assert.deepEqual([f.nome, f.largura, f.altura, f.extensao, f.aviso], ['Banner Workshop', 1200, 630, 'png', null]);
  assert.match(f.url, /^https:\/\/x\.com\/email\/i\/[0-9a-f]{32}\.png$/);
  assert.ok(kv.mapa.has(f.chave));

  r = await subir(new TextEncoder().encode('%PDF-1.4'), 'foto.png'); // nome de imagem, bytes de PDF
  assert.equal(r.status, 415);
  r = await subir(png(800, 600, 1024 * 1024), 'grande.png');
  assert.equal(r.status, 413);
  assert.match(r.corpo.error, /limite é 1 MB/);
  r = await subir(png(2400, 800), 'largo.png');
  assert.equal(r.status, 200);
  assert.match(r.corpo.imagem.aviso, /2400 px/);
  assert.equal((await lista()).length, 2);
});

test('endereço público serve os bytes com cache longo; chave errada é 404', async () => {
  const f = (await subir(gif(600, 200), 'conta.gif')).corpo.imagem;
  const caminho = new URL(f.url).pathname;
  const r = await abrir(caminho);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/gif');
  assert.match(r.headers.get('cache-control'), /immutable/);
  assert.equal((await abrir(caminho.replace('.gif', '.png'))).status, 404, 'extensão tem que bater');
  assert.equal((await abrir('/email/i/' + '0'.repeat(32) + '.gif')).status, 404);
});

test('renomear, buscar e apagar com trava de uso; apagada continua servindo', async () => {
  const f = (await subir(png(600, 140), 'logo.png')).corpo.imagem;
  assert.equal((await acao({ acao: 'renomear', id: f.id, nome: 'Logo da casa' })).corpo.imagem.nome, 'Logo da casa');
  assert.equal((await acao({ acao: 'renomear', id: f.id, nome: '   ' })).status, 400);
  assert.equal((await lista('&busca=casa')).length, 1);
  assert.equal((await lista('&busca=nada')).length, 0);

  // Em uso num modelo: não apaga, e diz onde.
  db.prepare("INSERT INTO email_modelos (nome, canal, assunto, previa, corpo, arquivado, criado_em, atualizado_em) VALUES ('Convite', 'marketing', 'a', '', ?, 0, 0, 0)").run(`img ${f.url}`);
  assert.deepEqual((await lista())[0].usos, ['Modelo: Convite']);
  let r = await acao({ acao: 'apagar', id: f.id });
  assert.equal(r.status, 409);
  assert.deepEqual(r.corpo.usos, ['Modelo: Convite']);

  db.prepare("UPDATE email_modelos SET corpo = 'sem imagem'").run();
  r = await acao({ acao: 'apagar', id: f.id });
  assert.equal(r.status, 200);
  assert.equal((await lista()).length, 0);
  assert.equal((await abrir(new URL(f.url).pathname)).status, 200, 'e-mails já enviados continuam mostrando');
});

test('sem o KV no ambiente: 503 e nada gravado', async () => {
  delete env.EMAIL_IMAGENS;
  const r = await subir(png(600, 140));
  assert.equal(r.status, 503);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_imagens').get().n, 0);
});
