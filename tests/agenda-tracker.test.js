// /tracker → agenda própria: o destino Calendly vira a página da agenda SÓ com
// AGENDA_ATIVA=1 (issue 360). Sem a variável, a produção segue no Calendly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost } from '../functions/tracker.js';

function d1(db) {
  const conv = (b) => b.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  const stmt = (sql, binds = []) => ({
    bind: (...b) => stmt(sql, conv(b)),
    all: async () => ({ results: db.prepare(sql).all(...binds) }),
    first: async () => db.prepare(sql).get(...binds) ?? null,
    run: async () => { const r = db.prepare(sql).run(...binds); return { meta: { changes: Number(r.changes) } }; },
  });
  return { prepare: (sql) => stmt(sql) };
}

function banco() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0047_agenda.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0048_agenda_descricao.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0049_agenda_etapas.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0059_agenda_tipos_teste.sql', import.meta.url), 'utf8'));
  db.exec(`INSERT INTO agenda_grades (id, nome, criado_em, atualizado_em) VALUES (1, 'g', 1, 1);
    INSERT INTO agenda_tipos (slug, nome, duracao_min, destino_cal, grade_id, comercial, funil, ativo, criado_em, atualizado_em)
    VALUES ('consultoria-individual', 'Consultoria', 45, 'c', 1, 1, 'sessao-estrategica', 1, 1, 1);`);
  return db;
}

const CALENDLY = 'https://calendly.com/gruposete/consultoria';
async function lead(env, funil, faturamento = 'De 100 a 500 mil') {
  globalThis.fetch = async () => new Response('{}', { status: 200 });
  const r = await onRequestPost({
    request: new Request('https://x/tracker', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 Chrome/120', 'cf-connecting-ip': '200.1.1.1' },
      body: JSON.stringify({ event_name: 'Lead', event_id: 'lead-' + Math.random(), event_time: 1, user_data: { em: 'ana@empresa.com' },
        lead_data: { nome: 'Ana', email: 'ana@empresa.com', telefone: '11987654321', funnel: funil, faturamento } }),
    }),
    env,
    waitUntil: () => {},
  });
  return (await r.json()).redirect;
}

test('sem AGENDA_ATIVA o lead segue para o Calendly', async () => {
  const db = banco();
  assert.equal(await lead({ DB: d1(db), LEAD_REDIRECT_CALENDLY: CALENDLY }, 'sessao-estrategica'), CALENDLY);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM agenda_convites').get().n, 0);
});

test('com AGENDA_ATIVA o lead vai para a agenda com convite', async () => {
  const db = banco();
  const env = { DB: d1(db), LEAD_REDIRECT_CALENDLY: CALENDLY, AGENDA_ATIVA: '1' };
  const r = await lead(env, 'sessao-estrategica');
  assert.match(r, /^\/agendar\/consultoria-individual\?c=/);
  const c = db.prepare('SELECT nome, email, funil FROM agenda_convites').get();
  assert.deepEqual({ ...c }, { nome: 'Ana', email: 'ana@empresa.com', funil: 'sessao-estrategica' });
  // Funil sem tipo próprio que cai no Calendly geral usa o tipo da sessão,
  // mas guarda o funil do lead.
  assert.match(await lead(env, 'aplicacao-mentoria'), /^\/agendar\/consultoria-individual/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM agenda_convites WHERE funil = 'aplicacao-mentoria'").get().n, 1);
  // Baixo faturamento continua indo ao WhatsApp.
  assert.equal(await lead({ ...env, LEAD_REDIRECT_WHATSAPP: 'https://wa.me/1' }, 'sessao-estrategica', 'Menos de 20 Mil'), 'https://wa.me/1');
});

// Cargo (06/11/2026): quem não decide (Gestor(a) ou Funcionário(a)) vai para o
// WhatsApp, como quem fatura menos de R$ 20 mil. "Outro" e Dono(a) seguem na
// agenda; a aplicação de tráfego continua decidida só pelo investimento.
const WHATS = 'https://wa.me/5511999999999';
async function leadCom(env, extra) {
  globalThis.fetch = async () => new Response('{}', { status: 200 });
  const r = await onRequestPost({
    request: new Request('https://x/tracker', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 Chrome/120', 'cf-connecting-ip': '200.1.1.1' },
      body: JSON.stringify({ event_name: 'Lead', event_id: 'lead-' + Math.random(), event_time: 1, user_data: { em: 'ana@empresa.com' },
        lead_data: { nome: 'Ana', email: 'ana@empresa.com', telefone: '11987654321', faturamento: 'De 100 a 500 mil', ...extra } }),
    }),
    env,
    waitUntil: () => {},
  });
  return (await r.json()).redirect;
}
const envRotas = () => ({ DB: d1(banco()), LEAD_REDIRECT_CALENDLY: CALENDLY, LEAD_REDIRECT_WHATSAPP: WHATS });

test('gestor(a) com faturamento alto vai para o WhatsApp', async () => {
  assert.equal(await leadCom(envRotas(), { funnel: 'sessao-estrategica', cargo: 'Gestor(a)' }), WHATS);
});

test('funcionário(a) com faturamento alto vai para o WhatsApp, também na aplicação da mentoria', async () => {
  assert.equal(await leadCom(envRotas(), { funnel: 'sessao-estrategica', cargo: 'Funcionário(a)' }), WHATS);
  assert.equal(await leadCom(envRotas(), { funnel: 'aplicacao-mentoria', cargo: 'Funcionário(a)' }), WHATS);
});

test('dono(a) e "Outro" com faturamento alto seguem para a agenda', async () => {
  assert.equal(await leadCom(envRotas(), { funnel: 'sessao-estrategica', cargo: 'Dono(a) / Sócio(a)' }), CALENDLY);
  assert.equal(await leadCom(envRotas(), { funnel: 'aplicacao-mentoria', cargo: 'Outro' }), CALENDLY);
});

test('lead sem cargo segue só pelo faturamento', async () => {
  assert.equal(await leadCom(envRotas(), { funnel: 'sessao-estrategica' }), CALENDLY);
  assert.equal(await leadCom(envRotas(), { funnel: 'sessao-estrategica', faturamento: 'Menos de 20 Mil' }), WHATS);
});

test('investimento no chat e na mentoria não muda o destino', async () => {
  assert.equal(await leadCom(envRotas(), { funnel: 'sessao-estrategica', cargo: 'Dono(a) / Sócio(a)', investimento: 'Ainda não invisto' }), CALENDLY);
});

test('aplicação de tráfego ignora o cargo e segue pelo investimento', async () => {
  const env = { ...envRotas(), LEAD_REDIRECT_CALENDLY_TRAFEGO: 'https://calendly.com/x/trafego' };
  assert.equal(await leadCom(env, { funnel: 'trafego-atacado', cargo: 'Funcionário(a)', investimento: 'Acima de R$ 10.000/mês' }), 'https://calendly.com/x/trafego');
});
