// Fronteira com a Evolution para ações de grupo.
// Spec: docs/superpowers/specs/2026-09-17-gestao-grupos-whatsapp-design.md
//
// O que se testa aqui é o CONTRATO com a Evolution (rota, header, corpo) e a
// promessa de nunca lançar. É o único arquivo da feature que conhece a
// Evolution, então é aqui que a troca dela um dia vai doer — e é por isso que
// ele tem teste próprio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credenciais, enviarTexto, renomear } from '../functions/api/_evolution-grupos.js';

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
