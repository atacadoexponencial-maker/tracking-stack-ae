// Fluxo da agenda própria contra SQLite real (migration 0047) e um Google
// simulado (fetch trocado). Cobre: configuração pelo dash, convite do
// formulário, horários, confirmação, remarcar/cancelar pelo lead, sync do
// Google e presença pelo Meet.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { generateKeyPairSync } from 'node:crypto';

import * as agendas from '../functions/api/agenda/agendas.js';
import * as grades from '../functions/api/agenda/grades.js';
import * as tipos from '../functions/api/agenda/tipos.js';
import * as reunioes from '../functions/api/agenda/reunioes.js';
import * as pubTipo from '../functions/api/agenda/publico/tipo.js';
import * as pubHorarios from '../functions/api/agenda/publico/horarios.js';
import * as pubConfirmar from '../functions/api/agenda/publico/confirmar.js';
import * as pubReuniao from '../functions/api/agenda/publico/reuniao.js';
import * as syncAgenda from '../functions/api/sync/agenda.js';
import { criarConvite, tipoDoFunil } from '../functions/api/_agenda-convite.js';

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

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = JSON.stringify({ client_email: 'sa@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
const CAL = 'cal-comercial@group.calendar.google.com';

let db, env, google;

// Google simulado: guarda eventos, responde freeBusy a partir deles.
function googleFalso() {
  const eventos = new Map();
  const meet = new Map(); // código → participantes | null
  let n = 0;
  const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFalso = async (url, op = {}) => {
    const u = String(url);
    const metodo = op.method || 'GET';
    if (u.startsWith('https://oauth2.googleapis.com/token')) return resp({ access_token: 'tok', expires_in: 3600 });
    if (u.includes('/users/me/calendarList')) return resp({ items: [{ id: CAL, summary: 'SETE | COMERCIAL' }, { id: 'pessoal', summary: 'Pessoal' }] });
    if (u.endsWith('/freeBusy')) {
      const corpo = JSON.parse(op.body);
      const calendars = {};
      for (const { id } of corpo.items) {
        calendars[id] = { busy: [...eventos.values()].filter((e) => e.cal === id && !e.cancelado).map((e) => ({ start: e.start, end: e.end })) };
      }
      return resp({ calendars });
    }
    const m = /\/calendars\/([^/]+)\/events(?:\/([^?]+))?/.exec(u);
    if (m) {
      const cal = decodeURIComponent(m[1]);
      const id = m[2] && decodeURIComponent(m[2]);
      if (metodo === 'POST') {
        const c = JSON.parse(op.body);
        const eid = 'ev' + (++n);
        const codigo = 'abc-defg-' + 'hi' + String.fromCharCode(96 + n);
        eventos.set(eid, { cal, start: c.start.dateTime, end: c.end.dateTime, desc: c.description, attendees: c.attendees, codigo });
        return resp({ id: eid, hangoutLink: `https://meet.google.com/${codigo}`, htmlLink: 'x' });
      }
      const ev = eventos.get(id);
      if (!ev) return resp({ error: { message: 'Not Found' } }, 404);
      if (metodo === 'DELETE') { eventos.delete(id); return new Response(null, { status: 204 }); }
      if (metodo === 'PATCH') {
        const c = JSON.parse(op.body);
        if (c.start) { ev.start = c.start.dateTime; ev.end = c.end.dateTime; }
        if (c.description) ev.desc = c.description;
        return resp({ id });
      }
      return resp({ id, status: 'confirmed', start: { dateTime: ev.start }, end: { dateTime: ev.end } });
    }
    if (u.includes('meet.googleapis.com/v2/conferenceRecords?filter')) {
      const codigo = /meeting_code = "([^"]+)"/.exec(decodeURIComponent(u))[1];
      const p = meet.get(codigo);
      return resp(p == null ? {} : { conferenceRecords: [{ name: `conferenceRecords/${codigo}` }] });
    }
    if (u.includes('/participants')) {
      const codigo = /conferenceRecords\/([^/]+)\/participants/.exec(u)[1];
      return resp({ participants: meet.get(codigo) });
    }
    if (u.includes('graph.facebook.com') || u.includes('google-analytics.com')) return resp({ events_received: 1 });
    throw new Error('fetch inesperado: ' + u);
  };
  return { eventos, meet, fetchFalso };
}

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_create_tables.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0047_agenda.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0048_agenda_descricao.sql', import.meta.url), 'utf8'));
  // As colunas de UTM da sessão entraram fora das migrations (conferido no D1 remoto).
  for (const c of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'funnel']) db.exec(`ALTER TABLE sessions ADD COLUMN ${c} TEXT`);
  env = { DB: d1(db), DASH_KEY: 'k', SYNC_SECRET: 's', GOOGLE_AGENDA_SA_JSON: SA };
  google = googleFalso();
  globalThis.fetch = google.fetchFalso;
});

const dash = (mod, corpo, qs = '') => (corpo
  ? mod.onRequestPost({ request: new Request(`https://x/api?key=k${qs}`, { method: 'POST', body: JSON.stringify(corpo) }), env })
  : mod.onRequestGet({ request: new Request(`https://x/api?key=k${qs}`), env })).then(async (r) => ({ status: r.status, corpo: await r.json() }));

const publico = (mod, { qs = '', corpo } = {}) => {
  const ctx = { env, waitUntil: (p) => pendentes.push(p) };
  ctx.request = corpo
    ? new Request(`https://x/api${qs}`, { method: 'POST', body: JSON.stringify(corpo), headers: { 'user-agent': 'Mozilla/5.0 Chrome/120', 'cf-connecting-ip': '200.1.1.1' } })
    : new Request(`https://x/api${qs}`);
  return (corpo ? mod.onRequestPost(ctx) : mod.onRequestGet(ctx)).then(async (r) => ({ status: r.status, corpo: await r.json() }));
};
let pendentes = [];

async function configurar({ comercial = true } = {}) {
  assert.equal((await dash(agendas, { acao: 'adicionar_conta', email: 'felipe@seteads.com' })).status, 200);
  await dash(agendas, { acao: 'conflito', id: CAL, conflito: true });
  const g = await dash(grades, { acao: 'salvar', nome: 'Todo dia', faixas: { 0: [['00:00', '24:00']], 1: [['00:00', '24:00']], 2: [['00:00', '24:00']], 3: [['00:00', '24:00']], 4: [['00:00', '24:00']], 5: [['00:00', '24:00']], 6: [['00:00', '24:00']] } });
  const gradeId = g.corpo.grades[0].id;
  const t = await dash(tipos, {
    acao: 'salvar', nome: 'Consultoria Individual', slug: 'consultoria-individual', duracao_min: 45,
    destino_cal: CAL, conflito_cals: [CAL], grade_id: gradeId, antecedencia_min: 60, janela_dias: 14,
    intervalo_min: 60, comercial, funil: comercial ? 'sessao-estrategica' : '',
    perguntas: [{ texto: 'Faturamento?', tipo: 'escolha', opcoes: ['A', 'B'], obrigatoria: true }],
  });
  assert.equal(t.status, 200, JSON.stringify(t.corpo));
  return t.corpo.tipos[0];
}

test('dash: recusa conta fora do Workspace e lista agendas da conta', async () => {
  const r = await dash(agendas, { acao: 'adicionar_conta', email: 'alguem@gmail.com' });
  assert.equal(r.status, 400);
  const ok = await dash(agendas, { acao: 'adicionar_conta', email: 'felipe@seteads.com' });
  assert.equal(ok.corpo.contas[0].agendas.length, 2);
  assert.equal((await dash(agendas)).status, 200);
});

test('fluxo comercial: convite → horários → confirmar → remarcar → cancelar', async () => {
  const tipo = await configurar();

  // Sem convite: manda para a LP do funil.
  const sem = await publico(pubTipo, { qs: '?slug=consultoria-individual' });
  assert.equal(sem.corpo.estado, 'sem_convite');
  assert.equal(sem.corpo.destino, '/');

  // O /tracker cria o convite com os dados do formulário.
  const t = await tipoDoFunil(env, 'sessao-estrategica');
  assert.equal(t.id, tipo.id);
  const c = await criarConvite(env, t, { eventId: 'lead-1', nome: 'Ana Lead', email: 'ana@empresa.com', telefone: '5511987654321', funil: 'sessao-estrategica' });
  const aberto = await publico(pubTipo, { qs: `?slug=consultoria-individual&c=${c}` });
  assert.equal(aberto.corpo.estado, 'ok');
  assert.equal(aberto.corpo.lead.email, 'ana@empresa.com');

  const h = await publico(pubHorarios, { qs: `?slug=consultoria-individual&c=${c}` });
  const dias = Object.keys(h.corpo.dias);
  assert.ok(dias.length >= 14, 'janela de 14 dias com horário todo dia');
  const horario = h.corpo.dias[dias[1]][3];

  // Pergunta obrigatória em branco
  const faltou = await publico(pubConfirmar, { corpo: { slug: 'consultoria-individual', c, inicio: horario, nome: 'Ana Lead', email: 'ana@empresa.com', telefone: '11987654321', respostas: [''] } });
  assert.equal(faltou.status, 400);
  assert.ok(faltou.corpo.campos.p0);

  pendentes = [];
  const ok = await publico(pubConfirmar, { corpo: { slug: 'consultoria-individual', c, inicio: horario, nome: 'Ana Lead', email: 'ana@empresa.com', telefone: '11987654321', respostas: ['A'], fuso: 'America/Sao_Paulo' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
  assert.ok(ok.corpo.schedule_event_id.startsWith('schedule-'));
  await Promise.all(pendentes);
  const linha = db.prepare('SELECT * FROM agenda_reunioes').get();
  assert.equal(linha.funil, 'sessao-estrategica');
  assert.equal(linha.lead_event_id, 'lead-1');
  assert.equal(linha.crm_situacao, 'sem_credencial');
  assert.equal(google.eventos.size, 1);
  assert.match([...google.eventos.values()][0].desc, /reuniao\//);

  // O mesmo horário não é mais oferecido, e confirmar de novo dá conflito.
  const h2 = await publico(pubHorarios, { qs: `?slug=consultoria-individual&c=${c}` });
  assert.ok(!h2.corpo.dias[dias[1]].includes(horario));
  const dup = await publico(pubConfirmar, { corpo: { slug: 'consultoria-individual', c, inicio: horario, nome: 'Bia', email: 'bia@x.com', telefone: '11987654322', respostas: ['B'] } });
  assert.equal(dup.status, 409);

  // Reuniões agendadas por funil (painel da Visão geral)
  const pf = await dash(reunioes, null, `&por=funil&from=0&to=${Math.floor(Date.now() / 1000) + 10}`);
  assert.deepEqual(pf.corpo.por_funil, { 'sessao-estrategica': 1 });

  // Lead remarca pelo link de gestão
  const g = ok.corpo.gestao;
  const ver = await publico(pubReuniao, { qs: `?g=${g}` });
  assert.equal(ver.corpo.situacao, 'marcada');
  assert.equal(ver.corpo.pode_mudar, true);
  const hg = await publico(pubHorarios, { qs: `?g=${g}` });
  const novo = hg.corpo.dias[dias[2]][5];
  const rem = await publico(pubReuniao, { corpo: { g, acao: 'remarcar', inicio: novo } });
  assert.equal(rem.status, 200, JSON.stringify(rem.corpo));
  assert.equal(rem.corpo.inicio, novo);
  assert.equal(google.eventos.size, 1);

  // Lead cancela
  const can = await publico(pubReuniao, { corpo: { g, acao: 'cancelar', motivo: 'imprevisto' } });
  assert.equal(can.corpo.situacao, 'cancelada');
  assert.equal(google.eventos.size, 0);
  const hist = db.prepare('SELECT acao FROM agenda_historico ORDER BY id').all().map((x) => x.acao);
  assert.deepEqual(hist, ['agendou', 'remarcou', 'cancelou']);
});

test('tipo não comercial: link direto, sem convite e sem conversão', async () => {
  await configurar({ comercial: false });
  const aberto = await publico(pubTipo, { qs: '?slug=consultoria-individual' });
  assert.equal(aberto.corpo.estado, 'ok');
  assert.equal(aberto.corpo.lead, null);
  const h = await publico(pubHorarios, { qs: '?slug=consultoria-individual' });
  const dia = Object.keys(h.corpo.dias)[1];
  pendentes = [];
  const ok = await publico(pubConfirmar, { corpo: { slug: 'consultoria-individual', inicio: h.corpo.dias[dia][0], nome: 'Candidato', email: 'c@x.com', telefone: '11987654321', respostas: ['A'] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
  assert.equal(ok.corpo.schedule_event_id, null);
  await Promise.all(pendentes);
  const linha = db.prepare('SELECT comercial, funil, crm_situacao, conversao_situacao FROM agenda_reunioes').get();
  assert.deepEqual({ ...linha }, { comercial: 0, funil: null, crm_situacao: null, conversao_situacao: null });
});

test('tipo pausado e exclusão com reunião futura', async () => {
  const tipo = await configurar({ comercial: false });
  await dash(tipos, { acao: 'pausar', id: tipo.id });
  assert.equal((await publico(pubTipo, { qs: '?slug=consultoria-individual' })).corpo.estado, 'pausado');
  await dash(tipos, { acao: 'reativar', id: tipo.id });
  const h = await publico(pubHorarios, { qs: '?slug=consultoria-individual' });
  const dia = Object.keys(h.corpo.dias)[1];
  const conf = await publico(pubConfirmar, { corpo: { slug: "consultoria-individual", inicio: h.corpo.dias[dia][0], nome: "Carla", email: "c@x.com", telefone: "11987654321", respostas: ["A"] } });
  assert.equal(conf.status, 200, JSON.stringify(conf.corpo));
  assert.equal((await dash(tipos, { acao: 'excluir', id: tipo.id })).status, 409);
  assert.equal((await dash(grades, { acao: 'excluir', id: tipo.grade_id })).status, 409);
});

test('sync: evento apagado no Google vira cancelada; presença pelo Meet', async () => {
  await configurar({ comercial: false });
  const h = await publico(pubHorarios, { qs: '?slug=consultoria-individual' });
  const dia = Object.keys(h.corpo.dias)[1];
  const conf = await publico(pubConfirmar, { corpo: { slug: "consultoria-individual", inicio: h.corpo.dias[dia][0], nome: "Carla", email: "c@x.com", telefone: "11987654321", respostas: ["A"] } });
  assert.equal(conf.status, 200, JSON.stringify(conf.corpo));
  await publico(pubConfirmar, { corpo: { slug: 'consultoria-individual', inicio: h.corpo.dias[dia][1], nome: "Davi", email: "d@x.com", telefone: '11987654322', respostas: ['A'] } });
  const [r1, r2] = db.prepare('SELECT * FROM agenda_reunioes ORDER BY inicio').all();
  google.eventos.delete(r1.google_event_id);
  // r2 já aconteceu (forçado) e o lead entrou na sala.
  const passado = Math.floor(Date.now() / 1000) - 2 * 3600;
  db.prepare('UPDATE agenda_reunioes SET inicio = ?, fim = ? WHERE id = ?').run(passado - 2700, passado, r2.id);
  google.meet.set(/meet\.google\.com\/(.+)$/.exec(r2.meet_link)[1], [{ signedinUser: { user: 'users/102068618279730112556' } }, { anonymousUser: { displayName: 'D' } }]);

  const s = await syncAgenda.onRequestPost({ request: new Request('https://x', { method: 'POST', headers: { 'x-sync-secret': 's' } }), env });
  const corpo = await s.json();
  assert.deepEqual(corpo.erros, []);
  assert.equal(corpo.google.canceladas, 1);
  assert.equal(corpo.presenca.realizada, 1);
  const sit = db.prepare('SELECT situacao FROM agenda_reunioes ORDER BY inicio').all().map((x) => x.situacao);
  assert.deepEqual(sit.sort(), ['cancelada', 'realizada']);

  const lista = await dash(reunioes, null, `&vista=todas&from=0&to=${Math.floor(Date.now() / 1000) + 30 * 86400}`);
  const pend = await dash(reunioes, null, `&vista=pendentes`);
  assert.equal(pend.corpo.contagens.pendentes, 0);
  assert.equal(lista.corpo.numeros.agendados, 2);
  assert.equal(lista.corpo.numeros.taxa_comparecimento, 1);
});
