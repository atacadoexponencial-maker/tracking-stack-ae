import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { inscreverComTag } from '../functions/api/_manychat.js';

// Simula a API do ManyChat: cada rota responde conforme `rotas` e toda chamada
// fica registrada para os asserts.
const fetchOriginal = globalThis.fetch;
function simularApi(rotas) {
  const chamadas = [];
  globalThis.fetch = async (url, opts = {}) => {
    const caminho = String(url).replace('https://api.manychat.com', '');
    chamadas.push({ caminho, body: opts.body ? JSON.parse(opts.body) : null });
    const chave = Object.keys(rotas).find((k) => caminho.startsWith(k));
    const [status, corpo] = chave ? rotas[chave](caminho) : [404, {}];
    return new Response(JSON.stringify(corpo), { status });
  };
  return chamadas;
}
afterEach(() => { globalThis.fetch = fetchOriginal; });

const env = { MANYCHAT_API: 'x' };
const base = { nome: 'Fulana Silva', telefone: '5521999990000', email: 'fulana@x.com', tagId: 123, env };
const jaExiste = () => [400, { status: 'error', message: 'This WhatsApp ID already exists' }];

test('inscrito novo: cria, preenche phone e aplica a tag', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/createSubscriber': () => [200, { data: { id: '777' } }],
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [200, {}],
  });
  const r = await inscreverComTag(base);
  assert.deepEqual(r, { ok: true, motivo: 'inscrito', subscriberId: '777' });
  assert.deepEqual(chamadas.at(-1).body, { subscriber_id: '777', tag_id: 123 });
});

test('já existia e é achado pelo telefone: tagueia o existente', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/createSubscriber': jaExiste,
    '/fb/subscriber/findBySystemField?phone=5521999990000': () => [200, { status: 'success', data: [{ id: 555 }] }],
    '/fb/subscriber/addTag': () => [200, {}],
  });
  const r = await inscreverComTag(base);
  assert.deepEqual(r, { ok: true, motivo: 'ja_existia_tagueado', subscriberId: '555' });
  assert.deepEqual(chamadas.at(-1).body, { subscriber_id: '555', tag_id: 123 });
  assert.ok(!chamadas.some((c) => c.caminho.includes('email=')), 'não precisa buscar por e-mail');
});

test('já existia, sem phone, achado pelo e-mail: tagueia o existente', async () => {
  simularApi({
    '/fb/subscriber/createSubscriber': jaExiste,
    '/fb/subscriber/findBySystemField?phone=': () => [200, { status: 'success', data: [] }],
    '/fb/subscriber/findBySystemField?email=fulana%40x.com': () => [200, { status: 'success', data: { id: 444 } }],
    '/fb/subscriber/addTag': () => [200, {}],
  });
  const r = await inscreverComTag(base);
  assert.deepEqual(r, { ok: true, motivo: 'ja_existia_tagueado', subscriberId: '444' });
});

test('já existia e não é achado (data vazio com status success): ja_existia, sem addTag', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/createSubscriber': jaExiste,
    '/fb/subscriber/findBySystemField': () => [200, { status: 'success', data: [] }],
  });
  const r = await inscreverComTag(base);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'ja_existia');
  assert.ok(!chamadas.some((c) => c.caminho.includes('addTag')));
});

test('já existia e a tag falha: erro com o id do existente', async () => {
  simularApi({
    '/fb/subscriber/createSubscriber': jaExiste,
    '/fb/subscriber/findBySystemField?phone=': () => [200, { data: [{ id: 555 }] }],
    '/fb/subscriber/addTag': () => [500, { message: 'boom' }],
  });
  const r = await inscreverComTag(base);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'erro');
  assert.equal(r.subscriberId, '555');
});

test('com flowNs: inscrito novo recebe a tag e depois o fluxo', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/createSubscriber': () => [200, { data: { id: '777' } }],
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [200, {}],
    '/fb/sending/sendFlow': () => [200, { status: 'success' }],
  });
  const r = await inscreverComTag({ ...base, flowNs: 'content_abc' });
  assert.deepEqual(r, { ok: true, motivo: 'inscrito', subscriberId: '777' });
  assert.equal(chamadas.at(-2).caminho, '/fb/subscriber/addTag');
  assert.deepEqual(chamadas.at(-1), { caminho: '/fb/sending/sendFlow', body: { subscriber_id: '777', flow_ns: 'content_abc' } });
});

test('com flowNs: existente achado pelo telefone também recebe o fluxo', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/createSubscriber': jaExiste,
    '/fb/subscriber/findBySystemField?phone=': () => [200, { data: [{ id: 555 }] }],
    '/fb/subscriber/addTag': () => [200, {}],
    '/fb/sending/sendFlow': () => [200, { status: 'success' }],
  });
  const r = await inscreverComTag({ ...base, flowNs: 'content_abc' });
  assert.deepEqual(r, { ok: true, motivo: 'ja_existia_tagueado', subscriberId: '555' });
  assert.deepEqual(chamadas.at(-1).body, { subscriber_id: '555', flow_ns: 'content_abc' });
});

test('com flowNs: sendFlow com 200 e status error vira erro', async () => {
  simularApi({
    '/fb/subscriber/createSubscriber': () => [200, { data: { id: '777' } }],
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [200, {}],
    '/fb/sending/sendFlow': () => [200, { status: 'error', message: 'Flow not found' }],
  });
  const r = await inscreverComTag({ ...base, flowNs: 'content_abc' });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'erro');
  assert.match(r.detalhe, /fluxo falhou/);
});

test('tag falha: fluxo não é disparado', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/createSubscriber': () => [200, { data: { id: '777' } }],
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [500, { message: 'boom' }],
  });
  const r = await inscreverComTag({ ...base, flowNs: 'content_abc' });
  assert.equal(r.ok, false);
  assert.ok(!chamadas.some((c) => c.caminho.includes('sendFlow')));
});

test('com tagEnviadoId: tag de controle entra depois do fluxo aceito', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/createSubscriber': () => [200, { data: { id: '777' } }],
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [200, {}],
    '/fb/sending/sendFlow': () => [200, { status: 'success' }],
  });
  const r = await inscreverComTag({ ...base, flowNs: 'content_abc', tagEnviadoId: 999 });
  assert.deepEqual(r, { ok: true, motivo: 'inscrito', subscriberId: '777' });
  assert.deepEqual(chamadas.slice(-3).map((c) => c.body), [
    { subscriber_id: '777', tag_id: 123 },
    { subscriber_id: '777', flow_ns: 'content_abc' },
    { subscriber_id: '777', tag_id: 999 },
  ]);
});

test('com tagEnviadoId: fluxo recusado não recebe a tag de controle', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/createSubscriber': () => [200, { data: { id: '777' } }],
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [200, {}],
    '/fb/sending/sendFlow': () => [400, { status: 'error', message: 'outside 24h window' }],
  });
  const r = await inscreverComTag({ ...base, flowNs: 'content_abc', tagEnviadoId: 999 });
  assert.equal(r.ok, false);
  assert.match(r.detalhe, /fluxo falhou/);
  assert.ok(!chamadas.some((c) => c.body?.tag_id === 999));
});

test('com tagEnviadoId: fluxo enviado e tag de controle falha vira erro explicado', async () => {
  simularApi({
    '/fb/subscriber/createSubscriber': jaExiste,
    '/fb/subscriber/findBySystemField?phone=': () => [200, { data: [{ id: 555 }] }],
    '/fb/subscriber/addTag': () => [200, {}],
    '/fb/sending/sendFlow': () => [200, { status: 'success' }],
  });
  // addTag responde conforme o tag_id: a de controle (999) falha
  const fetchSimulado = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    if (body?.tag_id === 999) return new Response('{"message":"boom"}', { status: 500 });
    return fetchSimulado(url, opts);
  };
  const r = await inscreverComTag({ ...base, flowNs: 'content_abc', tagEnviadoId: 999 });
  assert.equal(r.ok, false);
  assert.equal(r.subscriberId, '555');
  assert.match(r.detalhe, /fluxo enviado, mas a tag de controle falhou/);
});
