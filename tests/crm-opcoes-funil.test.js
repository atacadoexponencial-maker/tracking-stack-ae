import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extrairOpcoesFunil, lerOpcoesFunilCrm, ERRO_LEITURA_CRM } from '../functions/api/_crm-opcoes-funil.js';
import { CU_FIELD } from '../functions/api/_clickup.js';

const campoFunil = (options) => ({ id: CU_FIELD.funil, name: '🔻 Funil', type: 'drop_down', type_config: { options } });
const op = (id, name, orderindex) => ({ id, name, orderindex, color: '#000' });

test('extrai as opções do campo pelo id, na ordem do CRM', () => {
  const r = extrairOpcoesFunil({ fields: [
    { id: 'outro', name: '🔻 FUNIL', type: 'short_text', type_config: {} },
    campoFunil([op('b', 'WO PAGO', 9), op('a', 'SESSÃO ESTRATÉGICA', 0), op('c', 'LIVES SEMANAIS', 13)]),
  ] });
  assert.deepEqual(r, [
    { id: 'a', nome: 'SESSÃO ESTRATÉGICA' },
    { id: 'b', nome: 'WO PAGO' },
    { id: 'c', nome: 'LIVES SEMANAIS' },
  ]);
});

test('ignora o campo de texto homônimo "🔻 FUNIL"', () => {
  const r = extrairOpcoesFunil({ fields: [{ id: 'outro', name: '🔻 Funil', type_config: { options: [op('x', 'X', 0)] } }] });
  assert.equal(r, null);
});

test('campo ausente ou malformado devolve null, nunca lista vazia', () => {
  assert.equal(extrairOpcoesFunil(null), null);
  assert.equal(extrairOpcoesFunil({}), null);
  assert.equal(extrairOpcoesFunil({ fields: [] }), null);
  assert.equal(extrairOpcoesFunil({ fields: [{ id: CU_FIELD.funil, type_config: {} }] }), null);
});

test('descarta opção sem id ou sem nome e apara espaços', () => {
  const r = extrairOpcoesFunil({ fields: [campoFunil([op('a', '  ISCAS ', 1), op('', 'SEM ID', 2), op('c', '   ', 3)])] });
  assert.deepEqual(r, [{ id: 'a', nome: 'ISCAS' }]);
});

function comFetch(fn, corpo) {
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  return corpo().finally(() => { globalThis.fetch = original; });
}

test('sem token não chama o CRM e devolve a falha', async () => {
  let chamou = false;
  await comFetch(async () => { chamou = true; }, async () => {
    const r = await lerOpcoesFunilCrm({});
    assert.deepEqual(r, { ok: false, erro: ERRO_LEITURA_CRM });
  });
  assert.equal(chamou, false);
});

test('lê a lista configurada e devolve as opções', async () => {
  let urlChamada = '';
  await comFetch(async (url) => {
    urlChamada = url;
    return { ok: true, json: async () => ({ fields: [campoFunil([op('a', 'SESSÃO ESTRATÉGICA', 0)])] }) };
  }, async () => {
    const r = await lerOpcoesFunilCrm({ CLICKUP_API_TOKEN: 't', CLICKUP_LIST_ID: '123' });
    assert.deepEqual(r, { ok: true, opcoes: [{ id: 'a', nome: 'SESSÃO ESTRATÉGICA' }] });
  });
  assert.match(urlChamada, /\/list\/123\/field$/);
});

test('HTTP de erro, exceção de rede ou campo ausente viram falha, sem lançar', async () => {
  const env = { CLICKUP_API_TOKEN: 't' };
  const original = console.error;
  console.error = () => {};
  try {
    await comFetch(async () => ({ ok: false, status: 401 }), async () => {
      assert.deepEqual(await lerOpcoesFunilCrm(env), { ok: false, erro: ERRO_LEITURA_CRM });
    });
    await comFetch(async () => { throw new Error('rede'); }, async () => {
      assert.deepEqual(await lerOpcoesFunilCrm(env), { ok: false, erro: ERRO_LEITURA_CRM });
    });
    await comFetch(async () => ({ ok: true, json: async () => ({ fields: [] }) }), async () => {
      assert.deepEqual(await lerOpcoesFunilCrm(env), { ok: false, erro: ERRO_LEITURA_CRM });
    });
  } finally {
    console.error = original;
  }
});
