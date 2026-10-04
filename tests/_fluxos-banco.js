// Banco de teste dos fluxos (issues 386–388): SQLite real com as migrations
// do e-mail próprio e as formas mínimas das tabelas antigas que os fluxos LEEM
// (event_log, sessions, Greenn, agenda, grupos, CRM).
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function d1(db) {
  const conv = (b) => b.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  const stmt = (sql, binds = []) => ({
    bind: (...b) => stmt(sql, conv(b)),
    all: async () => ({ results: db.prepare(sql).all(...binds) }),
    first: async () => db.prepare(sql).get(...binds) ?? null,
    run: async () => { const r = db.prepare(sql).run(...binds); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return { prepare: (sql) => stmt(sql) };
}

export function bancoDosFluxos() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE sessions (session_id TEXT PRIMARY KEY, ip_address TEXT, utm_source TEXT, utm_campaign TEXT, utm_content TEXT, landing_url TEXT, funnel TEXT DEFAULT '');
    CREATE TABLE event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, event_name TEXT NOT NULL, event_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL, is_bot INTEGER DEFAULT 0, raw_email TEXT DEFAULT '', funnel TEXT DEFAULT '', is_junk INTEGER NOT NULL DEFAULT 0, material TEXT);
    CREATE TABLE leads_bloqueados (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT);
    CREATE TABLE lead_dispatch (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, email TEXT, phone TEXT, task_id TEXT);
    CREATE TABLE crm_status_log (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, status TEXT NOT NULL, recebido_em INTEGER NOT NULL, hist_id TEXT, hist_date INTEGER);
    CREATE TABLE config_kv (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
  `);
  for (const f of ['0026_whatsapp_grupos.sql', '0032_greenn_webhook.sql', '0047_agenda.sql', '0050_email.sql', '0051_email_modelos.sql',
    '0053_email_contatos.sql', '0054_email_segmentos.sql', '0055_email_campanhas.sql', '0056_email_campanhas_agendadas.sql',
    '0057_email_fluxos.sql', '0058_email_fluxos_rodando.sql', '0059_agenda_tipos_teste.sql']) {
    db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  }
  return db;
}
