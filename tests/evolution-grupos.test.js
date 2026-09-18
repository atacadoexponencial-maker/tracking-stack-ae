// Fronteira com a Evolution para ações de grupo.
// Spec: docs/superpowers/specs/2026-09-17-gestao-grupos-whatsapp-design.md
//
// O que se testa aqui é o CONTRATO com a Evolution (rota, header, corpo) e a
// promessa de nunca lançar. É o único arquivo da feature que conhece a
// Evolution, então é aqui que a troca dela um dia vai doer — e é por isso que
// ele tem teste próprio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credenciais, enviarTexto, renomear, enviarMidia, enviarAudio, aquecerGrupo } from '../functions/api/_evolution-grupos.js';

const ENV = { EVOLUTION_BASE_URL: 'https://api.exemplo.com/', EVOLUTION_INSTANCE: 'Marcelle', EVOLUTION_APIKEY_NOTIF: 'segredo' };
const JID = '120363427499061913@g.us';
const ok = () => new Response('{}', { status: 200 });

test('credenciais some quando falta qualquer variável', () => {
  assert.ok(credenciais(ENV));
  assert.equal(credenciais({ ...ENV, EVOLUTION_APIKEY_NOTIF: '' }), null);
  assert.equal(credenciais({}), null);
});

test('credenciais tira a barra final da base', () => {
  assert.equal(credenciais(ENV).base, 'https://api.exemplo.com');
});

test('enviarTexto chama a rota certa, com apikey no header e jid no corpo', async () => {
  let visto = null;
  const r = await enviarTexto(ENV, JID, 'Começou!', async (url, init) => { visto = { url, init }; return ok(); });
  assert.deepEqual(r, { ok: true });
  assert.equal(visto.url, 'https://api.exemplo.com/message/sendText/Marcelle');
  assert.equal(visto.init.headers.apikey, 'segredo');
  assert.deepEqual(JSON.parse(visto.init.body), { number: JID, text: 'Começou!' });
});

test('renomear chama updateGroupSubject com o jid na query', async () => {
  let visto = null;
  const r = await renomear(ENV, JID, '24/09 às 12h', async (url, init) => { visto = { url, init }; return ok(); });
  assert.deepEqual(r, { ok: true });
  assert.ok(visto.url.startsWith('https://api.exemplo.com/group/updateGroupSubject/Marcelle?groupJid='));
  assert.equal(new URL(visto.url).searchParams.get('groupJid'), JID);
  assert.deepEqual(JSON.parse(visto.init.body), { subject: '24/09 às 12h' });
});

test('HTTP de erro vira erro legível, sem lançar', async () => {
  const r = await enviarTexto(ENV, JID, 'oi', async () => new Response('sem permissão', { status: 403 }));
  assert.equal(r.ok, false);
  assert.match(r.erro, /403/);
});

test('rede caída vira erro legível, sem lançar', async () => {
  const r = await renomear(ENV, JID, 'x', async () => { throw new Error('ECONNRESET'); });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Evolution/);
});

test('sem credenciais não tenta chamar nada', async () => {
  let chamou = false;
  const r = await enviarTexto({}, JID, 'oi', async () => { chamou = true; return ok(); });
  assert.equal(r.ok, false);
  assert.equal(chamou, false);
  assert.match(r.erro, /EVOLUTION/);
});

// --- mídia ---

const MIDIA = { mediatype: 'video', url: 'https://atacadoexponencial.com/m/abc', fileName: 'aviso.mp4', caption: 'Começou!' };

test('enviarMidia manda URL, fileName e caption — e NUNCA mimetype', async () => {
  let visto = null;
  const r = await enviarMidia(ENV, JID, MIDIA, async (url, init) => { visto = { url, init }; return ok(); });
  assert.deepEqual(r, { ok: true });
  assert.equal(visto.url, 'https://api.exemplo.com/message/sendMedia/Marcelle');
  const corpo = JSON.parse(visto.init.body);
  assert.deepEqual(corpo, {
    number: JID, mediatype: 'video', media: MIDIA.url, fileName: 'aviso.mp4', delay: 0, caption: 'Começou!',
  });
  assert.equal('mimetype' in corpo, false, 'mimetype junto de fileName corrompe o arquivo');
});

test('enviarMidia sem legenda não manda caption vazio', async () => {
  let corpo = null;
  await enviarMidia(ENV, JID, { ...MIDIA, caption: '' }, async (u, init) => { corpo = JSON.parse(init.body); return ok(); });
  assert.equal('caption' in corpo, false);
});

test('enviarMidia nunca manda base64 — media é sempre a URL recebida', async () => {
  let corpo = null;
  await enviarMidia(ENV, JID, MIDIA, async (u, init) => { corpo = JSON.parse(init.body); return ok(); });
  assert.match(corpo.media, /^https:\/\//);
});

test('enviarAudio usa o endpoint de nota de voz e não aceita legenda', async () => {
  let visto = null;
  const r = await enviarAudio(ENV, JID, 'https://x/m/abc', async (url, init) => { visto = { url, init }; return ok(); });
  assert.deepEqual(r, { ok: true });
  assert.equal(visto.url, 'https://api.exemplo.com/message/sendWhatsAppAudio/Marcelle');
  const corpo = JSON.parse(visto.init.body);
  assert.deepEqual(corpo, { number: JID, audio: 'https://x/m/abc', delay: 0 });
  assert.equal('caption' in corpo, false);
});

test('erro de mídia vira erro legível, sem lançar', async () => {
  const r = await enviarMidia(ENV, JID, MIDIA, async () => new Response('grande demais', { status: 413 }));
  assert.equal(r.ok, false);
  assert.match(r.erro, /413/);
});

// --- aquecimento ---

test('aquecerGrupo consulta findGroupInfos com o jid', async () => {
  let visto = null;
  const r = await aquecerGrupo(ENV, JID, async (url, init) => { visto = { url, init }; return ok(); });
  assert.equal(r.ok, true);
  assert.ok(visto.url.startsWith('https://api.exemplo.com/group/findGroupInfos/Marcelle?groupJid='));
  assert.equal(new URL(visto.url).searchParams.get('groupJid'), JID);
  assert.equal(visto.init.headers.apikey, 'segredo');
});

test('aquecimento que falha devolve ok:false sem lançar — é tentativa, não etapa', async () => {
  assert.deepEqual(await aquecerGrupo(ENV, JID, async () => { throw new Error('rede'); }), { ok: false });
  assert.deepEqual(await aquecerGrupo(ENV, JID, async () => new Response('x', { status: 500 })), { ok: false });
  assert.deepEqual(await aquecerGrupo({}, JID, async () => ok()), { ok: false });
});
