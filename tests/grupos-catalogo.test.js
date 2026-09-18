// Catálogo de grupos: escolher da lista em vez de colar JID.
//
// Duas regras carregam o risco desta tela:
//
// 1. A da Comunidade: quem clica vê o nome da COMUNIDADE, mas quem precisa ser
//    monitorado é o grupo de AVISOS — é onde as pessoas estão e de onde vêm os
//    eventos. Cadastrar o pai daria medição vazia, sem erro nenhum na tela.
// 2. A da cópia local: listar os 123 grupos na Evolution leva ~46 segundos
//    (medido em produção). A tela lê do banco; quem fala com a Evolution é o
//    cron, em segundo plano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  catalogo, monitorar, desligar, alternarMeta, normalizar,
  atualizarCatalogo, talvezAtualizar, VALIDADE_SEG,
} from '../functions/api/_grupos-catalogo.js';
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

// O que a Evolution devolveria: uma Comunidade, o Avisos dela, e um grupo comum.
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
  db.exec(readFileSync(new URL('../migrations/0045_grupos_catalogo.sql', import.meta.url), 'utf8'));
  return db;
}

const fetchLista = (lista = LISTA) => async (url) => {
  const u = String(url);
  if (u.includes('fetchAllGroups')) return new Response(JSON.stringify(lista), { status: 200 });
  if (u.includes('findGroupInfos')) {
    const jid = new URL(u).searchParams.get('groupJid');
    return new Response(JSON.stringify(lista.find((x) => x.id === jid) || {}), { status: 200 });
  }
  return new Response('{}', { status: 200 });
};

const env = (db, extra = {}) => ({ DB: d1(db), ...ENV_EVO, ...extra });

/** Ambiente com a cópia local já preenchida — o estado normal de produção. */
async function comCatalogo(db, lista = LISTA, extra = {}) {
  const e = env(db, extra);
  await atualizarCatalogo(e, AGORA, fetchLista(lista));
  return e;
}

// --- busca ---

test('normalizar tira acento e caixa, para busca em português funcionar', () => {
  assert.equal(normalizar('Sessão Estratégica'), 'sessao estrategica');
  assert.equal(normalizar('LIVE | O Jogo'), 'live | o jogo');
  assert.equal(normalizar(null), '');
});

test('o texto de busca guardado já vem sem acento', async () => {
  const db = novoBanco();
  await atualizarCatalogo(env(db), AGORA, fetchLista([
    { id: 'x@g.us', subject: 'Sessão Estratégica', size: 3, isCommunity: false, isCommunityAnnounce: false },
  ]));
  const l = db.prepare('SELECT busca FROM whatsapp_groups_catalogo WHERE group_jid=?').get('x@g.us');
  assert.ok(l.busca.includes('sessao estrategica'));
});

// --- atualizar a cópia local ---

test('atualizar grava a lista, com o tipo de cada grupo', async () => {
  const db = novoBanco();
  const r = await atualizarCatalogo(env(db), AGORA, fetchLista());
  assert.deepEqual(r, { ok: true, total: 3 });
  const porJid = Object.fromEntries(db.prepare('SELECT group_jid,tipo FROM whatsapp_groups_catalogo').all().map((g) => [g.group_jid, g.tipo]));
  assert.deepEqual(porJid, { [PAI]: 'comunidade', [AVISOS]: 'avisos', [COMUM]: 'comum' });
});

test('grupo do qual o número saiu some da cópia local', async () => {
  const db = novoBanco();
  await atualizarCatalogo(env(db), AGORA, fetchLista());
  await atualizarCatalogo(env(db), AGORA + 10, fetchLista([LISTA[1]]));
  const jids = db.prepare('SELECT group_jid FROM whatsapp_groups_catalogo').all().map((g) => g.group_jid);
  assert.deepEqual(jids, [AVISOS], 'oferecer para monitorar um grupo que não existe mais seria mentira');
});

test('grupo sem nome (bug conhecido da Evolution) é buscado individualmente', async () => {
  const semNome = LISTA.map((g) => (g.id === AVISOS ? { ...g, subject: undefined } : g));
  let individuais = 0;
  const f = async (url) => {
    if (String(url).includes('fetchAllGroups')) return new Response(JSON.stringify(semNome), { status: 200 });
    individuais++;
    return new Response(JSON.stringify({ subject: 'Lives Semanais' }), { status: 200 });
  };
  const db = novoBanco();
  await atualizarCatalogo(env(db), AGORA, f);
  assert.equal(individuais, 1, 'só o que veio sem nome deve custar uma consulta extra');
  assert.equal(db.prepare('SELECT subject FROM whatsapp_groups_catalogo WHERE group_jid=?').get(AVISOS).subject, 'Lives Semanais');
});

test('Evolution fora do ar: erro legível e a cópia local ANTIGA é preservada', async () => {
  const db = novoBanco();
  await atualizarCatalogo(env(db), AGORA, fetchLista());
  const r = await atualizarCatalogo(env(db), AGORA + 10, async () => new Response('nope', { status: 500 }));
  assert.equal(r.ok, false);
  assert.match(r.erro, /500/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM whatsapp_groups_catalogo').get().n, 3,
    'uma Evolution fora do ar não pode apagar a lista que já funcionava');
});

test('o cron só atualiza quando a cópia está velha', async () => {
  const db = novoBanco();
  let chamadas = 0;
  const f = (url) => { if (String(url).includes('fetchAllGroups')) chamadas++; return fetchLista()(url); };

  await talvezAtualizar(env(db), AGORA, f);
  assert.equal(chamadas, 1, 'cópia vazia precisa ser preenchida');

  const r = await talvezAtualizar(env(db), AGORA + VALIDADE_SEG - 1, f);
  assert.deepEqual(r, { pulou: true });
  assert.equal(chamadas, 1, 'cópia fresca não custa 46 segundos da Evolution');

  await talvezAtualizar(env(db), AGORA + VALIDADE_SEG + 1, f);
  assert.equal(chamadas, 2);
});

// --- ler o catálogo (o que a tela faz) ---

test('catálogo lê do banco, ordenado por tamanho, SEM falar com a Evolution', async () => {
  const e = await comCatalogo(novoBanco());
  let falou = false;
  const c = await catalogo({ ...e, fetchImpl: () => { falou = true; } });
  assert.equal(c.ok, true);
  assert.deepEqual(c.grupos.map((g) => g.size), [207, 12, 6], 'maiores primeiro');
  assert.equal(falou, false);
  assert.equal(c.atualizado_em, AGORA);
});

test('catálogo marca quem está monitorado e quem está desligado', async () => {
  const db = novoBanco();
  const e = await comCatalogo(db);
  db.prepare('INSERT INTO whatsapp_groups_tracked (group_jid,label,enabled) VALUES (?,?,1)').run(AVISOS, 'Lives');
  db.prepare('INSERT INTO whatsapp_groups_tracked (group_jid,label,enabled) VALUES (?,?,0)').run(COMUM, 'Equipe');
  const porJid = Object.fromEntries((await catalogo(e)).grupos.map((g) => [g.group_jid, g]));
  assert.equal(porJid[AVISOS].monitorado, true);
  assert.equal(porJid[COMUM].monitorado, false, 'desligado não conta como monitorado');
  assert.equal(porJid[PAI].monitorado, false);
});

// --- monitorar ---

test('escolher a COMUNIDADE cadastra o grupo de AVISOS, não o pai', async () => {
  const db = novoBanco();
  const r = await monitorar(await comCatalogo(db), PAI, AGORA);
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
  const r = await monitorar(await comCatalogo(db), AVISOS, AGORA);
  assert.equal(r.ok, true);
  assert.equal(r.corrigido, false);
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS);
  assert.equal(l.parent_jid, PAI);
  assert.equal(l.label, 'Lives Semanais');
});

test('grupo comum é cadastrado nele mesmo, sem pai', async () => {
  const db = novoBanco();
  await monitorar(await comCatalogo(db), COMUM, AGORA);
  assert.equal(db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(COMUM).parent_jid, null);
});

test('monitorar NUNCA liga a conversão ao Meta', async () => {
  const db = novoBanco();
  await monitorar(await comCatalogo(db), AVISOS, AGORA);
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS);
  assert.equal(l.send_conversion, 0, 'mexer na otimização de campanha não pode ser efeito colateral');
  assert.equal(l.conversion_since, null);
});

test('Comunidade sem Avisos conhecido é recusada, não cadastrada errada', async () => {
  const r = await monitorar(await comCatalogo(novoBanco(), [LISTA[0]]), PAI, AGORA);
  assert.equal(r.ok, false);
  assert.match(r.erro, /avisos/i);
});

test('monitorar grupo fora da cópia local é recusado, pedindo para atualizar', async () => {
  const r = await monitorar(await comCatalogo(novoBanco()), 'inventado@g.us', AGORA);
  assert.equal(r.ok, false);
  assert.match(r.erro, /atualizar lista/i);
});

test('religar um grupo desligado atualiza, não duplica', async () => {
  const db = novoBanco();
  db.prepare('INSERT INTO whatsapp_groups_tracked (group_jid,label,enabled) VALUES (?,?,0)').run(AVISOS, 'nome velho');
  const r = await monitorar(await comCatalogo(db), AVISOS, AGORA);
  assert.equal(r.ok, true);
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked').all();
  assert.equal(l.length, 1);
  assert.equal(l[0].enabled, 1);
  assert.equal(l[0].label, 'Lives Semanais', 'o nome é atualizado para o atual');
});

// --- desligar ---

test('desligar não apaga: o histórico de entradas e saídas continua valendo', async () => {
  const db = novoBanco();
  const e = await comCatalogo(db);
  await monitorar(e, AVISOS, AGORA);
  assert.deepEqual(await desligar(e, AVISOS), { ok: true });
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS);
  assert.ok(l, 'a linha precisa continuar existindo');
  assert.equal(l.enabled, 0);
});

test('desligar também desliga a conversão ao Meta', async () => {
  const db = novoBanco();
  const e = await comCatalogo(db);
  await monitorar(e, AVISOS, AGORA);
  await alternarMeta(e, AVISOS, true, AGORA);
  await desligar(e, AVISOS);
  assert.equal(db.prepare('SELECT send_conversion FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS).send_conversion, 0,
    'grupo que não é medido não pode seguir mandando conversão');
});

test('desligar grupo que não está na lista responde erro', async () => {
  assert.equal((await desligar(await comCatalogo(novoBanco()), 'inventado@g.us')).ok, false);
});

// --- conversão ao Meta ---

test('ligar a conversão marca a partir de QUANDO, para não reenviar o passado', async () => {
  const db = novoBanco();
  const e = await comCatalogo(db);
  await monitorar(e, AVISOS, AGORA);
  assert.deepEqual(await alternarMeta(e, AVISOS, true, AGORA), { ok: true });
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS);
  assert.equal(l.send_conversion, 1);
  assert.equal(l.conversion_since, AGORA, 'sem isto, ligar mandaria meses de entradas antigas ao Meta de uma vez');
});

test('desligar a conversão não apaga desde quando ela valia', async () => {
  const db = novoBanco();
  const e = await comCatalogo(db);
  await monitorar(e, AVISOS, AGORA);
  await alternarMeta(e, AVISOS, true, AGORA);
  await alternarMeta(e, AVISOS, false, AGORA + 100);
  const l = db.prepare('SELECT * FROM whatsapp_groups_tracked WHERE group_jid=?').get(AVISOS);
  assert.equal(l.send_conversion, 0);
  assert.equal(l.conversion_since, AGORA);
});

test('ligar a conversão de grupo não monitorado é recusado', async () => {
  assert.equal((await alternarMeta(await comCatalogo(novoBanco()), AVISOS, true, AGORA)).ok, false);
});

// --- endpoint ---

const req = (qs = '?key=k') => new Request('https://exemplo.com/api/grupos-catalogo' + qs);
const post = (corpo) => new Request('https://exemplo.com/api/grupos-catalogo?key=k', { method: 'POST', body: JSON.stringify(corpo) });

test('endpoint exige a chave do dash', async () => {
  const e = await comCatalogo(novoBanco(), LISTA, { DASH_KEY: 'k' });
  assert.equal((await catGet({ request: req('?key=errada'), env: e })).status, 401);
  assert.equal((await catPost({ request: new Request('https://exemplo.com/api/grupos-catalogo?key=x', { method: 'POST', body: '{}' }), env: e })).status, 401);
});

test('GET devolve a lista pronta para a tela', async () => {
  const e = await comCatalogo(novoBanco(), LISTA, { DASH_KEY: 'k' });
  const j = await (await catGet({ request: req(), env: e })).json();
  assert.equal(j.ok, true);
  assert.equal(j.grupos.length, 3);
  assert.ok(j.grupos[0].busca.includes('lives semanais'), 'o texto de busca vem normalizado do backend');
  assert.equal(j.atualizado_em, AGORA);
});

test('POST monitorar avisa quando corrigiu a Comunidade para o Avisos', async () => {
  const e = await comCatalogo(novoBanco(), LISTA, { DASH_KEY: 'k' });
  const j = await (await catPost({ request: post({ group_jid: PAI, acao: 'monitorar' }), env: e })).json();
  assert.equal(j.ok, true);
  assert.equal(j.corrigido, true);
  assert.equal(j.group_jid, AVISOS);
});

test('POST atualizar refaz a cópia local', async () => {
  const db = novoBanco();
  const e = { ...env(db, { DASH_KEY: 'k' }) };
  const r = await catPost({ request: post({ acao: 'atualizar' }), env: e, fetchImpl: fetchLista() });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).total, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM whatsapp_groups_catalogo').get().n, 3);
});

test('POST com ação desconhecida é 400', async () => {
  const e = await comCatalogo(novoBanco(), LISTA, { DASH_KEY: 'k' });
  assert.equal((await catPost({ request: post({ group_jid: AVISOS, acao: 'explodir' }), env: e })).status, 400);
});

test('POST com JSON quebrado é 400, não 500', async () => {
  const e = await comCatalogo(novoBanco(), LISTA, { DASH_KEY: 'k' });
  const r = await catPost({ request: new Request('https://exemplo.com/api/grupos-catalogo?key=k', { method: 'POST', body: 'nao json' }), env: e });
  assert.equal(r.status, 400);
});
