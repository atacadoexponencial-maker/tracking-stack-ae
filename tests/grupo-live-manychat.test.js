import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { pontearGrupoLive, TAG_GRUPO_LIVE, TAG_SAIU_GRUPO, TAG_BOAS_VINDAS_ENVIADA, FLUXO_BOAS_VINDAS } from '../functions/api/_grupo-live-manychat.js';

// Mesmo padrão de tests/manychat.test.js: a API do ManyChat é simulada e toda
// chamada fica registrada. O log da ponte vai para console.error, silenciado
// aqui para a saída do teste não virar ruído.
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
const jid = (n) => `${n}@s.whatsapp.net`;
const entrou = (n) => ({ participantJid: jid(n), action: 'entrou', actorJid: null });
const saiu = (n) => ({ participantJid: jid(n), action: 'saiu', actorJid: null });
const caminhos = (chamadas) => chamadas.map((c) => c.caminho.split('?')[0]);
const corpoDe = (chamadas, caminho) => chamadas.filter((c) => c.caminho.startsWith(caminho)).map((c) => c.body);

test('entrou: inscreve, tagueia, dispara o fluxo e só então marca a tag de controle', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/createSubscriber': () => [200, { data: { id: '777' } }],
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [200, {}],
    '/fb/sending/sendFlow': () => [200, { status: 'success' }],
    '/fb/subscriber/removeTag': () => [200, {}],
  });

  const resumo = await pontearGrupoLive(env, [entrou('5521999990000')]);

  assert.deepEqual(resumo, { inscrito: 1 });
  assert.deepEqual(caminhos(chamadas), [
    '/fb/subscriber/createSubscriber',
    '/fb/subscriber/updateSubscriber',
    '/fb/subscriber/addTag',
    '/fb/sending/sendFlow',
    '/fb/subscriber/addTag',
    '/fb/subscriber/removeTag',
  ]);
  assert.deepEqual(corpoDe(chamadas, '/fb/subscriber/addTag'), [
    { subscriber_id: '777', tag_id: TAG_GRUPO_LIVE },
    { subscriber_id: '777', tag_id: TAG_BOAS_VINDAS_ENVIADA },
  ]);
  assert.deepEqual(corpoDe(chamadas, '/fb/sending/sendFlow'), [
    { subscriber_id: '777', flow_ns: FLUXO_BOAS_VINDAS },
  ]);
  // "Voltou": a tag de saída sai de quem entrou.
  assert.deepEqual(corpoDe(chamadas, '/fb/subscriber/removeTag'), [
    { subscriber_id: '777', tag_id: TAG_SAIU_GRUPO },
  ]);
});

test('entrou e o fluxo é recusado: fica sem a tag de controle', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/createSubscriber': () => [200, { data: { id: '777' } }],
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [200, {}],
    // O ManyChat responde 200 com erro no corpo — o caso que engana.
    '/fb/sending/sendFlow': () => [200, { status: 'error', message: 'template not approved' }],
  });

  const resumo = await pontearGrupoLive(env, [entrou('5521999990000')]);

  assert.deepEqual(resumo, { entrada_erro: 1 });
  assert.deepEqual(corpoDe(chamadas, '/fb/subscriber/addTag'), [
    { subscriber_id: '777', tag_id: TAG_GRUPO_LIVE },
  ]);
});

test('saiu: aplica a tag de saída e NÃO mexe na tag de pertencimento nem cria contato', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/findBySystemField': () => [200, { status: 'success', data: [{ id: 555 }] }],
    '/fb/subscriber/addTag': () => [200, {}],
  });

  const resumo = await pontearGrupoLive(env, [saiu('5521999990000')]);

  assert.deepEqual(resumo, { saida_tagueada: 1 });
  assert.deepEqual(caminhos(chamadas), ['/fb/subscriber/findBySystemField', '/fb/subscriber/addTag']);
  assert.deepEqual(corpoDe(chamadas, '/fb/subscriber/addTag'), [
    { subscriber_id: '555', tag_id: TAG_SAIU_GRUPO },
  ]);
});

test('saiu quem não está no ManyChat: nenhum contato é criado', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/findBySystemField': () => [200, { status: 'success', data: [] }],
  });

  const resumo = await pontearGrupoLive(env, [saiu('5521999990000')]);

  assert.deepEqual(resumo, { saida_sem_inscrito: 1 });
  assert.deepEqual(caminhos(chamadas), ['/fb/subscriber/findBySystemField']);
});

test('participante só com @lid: nenhuma chamada ao ManyChat', async () => {
  const chamadas = simularApi({});
  const resumo = await pontearGrupoLive(env, [{ participantJid: '48249931051224@lid', action: 'entrou' }]);
  assert.deepEqual(resumo, { sem_telefone: 1 });
  assert.equal(chamadas.length, 0);
});

test('telefone antigo sem o nono dígito recebe o 9 antes de ir ao ManyChat', async () => {
  const chamadas = simularApi({
    '/fb/subscriber/createSubscriber': () => [200, { data: { id: '777' } }],
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [200, {}],
    '/fb/sending/sendFlow': () => [200, { status: 'success' }],
    '/fb/subscriber/removeTag': () => [200, {}],
  });

  await pontearGrupoLive(env, [entrou('558496078857')]);

  assert.equal(chamadas[0].body.whatsapp_phone, '5584996078857');
});

test('sem MANYCHAT_API: desiste sem chamar nada', async () => {
  const chamadas = simularApi({});
  const resumo = await pontearGrupoLive({}, [entrou('5521999990000')]);
  assert.deepEqual(resumo, { sem_config: 1 });
  assert.equal(chamadas.length, 0);
});

test('um participante que falha não interrompe os outros do mesmo evento', async () => {
  let criacoes = 0;
  simularApi({
    '/fb/subscriber/createSubscriber': () => {
      criacoes += 1;
      return criacoes === 1 ? [500, { status: 'error' }] : [200, { data: { id: '888' } }];
    },
    '/fb/subscriber/updateSubscriber': () => [200, {}],
    '/fb/subscriber/addTag': () => [200, {}],
    '/fb/sending/sendFlow': () => [200, { status: 'success' }],
    '/fb/subscriber/removeTag': () => [200, {}],
  });

  const resumo = await pontearGrupoLive(env, [entrou('5521999990000'), entrou('5521999990001')]);

  assert.deepEqual(resumo, { entrada_erro: 1, inscrito: 1 });
});
