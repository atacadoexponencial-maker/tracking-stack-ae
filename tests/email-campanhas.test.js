// Campanhas (issues 382 e 383) contra SQLite real (migrations 0050, 0051, 0053–0055)
// e um Postmark simulado (fetch trocado) que aceita /email/batch.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import * as campApi from '../functions/api/email/campanhas.js';
import * as segApi from '../functions/api/email/segmentos.js';
import * as syncCamp from '../functions/api/sync/email-campanhas.js';
import * as webhook from '../functions/api/webhooks/postmark.js';
import { registrarLead, aplicarResultado } from '../functions/api/_email-contatos.js';
import { processarEnvio, processarAgendadas, LIMITE_MES } from '../functions/api/_email-campanhas.js';
import * as modelosApi from '../functions/api/email/modelos.js';
import { ymdBrt } from '../functions/api/_data-brt.js';

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
  const estado = { lotes: [], recusarLote: null, recusarPara: new Set(), foraDoAr: false, n: 0 };
  const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  estado.fetch = async (url, op = {}) => {
    const u = new URL(String(url));
    if (estado.foraDoAr) throw new TypeError('fetch failed');
    if (u.pathname === '/email/batch') {
      const msgs = JSON.parse(op.body);
      if (estado.recusarLote) return resp({ ErrorCode: estado.recusarLote, Message: 'x' }, 422);
      estado.lotes.push(msgs);
      return resp(msgs.map((m) => (estado.recusarPara.has(m.To)
        ? { ErrorCode: 406, Message: 'inactive', To: m.To }
        : { ErrorCode: 0, Message: 'OK', MessageID: `msg-${++estado.n}`, To: m.To })));
    }
    throw new Error('fetch inesperado: ' + u);
  };
  return estado;
}

const AGORA = Math.floor(Date.now() / 1000);

beforeEach(async () => {
  db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE lead_dispatch (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, email TEXT, task_id TEXT);
    CREATE TABLE crm_status_log (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, status TEXT NOT NULL, recebido_em INTEGER NOT NULL, hist_id TEXT, hist_date INTEGER);
  `);
  for (const f of ['0050_email.sql', '0051_email_modelos.sql', '0053_email_contatos.sql', '0054_email_segmentos.sql', '0055_email_campanhas.sql', '0056_email_campanhas_agendadas.sql']) {
    db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  }
  db.prepare(`INSERT INTO email_modelos (id, nome, canal, assunto, previa, corpo, arquivado, criado_em, atualizado_em) VALUES
    (1, 'Convite', 'marketing', 'Oi, {{primeiro_nome}}', 'Workshop', 'Oi, {{primeiro_nome}}!\n\n[[Quero | https://atacadoexponencial.com]]', 0, 0, 0),
    (2, 'Confirmação', 'transacional', 'a', '', 'b', 0, 0, 0),
    (3, 'Sem nome', 'marketing', 'Novidade', '', 'Tem novidade.', 0, 0, 0)`).run();
  env = { DB: d1(db), DASH_KEY: 'k', SYNC_SECRET: 's', POSTMARK_SERVER_TOKEN: 'srv', POSTMARK_WEBHOOK_USER: 'u', POSTMARK_WEBHOOK_PASS: 'p' };
  pm = postmarkFalso();
  globalThis.fetch = pm.fetch;
});

async function contatos(lista) {
  for (const [email, nome, funil] of lista) await registrarLead(env, { email, nome, funil, origem: 'bio', eventId: email + funil, quando: AGORA - 100 });
}
const api = (mod, corpo, qs = '') => (corpo
  ? mod.onRequestPost({ request: new Request(`https://x/api?key=k${qs}`, { method: 'POST', body: JSON.stringify(corpo) }), env })
  : mod.onRequestGet({ request: new Request(`https://x/api?key=k${qs}`), env })).then(async (r) => ({ status: r.status, corpo: await r.json() }));
const camp = (corpo, qs) => api(campApi, corpo, qs);
async function segmento(nome, funil) {
  const r = await api(segApi, { acao: 'salvar', nome, regras: [{ campo: 'funil', op: 'e', valor: funil }] });
  return r.corpo.segmento.id;
}
async function rascunho(segs, modelo = 1) {
  const r = await camp({ acao: 'salvar', nome: 'Convite outubro', modelo_id: modelo, segmentos: segs });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  return r.corpo.campanha.id;
}
const dest = (id) => db.prepare('SELECT email, situacao, motivo FROM email_campanha_destinatarios WHERE campanha_id = ? ORDER BY email').all(id);

test('rascunho: nome obrigatório; só modelo de marketing; segmento precisa existir', async () => {
  assert.equal((await camp({ acao: 'salvar', nome: '' })).status, 400);
  assert.equal((await camp({ acao: 'salvar', nome: 'x', modelo_id: 2 })).status, 400);
  assert.equal((await camp({ acao: 'salvar', nome: 'x', segmentos: [99] })).status, 400);
  const r = await camp({ acao: 'salvar', nome: 'Só nome' });
  assert.equal(r.corpo.campanha.situacao, 'rascunho');
  const e = await camp({ acao: 'salvar', id: r.corpo.campanha.id, nome: 'Outro nome', modelo_id: 1 });
  assert.equal(e.corpo.campanha.nome, 'Outro nome');
});

test('resumo: soma sem repetir, quem fica de fora por quê, sem nome e limite', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop'], ['ana@x.com', '', 'sessao'], ['bia@x.com', '', 'workshop'], ['caio@x.com', 'Caio', 'sessao'],
    ['dani@x.com', 'Dani', 'workshop'], ['edu@x.com', 'Edu', 'workshop'], ['ruim', '', 'workshop']]);
  await aplicarResultado(env, 'dani@x.com', 'descadastrou', AGORA);
  await aplicarResultado(env, 'edu@x.com', 'voltou', AGORA);
  const s1 = await segmento('Workshop', 'workshop');
  const s2 = await segmento('Sessão', 'sessao');
  const r = await camp({ acao: 'resumo', modelo_id: 1, segmentos: [s1, s2] });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.equal(r.corpo.recebem, 3);
  assert.equal(r.corpo.em_dois, 1);
  assert.deepEqual(r.corpo.fora, { descadastrado: 1, voltou: 1, denunciou: 0, invalido: 1 });
  assert.equal(r.corpo.sem_nome, 1);
  assert.equal(r.corpo.uso.limite, LIMITE_MES);
  assert.equal(r.corpo.bloqueio, null);
  assert.equal((await camp({ acao: 'resumo', modelo_id: 3, segmentos: [s1] })).corpo.sem_nome, 0, 'modelo sem campo de nome');
});

test('resumo: último teste do modelo, e se veio antes da última mudança', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop']]);
  const s = await segmento('Workshop', 'workshop');
  assert.equal((await camp({ acao: 'resumo', modelo_id: 1, segmentos: [s] })).corpo.ultimo_teste, null, 'sem teste');
  db.prepare("UPDATE email_modelos SET atualizado_em = 100 WHERE id = 1").run();
  const ins = db.prepare("INSERT INTO email_envios (message_id, canal, origem, ref_id, destinatario, situacao, enviado_em) VALUES (?, 'marketing', 'teste', ?, ?, 'enviado', ?)");
  ins.run('t1', 'modelo:1', 'eu@x.com', 50);
  ins.run('t2', 'modelo:3', 'outro@x.com', 500);
  let t = (await camp({ acao: 'resumo', modelo_id: 1, segmentos: [s] })).corpo.ultimo_teste;
  assert.deepEqual(t, { para: 'eu@x.com', em: 50, antes_da_mudanca: true }, 'teste de outro modelo não conta');
  ins.run('t3', 'modelo:1', 'eu@x.com', 200);
  t = (await camp({ acao: 'resumo', modelo_id: 1, segmentos: [s] })).corpo.ultimo_teste;
  assert.deepEqual(t, { para: 'eu@x.com', em: 200, antes_da_mudanca: false });
});

test('bloqueios: marketing não liberado, lista vazia, limite do mês e modelo inválido', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop']]);
  const s = await segmento('Workshop', 'workshop');
  const vazio = await segmento('Ninguém', 'nada');
  db.prepare("UPDATE email_config SET valor = '0' WHERE chave = 'marketing_liberado'").run();
  let r = await camp({ acao: 'resumo', modelo_id: 1, segmentos: [s] });
  assert.match(r.corpo.bloqueio, /não liberado/);
  db.prepare("UPDATE email_config SET valor = '1' WHERE chave = 'marketing_liberado'").run();
  r = await camp({ acao: 'resumo', modelo_id: 1, segmentos: [vazio] });
  assert.match(r.corpo.bloqueio, /Nenhum contato ativo/);
  const ins = db.prepare("INSERT INTO email_envios (canal, origem, destinatario, situacao, message_id, enviado_em) VALUES ('transacional', 'agenda', 'x@x.com', 'entregue', ?, ?)");
  for (let i = 0; i < LIMITE_MES; i++) ins.run(`m${i}`, AGORA);
  r = await camp({ acao: 'resumo', modelo_id: 1, segmentos: [s] });
  assert.match(r.corpo.bloqueio, /restam 0 e-mails no mês/);
  const id = await rascunho([s]);
  assert.equal((await camp({ acao: 'disparar', id })).status, 409);
  assert.equal(pm.lotes.length, 0);
  db.prepare("UPDATE email_modelos SET corpo = 'Oi {{nmoe}}' WHERE id = 1").run();
  assert.equal((await camp({ acao: 'resumo', modelo_id: 1, segmentos: [s] })).status, 400);
});

test('disparo: uma vez só, quem está em dois segmentos recebe uma vez, campos e descadastro no e-mail', async () => {
  await contatos([['ana@x.com', 'Ana Lima', 'workshop'], ['ana@x.com', '', 'sessao'], ['caio@x.com', 'Caio', 'sessao']]);
  const id = await rascunho([await segmento('Workshop', 'workshop'), await segmento('Sessão', 'sessao')]);
  const r = await camp({ acao: 'disparar', id });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const de2 = await camp({ acao: 'disparar', id });
  assert.equal(de2.status, 409);
  assert.match(de2.corpo.error, /já foi disparada/);
  assert.equal(pm.lotes.length, 1);
  const msgs = pm.lotes[0];
  assert.deepEqual(msgs.map((m) => m.To).sort(), ['ana@x.com', 'caio@x.com']);
  const ana = msgs.find((m) => m.To === 'ana@x.com');
  assert.equal(ana.Subject, 'Oi, Ana');
  assert.equal(ana.MessageStream, 'broadcast');
  assert.equal(ana.Tag, `campanha-${id}`);
  assert.ok(ana.HtmlBody.includes('{{{ pm:unsubscribe }}}'));
  assert.equal(ana.From, '"Felipe Santos | Atacado Exponencial" <felipe@news.atacadoexponencial.com>');
  const c = (await camp(null, `&id=${id}`)).corpo.campanha;
  assert.deepEqual([c.situacao, c.total, c.enviados, c.falhas, c.percentual, c.assunto], ['enviada', 2, 2, 0, 100, 'Oi, {{primeiro_nome}}']);
  const envios = db.prepare("SELECT destinatario, situacao, ref_id, message_id FROM email_envios WHERE origem = 'campanha' ORDER BY destinatario").all();
  assert.deepEqual(envios.map((e) => [e.destinatario, e.situacao, e.ref_id]), [['ana@x.com', 'enviado', String(id)], ['caio@x.com', 'enviado', String(id)]]);
  // O webhook liga o aberto à pessoa; a campanha passa a valer em "abriu".
  const auth = 'Basic ' + btoa('u:p');
  await webhook.onRequestPost({ request: new Request('https://x/api/webhooks/postmark', { method: 'POST', headers: { Authorization: auth }, body: JSON.stringify({ RecordType: 'Open', MessageID: envios[0].message_id, ReceivedAt: '2026-10-03T14:05:00Z' }) }), env });
  assert.equal(db.prepare("SELECT situacao FROM email_envios WHERE destinatario = 'ana@x.com'").get().situacao, 'aberto');
  const op = (await api(segApi)).corpo.opcoes.campanhas;
  assert.deepEqual(op.map((x) => x.nome), ['Convite outubro']);
  const ab = await api(segApi, { acao: 'previa', regras: [{ campo: 'abriu', op: 'sim', valor: String(id) }] });
  assert.equal(ab.corpo.ativos, 1);
});

test('destinatário recusado vira falha só dele; o resto segue', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop'], ['bia@x.com', 'Bia', 'workshop']]);
  pm.recusarPara.add('bia@x.com');
  const id = await rascunho([await segmento('W', 'workshop')]);
  await camp({ acao: 'disparar', id });
  assert.deepEqual(dest(id).map((d) => d.situacao), ['enviado', 'falhou']);
  assert.match(dest(id)[1].motivo, /Endereço inativo/);
  const c = (await camp(null, `&id=${id}`)).corpo.campanha;
  assert.deepEqual([c.situacao, c.enviados, c.falhas], ['enviada', 1, 1]);
});

test('lote recusado inteiro: campanha "falhou" com o motivo e nada mais sai', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop']]);
  pm.recusarLote = 405;
  const id = await rascunho([await segmento('W', 'workshop')]);
  await camp({ acao: 'disparar', id });
  const c = (await camp(null, `&id=${id}`)).corpo.campanha;
  assert.equal(c.situacao, 'falhou');
  assert.match(c.motivo, /sem créditos/);
  assert.deepEqual(dest(id).map((d) => d.situacao), ['nao_enviado']);
});

test('sem resposta: lote fica "não confirmado", não é reenviado, campanha avisa', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop']]);
  pm.foraDoAr = true;
  const id = await rascunho([await segmento('W', 'workshop')]);
  await camp({ acao: 'disparar', id });
  pm.foraDoAr = false;
  await processarEnvio(env);
  assert.equal(pm.lotes.length, 0);
  const c = (await camp(null, `&id=${id}`)).corpo.campanha;
  assert.equal(c.situacao, 'falhou');
  assert.match(c.motivo, /1 destinatários ficaram sem confirmação/);
  assert.equal(dest(id)[0].situacao, 'nao_confirmado');
});

test('lotes: mais de 100 pessoas saem em partes e a rodada continua', async () => {
  const lista = Array.from({ length: 250 }, (_, i) => [`p${String(i).padStart(3, '0')}@x.com`, `P${i}`, 'workshop']);
  await contatos(lista);
  const id = await rascunho([await segmento('W', 'workshop')]);
  await camp({ acao: 'disparar', id }); // 3 lotes no disparo (300)
  let c = (await camp(null, `&id=${id}`)).corpo.campanha;
  assert.deepEqual([c.situacao, c.enviados, pm.lotes.length], ['enviada', 250, 3]);
  assert.equal(new Set(pm.lotes.flat().map((m) => m.To)).size, 250);
  // Uma campanha maior que o disparo: a rodada termina.
  const mais = Array.from({ length: 150 }, (_, i) => [`q${String(i).padStart(3, '0')}@x.com`, `Q${i}`, 'sessao']);
  await contatos(mais);
  const s2 = await segmento('S', 'sessao');
  const id2 = await rascunho([s2]);
  // Dispara sem processar (simula a função encerrada logo depois).
  const { disparar } = await import('../functions/api/_email-campanhas.js');
  await disparar(env, id2);
  c = (await camp(null, `&id=${id2}`)).corpo.campanha;
  assert.deepEqual([c.situacao, c.percentual], ['enviando', 0]);
  const s = await syncCamp.onRequestPost({ request: new Request('https://x', { method: 'POST', headers: { 'x-sync-secret': 's' } }), env });
  assert.equal((await s.json()).ok, true);
  c = (await camp(null, `&id=${id2}`)).corpo.campanha;
  assert.deepEqual([c.situacao, c.enviados], ['enviada', 150]);
});

test('reserva parada há mais de 10 minutos vira "não confirmado"', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop'], ['bia@x.com', 'Bia', 'workshop']]);
  const id = await rascunho([await segmento('W', 'workshop')]);
  const { disparar } = await import('../functions/api/_email-campanhas.js');
  await disparar(env, id);
  db.prepare("UPDATE email_campanha_destinatarios SET situacao = 'enviando', lote = 'velho', atualizado_em = ? WHERE email = 'ana@x.com'").run(AGORA - 700);
  await processarEnvio(env);
  assert.deepEqual(dest(id).map((d) => d.situacao), ['nao_confirmado', 'enviado']);
  assert.equal((await camp(null, `&id=${id}`)).corpo.campanha.situacao, 'falhou');
});

test('lista com filtro, duplicar e excluir só rascunho', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop']]);
  const id = await rascunho([await segmento('W', 'workshop')]);
  await camp({ acao: 'disparar', id });
  const d = await camp({ acao: 'duplicar', id });
  assert.deepEqual([d.corpo.campanha.nome, d.corpo.campanha.situacao], ['Cópia de Convite outubro', 'rascunho']);
  assert.equal((await camp({ acao: 'excluir', id })).status, 409);
  assert.equal((await camp({ acao: 'salvar', id, nome: 'x' })).status, 409);
  let l = await camp(null);
  assert.deepEqual(l.corpo.por_situacao, { enviada: 1, rascunho: 1 });
  assert.equal(l.corpo.opcoes.modelos.length, 2);
  assert.equal(l.corpo.opcoes.segmentos[0].ativos, 1);
  l = await camp(null, '&situacao=rascunho');
  assert.equal(l.corpo.campanhas.length, 1);
  assert.equal((await camp({ acao: 'excluir', id: d.corpo.campanha.id })).status, 200);
  assert.equal((await camp(null, '&id=999')).status, 404);
});

// ---------------------------------------------------------------------------
// 383 · Agendadas
// ---------------------------------------------------------------------------

/** Dia e hora de Brasília daqui a `seg` segundos. */
function daquiA(seg) {
  const t = AGORA + seg;
  const hm = new Date(t * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return { dia: ymdBrt(t), hora: hm };
}
const situacao = (id) => db.prepare('SELECT situacao, agendada_para, motivo FROM email_campanhas WHERE id = ?').get(id);

test('agendar: horário de Brasília, pelo menos 5 minutos e até 90 dias', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop']]);
  const id = await rascunho([await segmento('W', 'workshop')]);
  assert.equal((await camp({ acao: 'agendar', id, ...daquiA(60) })).status, 400);
  assert.equal((await camp({ acao: 'agendar', id, ...daquiA(100 * 86400) })).status, 400);
  assert.equal((await camp({ acao: 'agendar', id, dia: '2026-13-01', hora: '09:00' })).status, 400);
  assert.equal((await camp({ acao: 'agendar', id, dia: ymdBrt(AGORA + 86400), hora: '25:00' })).status, 400);
  const ok = await camp({ acao: 'agendar', id, ...daquiA(3600) });
  assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
  assert.equal(ok.corpo.campanha.situacao, 'agendada');
  // 12:00 em Brasília = 15:00 UTC
  const id2 = await rascunho([await segmento('W2', 'workshop')]);
  const dia = ymdBrt(AGORA + 2 * 86400);
  await camp({ acao: 'agendar', id: id2, dia, hora: '12:00' });
  assert.equal(situacao(id2).agendada_para, Date.parse(`${dia}T15:00:00Z`) / 1000);
  assert.equal((await camp({ acao: 'agendar', id, ...daquiA(7200) })).status, 409, 'agendada não agenda de novo');
});

test('editar e cancelar antes do horário; depois de começar, recusa', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop']]);
  const s = await segmento('W', 'workshop');
  const id = await rascunho([s]);
  await camp({ acao: 'agendar', id, ...daquiA(3600) });
  const e = await camp({ acao: 'salvar', id, nome: 'Convite novo', modelo_id: 3, segmentos: [s], ...daquiA(7200) });
  assert.equal(e.status, 200, JSON.stringify(e.corpo));
  assert.deepEqual([e.corpo.campanha.nome, e.corpo.campanha.modelo_id, e.corpo.campanha.situacao], ['Convite novo', 3, 'agendada']);
  assert.equal((await camp({ acao: 'salvar', id, nome: 'x', modelo_id: null, segmentos: [s] })).status, 400, 'agendada precisa de modelo');
  const outra = await rascunho([s]);
  await camp({ acao: 'agendar', id: outra, ...daquiA(3600) });
  const c = await camp({ acao: 'cancelar', id: outra });
  assert.equal(c.corpo.campanha.situacao, 'cancelada');
  assert.equal((await camp({ acao: 'cancelar', id: outra })).status, 409);
  assert.equal((await camp({ acao: 'excluir', id: outra })).status, 409, 'cancelada fica no histórico');
  // Começou a sair: editar e cancelar são recusados.
  await processarAgendadas(env, AGORA + 7300);
  assert.equal(situacao(id).situacao, 'enviando');
  assert.equal((await camp({ acao: 'cancelar', id })).status, 409);
  assert.equal((await camp({ acao: 'salvar', id, nome: 'y', modelo_id: 1, segmentos: [s] })).status, 409);
});

test('rodada: sai no horário com a lista recalculada, uma vez só', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop'], ['bia@x.com', 'Bia', 'workshop']]);
  const id = await rascunho([await segmento('W', 'workshop')]);
  await camp({ acao: 'agendar', id, ...daquiA(600) });
  assert.equal(await processarAgendadas(env, AGORA + 60), 0, 'antes do horário: nada');
  // Entre o agendamento e o horário: entra um contato, outro se descadastra.
  await contatos([['caio@x.com', 'Caio', 'workshop']]);
  await aplicarResultado(env, 'bia@x.com', 'descadastrou', AGORA);
  const para = situacao(id).agendada_para;
  const [a, b] = await Promise.all([processarAgendadas(env, para), processarAgendadas(env, para)]);
  assert.equal(a + b, 1);
  await processarEnvio(env, { t: para });
  assert.deepEqual(pm.lotes.flat().map((m) => m.To).sort(), ['ana@x.com', 'caio@x.com']);
  assert.equal(situacao(id).situacao, 'enviada');
  // A rodada pela rota faz as duas coisas.
  const outra = await rascunho([await segmento('W2', 'workshop')]);
  await camp({ acao: 'agendar', id: outra, ...daquiA(600) });
  db.prepare('UPDATE email_campanhas SET agendada_para = ? WHERE id = ?').run(AGORA - 1, outra);
  const r = await syncCamp.onRequestPost({ request: new Request('https://x', { method: 'POST', headers: { 'x-sync-secret': 's' } }), env });
  const corpo = await r.json();
  assert.equal(corpo.agendadas, 1);
  assert.equal(situacao(outra).situacao, 'enviada');
});

test('bloqueio na hora de sair vira "falhou" com o motivo e nada sai', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop']]);
  const id = await rascunho([await segmento('W', 'workshop')]);
  db.prepare("UPDATE email_config SET valor = '0' WHERE chave = 'marketing_liberado'").run();
  const r = await camp({ acao: 'agendar', id, ...daquiA(600) });
  assert.equal(r.status, 200, 'dá para agendar sem o marketing liberado');
  await processarAgendadas(env, situacao(id).agendada_para);
  const c = situacao(id);
  assert.equal(c.situacao, 'falhou');
  assert.match(c.motivo, /Não saiu no horário: .*não liberado/);
  assert.equal(pm.lotes.length, 0);
});

test('travas: modelo e segmento usados em campanha agendada', async () => {
  await contatos([['ana@x.com', 'Ana', 'workshop']]);
  const s = await segmento('W', 'workshop');
  const id = await rascunho([s]);
  await camp({ acao: 'agendar', id, ...daquiA(3600) });
  const arq = await api(modelosApi, { acao: 'arquivar', id: 1 });
  assert.equal(arq.status, 409);
  assert.match(arq.corpo.error, /campanha agendada "Convite outubro"/);
  const exc = await api(segApi, { acao: 'excluir', id: s });
  assert.equal(exc.status, 409);
  assert.match(exc.corpo.error, /campanha agendada "Convite outubro"/);
  await camp({ acao: 'cancelar', id });
  assert.equal((await api(segApi, { acao: 'excluir', id: s })).status, 200);
});
