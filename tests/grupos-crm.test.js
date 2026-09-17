import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registrarNoCrm } from '../functions/api/_grupos-crm.js';

const LIVE = '120363427499061913@g.us';
const WORKSHOP = '120363380235066572@g.us';

// A API do ClickUp é simulada; toda chamada fica registrada. O log da ponte vai
// para console.error, silenciado para a saída do teste não virar ruído.
const fetchOriginal = globalThis.fetch;
const errOriginal = console.error;
function simularClickUp({ achar = () => null, comentar = () => [200, {}] } = {}) {
  const chamadas = [];
  globalThis.fetch = async (url, opts = {}) => {
    const caminho = String(url).replace('https://api.clickup.com/api/v2', '');
    const body = opts.body ? JSON.parse(opts.body) : null;
    chamadas.push({ caminho, metodo: opts.method || 'GET', body });
    if (caminho.includes('/comment')) {
      const [status, corpo] = comentar();
      return new Response(JSON.stringify(corpo), { status });
    }
    const task = achar(caminho);
    return new Response(JSON.stringify({ tasks: task ? [task] : [] }), { status: 200 });
  };
  console.error = () => {};
  return chamadas;
}
afterEach(() => { globalThis.fetch = fetchOriginal; console.error = errOriginal; });

const env = { CLICKUP_API_TOKEN: 'tok' };
const quando = '2026-09-17T17:59:01.873Z'; // 14h59 em Brasília
const jid = (n) => `${n}@s.whatsapp.net`;
const entrou = (n) => ({ participantJid: jid(n), action: 'entrou' });
const saiu = (n) => ({ participantJid: jid(n), action: 'saiu' });
const card = { id: 'abc123', url: 'https://app.clickup.com/t/abc123' };
const comentarios = (chamadas) => chamadas.filter((c) => c.caminho.includes('/comment')).map((c) => c.body.comment_text);

test('lead que já existe no CRM: comentário com data e hora de Brasília', async () => {
  const chamadas = simularClickUp({ achar: () => card });

  const resumo = await registrarNoCrm(env, [entrou('5521999990000')], quando, LIVE);

  assert.deepEqual(resumo, { comentado: 1 });
  assert.deepEqual(comentarios(chamadas), [
    '📥 Entrou no grupo de WhatsApp da live semanal em 17/09/2026 às 14h59.',
  ]);
  assert.equal(chamadas.at(-1).caminho, '/task/abc123/comment');
});

test('saída também vira comentário', async () => {
  const chamadas = simularClickUp({ achar: () => card });
  const resumo = await registrarNoCrm(env, [saiu('5521999990000')], quando, LIVE);
  assert.deepEqual(resumo, { comentado: 1 });
  assert.deepEqual(comentarios(chamadas), [
    '📤 Saiu do grupo de WhatsApp da live semanal em 17/09/2026 às 14h59.',
  ]);
});

test('quem não é lead: NENHUM card é criado', async () => {
  const chamadas = simularClickUp({ achar: () => null });
  const resumo = await registrarNoCrm(env, [entrou('5521999990000')], quando, LIVE);
  assert.deepEqual(resumo, { nao_e_lead: 1 });
  assert.equal(chamadas.every((c) => c.metodo === 'GET'), true);
});

test('telefone sem o nono dígito acha o card gravado com o 9', async () => {
  const buscas = [];
  simularClickUp({
    achar: (caminho) => {
      buscas.push(decodeURIComponent(caminho));
      return caminho.includes('%2B5584996078857') || decodeURIComponent(caminho).includes('+5584996078857')
        ? card
        : null;
    },
  });

  const resumo = await registrarNoCrm(env, [entrou('558496078857')], quando, LIVE);

  assert.deepEqual(resumo, { comentado: 1 });
  assert.equal(buscas.some((b) => b.includes('+5584996078857')), true);
});

test('participante só com @lid: nenhuma chamada ao ClickUp', async () => {
  const chamadas = simularClickUp({ achar: () => card });
  const resumo = await registrarNoCrm(env, [{ participantJid: '48249931051224@lid', action: 'entrou' }], quando, LIVE);
  assert.deepEqual(resumo, { sem_telefone: 1 });
  assert.equal(chamadas.length, 0);
});

test('toda entrada comenta de novo: a recorrência é o que o comercial quer ver', async () => {
  const chamadas = simularClickUp({ achar: () => card });
  const resumo = await registrarNoCrm(env, [entrou('5521999990000'), entrou('5521999990000')], quando, LIVE);
  assert.deepEqual(resumo, { comentado: 2 });
  assert.equal(comentarios(chamadas).length, 2);
});

test('erro no ClickUp não derruba os outros participantes do evento', async () => {
  // O primeiro participante falha nas DUAS tentativas (o `clickupWrite` repete
  // uma vez em 5xx, e é isso que o segundo 500 cobre); o segundo passa.
  let n = 0;
  simularClickUp({
    achar: () => card,
    comentar: () => { n += 1; return n <= 2 ? [500, {}] : [200, {}]; },
  });

  const resumo = await registrarNoCrm(env, [entrou('5521999990000'), entrou('5521999990001')], quando, LIVE);

  assert.deepEqual(resumo, { erro: 1, comentado: 1 });
});

test('sem CLICKUP_API_TOKEN: desiste sem chamar nada', async () => {
  const chamadas = simularClickUp({ achar: () => card });
  const resumo = await registrarNoCrm({}, [entrou('5521999990000')], quando, LIVE);
  assert.deepEqual(resumo, { sem_config: 1 });
  assert.equal(chamadas.length, 0);
});

test('sem instante do evento, o comentário sai sem a data em vez de sair errado', async () => {
  const chamadas = simularClickUp({ achar: () => card });
  await registrarNoCrm(env, [entrou('5521999990000')], null, LIVE);
  assert.deepEqual(comentarios(chamadas), ['📥 Entrou no grupo de WhatsApp da live semanal.']);
});

test('comentário do workshop diz "do workshop", não "da live semanal"', async () => {
  const chamadas = simularClickUp({ achar: () => card });
  const resumo = await registrarNoCrm(env, [entrou('5521999990000')], quando, WORKSHOP);
  assert.deepEqual(resumo, { comentado: 1 });
  assert.deepEqual(comentarios(chamadas), [
    '📥 Entrou no grupo de WhatsApp do workshop em 17/09/2026 às 14h59.',
  ]);
});

test('grupo sem automação configurada: nenhuma chamada ao ClickUp', async () => {
  const chamadas = simularClickUp({ achar: () => card });
  const resumo = await registrarNoCrm(env, [entrou('5521999990000')], quando, '120363999999999999@g.us');
  assert.deepEqual(resumo, {});
  assert.equal(chamadas.length, 0);
});
