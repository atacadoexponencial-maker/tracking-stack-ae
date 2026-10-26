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
import * as pubEtapa from '../functions/api/agenda/publico/etapa.js';
import * as funilApi from '../functions/api/agenda/funil.js';
import { criarConvite, tipoDoFunil } from '../functions/api/_agenda-convite.js';
import { CORTE_CALENDLY } from '../functions/api/_agenda-regras.js';
import { CONSULTORIA_MANYCHAT, dataEHora, motivoParaPular, whatsappDaReuniao } from '../functions/api/_agenda-manychat.js';

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
  db.exec(readFileSync(new URL('../migrations/0049_agenda_etapas.sql', import.meta.url), 'utf8'));
  // E-mails da agenda (issue 379): os ganchos de e-mail rodam de verdade.
  for (const f of ['0050_email.sql', '0051_email_modelos.sql', '0052_email_agenda.sql', '0059_agenda_tipos_teste.sql', '0064_agenda_janela_contagem.sql', '0067_agenda_comentarios.sql']) db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
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
  return (corpo ? mod.onRequestPost(ctx) : mod.onRequestGet(ctx)).then(async (r) => { const txt = await r.text(); return { status: r.status, corpo: txt ? JSON.parse(txt) : null }; });
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

  // Sem convite (link direto que a equipe manda, 20/10/2026): abre com os
  // campos vazios para a pessoa preencher.
  const sem = await publico(pubTipo, { qs: '?slug=consultoria-individual' });
  assert.equal(sem.corpo.estado, 'ok');
  assert.equal(sem.corpo.lead, null);
  const hSem = await publico(pubHorarios, { qs: '?slug=consultoria-individual' });
  assert.equal(hSem.status, 200);

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
  // E-mails da agenda (379): confirmação tentada na hora (sem chave do Postmark
  // aqui, então "falhou") e os dois lembretes padrão na fila.
  const fila = () => db.prepare('SELECT evento, situacao, motivo, inicio_ref FROM agenda_emails_fila ORDER BY id').all();
  assert.deepEqual(fila().map((x) => x.evento), ['confirmacao', 'lembrete', 'lembrete']);
  assert.equal(fila()[0].situacao, 'falhou');

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
  pendentes = [];
  const rem = await publico(pubReuniao, { corpo: { g, acao: 'remarcar', inicio: novo } });
  assert.equal(rem.status, 200, JSON.stringify(rem.corpo));
  await Promise.all(pendentes);
  assert.ok(!fila().some((x) => x.situacao === 'pendente' && x.inicio_ref === horario), 'nenhum lembrete do horário antigo pendente');
  assert.ok(fila().some((x) => x.evento === 'remarcacao'));
  assert.equal(rem.corpo.inicio, novo);
  assert.equal(google.eventos.size, 1);

  // Lead cancela
  pendentes = [];
  const can = await publico(pubReuniao, { corpo: { g, acao: 'cancelar', motivo: 'imprevisto' } });
  assert.equal(can.corpo.situacao, 'cancelada');
  await Promise.all(pendentes);
  assert.ok(!fila().some((x) => x.situacao === 'pendente'), 'nada pendente depois de cancelar');
  assert.ok(fila().some((x) => x.evento === 'cancelamento'));
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

test('sync: sem registro do Meet a reunião continua aguardando presença, mesmo depois de 24 h', async () => {
  await configurar({ comercial: false });
  const h = await publico(pubHorarios, { qs: '?slug=consultoria-individual' });
  const dia = Object.keys(h.corpo.dias)[1];
  for (const [i, nome] of [[0, 'Ana'], [1, 'Bia']]) {
    await publico(pubConfirmar, { corpo: { slug: 'consultoria-individual', inicio: h.corpo.dias[dia][i], nome, email: `${nome}@x.com`, telefone: `1198765432${i}`, respostas: ['A'] } });
  }
  const [r1, r2] = db.prepare('SELECT * FROM agenda_reunioes ORDER BY inicio').all();
  const t = Math.floor(Date.now() / 1000);
  // r1 terminou há 2 h, r2 há 30 h; nenhuma das salas tem registro no Meet.
  db.prepare('UPDATE agenda_reunioes SET inicio = ?, fim = ? WHERE id = ?').run(t - 2 * 3600 - 2700, t - 2 * 3600, r1.id);
  db.prepare('UPDATE agenda_reunioes SET inicio = ?, fim = ? WHERE id = ?').run(t - 30 * 3600 - 2700, t - 30 * 3600, r2.id);

  const s = await syncAgenda.onRequestPost({ request: new Request('https://x', { method: 'POST', headers: { 'x-sync-secret': 's' } }), env });
  const corpo = await s.json();
  assert.deepEqual(corpo.erros, []);
  assert.deepEqual(corpo.presenca, {});
  assert.deepEqual(db.prepare('SELECT situacao FROM agenda_reunioes').all().map((x) => x.situacao), ['marcada', 'marcada']);
  const pend = await dash(reunioes, null, '&vista=pendentes');
  assert.equal(pend.corpo.contagens.pendentes, 2);
  assert.ok(pend.corpo.rows.every((r) => r.aguardando_presenca));
});

test('lista: consultorias do Calendly desde 19/10, com nome e Meet, fora dos agendados do período', async () => {
  await configurar({ comercial: false });
  db.exec(readFileSync(new URL('../migrations/0063_calendly_consultorias.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0065_calendly_detalhes.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0066_calendly_presenca.sql', import.meta.url), 'utf8'));
  const t = Math.floor(Date.now() / 1000);
  const ins = db.prepare(`INSERT INTO calendly_consultorias (invitee_uri, event_uri, email, agendou_em, inicio, situacao, atualizado_em)
    VALUES (?, 'ev', ?, 0, ?, ?, 0)`);
  ins.run('cal-antes', 'antes@x.com', CORTE_CALENDLY - 3600, 'ativa');
  ins.run('cal-semana', 'semana@x.com', CORTE_CALENDLY + 3600, 'ativa');
  ins.run('cal-cancelada', 'cancelou@x.com', CORTE_CALENDLY + 7200, 'cancelada');
  ins.run('cal-futura', 'futura@x.com', t + 3 * 86400, 'ativa');
  db.prepare("UPDATE calendly_consultorias SET nome = 'Fábio', telefone = '5511999990000', meet_link = 'https://meet.google.com/xyz' WHERE invitee_uri = 'cal-futura'").run();

  const todas = await dash(reunioes, null, `&vista=todas&from=0&to=${t + 30 * 86400}`);
  const cal = todas.corpo.rows.filter((r) => r.origem === 'calendly');
  assert.deepEqual(cal.map((r) => r.email), ['futura@x.com', 'semana@x.com']);
  assert.ok(cal.every((r) => r.tipo_nome === 'Calendly'));
  assert.deepEqual(cal.map((r) => r.aguardando_presenca), [false, true]);
  assert.deepEqual([cal[0].nome, cal[0].telefone, cal[0].meet_link], ['Fábio', '5511999990000', 'https://meet.google.com/xyz']);
  assert.equal(cal[1].nome, 'semana@x.com', 'sem nome coletado, mostra o e-mail');
  assert.equal(todas.corpo.numeros.agendados, 0);

  const prox = await dash(reunioes, null, '&vista=proximas');
  assert.deepEqual(prox.corpo.rows.map((r) => r.email), ['futura@x.com']);
  assert.equal(prox.corpo.contagens.proximas, 1);

  const pend = await dash(reunioes, null, '&vista=pendentes');
  assert.deepEqual(pend.corpo.rows.map((r) => r.email), ['semana@x.com']);

  const comTipo = await dash(reunioes, null, `&vista=todas&from=0&to=${t + 30 * 86400}&tipo=1`);
  assert.equal(comTipo.corpo.rows.filter((r) => r.origem === 'calendly').length, 0);
});

test('Calendly: presença à mão sai de aguardando, entra no comparecimento, manda a conversão e a coleta não apaga', async () => {
  await configurar({ comercial: false });
  for (const f of ['0063_calendly_consultorias.sql', '0065_calendly_detalhes.sql', '0066_calendly_presenca.sql']) db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  const t = Math.floor(Date.now() / 1000);
  const uri = (id) => `https://api.calendly.com/scheduled_events/e/invitees/${id}`;
  const ins = db.prepare(`INSERT INTO calendly_consultorias (invitee_uri, event_uri, email, agendou_em, inicio, fim, situacao, atualizado_em)
    VALUES (?, 'ev', ?, 0, ?, ?, 'ativa', 0)`);
  ins.run(uri('ontem'), 'ontem@empresa.com', t - 86400, t - 86400 + 2700);
  ins.run(uri('velha'), 'velha@empresa.com', Math.max(CORTE_CALENDLY, t - 10 * 86400), Math.max(CORTE_CALENDLY, t - 10 * 86400) + 2700);
  ins.run(uri('amanha'), 'amanha@empresa.com', t + 86400, t + 86400 + 2700);

  let pend = await dash(reunioes, null, '&vista=pendentes');
  assert.deepEqual(pend.corpo.rows.map((r) => r.email).sort(), ['ontem@empresa.com', 'velha@empresa.com']);
  assert.equal(pend.corpo.contagens.pendentes, 2);
  assert.equal((await dash(reunioes, { acao: 'presenca', id: uri('amanha'), situacao: 'realizada' })).status, 409);

  assert.equal((await dash(reunioes, { acao: 'presenca', id: uri('ontem'), situacao: 'realizada' })).status, 200);
  assert.equal((await dash(reunioes, { acao: 'presenca', id: uri('velha'), situacao: 'realizada' })).status, 200);
  const linha = (id) => db.prepare('SELECT * FROM calendly_consultorias WHERE invitee_uri = ?').get(uri(id));
  assert.equal(linha('ontem').presenca, 'realizada');
  assert.equal(linha('ontem').conversao_realizada, 'enviada');
  assert.equal(linha('velha').conversao_realizada, 'fora_do_prazo');

  pend = await dash(reunioes, null, '&vista=pendentes');
  assert.equal(pend.corpo.rows.length, 0);
  const todas = await dash(reunioes, null, `&vista=todas&from=0&to=${t + 30 * 86400}`);
  assert.equal(todas.corpo.rows.find((r) => r.email === 'ontem@empresa.com').situacao, 'realizada');
  assert.deepEqual([todas.corpo.numeros.agendados, todas.corpo.numeros.realizadas], [0, 2]);
  const soRealizadas = await dash(reunioes, null, `&vista=todas&from=0&to=${t + 30 * 86400}&situacao=realizada`);
  assert.equal(soRealizadas.corpo.rows.length, 2);

  // A coleta diária regrava a linha e não mexe na presença.
  const { linhasDasConsultorias, onRequestPost: coleta } = await import('../functions/api/sync/calendly.js');
  assert.ok(linhasDasConsultorias);
  await coleta({ request: new Request('https://x', { method: 'POST', headers: { 'x-sync-secret': 's' }, body: JSON.stringify({ eventos: [
    { uri: 'ev', status: 'active', start_time: new Date((t - 86400) * 1000).toISOString(), convidados: [{ uri: uri('ontem'), email: 'ontem@empresa.com', created_at: '2026-10-20T10:00:00Z', status: 'active' }] },
  ] }) }), env });
  assert.equal(linha('ontem').presenca, 'realizada');
});

// ClickUp simulado por cima do Google: só a Rita tem card; guarda os comentários.
function clickupFalso() {
  const comentarios = [];
  const anterior = globalThis.fetch;
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url);
    if (!u.startsWith('https://api.clickup.com/')) return anterior(url, op);
    if (u.includes('/comment')) { comentarios.push({ card: /\/task\/([^/]+)\/comment/.exec(u)[1], texto: JSON.parse(op.body).comment_text }); return Response.json({ id: 'c' }); }
    const filtro = JSON.parse(new URL(u).searchParams.get('custom_fields'))[0];
    return Response.json({ tasks: filtro.value === 'rita@empresa.com' ? [{ id: 'card-rita' }] : [] });
  };
  env.CLICKUP_API_TOKEN = 'cu';
  return comentarios;
}

test('comentários: vários por reunião, em qualquer situação, cada um vira comentário no card do ClickUp', async () => {
  await configurar();
  const t = await tipoDoFunil(env, 'sessao-estrategica');
  const c = await criarConvite(env, t, { eventId: 'lead-7', nome: 'Rita Lead', email: 'rita@empresa.com', telefone: '5511987654321', funil: 'sessao-estrategica' });
  const h = await publico(pubHorarios, { qs: `?slug=consultoria-individual&c=${c}` });
  const dia = Object.keys(h.corpo.dias)[1];
  pendentes = [];
  const ok = await publico(pubConfirmar, { corpo: { slug: 'consultoria-individual', c, inicio: h.corpo.dias[dia][0], nome: 'Rita Lead', email: 'rita@empresa.com', telefone: '11987654321', respostas: ['A'] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
  await Promise.all(pendentes);
  const { id } = db.prepare('SELECT id FROM agenda_reunioes').get();
  const cu = clickupFalso();
  const comentar = (texto, rid = id) => dash(reunioes, { acao: 'comentar', id: rid, texto });

  assert.equal((await comentar('   ')).status, 400);
  assert.equal((await comentar('x'.repeat(2001))).status, 400);
  assert.equal((await comentar('oi', 'nao-existe')).status, 404);

  // Marcada (antes da reunião)
  const a = await comentar('  Não respondeu a ativação  ');
  assert.equal(a.status, 200, JSON.stringify(a.corpo));
  assert.deepEqual(a.corpo.comentarios.map((x) => [x.texto, x.crm_situacao]), [['Não respondeu a ativação', 'ok:card-rita']]);
  assert.equal(cu.length, 1);
  assert.equal(cu[0].card, 'card-rita');
  assert.match(cu[0].texto, /^💬 Comentário sobre a reunião: Consultoria Individual · /);
  assert.match(cu[0].texto, /\nNão respondeu a ativação$/);

  // Cancelada também aceita, e o anterior continua lá (só acrescenta).
  assert.equal((await dash(reunioes, { acao: 'cancelar', id })).status, 200);
  assert.equal((await comentar('Desistiu: precisa falar com o sócio')).status, 200);
  const det = await dash(reunioes, null, `&id=${id}`);
  assert.deepEqual(det.corpo.comentarios.map((x) => x.texto), ['Não respondeu a ativação', 'Desistiu: precisa falar com o sócio']);
  assert.equal(cu.filter((x) => x.texto.startsWith('💬')).length, 2);
  // Comentar não mexe na situação nem no histórico.
  assert.equal(det.corpo.reuniao.situacao, 'cancelada');
  assert.ok(det.corpo.historico.every((x) => x.acao !== 'comentou'));
});

test('comentários no Calendly: gaveta abre com os dados do Calendly, comentário fica salvo mesmo sem card', async () => {
  for (const f of ['0063_calendly_consultorias.sql', '0065_calendly_detalhes.sql', '0066_calendly_presenca.sql']) db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  const t = Math.floor(Date.now() / 1000);
  const uri = (x) => `https://api.calendly.com/scheduled_events/e/invitees/${x}`;
  db.prepare(`INSERT INTO calendly_consultorias (invitee_uri, event_uri, email, agendou_em, inicio, fim, situacao, atualizado_em, nome, meet_link)
    VALUES (?, 'ev', ?, 0, ?, ?, 'ativa', 0, ?, 'https://meet.google.com/xyz')`).run(uri('rita'), 'rita@empresa.com', t - 86400, t - 86400 + 2700, 'Rita');
  db.prepare(`INSERT INTO calendly_consultorias (invitee_uri, event_uri, email, agendou_em, inicio, situacao, atualizado_em)
    VALUES (?, 'ev', 'semcard@empresa.com', 0, ?, 'ativa', 0)`).run(uri('semcard'), t + 86400);
  const cu = clickupFalso();

  let det = await dash(reunioes, null, `&id=${encodeURIComponent(uri('rita'))}`);
  assert.equal(det.status, 200, JSON.stringify(det.corpo));
  assert.equal(det.corpo.reuniao.origem, 'calendly');
  assert.equal(det.corpo.reuniao.meet_link, 'https://meet.google.com/xyz');
  assert.equal(det.corpo.reuniao.crm_situacao, 'calendly_sem_registro');
  assert.deepEqual(det.corpo.comentarios, []);

  assert.equal((await dash(reunioes, { acao: 'comentar', id: uri('rita'), texto: 'Participou, divide a decisão com o pai' })).status, 200);
  assert.match(cu[0].texto, /^💬 Comentário sobre a reunião: Consultoria Individual \(Calendly\)/);
  det = await dash(reunioes, null, `&id=${encodeURIComponent(uri('rita'))}`);
  assert.equal(det.corpo.reuniao.crm_link, 'https://app.clickup.com/t/card-rita');
  assert.equal(det.corpo.comentarios.length, 1);

  const s = await dash(reunioes, { acao: 'comentar', id: uri('semcard'), texto: 'Remarcou sem avisar' });
  assert.equal(s.status, 200);
  assert.equal(s.corpo.comentarios[0].crm_situacao, 'sem_card');
  assert.equal((await dash(reunioes, { acao: 'comentar', id: uri('nao-existe'), texto: 'x' })).status, 404);
});

test('reunião realizada vira conversão uma vez só, e fora do prazo não envia', async () => {
  await configurar();
  const t = await tipoDoFunil(env, 'sessao-estrategica');
  const c = await criarConvite(env, t, { eventId: 'lead-9', nome: 'Rita Lead', email: 'rita@empresa.com', telefone: '5511987654321', funil: 'sessao-estrategica' });
  const h = await publico(pubHorarios, { qs: `?slug=consultoria-individual&c=${c}` });
  const dia = Object.keys(h.corpo.dias)[1];
  pendentes = [];
  const ok = await publico(pubConfirmar, { corpo: { slug: 'consultoria-individual', c, inicio: h.corpo.dias[dia][0], nome: 'Rita Lead', email: 'rita@empresa.com', telefone: '11987654321', respostas: ['A'] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
  await Promise.all(pendentes);
  const r = db.prepare('SELECT id FROM agenda_reunioes').get();
  const agora = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE agenda_reunioes SET inicio = ?, fim = ? WHERE id = ?').run(agora - 5400, agora - 2700, r.id);
  const marcar = (situacao) => dash(reunioes, { acao: 'presenca', id: r.id, situacao });
  assert.equal((await marcar('realizada')).status, 200);
  assert.equal(db.prepare('SELECT conversao_realizada AS c FROM agenda_reunioes').get().c, 'enviada');
  await marcar('faltou');
  await marcar('realizada');
  assert.equal(db.prepare('SELECT conversao_realizada AS c FROM agenda_reunioes').get().c, 'enviada');
  // Outra reunião, realizada há mais de 7 dias: não envia.
  db.prepare("UPDATE agenda_reunioes SET conversao_realizada = NULL, situacao = 'marcada', inicio = ?, fim = ? WHERE id = ?").run(agora - 9 * 86400, agora - 9 * 86400 + 2700, r.id);
  await marcar('realizada');
  assert.equal(db.prepare('SELECT conversao_realizada AS c FROM agenda_reunioes').get().c, 'fora_do_prazo');
});

test('etapas da agenda: uma vez por convite, sem teste, e entram no funil', async () => {
  await configurar();
  const t = await tipoDoFunil(env, 'sessao-estrategica');
  const c = await criarConvite(env, t, { nome: 'Lia Lead', email: 'lia@empresa.com', telefone: '11987654321', funil: 'sessao-estrategica' });
  const teste = await criarConvite(env, t, { nome: 'Teste', email: 'teste@seteads.com', telefone: '11999999999', funil: 'sessao-estrategica' });
  for (const corpo of [{ c, etapa: 'abriu' }, { c, etapa: 'abriu' }, { c, etapa: 'escolheu' }, { c: teste, etapa: 'abriu' }]) {
    assert.equal((await publico(pubEtapa, { corpo })).status, 204);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM agenda_etapas').get().n, 2);
  const f = await dash(funilApi, null, `&from=0&to=${Math.floor(Date.now() / 1000) + 10}`);
  assert.deepEqual([f.corpo.atual.leads, f.corpo.atual.abriu, f.corpo.atual.escolheu, f.corpo.atual.agendou], [1, 1, 1, 0]);
});

test('tipo de teste: some das listas e dos números, a página pública segue funcionando', async () => {
  const tipo = await configurar({ comercial: false });
  const salvo = await dash(tipos, {
    acao: 'salvar', id: tipo.id, nome: tipo.nome, slug: tipo.slug, duracao_min: 45, destino_cal: CAL, conflito_cals: [CAL],
    grade_id: tipo.grade_id, antecedencia_min: 60, janela_dias: 14, intervalo_min: 60, comercial: false, perguntas: tipo.perguntas, teste: true,
  });
  assert.equal(salvo.status, 200, JSON.stringify(salvo.corpo));
  assert.deepEqual([salvo.corpo.tipos.length, salvo.corpo.testes_escondidos], [0, 1]);
  const h = await publico(pubHorarios, { qs: '?slug=consultoria-individual' });
  const dia = Object.keys(h.corpo.dias)[1];
  const conf = await publico(pubConfirmar, { corpo: { slug: 'consultoria-individual', inicio: h.corpo.dias[dia][0], nome: 'Teste', email: 't@x.com', telefone: '11987654321', respostas: ['A'] } });
  assert.equal(conf.status, 200, JSON.stringify(conf.corpo));
  let r = await dash(reunioes, null, '&vista=proximas');
  assert.deepEqual([r.corpo.rows.length, r.corpo.contagens.proximas, r.corpo.tipos.length], [0, 0, 0]);
  r = await dash(reunioes, null, '&vista=proximas&testes=1');
  assert.deepEqual([r.corpo.rows.length, r.corpo.contagens.proximas, r.corpo.tipos.length], [1, 1, 1]);
  const comTestes = await dash(tipos, null, '&testes=1');
  assert.equal(comTestes.corpo.tipos[0].teste, true);
});

test('saúde da agenda: leitura OK não regrava a cada visita; erro grava sempre', async () => {
  await configurar({ comercial: false });
  const marca = () => db.prepare('SELECT ultima_leitura_ok, ultimo_erro FROM agenda_calendarios WHERE id = ?').get(CAL);
  assert.equal((await publico(pubHorarios, { qs: '?slug=consultoria-individual' })).status, 200);
  const primeira = marca().ultima_leitura_ok;
  assert.ok(primeira > 0);
  // Visita seguinte, minutos depois: não grava de novo.
  db.prepare('UPDATE agenda_calendarios SET ultima_leitura_ok = ? WHERE id = ?').run(primeira - 120, CAL);
  await publico(pubHorarios, { qs: '?slug=consultoria-individual' });
  assert.equal(marca().ultima_leitura_ok, primeira - 120);
  // Passou do intervalo: grava.
  db.prepare('UPDATE agenda_calendarios SET ultima_leitura_ok = ? WHERE id = ?').run(primeira - 3600, CAL);
  await publico(pubHorarios, { qs: '?slug=consultoria-individual' });
  assert.ok(marca().ultima_leitura_ok >= primeira);
  // Google falhou: grava o erro na hora, mesmo com leitura OK recente.
  const original = globalThis.fetch;
  globalThis.fetch = async (url, op) => (String(url).endsWith('/freeBusy') ? new Response('{}', { status: 500 }) : original(url, op));
  assert.equal((await publico(pubHorarios, { qs: '?slug=consultoria-individual' })).status, 503);
  globalThis.fetch = original;
  assert.ok(marca().ultimo_erro);
  // Voltou a funcionar: limpa o erro na hora.
  await publico(pubHorarios, { qs: '?slug=consultoria-individual' });
  assert.equal(marca().ultimo_erro, null);
});

// ---------------------------------------------------------------------------
// Confirmação da consultoria pelo WhatsApp (ManyChat), pedido de 26/10.
// ---------------------------------------------------------------------------

// ManyChat simulado por cima do Google: guarda as chamadas na ordem.
// `conhecidos`: telefones que o findBySystemField acha. `falhaFluxo`: sendFlow
// responde 200 com status "error", como a API faz.
function manychatFalso({ falhaFluxo = false } = {}) {
  const chamadas = [];
  const conhecidos = new Map();
  const anterior = globalThis.fetch;
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url);
    if (!u.startsWith('https://api.manychat.com/')) return anterior(url, op);
    const caminho = new URL(u).pathname;
    const corpo = op.body ? JSON.parse(op.body) : null;
    chamadas.push({ caminho, corpo });
    if (caminho.endsWith('/findBySystemField')) {
      const id = conhecidos.get(new URL(u).searchParams.get('phone'));
      return Response.json({ status: 'success', data: id ? [{ id }] : [] });
    }
    if (caminho.endsWith('/createSubscriber')) {
      conhecidos.set(corpo.whatsapp_phone, 'sub-1');
      return Response.json({ status: 'success', data: { id: 'sub-1' } });
    }
    if (caminho.endsWith('/sendFlow') && falhaFluxo) return Response.json({ status: 'error', message: 'template recusado' });
    return Response.json({ status: 'success' });
  };
  env.MANYCHAT_API = 'mc';
  return { chamadas, caminhos: () => chamadas.map((c) => c.caminho.split('/').pop()) };
}

async function agendarRita() {
  const t = await tipoDoFunil(env, 'sessao-estrategica');
  const c = await criarConvite(env, t, { eventId: 'lead-w', nome: 'Rita Lead', email: 'rita@empresa.com', telefone: '5511987654321', funil: 'sessao-estrategica' });
  const h = await publico(pubHorarios, { qs: `?slug=consultoria-individual&c=${c}` });
  const dias = Object.keys(h.corpo.dias);
  pendentes = [];
  const ok = await publico(pubConfirmar, { corpo: { slug: 'consultoria-individual', c, inicio: h.corpo.dias[dias[1]][0], nome: 'Rita Lead', email: 'rita@empresa.com', telefone: '11987654321', respostas: ['A'] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
  await Promise.all(pendentes);
  return { ok, h, dias, reuniao: () => db.prepare('SELECT * FROM agenda_reunioes').get() };
}
const historicoWhats = () => db.prepare("SELECT detalhe FROM agenda_historico WHERE acao = 'whatsapp' ORDER BY id").all().map((x) => x.detalhe);

test('WhatsApp: dia e hora em Brasília, no formato da mensagem', () => {
  // 27/10/2026 17h UTC = terça, 14h em Brasília
  assert.deepEqual(dataEHora(Date.UTC(2026, 9, 27, 17, 0) / 1000), { data: 'terça, 27/10', horario: '14h00' });
  assert.deepEqual(dataEHora(Date.UTC(2026, 9, 31, 12, 30) / 1000), { data: 'sábado, 31/10', horario: '09h30' });
});

test('WhatsApp: só agendou/remarcou da Consultoria Individual ativa, e só com fluxo configurado', () => {
  const cfg = { ...CONSULTORIA_MANYCHAT, fluxo: 'f' };
  const tipo = { slug: 'consultoria-individual' };
  const r = { situacao: 'marcada' };
  assert.equal(motivoParaPular(r, tipo, 'agendou', cfg), '');
  assert.equal(motivoParaPular({ situacao: 'remarcada' }, tipo, 'remarcou', cfg), '');
  assert.equal(motivoParaPular(r, tipo, 'cancelou', cfg), 'acao_sem_mensagem');
  assert.equal(motivoParaPular(r, { slug: 'entrevista-rh' }, 'agendou', cfg), 'outro_tipo');
  assert.equal(motivoParaPular({ situacao: 'cancelada' }, tipo, 'remarcou', cfg), 'reuniao_nao_ativa');
  assert.equal(motivoParaPular(r, tipo, 'agendou', { ...cfg, fluxo: '' }), 'sem_fluxo');
});

test('WhatsApp: desligado sem fluxo configurado, o agendamento não chama o ManyChat', async () => {
  await configurar();
  const mc = manychatFalso();
  await agendarRita();
  assert.deepEqual(mc.chamadas, []);
  assert.deepEqual(historicoWhats(), []);
});

test('WhatsApp: agendamento e as três remarcações mandam a mensagem com os campos antes do fluxo; cancelar não manda', async () => {
  await configurar();
  CONSULTORIA_MANYCHAT.fluxo = 'flow-consultoria';
  try {
    const mc = manychatFalso();
    const { ok, h, dias, reuniao } = await agendarRita();

    // Agendou: contato novo, tag, campos e só então o fluxo.
    const ordem = mc.caminhos();
    assert.ok(ordem.includes('createSubscriber'));
    assert.ok(ordem.indexOf('addTag') < ordem.indexOf('setCustomFields'));
    assert.ok(ordem.indexOf('setCustomFields') < ordem.indexOf('sendFlow'));
    const tag = mc.chamadas.find((c) => c.caminho.endsWith('/addTag')).corpo;
    assert.equal(tag.tag_id, CONSULTORIA_MANYCHAT.tag);
    const campos = Object.fromEntries(mc.chamadas.find((c) => c.caminho.endsWith('/setCustomFields')).corpo.fields.map((f) => [f.field_id, f.field_value]));
    const esperado = dataEHora(reuniao().inicio);
    assert.equal(campos[CONSULTORIA_MANYCHAT.campos.data], esperado.data);
    assert.equal(campos[CONSULTORIA_MANYCHAT.campos.horario], esperado.horario);
    assert.equal(campos[CONSULTORIA_MANYCHAT.campos.meet], reuniao().meet_link);
    assert.match(campos[CONSULTORIA_MANYCHAT.campos.gestao], new RegExp(`/reuniao/${ok.corpo.gestao}$`));
    assert.deepEqual(mc.chamadas.find((c) => c.caminho.endsWith('/sendFlow')).corpo, { subscriber_id: 'sub-1', flow_ns: 'flow-consultoria' });
    assert.match(historicoWhats()[0], /^WhatsApp enviado \(agendamento\)/);

    // Remarcou pelo lead: contato já existe, não cria outro; horário novo nos campos.
    mc.chamadas.length = 0;
    pendentes = [];
    const novo = h.corpo.dias[dias[2]][3];
    assert.equal((await publico(pubReuniao, { corpo: { g: ok.corpo.gestao, acao: 'remarcar', inicio: novo } })).status, 200);
    await Promise.all(pendentes);
    assert.ok(!mc.caminhos().includes('createSubscriber'));
    const campos2 = Object.fromEntries(mc.chamadas.find((c) => c.caminho.endsWith('/setCustomFields')).corpo.fields.map((f) => [f.field_id, f.field_value]));
    assert.equal(campos2[CONSULTORIA_MANYCHAT.campos.horario], dataEHora(novo).horario);
    assert.equal(mc.caminhos().filter((x) => x === 'sendFlow').length, 1);

    // Remarcou pela equipe no dash.
    mc.chamadas.length = 0;
    assert.equal((await dash(reunioes, { acao: 'remarcar', id: reuniao().id, inicio: h.corpo.dias[dias[3]][2] })).status, 200);
    assert.equal(mc.caminhos().filter((x) => x === 'sendFlow').length, 1);

    // Movida direto na agenda do Google.
    mc.chamadas.length = 0;
    const ev = google.eventos.get(reuniao().google_event_id);
    const mais1h = (iso) => new Date(Date.parse(iso) + 3600e3).toISOString();
    ev.start = mais1h(ev.start); ev.end = mais1h(ev.end);
    const s = await syncAgenda.onRequestPost({ request: new Request('https://x', { method: 'POST', headers: { 'x-sync-secret': 's' } }), env });
    assert.equal((await s.json()).google.movidas, 1);
    assert.equal(mc.caminhos().filter((x) => x === 'sendFlow').length, 1);
    assert.equal(historicoWhats().length, 4);

    // Cancelou: nada no ManyChat.
    mc.chamadas.length = 0;
    pendentes = [];
    await publico(pubReuniao, { corpo: { g: ok.corpo.gestao, acao: 'cancelar' } });
    await Promise.all(pendentes);
    assert.deepEqual(mc.chamadas, []);
  } finally {
    CONSULTORIA_MANYCHAT.fluxo = '';
  }
});

test('WhatsApp: falha no ManyChat fica no histórico e não atrapalha o agendamento; sem telefone não chama', async () => {
  await configurar();
  CONSULTORIA_MANYCHAT.fluxo = 'flow-consultoria';
  try {
    manychatFalso({ falhaFluxo: true });
    const { ok } = await agendarRita();
    assert.equal(ok.corpo.ok, true);
    assert.match(historicoWhats()[0], /^WhatsApp falhou: fluxo falhou: .*template recusado/);

    const r = db.prepare('SELECT id FROM agenda_reunioes').get();
    db.prepare("UPDATE agenda_reunioes SET telefone = NULL WHERE id = ?").run(r.id);
    assert.equal(await whatsappDaReuniao(env, r.id, 'remarcou'), 'sem_telefone');
    assert.match(historicoWhats().at(-1), /sem telefone/);
  } finally {
    CONSULTORIA_MANYCHAT.fluxo = '';
  }
});
