// Contatos de marketing (issue 380) contra SQLite real (migrations 0050 e
// 0053 + as colunas do event_log, sessions, lead_dispatch, leads_bloqueados e
// config_kv que a carga lê) e Postmark/ClickUp simulados (fetch trocado).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import * as contatosApi from '../functions/api/email/contatos.js';
import * as syncContatos from '../functions/api/sync/email-contatos.js';
import {
  registrarLead, carregarDoTracking, preencherNomes, aplicarResultado,
} from '../functions/api/_email-contatos.js';
import { CU_FIELD } from '../functions/api/_clickup.js';

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

let db, env, rede;

// Postmark (supressões) e ClickUp (tarefas) simulados.
function redeFalsa() {
  const estado = { supressoes: [], foraDoAr: false, tarefas: {}, clickupChamadas: 0 };
  const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  estado.fetch = async (url, op = {}) => {
    const u = new URL(String(url));
    if (u.hostname === 'api.clickup.com') {
      estado.clickupChamadas++;
      const id = decodeURIComponent(u.pathname.split('/task/')[1] || '');
      const t = estado.tarefas[id];
      return t ? resp(t) : resp({ err: 'not found' }, 404);
    }
    if (estado.foraDoAr) throw new TypeError('fetch failed');
    const m = /^\/message-streams\/([^/]+)\/suppressions(\/delete)?$/.exec(u.pathname);
    if (m) {
      const email = JSON.parse(op.body).Suppressions[0].EmailAddress;
      estado.supressoes.push({ stream: m[1], email, acao: m[2] ? 'apagar' : 'criar' });
      return resp({ Suppressions: [{ EmailAddress: email, Status: m[2] ? 'Deleted' : 'Suppressed', Message: null }] });
    }
    throw new Error('fetch inesperado: ' + u);
  };
  return estado;
}

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE sessions (session_id TEXT PRIMARY KEY, ip_address TEXT, utm_source TEXT, utm_campaign TEXT, funnel TEXT DEFAULT '');
    CREATE TABLE event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, event_name TEXT NOT NULL, event_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL, is_bot INTEGER DEFAULT 0, raw_email TEXT DEFAULT '', funnel TEXT DEFAULT '', is_junk INTEGER NOT NULL DEFAULT 0, material TEXT);
    CREATE TABLE leads_bloqueados (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT);
    CREATE TABLE lead_dispatch (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, email TEXT, task_id TEXT);
    CREATE TABLE config_kv (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
  `);
  for (const f of ['0050_email.sql', '0053_email_contatos.sql']) db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  env = { DB: d1(db), DASH_KEY: 'k', SYNC_SECRET: 's', POSTMARK_SERVER_TOKEN: 'srv', CLICKUP_API_TOKEN: 'cu' };
  rede = redeFalsa();
  globalThis.fetch = rede.fetch;
});

let n = 0;
function lead({ email, funil = 'workshop-gratuito', ts = 1000, bot = 0, junk = 0, utm = 'facebookads', material = null, ip = '200.1.1.1', evento = 'Lead' }) {
  const sid = `s${++n}`;
  db.prepare('INSERT INTO sessions (session_id, ip_address, utm_source) VALUES (?, ?, ?)').run(sid, ip, utm);
  const eid = `ev${n}`;
  db.prepare('INSERT INTO event_log (session_id, event_name, event_id, timestamp, is_bot, raw_email, funnel, is_junk, material) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(sid, evento, eid, ts, bot, email, funil, junk, material);
  return eid;
}
const contato = (email) => db.prepare('SELECT * FROM email_contatos WHERE email = ?').get(email);
const dash = (corpo, qs = '') => (corpo
  ? contatosApi.onRequestPost({ request: new Request(`https://x/api?key=k${qs}`, { method: 'POST', body: JSON.stringify(corpo) }), env })
  : contatosApi.onRequestGet({ request: new Request(`https://x/api?key=k${qs}`), env })).then(async (r) => ({ status: r.status, corpo: await r.json() }));

test('carga: um contato por e-mail, inválido marcado, robô, bloqueado e teste antigo fora', async () => {
  lead({ email: 'Ana@Empresa.com ', ts: 100 });
  lead({ email: 'ana@empresa.com', funil: 'sessao-estrategica', ts: 200, utm: '' });
  lead({ email: 'nao-e-email', ts: 300 });
  lead({ email: 'bot@x.com', bot: 1 });
  lead({ email: 'teste@seteads.com', junk: 1 });
  const bloq = lead({ email: 'bloq@x.com' });
  db.prepare('INSERT INTO leads_bloqueados (event_id) VALUES (?)').run(bloq);
  lead({ email: 'ip@x.com', ip: '45.148.10.7' });
  lead({ email: 'pv@x.com', evento: 'PageView' });
  const r = await carregarDoTracking(env);
  assert.deepEqual(db.prepare('SELECT email FROM email_contatos ORDER BY email').all().map((x) => x.email), ['ana@empresa.com', 'nao-e-email']);
  const ana = contato('ana@empresa.com');
  assert.deepEqual([ana.funil, ana.origem, ana.entrou_em, ana.situacao], ['workshop-gratuito', 'meta-ads', 100, 'ativo']);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_contatos_entradas WHERE contato_id = ?').get(ana.id).n, 2);
  assert.equal(contato('nao-e-email').situacao, 'invalido');
  assert.equal(r.cursor, db.prepare('SELECT MAX(id) AS m FROM event_log').get().m);
});

test('carga continua de onde parou e não repete', async () => {
  for (let i = 0; i < 5; i++) lead({ email: `p${i}@x.com`, ts: 100 + i });
  let r = await carregarDoTracking(env, { limite: 2 });
  assert.equal(r.lidos, 2);
  r = await carregarDoTracking(env, { limite: 2 });
  r = await carregarDoTracking(env, { limite: 2 });
  r = await carregarDoTracking(env, { limite: 2 });
  assert.equal(r.lidos, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_contatos').get().n, 5);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_contatos_entradas').get().n, 5);
});

test('lead novo pelo tracker: nome na hora; a carga depois não duplica e acerta a primeira entrada', async () => {
  const antigo = lead({ email: 'bia@x.com', funil: 'workshop-gratuito', ts: 100 });
  const novo = lead({ email: 'bia@x.com', funil: 'sessao-estrategica', ts: 500 });
  await registrarLead(env, { email: 'bia@x.com', nome: 'Bia Souza', funil: 'sessao-estrategica', origem: 'bio', eventId: novo, quando: 500 });
  assert.deepEqual([contato('bia@x.com').nome, contato('bia@x.com').funil], ['Bia Souza', 'sessao-estrategica']);
  await carregarDoTracking(env);
  const c = contato('bia@x.com');
  assert.deepEqual([c.nome, c.funil, c.entrou_em], ['Bia Souza', 'workshop-gratuito', 100]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_contatos_entradas').get().n, 2);
  assert.ok(antigo);
});

test('nome com @ (e-mail no campo de nome) não vira nome', async () => {
  await registrarLead(env, { email: 'ana@x.com', nome: 'ana@x.com', eventId: 'n1', quando: 10 });
  const c = contato('ana@x.com');
  assert.deepEqual([c.nome, c.nome_buscado], [null, 0], 'fica sem nome, e a busca no ClickUp ainda tenta');
  await registrarLead(env, { email: 'ana@x.com', nome: 'Ana Lima', eventId: 'n2', quando: 20 });
  await registrarLead(env, { email: 'ana@x.com', nome: 'outra@x.com', eventId: 'n3', quando: 30 });
  assert.equal(contato('ana@x.com').nome, 'Ana Lima', 'um e-mail depois não apaga o nome bom');
});

test('teste interno pelo tracker entra como contato normal', async () => {
  await registrarLead(env, { email: 'eu@seteads.com', nome: 'Eu', eventId: 'x1', quando: 10 });
  assert.equal(contato('eu@seteads.com').situacao, 'ativo');
});

test('descadastrado que preenche de novo volta a ativo; denunciou e voltou não', async () => {
  for (const [email, tipo] of [['a@x.com', 'descadastrou'], ['b@x.com', 'spam'], ['c@x.com', 'voltou']]) {
    await registrarLead(env, { email, eventId: `${email}-1`, quando: 100 });
    await aplicarResultado(env, email, tipo, 200);
  }
  // Formulário antigo (antes do descadastro) não reativa.
  await registrarLead(env, { email: 'a@x.com', eventId: 'a-velho', quando: 150 });
  assert.equal(contato('a@x.com').situacao, 'descadastrado');
  for (const email of ['a@x.com', 'b@x.com', 'c@x.com']) await registrarLead(env, { email, eventId: `${email}-2`, quando: 300 });
  assert.deepEqual([contato('a@x.com').situacao, contato('a@x.com').situacao_por], ['ativo', 'lead']);
  assert.equal(contato('b@x.com').situacao, 'denunciou');
  assert.equal(contato('c@x.com').situacao, 'voltou');
  assert.deepEqual(rede.supressoes, [{ stream: 'broadcast', email: 'a@x.com', acao: 'apagar' }]);
});

test('resultados só sobem de gravidade', async () => {
  await registrarLead(env, { email: 'a@x.com', eventId: 'e1', quando: 1 });
  await aplicarResultado(env, 'A@x.com', 'voltou', 10);
  assert.equal(contato('a@x.com').situacao, 'voltou');
  await aplicarResultado(env, 'a@x.com', 'spam', 20);
  assert.equal(contato('a@x.com').situacao, 'denunciou');
  await aplicarResultado(env, 'a@x.com', 'descadastrou', 30);
  await aplicarResultado(env, 'a@x.com', 'voltou', 40);
  assert.deepEqual([contato('a@x.com').situacao, contato('a@x.com').situacao_por], ['denunciou', 'servico']);
  await aplicarResultado(env, 'a@x.com', 'aberto', 50);
  assert.equal(contato('a@x.com').situacao, 'denunciou');
});

test('nomes pelo ClickUp: campo Nome, sem card fica sem nome, não pergunta duas vezes', async () => {
  for (const email of ['a@x.com', 'b@x.com', 'c@x.com']) await registrarLead(env, { email, eventId: email, quando: 1 });
  db.prepare("INSERT INTO lead_dispatch (email, task_id) VALUES ('A@x.com', 't1'), ('b@x.com', 't2')").run();
  rede.tarefas.t1 = { name: 'Card A', custom_fields: [{ id: CU_FIELD.nome, value: 'Ana Lima' }] };
  rede.tarefas.t2 = { name: 'Bruno Rocha', custom_fields: [] };
  assert.equal(await preencherNomes(env), 2);
  assert.deepEqual(['a@x.com', 'b@x.com', 'c@x.com'].map((e) => contato(e).nome), ['Ana Lima', 'Bruno Rocha', null]);
  const chamadas = rede.clickupChamadas;
  assert.equal(await preencherNomes(env), 0);
  assert.equal(rede.clickupChamadas, chamadas);
});

test('descadastrar: marca e cria supressão no marketing; Postmark fora do ar avisa', async () => {
  await registrarLead(env, { email: 'a@x.com', eventId: 'e1', quando: 1 });
  const id = contato('a@x.com').id;
  let r = await dash({ acao: 'descadastrar', id });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.contato.situacao, 'descadastrado');
  assert.equal(r.corpo.aviso, null);
  assert.deepEqual(rede.supressoes, [{ stream: 'broadcast', email: 'a@x.com', acao: 'criar' }]);
  rede.foraDoAr = true;
  r = await dash({ acao: 'descadastrar', id });
  assert.equal(r.status, 200);
  assert.match(r.corpo.aviso, /não confirmou a supressão/);
});

test('reativar só "voltou", apagando a supressão nos dois canais', async () => {
  for (const email of ['v@x.com', 'd@x.com']) await registrarLead(env, { email, eventId: email, quando: 1 });
  await aplicarResultado(env, 'v@x.com', 'voltou', 10);
  await aplicarResultado(env, 'd@x.com', 'descadastrou', 10);
  let r = await dash({ acao: 'reativar', id: contato('d@x.com').id });
  assert.equal(r.status, 409);
  rede.foraDoAr = true;
  r = await dash({ acao: 'reativar', id: contato('v@x.com').id });
  assert.equal(r.status, 504);
  assert.equal(contato('v@x.com').situacao, 'voltou');
  rede.foraDoAr = false;
  r = await dash({ acao: 'reativar', id: contato('v@x.com').id });
  assert.equal(r.corpo.contato.situacao, 'ativo');
  assert.deepEqual(rede.supressoes.map((s) => s.stream).sort(), ['broadcast', 'outbound']);
});

test('lista: totais, busca, filtros e página', async () => {
  await registrarLead(env, { email: 'ana@x.com', nome: 'Ana Lima', funil: 'workshop-gratuito', origem: 'meta-ads', eventId: 'e1', quando: 10 });
  await registrarLead(env, { email: 'ana@x.com', funil: 'sessao-estrategica', origem: 'bio', eventId: 'e2', quando: 20 });
  await registrarLead(env, { email: 'bruno@x.com', nome: 'Bruno', funil: 'sessao-estrategica', origem: 'bio', eventId: 'e3', quando: 30 });
  await aplicarResultado(env, 'bruno@x.com', 'voltou', 40);
  let r = await dash(null);
  assert.deepEqual(r.corpo.totais, { ativos: 1, geral: 2 });
  assert.deepEqual(r.corpo.funis, ['sessao-estrategica', 'workshop-gratuito']);
  assert.deepEqual(r.corpo.origens, ['bio', 'meta-ads']);
  r = await dash(null, '&busca=LIMA');
  assert.deepEqual(r.corpo.contatos.map((c) => c.email), ['ana@x.com']);
  r = await dash(null, '&funil=sessao-estrategica');
  assert.equal(r.corpo.total, 2, 'acha pela entrada, não só pela primeira');
  r = await dash(null, '&situacao=voltou');
  assert.deepEqual(r.corpo.contatos.map((c) => c.email), ['bruno@x.com']);
  r = await dash(null, '&origem=meta-ads&pagina=2');
  assert.deepEqual([r.corpo.total, r.corpo.contatos.length], [1, 0]);
});

test('detalhe: entradas e e-mails recebidos; inexistente dá 404', async () => {
  await registrarLead(env, { email: 'ana@x.com', funil: 'workshop-gratuito', eventId: 'e1', quando: 10 });
  db.prepare("INSERT INTO email_envios (canal, origem, destinatario, assunto, situacao, enviado_em) VALUES ('marketing', 'teste', 'Ana@x.com', 'Oi', 'aberto', 50)").run();
  const r = await dash(null, `&id=${contato('ana@x.com').id}`);
  assert.equal(r.status, 200);
  assert.equal(r.corpo.entradas.length, 1);
  assert.deepEqual(r.corpo.envios.map((e) => [e.assunto, e.situacao]), [['Oi', 'aberto']]);
  assert.equal((await dash(null, '&id=999')).status, 404);
});

test('rodada periódica: exige o segredo, carrega e busca nomes', async () => {
  const sem = await syncContatos.onRequestPost({ request: new Request('https://x', { method: 'POST' }), env });
  assert.equal(sem.status, 401);
  lead({ email: 'a@x.com' });
  db.prepare("INSERT INTO lead_dispatch (email, task_id) VALUES ('a@x.com', 't1')").run();
  rede.tarefas.t1 = { name: 'x', custom_fields: [{ id: CU_FIELD.nome, value: 'Ana' }] };
  const r = await syncContatos.onRequestPost({ request: new Request('https://x', { method: 'POST', headers: { 'x-sync-secret': 's' } }), env });
  const corpo = await r.json();
  assert.deepEqual([corpo.ok, corpo.lidos, corpo.nomes], [true, 1, 1]);
  assert.equal(contato('a@x.com').nome, 'Ana');
});
