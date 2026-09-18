// Agenda de ações de grupo contra SQLite de verdade, com a migration 0043 real.
// Spec: docs/superpowers/specs/2026-09-17-gestao-grupos-whatsapp-design.md
//
// SQLite de verdade e não mock porque as duas regras que carregam o risco
// desta feature — a trava de corrida e a janela de atraso — são regras de
// UPDATE condicional. Em mock elas passam sempre; em produção é que se
// descobre que a mensagem saiu duas vezes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  validarAcao, criarAcao, cancelarAcao, listarAcoes,
  executarAcao, executarVencidas, ATRASO_MAX_SEG,
} from '../functions/api/_grupos-acoes.js';

// --- D1 mínimo em cima do node:sqlite (mesmo adaptador de meta-fila.test.js) ---
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
const AGORA = 1_789_600_000;

function novoBanco() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE whatsapp_groups_tracked (
      group_jid TEXT PRIMARY KEY, label TEXT, group_name TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      send_conversion INTEGER NOT NULL DEFAULT 0, conversion_since INTEGER);
  `);
  db.exec(readFileSync(new URL('../migrations/0043_grupos_acoes.sql', import.meta.url), 'utf8'));
  db.prepare('INSERT INTO whatsapp_groups_tracked (group_jid, label, enabled, parent_jid) VALUES (?, ?, 1, ?)')
    .run(AVISOS, 'Live semanal', PAI);
  db.prepare('INSERT INTO whatsapp_groups_tracked (group_jid, label, enabled) VALUES (?, ?, 0)')
    .run('desligado@g.us', 'Grupo desligado');
  return db;
}

test('migration 0043 cria a tabela, o índice da fila e a coluna do par', () => {
  const db = novoBanco();
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='whatsapp_group_actions'").get();
  assert.ok(t, 'tabela whatsapp_group_actions não foi criada');
  const i = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_group_actions_fila'").get();
  assert.ok(i, 'índice da fila não foi criado');
  const col = db.prepare('SELECT parent_jid FROM whatsapp_groups_tracked WHERE group_jid = ?').get(AVISOS);
  assert.equal(col.parent_jid, PAI);
});

// --- validação, criação, cancelamento, listagem ---

const GRUPO = { group_jid: AVISOS, label: 'Live semanal', parent_jid: PAI };

test('recusa tipo desconhecido', () => {
  const r = validarAcao({ tipo: 'apagar_tudo', agendada_para: AGORA + 600 }, GRUPO, AGORA);
  assert.match(r.erro, /tipo/i);
});

test('recusa mensagem sem texto e texto longo demais', () => {
  assert.match(validarAcao({ tipo: 'mensagem', texto: '   ', agendada_para: AGORA + 600 }, GRUPO, AGORA).erro, /texto/i);
  assert.match(validarAcao({ tipo: 'mensagem', texto: 'x'.repeat(4001), agendada_para: AGORA + 600 }, GRUPO, AGORA).erro, /4000/);
});

test('recusa renomear sem título e título longo demais', () => {
  assert.match(validarAcao({ tipo: 'renomear', titulo: '', agendada_para: AGORA + 600 }, GRUPO, AGORA).erro, /t[ií]tulo/i);
  assert.match(validarAcao({ tipo: 'renomear', titulo: 'x'.repeat(101), agendada_para: AGORA + 600 }, GRUPO, AGORA).erro, /100/);
});

test('recusa hora no passado', () => {
  const r = validarAcao({ tipo: 'mensagem', texto: 'oi', agendada_para: AGORA - 60 }, GRUPO, AGORA);
  assert.match(r.erro, /passou|passado/i);
});

test('aceita agendar para daqui a pouco e guarda o payload como JSON', () => {
  const r = validarAcao({ tipo: 'mensagem', texto: ' Começou! ', agendada_para: AGORA + 600 }, GRUPO, AGORA);
  assert.equal(r.erro, undefined);
  assert.equal(r.acao.group_jid, AVISOS);
  assert.deepEqual(JSON.parse(r.acao.payload), { texto: 'Começou!' });
});

test('aplicar_no_par é recusado quando o grupo não tem par conhecido', () => {
  const semPar = { group_jid: AVISOS, label: 'x', parent_jid: null };
  const r = validarAcao({ tipo: 'renomear', titulo: 'Novo', aplicar_no_par: true, agendada_para: AGORA + 600 }, semPar, AGORA);
  assert.match(r.erro, /par/i);
});

test('criarAcao recusa grupo fora da allowlist e grupo desligado', async () => {
  const env = { DB: d1(novoBanco()) };
  const fora = await criarAcao(env, { group_jid: 'inventado@g.us', tipo: 'mensagem', texto: 'oi', agendada_para: AGORA + 600 }, AGORA);
  assert.equal(fora.status, 400);
  assert.match(fora.erro, /monitorad/i);
  const desligado = await criarAcao(env, { group_jid: 'desligado@g.us', tipo: 'mensagem', texto: 'oi', agendada_para: AGORA + 600 }, AGORA);
  assert.equal(desligado.status, 400);
});

test('criarAcao grava a ação como agendada', async () => {
  const db = novoBanco(); const env = { DB: d1(db) };
  const r = await criarAcao(env, { group_jid: AVISOS, tipo: 'renomear', titulo: '24/09 às 12h', aplicar_no_par: true, agendada_para: AGORA + 600 }, AGORA);
  assert.ok(r.id);
  const l = db.prepare('SELECT * FROM whatsapp_group_actions WHERE id = ?').get(r.id);
  assert.equal(l.status, 'agendada');
  assert.equal(l.agendada_para, AGORA + 600);
  assert.deepEqual(JSON.parse(l.payload), { titulo: '24/09 às 12h', aplicar_no_par: true });
});

test('cancelar só vale enquanto está agendada', async () => {
  const db = novoBanco(); const env = { DB: d1(db) };
  const { id } = await criarAcao(env, { group_jid: AVISOS, tipo: 'mensagem', texto: 'oi', agendada_para: AGORA + 600 }, AGORA);
  assert.deepEqual(await cancelarAcao(env, id), { ok: true });
  assert.equal(db.prepare('SELECT status FROM whatsapp_group_actions WHERE id = ?').get(id).status, 'cancelada');
  const segunda = await cancelarAcao(env, id);
  assert.equal(segunda.ok, false, 'cancelar duas vezes não pode dizer que deu certo');
});

test('listarAcoes separa o que ainda vai acontecer do que já aconteceu', async () => {
  const db = novoBanco(); const env = { DB: d1(db) };
  await criarAcao(env, { group_jid: AVISOS, tipo: 'mensagem', texto: 'futura', agendada_para: AGORA + 600 }, AGORA);
  const { id } = await criarAcao(env, { group_jid: AVISOS, tipo: 'mensagem', texto: 'passada', agendada_para: AGORA + 300 }, AGORA);
  db.prepare("UPDATE whatsapp_group_actions SET status='concluida', executada_em=? WHERE id=?").run(AGORA + 300, id);
  const r = await listarAcoes(env, AGORA);
  assert.equal(r.agendadas.length, 1);
  assert.equal(r.historico.length, 1);
  assert.equal(r.agendadas[0].label, 'Live semanal', 'a agenda mostra o rótulo do grupo, não o JID cru');
  assert.equal(typeof r.agendadas[0].payload, 'object', 'a tela não deveria precisar dar parse no payload');
});

// --- executor: é aqui que mora todo o risco da feature ---

const ENV_EVO = { EVOLUTION_BASE_URL: 'https://api.exemplo.com', EVOLUTION_INSTANCE: 'Marcelle', EVOLUTION_APIKEY_NOTIF: 'segredo' };
const envCom = (db) => ({ DB: d1(db), ...ENV_EVO });
const okFetch = () => new Response('{}', { status: 200 });

async function agendar(env, extra = {}) {
  const r = await criarAcao(env, { group_jid: AVISOS, tipo: 'mensagem', texto: 'oi', agendada_para: AGORA + 300, ...extra }, AGORA);
  assert.ok(r.id, r.erro);
  return r.id;
}

test('mensagem na hora certa é enviada e fica concluída', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await agendar(env);
  let chamadas = 0;
  const r = await executarAcao(env, id, AGORA + 300, async () => { chamadas++; return okFetch(); });
  assert.equal(r.status, 'concluida');
  assert.equal(chamadas, 1);
  const l = db.prepare('SELECT * FROM whatsapp_group_actions WHERE id=?').get(id);
  assert.equal(l.status, 'concluida');
  assert.equal(l.executada_em, AGORA + 300);
});

test('ação vencida há mais de 30 min NÃO dispara e vira falha', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await agendar(env);
  let chamadas = 0;
  const r = await executarAcao(env, id, AGORA + 300 + ATRASO_MAX_SEG + 1, async () => { chamadas++; return okFetch(); });
  assert.equal(chamadas, 0, 'mensagem atrasada não pode ser enviada');
  assert.equal(r.status, 'falhou');
  assert.match(r.erro, /venceu|janela/i);
});

test('exatamente no limite de 30 min ainda dispara', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await agendar(env);
  const r = await executarAcao(env, id, AGORA + 300 + ATRASO_MAX_SEG, async () => okFetch());
  assert.equal(r.status, 'concluida');
});

test('trava de corrida: a segunda execução simultânea não faz nada', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await agendar(env);
  let chamadas = 0;
  const f = async () => { chamadas++; return okFetch(); };
  const [a, b] = await Promise.all([executarAcao(env, id, AGORA + 300, f), executarAcao(env, id, AGORA + 300, f)]);
  assert.equal(chamadas, 1, 'a mensagem não pode sair duas vezes');
  assert.deepEqual([a.status, b.status].sort(), ['concluida', 'ignorada']);
});

test('mensagem que falha NÃO é retentada', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await agendar(env);
  const r = await executarAcao(env, id, AGORA + 300, async () => new Response('nope', { status: 500 }));
  assert.equal(r.status, 'falhou');
  const l = db.prepare('SELECT * FROM whatsapp_group_actions WHERE id=?').get(id);
  assert.equal(l.status, 'falhou', 'mensagem falhada precisa sair da fila, não voltar para agendada');
  assert.equal(l.tentativas, 1);
});

test('renomear que falha volta para a fila até 3 tentativas', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await criarAcao(env, { group_jid: AVISOS, tipo: 'renomear', titulo: 'Novo', agendada_para: AGORA + 300 }, AGORA).then((r) => r.id);
  const falha = async () => new Response('nope', { status: 500 });
  await executarAcao(env, id, AGORA + 300, falha);
  let l = db.prepare('SELECT * FROM whatsapp_group_actions WHERE id=?').get(id);
  assert.equal(l.status, 'agendada', 'renomear é idempotente, pode tentar de novo');
  assert.equal(l.tentativas, 1);
  await executarAcao(env, id, AGORA + 310, falha);
  await executarAcao(env, id, AGORA + 320, falha);
  l = db.prepare('SELECT * FROM whatsapp_group_actions WHERE id=?').get(id);
  assert.equal(l.status, 'falhou', 'na 3ª tentativa desiste');
  assert.equal(l.tentativas, 3);
});

test('renomear com aplicar_no_par renomeia os dois grupos', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await criarAcao(env, { group_jid: AVISOS, tipo: 'renomear', titulo: '24/09 às 12h', aplicar_no_par: true, agendada_para: AGORA + 300 }, AGORA).then((r) => r.id);
  const jids = [];
  await executarAcao(env, id, AGORA + 300, async (url) => { jids.push(new URL(url).searchParams.get('groupJid')); return okFetch(); });
  assert.deepEqual(jids.sort(), [PAI, AVISOS].sort());
});

test('se um dos dois do par falha, a ação falha inteira', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await criarAcao(env, { group_jid: AVISOS, tipo: 'renomear', titulo: 'x', aplicar_no_par: true, agendada_para: AGORA + 300 }, AGORA).then((r) => r.id);
  let n = 0;
  const r = await executarAcao(env, id, AGORA + 300, async () => (++n === 1 ? okFetch() : new Response('x', { status: 500 })));
  assert.notEqual(r.status, 'concluida');
});

test('executarVencidas pega só o que venceu e ignora cancelada e futura', async () => {
  const db = novoBanco(); const env = envCom(db);
  const venceu = await agendar(env, { texto: 'venceu', agendada_para: AGORA + 100 });
  const futura = await agendar(env, { texto: 'futura', agendada_para: AGORA + 9999 });
  const cancelada = await agendar(env, { texto: 'cancelada', agendada_para: AGORA + 100 });
  await cancelarAcao(env, cancelada);
  const r = await executarVencidas(env, AGORA + 200, async () => okFetch());
  assert.equal(r.total, 1);
  assert.equal(db.prepare('SELECT status FROM whatsapp_group_actions WHERE id=?').get(venceu).status, 'concluida');
  assert.equal(db.prepare('SELECT status FROM whatsapp_group_actions WHERE id=?').get(futura).status, 'agendada');
});

test('executarVencidas conta falhas e não para na primeira', async () => {
  const db = novoBanco(); const env = envCom(db);
  await agendar(env, { texto: 'a', agendada_para: AGORA + 100 });
  await agendar(env, { texto: 'b', agendada_para: AGORA + 110 });
  let n = 0;
  const r = await executarVencidas(env, AGORA + 200, async () => (++n === 1 ? new Response('x', { status: 500 }) : okFetch()));
  assert.equal(r.total, 2, 'a segunda ação precisa ser tentada mesmo com a primeira falhando');
  assert.equal(r.falhas, 1);
});
