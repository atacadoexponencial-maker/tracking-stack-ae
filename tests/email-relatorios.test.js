// Relatório de campanha e visão do canal (issue 384) contra SQLite real
// (migrations 0050, 0051, 0053–0056). Envios e avisos entram direto no banco,
// do jeito que o disparo (382) e o webhook (377) gravam.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import * as relApi from '../functions/api/email/relatorios.js';
import { reputacao, recorte } from '../functions/api/_email-relatorios.js';
import { condicoesDasProtecoes } from '../functions/api/_saude-alertas.js';
import { ymdBrt, inicioDoDiaBrt } from '../functions/api/_data-brt.js';

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

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const f of ['0050_email.sql', '0051_email_modelos.sql', '0053_email_contatos.sql', '0054_email_segmentos.sql', '0055_email_campanhas.sql', '0056_email_campanhas_agendadas.sql', '0061_email_campanhas_conteudo.sql']) {
    db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  }
  env = { DB: d1(db), DASH_KEY: 'k' };
});

function campanha(nome, situacao = 'enviada', disparada = AGORA - 3600) {
  return Number(db.prepare(`INSERT INTO email_campanhas (nome, situacao, total, disparada_em, criado_em, atualizado_em) VALUES (?, ?, 0, ?, 0, 0)`).run(nome, situacao, disparada).lastInsertRowid);
}
let nMsg = 0;
/** Um envio: marcas = { entregue, aberto, clicado, voltou, spam, descad } (horários) ou null. */
function envio({ ref = null, origem = 'campanha', canal = 'marketing', email, enviado = AGORA - 3000, saiu = true, ...m }) {
  const r = db.prepare(`INSERT INTO email_envios (message_id, canal, origem, ref_id, destinatario, situacao, enviado_em, entregue_em, aberto_em, clicado_em, voltou_em, spam_em, descadastrou_em)
    VALUES (?, ?, ?, ?, ?, 'enviado', ?, ?, ?, ?, ?, ?, ?)`).run(saiu ? `m${++nMsg}` : null, canal, origem, ref == null ? null : String(ref), email, enviado,
    m.entregue ?? null, m.aberto ?? null, m.clicado ?? null, m.voltou ?? null, m.spam ?? null, m.descad ?? null);
  return Number(r.lastInsertRowid);
}
function evento(envioId, tipo, detalhe, ocorrido = AGORA) {
  db.prepare('INSERT INTO email_eventos (chave, envio_id, tipo, ocorrido_em, recebido_em, detalhe_json) VALUES (?, ?, ?, ?, ?, ?)')
    .run(`${tipo}|${envioId}|${ocorrido}|${Math.random()}`, envioId, tipo, ocorrido, ocorrido, JSON.stringify(detalhe));
}
const api = (qs) => relApi.onRequestGet({ request: new Request(`https://x/api?key=k${qs}`), env }).then(async (r) => ({ status: r.status, corpo: await r.json() }));

function cenarioCampanha() {
  const id = campanha('Convite');
  db.prepare('UPDATE email_campanhas SET total = 4 WHERE id = ?').run(id);
  db.prepare("INSERT INTO email_contatos (email, nome, situacao, entrou_em, atualizado_em) VALUES ('ana@x.com', 'Ana', 'ativo', 1, 1)").run();
  const ana = envio({ ref: id, email: 'Ana@x.com', entregue: 10, aberto: 20, clicado: 30 });
  const bia = envio({ ref: id, email: 'bia@x.com', entregue: 11, aberto: 25, descad: 40 });
  const caio = envio({ ref: id, email: 'caio@x.com', voltou: 12 });
  envio({ ref: id, email: 'davi@x.com', entregue: 13 });
  evento(ana, 'clicado', { link: 'https://atacadoexponencial.com/workshop' }, 30);
  evento(ana, 'clicado', { link: 'https://atacadoexponencial.com/workshop' }, 35);
  evento(ana, 'clicado', { link: 'https://instagram.com/x' }, 36);
  evento(caio, 'voltou', { tipo_devolucao: 'HardBounce' }, 12);
  // Envio de outra campanha não entra.
  envio({ ref: id + 1, email: 'ana@x.com', entregue: 1, aberto: 1 });
  return id;
}

test('relatório da campanha: números de pessoas únicas e taxas', async () => {
  const id = cenarioCampanha();
  const r = await api(`&campanha=${id}`);
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const c = r.corpo;
  assert.deepEqual([c.destinatarios, c.enviados, c.entregues, c.abertos, c.clicados, c.voltaram, c.spam, c.descadastros], [4, 4, 3, 2, 1, 1, 0, 1]);
  assert.equal(c.taxas.entrega, 0.75);
  assert.equal(c.taxas.abertura, 2 / 3);
  assert.equal(c.taxas.clique_sobre_abertura, 0.5);
  assert.equal(c.taxas.devolucao, 0.25);
  assert.deepEqual(c.links, [{ link: 'https://atacadoexponencial.com/workshop', pessoas: 1 }, { link: 'https://instagram.com/x', pessoas: 1 }]);
});

test('listas: quem abriu, clicou (com link), voltou (com motivo) e descadastrou; contato ligado', async () => {
  const id = cenarioCampanha();
  let r = await api(`&campanha=${id}&lista=abriram`);
  assert.deepEqual(r.corpo.pessoas.map((p) => p.email), ['bia@x.com', 'Ana@x.com']);
  assert.equal(r.corpo.total, 2);
  r = await api(`&campanha=${id}&lista=clicaram`);
  assert.deepEqual([r.corpo.pessoas[0].detalhe, r.corpo.pessoas[0].nome], ['https://atacadoexponencial.com/workshop', 'Ana']);
  assert.ok(r.corpo.pessoas[0].contato_id);
  r = await api(`&campanha=${id}&lista=voltaram`);
  assert.deepEqual([r.corpo.pessoas[0].email, r.corpo.pessoas[0].detalhe, r.corpo.pessoas[0].contato_id], ['caio@x.com', 'HardBounce', null]);
  r = await api(`&campanha=${id}&lista=descadastraram`);
  assert.deepEqual(r.corpo.pessoas.map((p) => p.email), ['bia@x.com']);
  assert.equal((await api(`&campanha=${id}&lista=todos`)).status, 400);
});

test('lista com página de 50', async () => {
  const id = campanha('Grande');
  for (let i = 0; i < 60; i++) envio({ ref: id, email: `p${i}@x.com`, entregue: 1, aberto: 100 + i });
  const p1 = await api(`&campanha=${id}&lista=abriram`);
  const p2 = await api(`&campanha=${id}&lista=abriram&pagina=2`);
  assert.deepEqual([p1.corpo.pessoas.length, p2.corpo.pessoas.length, p1.corpo.total], [50, 10, 60]);
});

test('campanha que não saiu não tem relatório; inexistente dá 404', async () => {
  const r = campanha('Rascunho', 'rascunho', null);
  assert.equal((await api(`&campanha=${r}`)).status, 409);
  assert.equal((await api('&campanha=999')).status, 404);
  const sem = campanha('Sem envios');
  const v = await api(`&campanha=${sem}`);
  assert.deepEqual([v.corpo.enviados, v.corpo.taxas.entrega, v.corpo.taxas.abertura], [0, null, null]);
});

test('visão do canal: período, testes fora das taxas, campanhas do período, uso do mês', async () => {
  const id = cenarioCampanha();
  envio({ origem: 'agenda', canal: 'transacional', email: 'r@x.com', entregue: 1 });
  envio({ origem: 'teste', canal: 'marketing', email: 'eu@x.com', voltou: 1 });
  envio({ origem: 'agenda', canal: 'transacional', email: 'velho@x.com', entregue: 1, enviado: AGORA - 200 * 86400 });
  envio({ origem: 'campanha', ref: id, email: 'falhou@x.com', saiu: false });
  const r = await api('&periodo=90');
  const v = r.corpo;
  assert.equal(v.enviados, 6, '4 da campanha + 1 da agenda + 1 da outra campanha; teste e antigo fora');
  assert.equal(v.taxas.devolucao, 1 / 6);
  assert.equal(v.canais.transacional.enviados, 1);
  assert.deepEqual(v.campanhas.map((c) => [c.nome, c.enviados, c.abertos]), [['Convite', 4, 2]]);
  assert.equal(v.taxas.descadastro, 1 / 4, 'descadastro só do marketing');
  assert.equal(v.uso.usados, 7, 'o limite conta o teste também');
  assert.equal(v.uso.por_canal.marketing, 6);
  assert.ok(v.uso.projecao >= v.uso.usados);
  const vazio = await api('&periodo=mes-passado');
  assert.deepEqual([vazio.corpo.enviados, vazio.corpo.taxas.entrega], [0, null]);
});

test('recorte do período em Brasília', () => {
  const t = Date.parse('2026-10-03T15:00:00Z') / 1000;
  assert.deepEqual(recorte('mes', t), { periodo: 'mes', de: inicioDoDiaBrt('2026-10-01'), ate: t + 1 });
  assert.deepEqual(recorte('mes-passado', t), { periodo: 'mes-passado', de: inicioDoDiaBrt('2026-09-01'), ate: inicioDoDiaBrt('2026-10-01') });
  assert.equal(recorte('90', t).de, t - 90 * 86400);
  assert.equal(ymdBrt(recorte('mes', t).de), '2026-10-01');
});

test('reputação: acima do limite com volume vira alerta; pouco volume não', async () => {
  for (let i = 0; i < 99; i++) envio({ email: `m${i}@x.com`, entregue: 1, spam: i === 0 ? 1 : null });
  let r = await reputacao(env);
  assert.deepEqual(r.itens, [], '99 e-mails: pouco volume');
  envio({ email: 'm99@x.com', entregue: 1 });
  r = await reputacao(env);
  assert.deepEqual(r.itens, ['Marketing: spam 1,00% nos últimos 30 dias (limite 0,10%)']);
  for (let i = 0; i < 120; i++) envio({ canal: 'transacional', origem: 'agenda', email: `t${i}@x.com`, voltou: i < 7 ? 1 : null });
  r = await reputacao(env);
  assert.ok(r.itens.some((i) => /^Transacional: devolução 5,8% nos últimos 30 dias/.test(i)));
  // Envio antigo (fora dos 30 dias) não conta.
  db.prepare('UPDATE email_envios SET enviado_em = ? WHERE canal = ?').run(AGORA - 40 * 86400, 'marketing');
  r = await reputacao(env);
  assert.ok(!r.itens.some((i) => i.startsWith('Marketing')));
});

test('alerta de reputação entra no aviso de integrações', async () => {
  // O aviso também lê credenciais e horários (migration 0042, que altera lead_dispatch).
  db.exec(`CREATE TABLE lead_dispatch (id INTEGER PRIMARY KEY, event_id TEXT, email TEXT, phone TEXT, funnel TEXT,
    resultado TEXT, task_id TEXT, task_url TEXT, erro TEXT, criado_em INTEGER, lead_json TEXT, tentativas INTEGER DEFAULT 0)`);
  db.exec(readFileSync(new URL('../migrations/0041_meta_envios.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0042_protecoes_integracoes.sql', import.meta.url), 'utf8'));
  for (let i = 0; i < 100; i++) envio({ email: `m${i}@x.com`, entregue: 1, spam: i < 2 ? 1 : null });
  const c = await condicoesDasProtecoes(env, AGORA);
  assert.ok(c.condicoes.includes('email_reputacao'));
  assert.deepEqual(c.itens.email_reputacao, ['Marketing: spam 2,00% nos últimos 30 dias (limite 0,10%)']);
});
