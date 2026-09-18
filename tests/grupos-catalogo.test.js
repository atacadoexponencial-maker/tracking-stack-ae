// Catálogo de grupos: escolher da lista em vez de colar JID.
//
// A regra que carrega o risco aqui é a da Comunidade: quem clica vê o nome da
// Comunidade, mas quem precisa ser monitorado é o grupo de AVISOS — é onde as
// pessoas estão e de onde vêm os eventos. Cadastrar o pai daria uma medição
// permanentemente vazia, sem erro nenhum na tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { catalogo, monitorar, desligar, alternarMeta, normalizar } from '../functions/api/_grupos-catalogo.js';
import { onRequestGet as catGet, onRequestPost as catPost } from '../functions/api/grupos-catalogo.js';

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

const AVISOS = '120363427499061913@g.us';
const PAI = '120363429583787754@g.us';
const COMUM = '999999999999999999@g.us';
const AGORA = 1_789_800_000;

const ENV_EVO = { EVOLUTION_BASE_URL: 'https://api.exemplo.com', EVOLUTION_INSTANCE: 'Marcelle', EVOLUTION_APIKEY_NOTIF: 'segredo' };

// Lista que a Evolution devolveria: uma Comunidade, o Avisos dela, e um grupo comum.
const LISTA = [
  { id: PAI, subject: 'Lives Semanais', size: 6, isCommunity: true, isCommunityAnnounce: false, linkedParent: null },
  { id: AVISOS, subject: 'Lives Semanais', size: 207, isCommunity: false, isCommunityAnnounce: true, linkedParent: PAI },
  { id: COMUM, subject: 'Grupo da equipe', size: 12, isCommunity: false, isCommunityAnnounce: false, linkedParent: null },
];

function novoBanco() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE whatsapp_groups_tracked (
      group_jid TEXT PRIMARY KEY, label TEXT, group_name TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      send_conversion INTEGER NOT NULL DEFAULT 0, conversion_since INTEGER);
  `);
  db.exec(readFileSync(new URL('../migrations/0043_grupos_acoes.sql', import.meta.url), 'utf8'));
  return db;
}

const env = (db) => ({ DB: d1(db), ...ENV_EVO });
const fetchLista = (lista = LISTA) => async (url) => {
  const u = String(url);
  if (u.includes('fetchAllGroups')) return new Response(JSON.stringify(lista), { status: 200 });
  if (u.includes('findGroupInfos')) {
    const jid = new URL(u).searchParams.get('groupJid');
    const g = lista.find((x) => x.id === jid) || {};
    return new Response(JSON.stringify(g), { status: 200 });
  }
  return new Response('{}', { status: 200 });
};

// --- busca ---

test('normalizar tira acento e caixa, para busca em português funcionar', () => {
  assert.equal(normalizar('Sessão Estratégica'), 'sessao estrategica');
  assert.equal(normalizar('LIVE | O Jogo'), 'live | o jogo');
  assert.equal(normalizar(null), '');
});

// --- catálogo ---

test('catálogo classifica o tipo de cada grupo e ordena por tamanho', async () => {
  const c = await catalogo(env(novoBanco()), fetchLista());
  assert.equal(c.ok, true);
  assert.deepEqual(c.grupos.map((g) => g.size), [207, 12, 6], 'maiores primeiro');
  const porJid = Object.fromEntries(c.grupos.map((g) => [g.group_jid, g.tipo]));
  assert.equal(porJid[PAI], 'comunidade');
  assert.equal(porJid[AVISOS], 'avisos');
  assert.equal(porJid[COMUM], 'comum');
});

test('catálogo marca quem já está monitorado e quem está desligado', async () => {
  const db = novoBanco();
  db.prepare('INSERT INTO whatsapp_groups_tracked (group_jid,label,enabled) VALUES (?,?,1)').run(AVISOS, 'Lives');
  db.prepare('INSERT INTO whatsapp_groups_tracked (group_jid,label,enabled) VALUES (?,?,0)').run(COMUM, 'Equipe');
  const c = await catalogo(env(db), fetchLista());
  const porJid = Object.fromEntries(c.grupos.map((g) => [g.group_jid, g]));
  assert.equal(porJid[AVISOS].monitorado, true);
  assert.equal(porJid[COMUM].monitorado, false);
  assert.equal(porJid[PAI].monitorado, false);
});

test('grupo sem nome (bug conhecido da Evolution) é buscado individualmente', async () => {
  const semNome = LISTA.map((g) => (g.id === AVISOS ? { ...g, subject: undefined } : g));
  let buscasIndividuais = 0;
  const f = async (url) => {
    const u = String(url);
    if (u.includes('fetchAllGroups')) return new Response(JSON.stringify(semNome), { status: 200 });
    buscasIndividuais++;
    return new Response(JSON.stringify({ subject: 'Lives Semanais', size: 207 }), { status: 200 });
  };
  const c = await catalogo(env(novoBanco()), f);
  assert.equal(buscasIndividuais, 1, 'só o que veio sem nome deve custar uma consulta extra');
  assert.equal(c.grupos.find((g) => g.group_jid === AVISOS).subject, 'Lives Semanais');
});

test('Evolution fora do ar devolve erro legível, sem lançar', async () => {
  const c = await catalogo(env(novoBanco()), async () => new Response('nope', { status: 500 }));
  assert.equal(c.ok, false);
  assert.match(c.erro, /500/);
});

// --- monitorar ---

test('escolher a COMUNIDADE cadastra o grupo de AVISOS, não o pai', async () => {
  const db = novoBanco();
  const r = await monitorar(env(db), PAI, AGORA, fetchLista());
  assert.equal(r.ok, true);
  assert.equal(r.group_jid, AVISOS, 'é no Avisos que as pessoas estão');
  assert.equal(r.corrigido, true);
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked').all();
  assert.equal(l.length, 1);
  assert.equal(l[0].group_jid, AVISOS);
  assert.equal(l[0].parent_jid, PAI);
});

test('escolher o Avisos guarda o pai junto', async () => {
  const db = novoBanco();
  const r = await monitorar(env(db), AVISOS, AGORA, fetchLista());
  assert.equal(r.ok, true);
  assert.equal(r.corrigido, false);
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS);
  assert.equal(l.parent_jid, PAI);
  assert.equal(l.label, 'Lives Semanais');
});

test('grupo comum é cadastrado nele mesmo, sem pai', async () => {
  const db = novoBanco();
  await monitorar(env(db), COMUM, AGORA, fetchLista());
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(COMUM);
  assert.equal(l.parent_jid, null);
});

test('monitorar NUNCA liga a conversão ao Meta', async () => {
  const db = novoBanco();
  await monitorar(env(db), AVISOS, AGORA, fetchLista());
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS);
  assert.equal(l.send_conversion, 0, 'mexer na otimização de campanha não pode ser efeito colateral');
  assert.equal(l.conversion_since, null);
});

test('Comunidade sem Avisos na lista é recusada com motivo, não cadastrada errada', async () => {
  const soPai = [LISTA[0]];
  const r = await monitorar(env(novoBanco()), PAI, AGORA, fetchLista(soPai));
  assert.equal(r.ok, false);
  assert.match(r.erro, /avisos/i);
});

test('monitorar grupo fora da lista da Evolution é recusado', async () => {
  const r = await monitorar(env(novoBanco()), 'inventado@g.us', AGORA, fetchLista());
  assert.equal(r.ok, false);
  assert.match(r.erro, /n[ãa]o encontr/i);
});

test('religar um grupo desligado atualiza, não duplica', async () => {
  const db = novoBanco();
  db.prepare('INSERT INTO whatsapp_groups_tracked (group_jid,label,enabled) VALUES (?,?,0)').run(AVISOS, 'nome velho');
  const r = await monitorar(env(db), AVISOS, AGORA, fetchLista());
  assert.equal(r.ok, true);
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked').all();
  assert.equal(l.length, 1);
  assert.equal(l[0].enabled, 1);
  assert.equal(l[0].label, 'Lives Semanais', 'o nome é atualizado para o atual');
});

// --- desligar ---

test('desligar não apaga: o histórico de entradas e saídas continua valendo', async () => {
  const db = novoBanco();
  await monitorar(env(db), AVISOS, AGORA, fetchLista());
  const r = await desligar(env(db), AVISOS);
  assert.equal(r.ok, true);
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS);
  assert.ok(l, 'a linha precisa continuar existindo');
  assert.equal(l.enabled, 0);
});

test('desligar também desliga a conversão ao Meta', async () => {
  const db = novoBanco();
  await monitorar(env(db), AVISOS, AGORA, fetchLista());
  await alternarMeta(env(db), AVISOS, true, AGORA);
  await desligar(env(db), AVISOS);
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS);
  assert.equal(l.send_conversion, 0, 'grupo que não é medido não pode seguir mandando conversão');
});

test('desligar grupo que não está na lista responde erro', async () => {
  const r = await desligar(env(novoBanco()), 'inventado@g.us');
  assert.equal(r.ok, false);
});

// --- conversão ao Meta ---

test('ligar a conversão marca a partir de QUANDO, para não reenviar o passado', async () => {
  const db = novoBanco();
  await monitorar(env(db), AVISOS, AGORA, fetchLista());
  const r = await alternarMeta(env(db), AVISOS, true, AGORA);
  assert.equal(r.ok, true);
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS);
  assert.equal(l.send_conversion, 1);
  assert.equal(l.conversion_since, AGORA, 'sem isto, ligar mandaria meses de entradas antigas ao Meta de uma vez');
});

test('desligar a conversão não apaga desde quando ela valia', async () => {
  const db = novoBanco();
  await monitorar(env(db), AVISOS, AGORA, fetchLista());
  await alternarMeta(env(db), AVISOS, true, AGORA);
  await alternarMeta(env(db), AVISOS, false, AGORA + 100);
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS);
  assert.equal(l.send_conversion, 0);
  assert.equal(l.conversion_since, AGORA);
});

test('ligar a conversão de grupo não monitorado é recusado', async () => {
  const db = novoBanco();
  const r = await alternarMeta(env(db), AVISOS, true, AGORA);
  assert.equal(r.ok, false);
});

// --- endpoint ---

const req = (qs = '?key=k') => new Request('https://exemplo.com/api/grupos-catalogo' + qs);
const post = (corpo) => new Request('https://exemplo.com/api/grupos-catalogo?key=k', { method: 'POST', body: JSON.stringify(corpo) });

test('endpoint exige a chave do dash', async () => {
  const e = { ...env(novoBanco()), DASH_KEY: 'k' };
  assert.equal((await catGet({ request: req('?key=errada'), env: e })).status, 401);
  assert.equal((await catPost({ request: new Request('https://exemplo.com/api/grupos-catalogo?key=x', { method: 'POST', body: '{}' }), env: e })).status, 401);
});

test('GET devolve a lista pronta para a tela', async () => {
  const e = { ...env(novoBanco()), DASH_KEY: 'k' };
  const j = await (await catGet({ request: req(), env: e, fetchImpl: fetchLista() })).json();
  assert.equal(j.ok, true);
  assert.equal(j.grupos.length, 3);
  assert.ok(j.grupos[0].busca.includes('lives semanais'), 'o texto de busca vem normalizado do backend');
});

test('Evolution fora do ar: 200 com o motivo, para a tela saber a diferença', async () => {
  const e = { ...env(novoBanco()), DASH_KEY: 'k' };
  const r = await catGet({ request: req(), env: e, fetchImpl: async () => new Response('x', { status: 503 }) });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, false);
  assert.match(j.error, /503/);
  assert.deepEqual(j.grupos, []);
});

test('POST monitorar avisa quando corrigiu a Comunidade para o Avisos', async () => {
  const db = novoBanco();
  const e = { ...env(db), DASH_KEY: 'k' };
  const j = await (await catPost({ request: post({ group_jid: PAI, acao: 'monitorar' }), env: e, fetchImpl: fetchLista() })).json();
  assert.equal(j.ok, true);
  assert.equal(j.corrigido, true);
  assert.equal(j.group_jid, AVISOS);
});

test('POST com ação desconhecida é 400', async () => {
  const e = { ...env(novoBanco()), DASH_KEY: 'k' };
  const r = await catPost({ request: post({ group_jid: AVISOS, acao: 'explodir' }), env: e });
  assert.equal(r.status, 400);
});

test('POST com JSON quebrado é 400, não 500', async () => {
  const e = { ...env(novoBanco()), DASH_KEY: 'k' };
  const r = await catPost({ request: new Request('https://exemplo.com/api/grupos-catalogo?key=k', { method: 'POST', body: 'nao json' }), env: e });
  assert.equal(r.status, 400);
});
