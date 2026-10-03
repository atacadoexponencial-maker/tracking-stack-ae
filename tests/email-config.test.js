// Configuração, envio de teste e resultados do e-mail próprio (issue 377)
// contra SQLite real (migration 0050) e um Postmark simulado (fetch trocado).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import * as config from '../functions/api/email/config.js';
import * as webhook from '../functions/api/webhooks/postmark.js';
import { executarChecagem } from '../functions/api/_credenciais-checagem.js';

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

// Postmark simulado: guarda envios e webhooks; `recusar` força ErrorCode no envio.
function postmarkFalso() {
  const estado = { envios: [], webhooks: [], recusar: null, foraDoAr: false, chamadas: [], n: 0 };
  const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  estado.fetch = async (url, op = {}) => {
    const u = new URL(String(url));
    const metodo = op.method || 'GET';
    estado.chamadas.push(`${metodo} ${u.pathname}`);
    if (estado.foraDoAr) throw new TypeError('fetch failed');
    if (u.pathname === '/domains') {
      if (op.headers['X-Postmark-Account-Token'] !== 'acc') return resp({ ErrorCode: 10 }, 401);
      return resp({ Domains: [
        { Name: 'envio.atacadoexponencial.com', DKIMVerified: true, ReturnPathDomainVerified: true },
        { Name: 'news.atacadoexponencial.com', DKIMVerified: true, ReturnPathDomainVerified: false },
      ] });
    }
    if (op.headers['X-Postmark-Server-Token'] !== 'srv') return resp({ ErrorCode: 10, Message: 'bad token' }, 401);
    if (u.pathname === '/server') return resp({ ID: 1, Name: 'x' });
    if (u.pathname === '/email') {
      const c = JSON.parse(op.body);
      if (estado.recusar) return resp({ ErrorCode: estado.recusar, Message: 'x' }, 422);
      const id = `msg-${++estado.n}`;
      estado.envios.push({ ...c, MessageID: id });
      return resp({ ErrorCode: 0, Message: 'OK', MessageID: id, To: c.To });
    }
    if (u.pathname === '/webhooks' && metodo === 'GET') {
      return resp({ Webhooks: estado.webhooks.filter((w) => w.MessageStream === u.searchParams.get('MessageStream')) });
    }
    if (u.pathname === '/webhooks' && metodo === 'POST') {
      const c = JSON.parse(op.body);
      const w = { ID: ++estado.n, ...c };
      estado.webhooks.push(w);
      return resp(w);
    }
    const m = /^\/webhooks\/(\d+)$/.exec(u.pathname);
    if (m && metodo === 'PUT') {
      const w = estado.webhooks.find((x) => x.ID === Number(m[1]));
      Object.assign(w, JSON.parse(op.body));
      return resp(w);
    }
    throw new Error('fetch inesperado: ' + u);
  };
  return estado;
}

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0050_email.sql', import.meta.url), 'utf8'));
  env = {
    DB: d1(db), DASH_KEY: 'k',
    POSTMARK_SERVER_TOKEN: 'srv', POSTMARK_ACCOUNT_TOKEN: 'acc',
    POSTMARK_WEBHOOK_USER: 'u', POSTMARK_WEBHOOK_PASS: 'p',
  };
  pm = postmarkFalso();
  globalThis.fetch = pm.fetch;
});

const ORIGEM = 'https://email-proprio.tracking-ae.pages.dev';
const dash = (corpo, key = 'k') => (corpo
  ? config.onRequestPost({ request: new Request(`${ORIGEM}/api/email/config?key=${key}`, { method: 'POST', body: JSON.stringify(corpo) }), env })
  : config.onRequestGet({ request: new Request(`${ORIGEM}/api/email/config?key=${key}`), env })).then(async (r) => ({ status: r.status, corpo: await r.json() }));

const basic = (u, p) => 'Basic ' + btoa(`${u}:${p}`);
const aviso = (payload, auth = basic('u', 'p')) => webhook.onRequestPost({
  request: new Request(`${ORIGEM}/api/webhooks/postmark`, {
    method: 'POST', body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    headers: auth ? { Authorization: auth } : {},
  }),
  env,
}).then(async (r) => ({ status: r.status, corpo: await r.json() }));

const envio = (id) => db.prepare('SELECT * FROM email_envios WHERE id = ?').get(id);
const nEventos = () => db.prepare('SELECT COUNT(*) AS n FROM email_eventos').get().n;

test('sem a chave do dash: 401', async () => {
  assert.equal((await dash(null, 'x')).status, 401);
  assert.equal((await dash({ acao: 'salvar', campos: {} }, 'x')).status, 401);
});

test('GET mostra sementes, conta aceita, domínios e resultados não conectados', async () => {
  const r = await dash();
  assert.equal(r.status, 200);
  assert.equal(r.corpo.config.remetente_transacional_email, 'notify@envio.atacadoexponencial.com');
  assert.equal(r.corpo.config.remetente_marketing_nome, 'Felipe Santos | Atacado Exponencial');
  assert.equal(r.corpo.config.marketing_liberado, '1');
  assert.equal(r.corpo.conta, 'aceita');
  assert.equal(r.corpo.dominios.consultado, true);
  const news = r.corpo.dominios.itens.find((d) => d.canal === 'marketing');
  assert.deepEqual([news.dkim, news.retorno], [true, false]);
  assert.deepEqual(r.corpo.resultados, { transacional: false, marketing: false });
  assert.deepEqual(r.corpo.testes, []);
});

test('sem account token: domínios não consultados, o resto segue', async () => {
  delete env.POSTMARK_ACCOUNT_TOKEN;
  const r = await dash();
  assert.equal(r.corpo.conta, 'aceita');
  assert.deepEqual([r.corpo.dominios.consultado, r.corpo.dominios.motivo], [false, 'sem_chave_conta']);
});

test('server token recusado: conta recusada e teste/conexão indisponíveis', async () => {
  env.POSTMARK_SERVER_TOKEN = 'errado';
  assert.equal((await dash()).corpo.conta, 'recusada');
  delete env.POSTMARK_SERVER_TOKEN;
  assert.equal((await dash()).corpo.conta, 'ausente');
  const t = await dash({ acao: 'enviar_teste', para: 'eu@x.com', canal: 'transacional' });
  assert.equal(t.status, 503);
  assert.match(t.corpo.error, /Saúde das integrações/);
  assert.equal((await dash({ acao: 'conectar_resultados' })).status, 503);
});

test('salvar valida o domínio por canal e grava', async () => {
  let r = await dash({ acao: 'salvar', campos: { remetente_marketing_email: 'felipe@envio.atacadoexponencial.com' } });
  assert.equal(r.status, 400);
  assert.match(r.corpo.error, /@news\.atacadoexponencial\.com/);
  r = await dash({ acao: 'salvar', campos: { remetente_transacional_email: 'x@gmail.com' } });
  assert.equal(r.status, 400);
  r = await dash({ acao: 'salvar', campos: { remetente_marketing_nome: '  ' } });
  assert.equal(r.status, 400);
  r = await dash({ acao: 'salvar', campos: { resposta_marketing: 'incompleto@' } });
  assert.equal(r.status, 400);
  r = await dash({ acao: 'salvar', campos: { rodape: 'x'.repeat(1001) } });
  assert.equal(r.status, 400);
  r = await dash({ acao: 'salvar', campos: { segredo: '1' } });
  assert.equal(r.status, 400);

  r = await dash({ acao: 'salvar', campos: {
    remetente_marketing_nome: 'Felipe | AE', remetente_marketing_email: 'Felipe@News.AtacadoExponencial.com',
    resposta_marketing: '', rodape: 'Seteads Ltda.\nSão Paulo',
  } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.config.remetente_marketing_nome, 'Felipe | AE');
  assert.equal(r.corpo.config.remetente_marketing_email, 'felipe@news.atacadoexponencial.com');
  assert.equal(r.corpo.config.rodape, 'Seteads Ltda.\nSão Paulo');
  assert.equal((await dash()).corpo.config.remetente_marketing_nome, 'Felipe | AE');
});

test('enviar teste: sai pelo stream certo, com tag, metadata e rastreio; sem ReplyTo quando vazio', async () => {
  await dash({ acao: 'salvar', campos: { resposta_transacional: 'contato@seteads.com' } });
  let r = await dash({ acao: 'enviar_teste', para: 'Eu@Exemplo.com', canal: 'marketing' });
  assert.equal(r.status, 200);
  const m = pm.envios[0];
  assert.equal(m.MessageStream, 'broadcast');
  assert.equal(m.From, '"Felipe Santos | Atacado Exponencial" <felipe@news.atacadoexponencial.com>');
  assert.equal(m.To, 'eu@exemplo.com');
  assert.equal(m.Tag, 'teste');
  assert.deepEqual(m.Metadata, { origem: 'teste', envio_id: String(r.corpo.envio_id) });
  assert.equal(m.TrackOpens, true);
  assert.ok(m.TrackLinks && m.TrackLinks !== 'None');
  assert.match(m.HtmlBody, /<a href="https:\/\//);
  assert.equal('ReplyTo' in m, false);
  const e = envio(r.corpo.envio_id);
  assert.deepEqual([e.situacao, e.message_id, e.erro, e.origem, e.canal], ['enviado', 'msg-1', null, 'teste', 'marketing']);
  assert.ok(e.enviado_em > 0);
  assert.equal(r.corpo.testes.length, 1);

  r = await dash({ acao: 'enviar_teste', para: 'eu@exemplo.com', canal: 'transacional' });
  assert.equal(pm.envios[1].MessageStream, 'outbound');
  assert.equal(pm.envios[1].ReplyTo, 'contato@seteads.com');
});

test('enviar teste: e-mail ou canal inválido é recusado antes do serviço', async () => {
  assert.equal((await dash({ acao: 'enviar_teste', para: 'nada', canal: 'transacional' })).status, 400);
  assert.equal((await dash({ acao: 'enviar_teste', para: 'eu@x.com', canal: 'outro' })).status, 400);
  assert.equal(pm.envios.length, 0);
});

test('enviar teste: marketing marcado como não liberado é recusado', async () => {
  await dash({ acao: 'salvar', campos: { marketing_liberado: '0' } });
  const r = await dash({ acao: 'enviar_teste', para: 'eu@x.com', canal: 'marketing' });
  assert.equal(r.status, 409);
  assert.equal(pm.envios.length, 0);
});

test('enviar teste: recusa do serviço grava "falhou" com o motivo traduzido', async () => {
  pm.recusar = 406;
  const r = await dash({ acao: 'enviar_teste', para: 'eu@x.com', canal: 'transacional' });
  assert.equal(r.status, 422);
  assert.match(r.corpo.error, /inativo/);
  const e = db.prepare('SELECT * FROM email_envios').get();
  assert.deepEqual([e.situacao, e.message_id], ['falhou', null]);
  assert.match(e.erro, /inativo/);
  assert.equal(r.corpo.testes[0].situacao, 'falhou');
});

test('enviar teste: serviço fora do ar não grava nada como enviado', async () => {
  pm.foraDoAr = true;
  const r = await dash({ acao: 'enviar_teste', para: 'eu@x.com', canal: 'transacional' });
  assert.equal(r.status, 504);
  assert.match(r.corpo.error, /Não foi possível falar com o serviço de envio/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_envios').get().n, 0);
});

test('conectar resultados cria um webhook por stream, sem duplicar, e atualiza o que mudou', async () => {
  let r = await dash({ acao: 'conectar_resultados' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo.resultados, { transacional: 'criado', marketing: 'criado' });
  assert.equal(pm.webhooks.length, 2);
  const w = pm.webhooks.find((x) => x.MessageStream === 'broadcast');
  assert.equal(w.Url, `${ORIGEM}/api/webhooks/postmark`);
  assert.deepEqual(w.HttpAuth, { Username: 'u', Password: 'p' });
  assert.deepEqual(w.Triggers.Open, { Enabled: true, PostFirstOpenOnly: false });
  assert.equal(w.Triggers.Bounce.IncludeContent, false);
  assert.equal(w.Triggers.SpamComplaint.IncludeContent, false);
  for (const k of ['Click', 'Delivery', 'SubscriptionChange']) assert.equal(w.Triggers[k].Enabled, true);
  assert.deepEqual((await dash()).corpo.resultados, { transacional: true, marketing: true });

  // Gatilho desligado por alguém no painel do Postmark: volta a conectar e corrige.
  w.Triggers.Click.Enabled = false;
  assert.equal((await dash()).corpo.resultados.marketing, false);
  env.POSTMARK_WEBHOOK_PASS = 'nova';
  r = await dash({ acao: 'conectar_resultados' });
  assert.deepEqual(r.corpo.resultados, { transacional: 'atualizado', marketing: 'atualizado' });
  assert.equal(pm.webhooks.length, 2);
  assert.equal(w.Triggers.Click.Enabled, true);
  assert.equal(w.HttpAuth.Password, 'nova');
});

test('webhook: sem senha ou com senha errada dá 401 e não grava', async () => {
  const p = { RecordType: 'Delivery', MessageID: 'msg-1', DeliveredAt: '2026-10-03T14:00:00Z' };
  assert.equal((await aviso(p, null)).status, 401);
  assert.equal((await aviso(p, basic('u', 'errada'))).status, 401);
  assert.equal((await aviso(p, basic('outro', 'p'))).status, 401);
  assert.equal((await aviso(p, 'Bearer p')).status, 401);
  delete env.POSTMARK_WEBHOOK_PASS;
  assert.equal((await aviso(p)).status, 401);
  assert.equal(nEventos(), 0);
});

test('webhook: corpo inválido responde 200 sem gravar', async () => {
  assert.equal((await aviso('{lixo')).status, 200);
  assert.equal((await aviso({ RecordType: 'Inbound', MessageID: 'x' })).status, 200);
  assert.equal(nEventos(), 0);
});

test('webhook: entregue, aberto (repetido) e clicado atualizam o envio; aviso repetido é ignorado', async () => {
  const { corpo } = await dash({ acao: 'enviar_teste', para: 'eu@x.com', canal: 'transacional' });
  const id = corpo.envio_id;
  const entrega = { RecordType: 'Delivery', MessageID: 'msg-1', MessageStream: 'outbound', DeliveredAt: '2026-10-03T14:00:00Z', Recipient: 'eu@x.com' };
  let r = await aviso(entrega);
  assert.deepEqual([r.status, r.corpo.status, r.corpo.ligado], [200, 'gravado', true]);
  assert.equal(envio(id).situacao, 'entregue');
  const t0 = envio(id).entregue_em;

  r = await aviso(entrega);
  assert.deepEqual([r.status, r.corpo.status], [200, 'repetido']);
  assert.equal(nEventos(), 1);

  await aviso({ RecordType: 'Open', MessageID: 'msg-1', ReceivedAt: '2026-10-03T14:05:00Z' });
  await aviso({ RecordType: 'Open', MessageID: 'msg-1', ReceivedAt: '2026-10-03T14:09:00Z' });
  const e1 = envio(id);
  assert.equal(e1.situacao, 'aberto');
  assert.equal(e1.aberto_em, Math.floor(Date.parse('2026-10-03T14:05:00Z') / 1000));
  assert.equal(nEventos(), 3);

  await aviso({ RecordType: 'Click', MessageID: 'msg-1', ReceivedAt: '2026-10-03T14:06:00Z', OriginalLink: 'https://atacadoexponencial.com/' });
  const e2 = envio(id);
  assert.equal(e2.situacao, 'clicado');
  assert.ok(e2.clicado_em > 0);
  assert.equal(e2.entregue_em, t0);

  const ev = db.prepare("SELECT detalhe_json FROM email_eventos WHERE tipo = 'clicado'").get();
  assert.deepEqual(JSON.parse(ev.detalhe_json), { link: 'https://atacadoexponencial.com/' });

  const g = await dash();
  assert.equal(g.corpo.testes[0].situacao, 'clicado');
  assert.deepEqual(g.corpo.testes[0].eventos.map((x) => x.tipo), ['entregue', 'aberto', 'clicado', 'aberto']);
});

test('webhook: fora de ordem não rebaixa a situação; voltou é mais grave', async () => {
  const { corpo } = await dash({ acao: 'enviar_teste', para: 'eu@x.com', canal: 'transacional' });
  const id = corpo.envio_id;
  await aviso({ RecordType: 'Open', MessageID: 'msg-1', ReceivedAt: '2026-10-03T14:05:00Z' });
  await aviso({ RecordType: 'Delivery', MessageID: 'msg-1', DeliveredAt: '2026-10-03T14:00:00Z' });
  let e = envio(id);
  assert.equal(e.situacao, 'aberto');
  assert.ok(e.entregue_em && e.aberto_em);
  await aviso({ RecordType: 'Bounce', MessageID: 'msg-1', Type: 'SoftBounce', Inactive: false, BouncedAt: '2026-10-03T14:10:00Z' });
  assert.equal(envio(id).situacao, 'aberto');
  await aviso({ RecordType: 'SpamComplaint', MessageID: 'msg-1', BouncedAt: '2026-10-03T15:00:00Z' });
  e = envio(id);
  assert.equal(e.situacao, 'spam');
  assert.ok(e.spam_em > 0);
});

test('webhook: soft bounce de envio só enviado marca voltou_temporario sem data definitiva', async () => {
  const { corpo } = await dash({ acao: 'enviar_teste', para: 'eu@x.com', canal: 'transacional' });
  await aviso({ RecordType: 'Bounce', MessageID: 'msg-1', Type: 'SoftBounce', Inactive: false, BouncedAt: '2026-10-03T14:10:00Z' });
  const e = envio(corpo.envio_id);
  assert.deepEqual([e.situacao, e.voltou_em], ['voltou_temporario', null]);
});

test('webhook: mensagem que o dash não mandou é gravada sem envio ligado', async () => {
  const r = await aviso({ RecordType: 'Delivery', MessageID: 'de-fora', DeliveredAt: '2026-10-03T14:00:00Z' });
  assert.deepEqual([r.status, r.corpo.ligado], [200, false]);
  assert.equal(db.prepare('SELECT envio_id FROM email_eventos').get().envio_id, null);
});

test('webhook: falha de escrita no D1 devolve 500', async () => {
  env.DB = { prepare: () => { throw new Error('D1 fora'); } };
  const r = await aviso({ RecordType: 'Delivery', MessageID: 'msg-1', DeliveredAt: '2026-10-03T14:00:00Z' });
  assert.equal(r.status, 500);
});

test('checagem de credenciais: Postmark aceito e recusado', async () => {
  // 0042 altera tabelas antigas; aqui só a forma mínima delas (como em protecoes-integracao.test.js).
  db.exec(`CREATE TABLE lead_dispatch (id INTEGER PRIMARY KEY);
    CREATE TABLE whatsapp_group_conversions (id INTEGER PRIMARY KEY);`);
  for (const m of ['0041_meta_envios.sql', '0042_protecoes_integracoes.sql']) db.exec(readFileSync(new URL(`../migrations/${m}`, import.meta.url), 'utf8'));
  const fetchImpl = async (url, op) => {
    if (String(url) === 'https://api.postmarkapp.com/server') return pm.fetch(url, op);
    return new Response('{}', { status: 200 });
  };
  await executarChecagem(env, { origem: 'manual', agora: 1000, fetchImpl });
  let s = db.prepare("SELECT situacao, nota FROM credenciais_estado WHERE nome = 'POSTMARK_SERVER_TOKEN'").get();
  assert.deepEqual([s.situacao, s.nota], ['ok', 'Aceita pelo serviço.']);
  env.POSTMARK_SERVER_TOKEN = 'errado';
  await executarChecagem(env, { origem: 'manual', agora: 2000, fetchImpl });
  s = db.prepare("SELECT situacao FROM credenciais_estado WHERE nome = 'POSTMARK_SERVER_TOKEN'").get();
  assert.equal(s.situacao, 'problema');
});
