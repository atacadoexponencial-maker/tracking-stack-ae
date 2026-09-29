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
const tagForm = FUNIS_MANYCHAT.workshop.tagForm;

test('workshop, contato novo: procura nas duas formas do telefone, cria e aplica a tag do formulário', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/findBySystemField': () => [200, { status: 'success', data: [] }],
    '/fb/subscriber/createSubscriber': () => [200, { data: { id: '777' } }],
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [200, {}],
  });

  const r = await enviarLeadAoManyChat({ leadData: lead, env });

  assert.equal(r, 'inscrito');
  assert.deepEqual(caminhos(chamadas), [
    '/fb/subscriber/findBySystemField',
    '/fb/subscriber/findBySystemField',
    '/fb/subscriber/createSubscriber',
    '/fb/subscriber/updateSubscriber',
    '/fb/subscriber/addTag',
  ]);
  const cria = chamadas.find((c) => c.caminho.startsWith('/fb/subscriber/createSubscriber')).body;
  assert.equal(cria.whatsapp_phone, '5521999990000');
  assert.equal(cria.first_name, 'Fulana');
  assert.deepEqual(chamadas.at(-1).body, { subscriber_id: '777', tag_id: tagForm });
  // Sem fluxo configurado, nenhuma mensagem sai.
  assert.ok(!caminhos(chamadas).includes('/fb/sending/sendFlow'));
});

test('workshop, contato que já existe: só aplica a tag, sem criar outro', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/findBySystemField': () => [200, { status: 'success', data: [{ id: '555' }] }],
    '/fb/subscriber/addTag': () => [200, {}],
  });

  const r = await enviarLeadAoManyChat({ leadData: lead, env });

  assert.equal(r, 'ja_existia_tagueado');
  assert.ok(!caminhos(chamadas).includes('/fb/subscriber/createSubscriber'));
  assert.deepEqual(chamadas.at(-1).body, { subscriber_id: '555', tag_id: tagForm });
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
