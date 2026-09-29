import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { enviarLeadAoManyChat, FUNIS_MANYCHAT } from '../functions/api/_lead-manychat.js';

// Mesmo padrão de tests/grupos-manychat.test.js: a API do ManyChat é simulada
// e toda chamada fica registrada.
const fetchOriginal = globalThis.fetch;
const errOriginal = console.error;
function simularApi(rotas) {
  const chamadas = [];
  globalThis.fetch = async (url, opts = {}) => {
    const caminho = String(url).replace('https://api.manychat.com', '');
    chamadas.push({ caminho, body: opts.body ? JSON.parse(opts.body) : null });
    const chave = Object.keys(rotas).find((k) => caminho.startsWith(k));
    const [status, corpo] = chave ? rotas[chave](caminho) : [404, {}];
    return new Response(JSON.stringify(corpo), { status });
  };
  console.error = () => {};
  return chamadas;
}
afterEach(() => { globalThis.fetch = fetchOriginal; console.error = errOriginal; });

const env = { MANYCHAT_API: 'x' };
const lead = { funnel: 'workshop', nome: 'Fulana de Tal', telefone: '(21) 99999-0000', email: 'Fulana@Exemplo.com' };
const caminhos = (chamadas) => chamadas.map((c) => c.caminho.split('?')[0]);
const corpo = (chamadas, caminho) => chamadas.find((c) => c.caminho.startsWith(caminho))?.body;
const tagForm = FUNIS_MANYCHAT.workshop.tagForm;

test('workshop, contato novo: procura nas duas formas do telefone, cria e aplica a tag do formulário', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/findBySystemField': () => [200, { status: 'success', data: [] }],
    '/fb/subscriber/createSubscriber': () => [200, { data: { id: '777' } }],
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [200, {}],
    '/fb/sending/sendFlow': () => [200, { status: 'success' }],
  });

  const r = await enviarLeadAoManyChat({ leadData: lead, env });

  assert.equal(r, 'inscrito');
  assert.deepEqual(caminhos(chamadas), [
    '/fb/subscriber/findBySystemField',
    '/fb/subscriber/findBySystemField',
    '/fb/subscriber/createSubscriber',
    '/fb/subscriber/updateSubscriber',
    '/fb/subscriber/addTag',
    '/fb/sending/sendFlow',
  ]);
  const cria = chamadas.find((c) => c.caminho.startsWith('/fb/subscriber/createSubscriber')).body;
  assert.equal(cria.whatsapp_phone, '5521999990000');
  assert.equal(cria.first_name, 'Fulana');
  assert.deepEqual(corpo(chamadas, '/fb/subscriber/addTag'), { subscriber_id: '777', tag_id: tagForm });
  // O fluxo "Entre no grupo" sai logo depois da tag; a espera de 30 min é dele.
  assert.equal(corpo(chamadas, '/fb/sending/sendFlow').flow_ns, FUNIS_MANYCHAT.workshop.fluxo);
});

test('workshop, contato que já existe: aplica a tag e dispara o fluxo, sem criar outro', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/findBySystemField': () => [200, { status: 'success', data: [{ id: '555' }] }],
    '/fb/subscriber/addTag': () => [200, {}],
    '/fb/sending/sendFlow': () => [200, { status: 'success' }],
  });

  const r = await enviarLeadAoManyChat({ leadData: lead, env });

  assert.equal(r, 'ja_existia_tagueado');
  assert.ok(!caminhos(chamadas).includes('/fb/subscriber/createSubscriber'));
  assert.deepEqual(corpo(chamadas, '/fb/subscriber/addTag'), { subscriber_id: '555', tag_id: tagForm });
  assert.equal(corpo(chamadas, '/fb/sending/sendFlow').subscriber_id, '555');
});

test('funil sem configuração não chama o ManyChat', async () => {
  const chamadas = simularApi({});
  const r = await enviarLeadAoManyChat({ leadData: { ...lead, funnel: 'sessao-estrategica' }, env });
  assert.equal(r, 'funil_sem_config');
  assert.equal(chamadas.length, 0);
});

test('falha da API não lança', async () => {
  simularApi({ '/fb/subscriber/findBySystemField': () => { throw new Error('rede caiu'); } });
  const r = await enviarLeadAoManyChat({ leadData: lead, env });
  assert.equal(typeof r, 'string');
});
