// Segmentos (issue 381) contra SQLite real (migrations 0050, 0053 e 0054 +
// lead_dispatch e crm_status_log na forma que a regra de estágio lê).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import * as segApi from '../functions/api/email/segmentos.js';
import * as contatosApi from '../functions/api/email/contatos.js';
import { registrarLead, aplicarResultado } from '../functions/api/_email-contatos.js';
import { consultasDeUso, fontesDeCampanhas, contatosDoSegmento } from '../functions/api/_email-segmentos.js';

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

let db, env;
const AGORA = Math.floor(Date.now() / 1000);
const DIA = 86400;

beforeEach(async () => {
  db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE lead_dispatch (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, email TEXT, task_id TEXT);
    CREATE TABLE crm_status_log (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, status TEXT NOT NULL, recebido_em INTEGER NOT NULL, hist_id TEXT, hist_date INTEGER);
  `);
  for (const f of ['0050_email.sql', '0053_email_contatos.sql', '0054_email_segmentos.sql']) db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  env = { DB: d1(db), DASH_KEY: 'k' };
  consultasDeUso.length = 0;
  fontesDeCampanhas.length = 0;
  // ana: workshop há 5 dias e depois sessão; bruno: sessão há 40 dias; carla: workshop há 10 dias, voltou; davi: workshop há 2 dias
  await registrarLead(env, { email: 'ana@x.com', nome: 'Ana', funil: 'workshop-gratuito', origem: 'meta-ads', eventId: 'a1', quando: AGORA - 5 * DIA });
  await registrarLead(env, { email: 'ana@x.com', funil: 'sessao-estrategica', origem: 'bio', eventId: 'a2', quando: AGORA - DIA });
  await registrarLead(env, { email: 'bruno@x.com', nome: 'Bruno', funil: 'sessao-estrategica', origem: 'bio', eventId: 'b1', quando: AGORA - 40 * DIA });
  await registrarLead(env, { email: 'carla@x.com', nome: 'Carla', funil: 'workshop-gratuito', origem: 'meta-ads', eventId: 'c1', quando: AGORA - 10 * DIA });
  await aplicarResultado(env, 'carla@x.com', 'voltou', AGORA);
  await registrarLead(env, { email: 'davi@x.com', nome: 'Davi', funil: 'workshop-gratuito', origem: 'manychat', eventId: 'd1', quando: AGORA - 2 * DIA });
  // CRM: ana passou por qualificação e hoje está em reunião; bruno em qualificação; davi sem card.
  db.exec(`
    INSERT INTO lead_dispatch (email, task_id) VALUES ('Ana@x.com', 't-ana'), ('bruno@x.com', 't-bruno');
    INSERT INTO crm_status_log (task_id, status, recebido_em) VALUES ('t-ana', 'qualificação', 100), ('t-ana', 'reunião', 200), ('t-bruno', 'qualificação', 100);
  `);
});

const dash = (corpo) => (corpo
  ? segApi.onRequestPost({ request: new Request('https://x/api?key=k', { method: 'POST', body: JSON.stringify(corpo) }), env })
  : segApi.onRequestGet({ request: new Request('https://x/api?key=k'), env })).then(async (r) => ({ status: r.status, corpo: await r.json() }));
const previa = async (regras) => (await dash({ acao: 'previa', regras })).corpo;
const emails = (p) => p.amostra.map((c) => c.email).sort();

test('workshop gratuito nos últimos 30 dias: só ativos na conta, amostra mais recente primeiro', async () => {
  const p = await previa([{ campo: 'funil', op: 'e', valor: 'workshop-gratuito' }, { campo: 'entrada', op: 'ultimos', valor: 30 }]);
  assert.deepEqual([p.ativos, p.fora], [2, 1]);
  assert.deepEqual(p.amostra.map((c) => c.email), ['davi@x.com', 'ana@x.com']);
});

test('regra vazia pega todos os ativos', async () => {
  const p = await previa([]);
  assert.deepEqual([p.ativos, p.fora], [3, 1]);
});

test('funil é pela entrada (qualquer formulário); não é = nunca preencheu', async () => {
  assert.deepEqual(emails(await previa([{ campo: 'funil', op: 'e', valor: 'sessao-estrategica' }])), ['ana@x.com', 'bruno@x.com']);
  assert.deepEqual(emails(await previa([{ campo: 'funil', op: 'nao', valor: 'sessao-estrategica' }])), ['davi@x.com']);
  // Duas condições de funil: quem preencheu os dois.
  assert.deepEqual(emails(await previa([{ campo: 'funil', op: 'e', valor: 'sessao-estrategica' }, { campo: 'funil', op: 'e', valor: 'workshop-gratuito' }])), ['ana@x.com']);
});

test('origem e data de entrada', async () => {
  assert.deepEqual(emails(await previa([{ campo: 'origem', op: 'e', valor: 'meta-ads' }])), ['ana@x.com']);
  assert.deepEqual(emails(await previa([{ campo: 'origem', op: 'nao', valor: 'meta-ads' }])), ['bruno@x.com', 'davi@x.com']);
  assert.deepEqual(emails(await previa([{ campo: 'entrada', op: 'antes', valor: '30' }])), ['bruno@x.com']);
  assert.deepEqual(emails(await previa([{ campo: 'entrada', op: 'ultimos', valor: '7' }])), ['ana@x.com', 'davi@x.com']);
});

test('estágio no CRM: último status do card; "não é" inclui quem não tem card', async () => {
  assert.deepEqual(emails(await previa([{ campo: 'estagio', op: 'e', valor: 'reunião' }])), ['ana@x.com']);
  assert.deepEqual(emails(await previa([{ campo: 'estagio', op: 'e', valor: 'qualificação' }])), ['bruno@x.com']);
  assert.deepEqual(emails(await previa([{ campo: 'estagio', op: 'nao', valor: 'qualificação' }])), ['ana@x.com', 'davi@x.com']);
});

test('abriu e clicou: só com campanha enviada; lê os envios da campanha', async () => {
  let r = await dash({ acao: 'previa', regras: [{ campo: 'abriu', op: 'sim', valor: '1' }] });
  assert.equal(r.status, 400);
  assert.match(r.corpo.error, /Ainda não há campanha enviada/);
  fontesDeCampanhas.push(async () => [{ id: 1, nome: 'Convite' }]);
  db.exec(`INSERT INTO email_envios (canal, origem, ref_id, destinatario, situacao, aberto_em, clicado_em) VALUES
    ('marketing', 'campanha', '1', 'ana@x.com', 'clicado', 10, 20), ('marketing', 'campanha', '1', 'davi@x.com', 'aberto', 10, NULL)`);
  assert.deepEqual(emails(await previa([{ campo: 'abriu', op: 'sim', valor: '1' }])), ['ana@x.com', 'davi@x.com']);
  assert.deepEqual(emails(await previa([{ campo: 'clicou', op: 'sim', valor: '1' }])), ['ana@x.com']);
  assert.deepEqual(emails(await previa([{ campo: 'abriu', op: 'nao', valor: '1' }])), ['bruno@x.com']);
  r = await dash({ acao: 'previa', regras: [{ campo: 'abriu', op: 'sim', valor: '99' }] });
  assert.equal(r.status, 400);
});

test('validação: campo, comparação, valor, prazo, origem e limite de condições', async () => {
  for (const regras of [
    [{ campo: 'cidade', op: 'e', valor: 'x' }],
    [{ campo: 'funil', op: 'contem', valor: 'x' }],
    [{ campo: 'funil', op: 'e', valor: '' }],
    [{ campo: 'entrada', op: 'ultimos', valor: '45' }],
    [{ campo: 'origem', op: 'e', valor: 'Meta Ads' }],
    Array.from({ length: 11 }, () => ({ campo: 'funil', op: 'e', valor: 'x' })),
    'nada',
  ]) {
    assert.equal((await dash({ acao: 'previa', regras })).status, 400, JSON.stringify(regras));
  }
});

test('salvar, nome repetido, lista com ativos, duplicar e excluir', async () => {
  const regras = [{ campo: 'funil', op: 'e', valor: 'workshop-gratuito' }, { campo: 'entrada', op: 'ultimos', valor: '30' }];
  let r = await dash({ acao: 'salvar', nome: 'Workshop 30 dias', regras });
  assert.equal(r.status, 200);
  const id = r.corpo.segmento.id;
  assert.equal((await dash({ acao: 'salvar', nome: 'Workshop 30 dias', regras: [] })).status, 409);
  assert.equal((await dash({ acao: 'salvar', nome: '', regras: [] })).status, 400);
  r = await dash({ acao: 'salvar', id, nome: 'Workshop 30 dias', regras: [regras[0]] });
  assert.equal(r.corpo.segmento.regras.length, 1);
  let g = await dash();
  assert.deepEqual(g.corpo.segmentos.map((s) => [s.nome, s.ativos]), [['Workshop 30 dias', 2]]);
  assert.ok(g.corpo.opcoes.funis.includes('workshop-gratuito'));
  assert.deepEqual(g.corpo.opcoes.estagios.slice(0, 2), ['qualificação', 'reunião']);
  r = await dash({ acao: 'duplicar', id });
  assert.equal(r.corpo.segmento.nome, 'Cópia de Workshop 30 dias');
  assert.equal((await dash({ acao: 'duplicar', id })).corpo.segmento.nome, 'Cópia de Workshop 30 dias (2)');
  assert.equal((await dash({ acao: 'excluir', id: r.corpo.segmento.id })).status, 200);
  g = await dash();
  assert.equal(g.corpo.segmentos.length, 2);
  assert.equal((await dash({ acao: 'excluir', id: 999 })).status, 404);
});

test('segmento em uso não é excluído', async () => {
  const { corpo } = await dash({ acao: 'salvar', nome: 'Todos', regras: [] });
  consultasDeUso.push(async (_env, id) => (id === corpo.segmento.id ? ['campanha agendada "Convite"'] : []));
  const r = await dash({ acao: 'excluir', id: corpo.segmento.id });
  assert.equal(r.status, 409);
  assert.match(r.corpo.error, /Este segmento está em uso em: campanha agendada "Convite"/);
});

test('lista para o disparo e segmentos no detalhe do contato', async () => {
  await dash({ acao: 'salvar', nome: 'Sessão', regras: [{ campo: 'funil', op: 'e', valor: 'sessao-estrategica' }] });
  await dash({ acao: 'salvar', nome: 'Meta', regras: [{ campo: 'origem', op: 'e', valor: 'meta-ads' }] });
  const lista = await contatosDoSegmento(env, [{ campo: 'funil', op: 'e', valor: 'workshop-gratuito' }]);
  assert.deepEqual(lista.map((c) => c.email).sort(), ['ana@x.com', 'davi@x.com']);
  const ana = db.prepare("SELECT id FROM email_contatos WHERE email = 'ana@x.com'").get().id;
  const r = await contatosApi.onRequestGet({ request: new Request(`https://x/api?key=k&id=${ana}`), env });
  const corpo = await r.json();
  assert.deepEqual(corpo.segmentos.map((s) => s.nome), ['Meta', 'Sessão']);
});
