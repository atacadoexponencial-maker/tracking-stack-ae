// E-mails da agenda (issue 379) contra SQLite real (migrations 0047–0052) e
// um Postmark simulado (fetch trocado). As reuniões entram direto no banco: o
// caminho pelo Google está coberto em agenda-fluxo.test.js.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import * as emailsApi from '../functions/api/agenda/emails.js';
import * as reunioes from '../functions/api/agenda/reunioes.js';
import * as modelosApi from '../functions/api/email/modelos.js';
import * as syncEmail from '../functions/api/sync/email-agenda.js';
import {
  programarEmails, processarFila, valoresDaReuniao, falhasRecentes, usosNaAgenda,
} from '../functions/api/_email-agenda.js';

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

let db, env, pm;

function postmarkFalso() {
  const estado = { envios: [], recusar: null, foraDoAr: false, n: 0 };
  const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  estado.fetch = async (url, op = {}) => {
    const u = new URL(String(url));
    if (estado.foraDoAr) throw new TypeError('fetch failed');
    if (u.pathname === '/email') {
      const c = JSON.parse(op.body);
      if (estado.recusar) return resp({ ErrorCode: estado.recusar, Message: 'x' }, 422);
      const id = `msg-${++estado.n}`;
      estado.envios.push({ ...c, MessageID: id });
      return resp({ ErrorCode: 0, Message: 'OK', MessageID: id, To: c.To });
    }
    throw new Error('fetch inesperado: ' + u);
  };
  return estado;
}

const AGORA = Math.floor(Date.now() / 1000);
const DIA = 86400;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const f of ['0047_agenda.sql', '0048_agenda_descricao.sql', '0049_agenda_etapas.sql', '0050_email.sql', '0051_email_modelos.sql', '0052_email_agenda.sql', '0059_agenda_tipos_teste.sql']) {
    db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  }
  db.prepare("INSERT INTO agenda_grades (id, nome, faixas_json, criado_em, atualizado_em) VALUES (1, 'G', '{}', 0, 0)").run();
  db.prepare(`INSERT INTO agenda_tipos (id, slug, nome, duracao_min, destino_cal, grade_id, comercial, criado_em, atualizado_em)
              VALUES (1, 'sessao', 'Sessão estratégica', 45, 'cal', 1, 1, 0, 0), (2, 'rh', 'Entrevista RH', 30, 'cal', 1, 0, 0, 0)`).run();
  env = { DB: d1(db), DASH_KEY: 'k', SYNC_SECRET: 's', POSTMARK_SERVER_TOKEN: 'srv' };
  pm = postmarkFalso();
  globalThis.fetch = pm.fetch;
});

let nReuniao = 0;
function reuniao({ inicio = AGORA + 3 * DIA, tipo = 1, situacao = 'marcada', email = 'ana@empresa.com' } = {}) {
  const id = `r${++nReuniao}`;
  db.prepare(`INSERT INTO agenda_reunioes (id, tipo_id, inicio, fim, nome, email, situacao, meet_link, token_gestao, criado_em, atualizado_em)
              VALUES (?, ?, ?, ?, 'Ana Lima Souza', ?, ?, 'https://meet.google.com/abc-defg-hij', ?, ?, ?)`)
    .run(id, tipo, inicio, inicio + 2700, email, situacao, `tok-${id}`, AGORA, AGORA);
  return id;
}
const fila = (id) => db.prepare('SELECT * FROM agenda_emails_fila WHERE reuniao_id = ? ORDER BY id').all(id);

const dash = (mod, corpo, qs = '') => (corpo
  ? mod.onRequestPost({ request: new Request(`https://x/api?key=k${qs}`, { method: 'POST', body: JSON.stringify(corpo) }), env })
  : mod.onRequestGet({ request: new Request(`https://x/api?key=k${qs}`), env })).then(async (r) => ({ status: r.status, corpo: await r.json() }));

test('configuração padrão: cinco e-mails ligados com os modelos semeados', async () => {
  const r = await dash(emailsApi, null, '&tipo=1');
  assert.equal(r.status, 200);
  assert.equal(r.corpo.tipo_id, 1);
  assert.deepEqual(r.corpo.emails.map((e) => e.nome), ['Confirmação', 'Lembrete 24 h antes', 'Lembrete 1 h antes', 'Remarcação', 'Cancelamento']);
  assert.ok(r.corpo.emails.every((e) => e.ligado === 1));
  const nomes = Object.fromEntries(r.corpo.modelos.map((m) => [m.id, m.nome]));
  assert.equal(nomes[r.corpo.emails[0].modelo_id], 'Confirmação de reunião');
  assert.equal(r.corpo.remetente.email, 'notify@envio.atacadoexponencial.com');
  assert.equal((await dash(emailsApi, null, '&tipo=1')).corpo.emails.length, 5, 'não duplica na segunda leitura');
});

test('agendou: confirmação sai na hora com os campos; lembretes na fila', async () => {
  const id = reuniao();
  await programarEmails(env, id, 'agendou', AGORA);
  await processarFila(env, { reuniaoId: id, t: AGORA });
  assert.equal(pm.envios.length, 1);
  const e = pm.envios[0];
  assert.equal(e.MessageStream, 'outbound');
  assert.equal(e.To, 'ana@empresa.com');
  assert.equal(e.Subject, 'Sua reunião está confirmada, Ana');
  assert.equal(e.Tag, 'agenda-confirmacao');
  assert.match(e.HtmlBody, /href="https:\/\/meet\.google\.com\/abc-defg-hij"/);
  assert.match(e.HtmlBody, /href="https:\/\/atacadoexponencial\.com\/reuniao\/tok-r\d+"/);
  const envio = db.prepare('SELECT origem, ref_id, situacao FROM email_envios').get();
  assert.deepEqual({ ...envio }, { origem: 'agenda', ref_id: id, situacao: 'enviado' });
  const f = fila(id);
  assert.deepEqual(f.map((x) => [x.evento, x.situacao]), [['confirmacao', 'enviado'], ['lembrete', 'pendente'], ['lembrete', 'pendente']]);
  const r = db.prepare('SELECT inicio FROM agenda_reunioes WHERE id = ?').get(id);
  assert.deepEqual(f.slice(1).map((x) => x.enviar_em), [r.inicio - 1440 * 60, r.inicio - 3600]);
});

test('valores da reunião: data e hora de Brasília, primeiro nome, links', () => {
  // 07/10/2026 15:00 em Brasília = 18:00 UTC
  const inicio = Date.UTC(2026, 9, 7, 18, 0) / 1000;
  const v = valoresDaReuniao({ nome: ' Ana  Lima ', email: 'a@x.com', inicio, meet_link: 'https://meet.google.com/x', token_gestao: 't' }, { nome: 'Sessão estratégica' });
  assert.deepEqual(v, {
    nome: 'Ana  Lima', primeiro_nome: 'Ana', email: 'a@x.com', tipo_reuniao: 'Sessão estratégica',
    data_reuniao: 'quarta, 07/10', hora_reuniao: '15:00', link_reuniao: 'https://meet.google.com/x',
    link_remarcar: 'https://atacadoexponencial.com/reuniao/t',
  });
});

test('em cima da hora: lembretes viram "não enviado" com o motivo', async () => {
  const id = reuniao({ inicio: AGORA + 1800 });
  await programarEmails(env, id, 'agendou', AGORA);
  const lembretes = fila(id).filter((x) => x.evento === 'lembrete');
  assert.deepEqual(lembretes.map((x) => [x.situacao, x.motivo]), [
    ['pulado', 'O horário do lembrete já tinha passado.'], ['pulado', 'O horário do lembrete já tinha passado.'],
  ]);
});

test('e-mail desligado no tipo não é programado; desligado depois vira "não enviado"', async () => {
  const cfg = (await dash(emailsApi, null, '&tipo=1')).corpo.emails;
  await dash(emailsApi, { acao: 'salvar', id: cfg[0].id, ligado: false });
  const id = reuniao();
  await programarEmails(env, id, 'agendou', AGORA);
  await processarFila(env, { reuniaoId: id, t: AGORA });
  assert.equal(pm.envios.length, 0);
  assert.ok(!fila(id).some((x) => x.evento === 'confirmacao'));
  // Desliga o lembrete de 24 h depois de programado.
  await dash(emailsApi, { acao: 'salvar', id: cfg[1].id, ligado: false });
  const l24 = fila(id).find((x) => x.antes_min === 1440);
  await processarFila(env, { t: l24.enviar_em });
  assert.equal(fila(id).find((x) => x.antes_min === 1440).motivo, 'Desligado em Agenda › E-mails.');
  // Tira o lembrete de 1 h depois de programado.
  await dash(emailsApi, { acao: 'tirar_lembrete', id: cfg[2].id });
  const l1 = fila(id).find((x) => x.antes_min === 60);
  await processarFila(env, { t: l1.enviar_em });
  assert.equal(fila(id).find((x) => x.antes_min === 60).motivo, 'Lembrete tirado em Agenda › E-mails.');
  assert.equal(pm.envios.length, 0);
});

test('lembrete sai na hora pela rodada; reunião cancelada por fora não recebe', async () => {
  const a = reuniao();
  const b = reuniao({ email: 'bia@empresa.com' });
  for (const id of [a, b]) await programarEmails(env, id, 'agendou', AGORA);
  await processarFila(env, { t: AGORA });
  assert.equal(pm.envios.length, 2);
  db.prepare("UPDATE agenda_reunioes SET situacao = 'cancelada' WHERE id = ?").run(b);
  const hora = fila(a).find((x) => x.antes_min === 1440).enviar_em;
  // Antes da hora: nada.
  await processarFila(env, { t: hora - 60 });
  assert.equal(pm.envios.length, 2);
  await processarFila(env, { t: hora });
  assert.equal(pm.envios.length, 3);
  assert.equal(pm.envios[2].To, 'ana@empresa.com');
  assert.equal(pm.envios[2].Subject, 'Amanhã: sua Sessão estratégica');
  assert.equal(fila(b).find((x) => x.antes_min === 1440).motivo, 'Reunião cancelada.');
});

test('remarcou: lembretes antigos pulados, novos programados, remarcação enviada', async () => {
  const id = reuniao();
  await programarEmails(env, id, 'agendou', AGORA);
  const antigo = db.prepare('SELECT inicio FROM agenda_reunioes WHERE id = ?').get(id).inicio;
  const novo = antigo + 2 * DIA;
  db.prepare("UPDATE agenda_reunioes SET inicio = ?, fim = ?, situacao = 'remarcada' WHERE id = ?").run(novo, novo + 2700, id);
  await programarEmails(env, id, 'remarcou', AGORA + 10);
  await processarFila(env, { reuniaoId: id, t: AGORA + 10 });
  const f = fila(id);
  assert.deepEqual(f.filter((x) => x.inicio_ref === antigo && x.evento === 'lembrete').map((x) => x.motivo), ['Reunião remarcada.', 'Reunião remarcada.']);
  assert.deepEqual(f.filter((x) => x.inicio_ref === novo && x.evento === 'lembrete').map((x) => x.situacao), ['pendente', 'pendente']);
  assert.equal(f.find((x) => x.evento === 'remarcacao').situacao, 'enviado');
  assert.match(pm.envios.at(-1).Subject, /^Novo horário: /);
});

test('cancelou: nada pendente fica, cancelamento enviado', async () => {
  const id = reuniao();
  await programarEmails(env, id, 'agendou', AGORA);
  db.prepare("UPDATE agenda_reunioes SET situacao = 'cancelada' WHERE id = ?").run(id);
  await programarEmails(env, id, 'cancelou', AGORA + 10);
  await processarFila(env, { reuniaoId: id, t: AGORA + 10 });
  const f = fila(id);
  assert.ok(!f.some((x) => x.situacao === 'pendente'));
  assert.equal(f.find((x) => x.evento === 'cancelamento').situacao, 'enviado');
  assert.equal(pm.envios.at(-1).Subject, 'Sua reunião foi cancelada');
});

test('duas rodadas ao mesmo tempo mandam uma vez só', async () => {
  const id = reuniao();
  await programarEmails(env, id, 'agendou', AGORA);
  await Promise.all([processarFila(env, { t: AGORA }), processarFila(env, { t: AGORA }), processarFila(env, { reuniaoId: id, t: AGORA })]);
  assert.equal(pm.envios.length, 1);
});

test('recusa do serviço: falhou com o motivo, sem nova tentativa', async () => {
  pm.recusar = 406;
  const id = reuniao();
  await programarEmails(env, id, 'agendou', AGORA);
  await processarFila(env, { t: AGORA });
  const c = fila(id)[0];
  assert.equal(c.situacao, 'falhou');
  assert.match(c.motivo, /Endereço inativo/);
  pm.recusar = null;
  await processarFila(env, { t: AGORA + 300 });
  assert.equal(pm.envios.length, 0);
});

test('sem resposta: tenta de novo e desiste na terceira', async () => {
  pm.foraDoAr = true;
  const id = reuniao();
  await programarEmails(env, id, 'agendou', AGORA);
  await processarFila(env, { reuniaoId: id, t: AGORA });
  assert.deepEqual([fila(id)[0].situacao, fila(id)[0].tentativas], ['pendente', 1]);
  await processarFila(env, { reuniaoId: id, t: AGORA + 300 });
  await processarFila(env, { reuniaoId: id, t: AGORA + 600 });
  assert.deepEqual([fila(id)[0].situacao, fila(id)[0].motivo], ['falhou', 'O serviço de envio não respondeu em três tentativas.']);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_envios').get().n, 0);
});

test('reserva parada há mais de 10 minutos volta para a fila', async () => {
  const id = reuniao();
  await programarEmails(env, id, 'agendou', AGORA);
  db.prepare("UPDATE agenda_emails_fila SET situacao = 'enviando', atualizado_em = ? WHERE evento = 'confirmacao'").run(AGORA - 700);
  await processarFila(env, { t: AGORA });
  assert.equal(fila(id)[0].situacao, 'enviado');
});

test('detalhe do agendamento traz os e-mails com a situação de entrega', async () => {
  const id = reuniao();
  await programarEmails(env, id, 'agendou', AGORA);
  await processarFila(env, { t: AGORA });
  db.prepare("UPDATE email_envios SET situacao = 'aberto'").run();
  const r = await dash(reunioes, null, `&id=${id}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo.emails.map((e) => [e.nome, e.situacao]), [
    ['Confirmação', 'aberto'], ['Lembrete 24 h antes', 'agendado'], ['Lembrete 1 h antes', 'agendado'],
  ]);
});

test('voltou e falhou entram no aviso, sem e-mail do lead', async () => {
  const a = reuniao();
  await programarEmails(env, a, 'agendou', AGORA);
  await processarFila(env, { t: AGORA });
  db.prepare("UPDATE email_envios SET situacao = 'voltou', voltou_em = ?").run(AGORA);
  pm.recusar = 406;
  const b = reuniao({ tipo: 2, email: 'c@x.com' });
  await programarEmails(env, b, 'agendou', AGORA);
  await processarFila(env, { t: AGORA });
  const itens = await falhasRecentes(env, AGORA + 60);
  assert.equal(itens.length, 2);
  assert.ok(itens.some((i) => /^Confirmação · Sessão estratégica · .*: voltou$/.test(i)));
  assert.ok(itens.some((i) => /^Confirmação · Entrevista RH · .*: Endereço inativo/.test(i)));
  assert.ok(itens.every((i) => !/@/.test(i)));
  assert.deepEqual(await falhasRecentes(env, AGORA + 2 * DIA), []);
});

test('modelo usado na agenda não arquiva nem troca de canal', async () => {
  await dash(emailsApi, null, '&tipo=1');
  const m = db.prepare("SELECT id FROM email_modelos WHERE nome = 'Confirmação de reunião'").get();
  assert.deepEqual(await usosNaAgenda(env, m.id), ['confirmação da agenda (Sessão estratégica)']);
  const r = await dash(modelosApi, { acao: 'arquivar', id: m.id });
  assert.equal(r.status, 409);
  assert.match(r.corpo.error, /Este modelo está em uso em: confirmação da agenda \(Sessão estratégica\)/);
});

test('configuração pelo dash: modelo inválido, lembrete repetido, fora da lista, tirar só lembrete', async () => {
  const cfg = (await dash(emailsApi, null, '&tipo=1')).corpo.emails;
  const mkt = db.prepare("INSERT INTO email_modelos (nome, canal, assunto, corpo, criado_em, atualizado_em) VALUES ('Mkt', 'marketing', 'a', 'b', 0, 0)").run();
  let r = await dash(emailsApi, { acao: 'salvar', id: cfg[0].id, modelo_id: Number(mkt.lastInsertRowid) });
  assert.equal(r.status, 400);
  assert.match(r.corpo.error, /transacional/);
  r = await dash(emailsApi, { acao: 'adicionar_lembrete', tipo_id: 1, antes_min: 1440 });
  assert.equal(r.status, 409);
  assert.equal((await dash(emailsApi, { acao: 'adicionar_lembrete', tipo_id: 1, antes_min: 45 })).status, 400);
  r = await dash(emailsApi, { acao: 'adicionar_lembrete', tipo_id: 1, antes_min: 30 });
  assert.equal(r.status, 200);
  assert.ok(r.corpo.emails.some((e) => e.nome === 'Lembrete 30 min antes'));
  assert.equal((await dash(emailsApi, { acao: 'tirar_lembrete', id: cfg[0].id })).status, 400);
  // Trocar o modelo de um e-mail: vale o novo.
  const lembrete1h = db.prepare("SELECT id FROM email_modelos WHERE nome = 'Lembrete 1h antes'").get().id;
  r = await dash(emailsApi, { acao: 'salvar', id: cfg[0].id, modelo_id: lembrete1h });
  assert.equal(r.corpo.emails[0].modelo_id, lembrete1h);
});

test('rodada periódica: exige o segredo e manda o que chegou na hora', async () => {
  const sem = await syncEmail.onRequestPost({ request: new Request('https://x', { method: 'POST' }), env });
  assert.equal(sem.status, 401);
  const id = reuniao();
  await programarEmails(env, id, 'agendou', AGORA);
  const r = await syncEmail.onRequestPost({ request: new Request('https://x', { method: 'POST', headers: { 'x-sync-secret': 's' } }), env });
  const corpo = await r.json();
  assert.equal(corpo.ok, true);
  assert.equal(corpo.enviados, 1);
});
