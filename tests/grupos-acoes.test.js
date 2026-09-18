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
