// Fila de reenvio ao Meta contra SQLite de verdade, com a migration 0041 real
// (spec-capi-reenvio-monitoramento.md, critérios de aceite 1–10, 16–20).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { registrarPrimeiraTentativa, executarRodada, recuperarRecentes, metricasSaude } from '../functions/api/_meta-fila.js';
import { processarAlertas, enviarTeste, planejarAvisos } from '../functions/api/_meta-alerta.js';
import { avaliarCondicoes, JANELA_SEGUNDOS, MAX_TENTATIVAS } from '../functions/api/_meta-envio.js';
import { onRequestGet as saudeGet, onRequestPost as saudePost } from '../functions/api/meta-saude.js';
import { onRequestPost as reenvioPost } from '../functions/api/sync/meta-reenvio.js';

// --- D1 mínimo em cima do node:sqlite ---
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

function novoBanco() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE event_log (id INTEGER PRIMARY KEY, session_id TEXT, event_name TEXT, event_id TEXT, timestamp INTEGER,
      is_bot INTEGER DEFAULT 0, sent_to_meta INTEGER, meta_status_code INTEGER, meta_response_ok INTEGER,
      meta_response_body TEXT, meta_payload_sent TEXT);
    CREATE TABLE purchase_log (id INTEGER PRIMARY KEY, event_id TEXT, event_time INTEGER, created_at INTEGER,
      meta_status_code INTEGER, meta_response_ok INTEGER, meta_response_body TEXT, meta_payload_sent TEXT, product_name TEXT);
    CREATE TABLE whatsapp_group_conversions (id INTEGER PRIMARY KEY, group_jid TEXT, phone TEXT, event_id TEXT,
      occurred_at TEXT, status TEXT, tentativas INTEGER DEFAULT 0, enriquecida INTEGER DEFAULT 0, erro TEXT,
      criado_em INTEGER, enviado_em INTEGER);
    CREATE TABLE sessions (session_id TEXT PRIMARY KEY, utm_source TEXT, utm_medium TEXT, fbclid TEXT, gclid TEXT,
      ip_address TEXT, user_agent TEXT, created_at INTEGER);
    CREATE TABLE lead_dispatch (id INTEGER PRIMARY KEY, event_id TEXT, email TEXT, phone TEXT, funnel TEXT,
      resultado TEXT, task_id TEXT, task_url TEXT, erro TEXT, criado_em INTEGER, lead_json TEXT, tentativas INTEGER DEFAULT 0);
  `);
  db.exec(readFileSync(new URL('../migrations/0041_meta_envios.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0042_protecoes_integracoes.sql', import.meta.url), 'utf8'));
  return db;
}

const AGORA = 1_789_600_000;
const envCom = (db, extra = {}) => ({ DB: d1(db), META_PIXEL_ID_2: '2800317883678788', META_ACCESS_TOKEN_2: 'tok', ...extra });
const payload = (id, t = AGORA) => JSON.stringify({ data: [{ event_name: 'Lead', event_id: id, event_time: t, user_data: {} }] });
const resposta = (status, corpo) => new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status });
const linha = (db, id) => db.prepare('SELECT * FROM meta_envios WHERE event_id = ?').get(id);
const erroCredencial = { error: { code: 190, type: 'OAuthException', message: 'Invalid OAuth access token' } };

async function registrar(env, id, resultado, extra = {}) {
  return registrarPrimeiraTentativa(env, {
    origem: 'site', eventId: id, eventName: 'Lead', eventTime: AGORA, referencia: '/se-v1', payload: payload(id), resultado, ...extra,
  }, AGORA);
}

// --- 1ª tentativa ---

test('critério 1: aceita na 1ª tentativa fica aceita, sem payload e fora da rodada', async () => {
  const db = novoBanco(); const env = envCom(db);
  await registrar(env, 'a', { ok: true, status: 200, corpo: '{"events_received":1}' });
  const l = linha(db, 'a');
  assert.deepEqual([l.situacao, l.payload, l.aceita_em], ['aceita', null, AGORA]);
  let chamadas = 0;
  const r = await executarRodada(env, AGORA + 3600, async () => { chamadas++; return resposta(200, '{}'); });
  assert.equal(r.vazia, true);
  assert.equal(chamadas, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM meta_reenvio_rodadas').get().n, 0, 'rodada vazia não grava');
});

test('PageView e eventos internos nunca entram na fila', async () => {
  const db = novoBanco(); const env = envCom(db);
  for (const nome of ['PageView', 'CTAClick', 'FormStep', 'FormStart']) {
    await registrar(env, nome, { status: 500, corpo: 'x' }, { eventName: nome });
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM meta_envios').get().n, 0);
});

test('critério 8: evento recusado vai direto para falhou, com motivo legível', async () => {
  const db = novoBanco(); const env = envCom(db);
  await registrar(env, 'e', { status: 400, corpo: { error: { code: 100, message: 'Invalid parameter', error_user_msg: 'Parâmetro fbc inválido' } } });
  const l = linha(db, 'e');
  assert.deepEqual([l.situacao, l.categoria], ['falhou', 'evento']);
  assert.match(l.motivo, /Parâmetro fbc inválido/);
  assert.ok(l.payload, 'guarda o payload para o "Tentar de novo"');
});

// --- reenvio ---

test('critério 2: falha passageira é reenviada com o MESMO event_id e horário original', async () => {
  const db = novoBanco(); const env = envCom(db);
  await registrar(env, 'p', { erroRede: true, corpo: 'Fetch error: timeout' });
  const l1 = linha(db, 'p');
  assert.deepEqual([l1.situacao, l1.categoria, l1.tentativas], ['pendente', 'passageira', 1]);

  // Antes de acabar a espera, não reenvia.
  let enviados = [];
  const fetchOk = async (url, init) => { enviados.push(JSON.parse(init.body)); return resposta(200, '{"events_received":1}'); };
  assert.equal((await executarRodada(env, AGORA + 60, fetchOk)).vazia, true);

  const r = await executarRodada(env, AGORA + 16 * 60, fetchOk);
  assert.equal(r.aceitas, 1);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].data[0].event_id, 'p');
  assert.equal(enviados[0].data[0].event_time, AGORA);
  const l2 = linha(db, 'p');
  assert.deepEqual([l2.situacao, l2.aceita_por_reenvio, l2.tentativas, l2.payload], ['aceita', 1, 2, null]);
  assert.equal(db.prepare('SELECT aceitas FROM meta_reenvio_rodadas').get().aceitas, 1);
});

test('critério 4: credencial não consome tentativa e interrompe a rodada na 1ª recusa', async () => {
  const db = novoBanco(); const env = envCom(db);
  for (const id of ['c1', 'c2', 'c3']) await registrar(env, id, { status: 400, corpo: erroCredencial });
  assert.equal(linha(db, 'c1').tentativas, 0);
  let chamadas = 0;
  const r = await executarRodada(env, AGORA + 60, async () => { chamadas++; return resposta(400, erroCredencial); });
  assert.equal(chamadas, 1, 'só uma chamada ao Meta com credencial quebrada');
  assert.equal(r.abortouCredencial, true);
  for (const id of ['c1', 'c2', 'c3']) assert.equal(linha(db, id).tentativas, 0);
  assert.equal(db.prepare('SELECT abortou_credencial FROM meta_reenvio_rodadas').get().abortou_credencial, 1);
});

test('critério 5: credencial consertada → pendentes aceitas nas rodadas seguintes', async () => {
  const db = novoBanco(); const env = envCom(db);
  for (const id of ['k1', 'k2']) await registrar(env, id, { status: 400, corpo: erroCredencial });
  const r = await executarRodada(env, AGORA + 60, async () => resposta(200, '{"events_received":1}'));
  assert.equal(r.aceitas, 2);
  assert.equal(linha(db, 'k2').situacao, 'aceita');
});

test('credencial ausente no ambiente: pendente, sem gastar tentativa, nada é enviado', async () => {
  const db = novoBanco(); const env = { DB: d1(db) };
  await registrar(env, 's', { semCredencial: true });
  let chamadas = 0;
  const r = await executarRodada(env, AGORA + 60, async () => { chamadas++; return resposta(200, '{}'); });
  assert.equal(chamadas, 0);
  assert.equal(r.abortouCredencial, true);
  assert.equal(linha(db, 's').motivo, 'Credencial do Meta não configurada.');
});

test('critério 6: falha passageira repetida esgota as tentativas', async () => {
  const db = novoBanco(); const env = envCom(db);
  await registrar(env, 'x', { status: 503, corpo: 'indisponível' });
  let t = AGORA;
  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    t += 4 * 3600;
    await executarRodada(env, t, async () => resposta(503, 'Service Unavailable'));
  }
  const l = linha(db, 'x');
  assert.deepEqual([l.situacao, l.categoria, l.tentativas], ['falhou', 'esgotou', MAX_TENTATIVAS]);
  assert.match(l.motivo, /^Esgotou as tentativas\. Última resposta: Service Unavailable\.$/);
});

test('critério 7: pendente com mais de 6 dias expira e não é enviada', async () => {
  const db = novoBanco(); const env = envCom(db);
  await registrar(env, 'v', { status: 503, corpo: 'x' });
  let chamadas = 0;
  const r = await executarRodada(env, AGORA + JANELA_SEGUNDOS + 1, async () => { chamadas++; return resposta(200, '{}'); });
  assert.equal(chamadas, 0);
  assert.equal(r.expiradas, 1);
  const l = linha(db, 'v');
  assert.deepEqual([l.situacao, l.categoria, l.payload], ['falhou', 'expirou', null]);
});

test('duas rodadas simultâneas não enviam a mesma conversão duas vezes', async () => {
  const db = novoBanco(); const env = envCom(db);
  await registrar(env, 'd', { status: 503, corpo: 'x' });
  let chamadas = 0;
  let liberar;
  const trava = new Promise((r) => { liberar = r; });
  const lento = async () => { chamadas++; await trava; return resposta(200, '{}'); };
  const t = AGORA + 3600;
  const a = executarRodada(env, t, lento);
  await new Promise((r) => setTimeout(r, 10));
  const b = executarRodada(env, t, lento);
  await new Promise((r) => setTimeout(r, 10));
  liberar();
  await Promise.all([a, b]);
  assert.equal(chamadas, 1);
});

test('critério 9: Purchase segue as mesmas regras', async () => {
  const db = novoBanco(); const env = envCom(db);
  await registrarPrimeiraTentativa(env, { origem: 'venda', eventId: 'purchase:1', eventName: 'Purchase', eventTime: AGORA, referencia: 'Workshop', payload: payload('purchase:1'), resultado: { status: 500, corpo: 'x' } }, AGORA);
  await executarRodada(env, AGORA + 3600, async () => resposta(200, '{}'));
  assert.equal(db.prepare(`SELECT situacao FROM meta_envios WHERE origem = 'venda'`).get().situacao, 'aceita');
});

// --- recuperação na ativação ---

test('recuperar: recusas dos últimos 6 dias entram; bots, aceitas, internas e antigas não; é idempotente', async () => {
  const db = novoBanco(); const env = envCom(db);
  const ins = db.prepare(`INSERT INTO event_log (event_name, event_id, timestamp, is_bot, sent_to_meta, meta_status_code, meta_response_ok, meta_response_body, meta_payload_sent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  ins.run('Lead', 'r1', AGORA - 86400, 0, 1, 400, 0, JSON.stringify(erroCredencial), payload('r1'));
  ins.run('Lead', 'r2', AGORA - 86400, 1, 1, 400, 0, 'x', payload('r2'));
  ins.run('Lead', 'r3', AGORA - 86400, 0, 1, 200, 1, '{}', payload('r3'));
  ins.run('CTAClick', 'r4', AGORA - 86400, 0, 1, 400, 0, 'x', payload('r4'));
  ins.run('Lead', 'r5', AGORA - 8 * 86400, 0, 1, 400, 0, 'x', payload('r5'));
  db.prepare(`INSERT INTO purchase_log (event_id, event_time, created_at, meta_status_code, meta_response_ok, meta_response_body, meta_payload_sent, product_name) VALUES ('purchase:9', ?, ?, 0, 0, 'skipped: missing meta env', ?, 'Workshop')`)
    .run(AGORA - 3600, AGORA - 3600, payload('purchase:9'));

  assert.deepEqual(await recuperarRecentes(env, AGORA), { site: 1, venda: 1 });
  assert.deepEqual(await recuperarRecentes(env, AGORA), { site: 0, venda: 0 });
  assert.equal(linha(db, 'r1').situacao, 'pendente');
  assert.equal(linha(db, 'purchase:9').motivo, 'Credencial do Meta não configurada.');
  assert.equal(linha(db, 'purchase:9').referencia, 'Workshop');
});

// --- alertas ---

function slackFalso() {
  const msgs = [];
  return { msgs, fetch: async (url, init) => { msgs.push(JSON.parse(init.body).text); return resposta(200, 'ok'); } };
}

test('alerta: credencial dispara uma vez, não repete antes de 6 h, lembra depois e avisa a recuperação', async () => {
  const db = novoBanco();
  const slack = slackFalso();
  const env = envCom(db, { SLACK_WEBHOOK_META: 'https://hooks.slack.test/x' });
  await registrar(env, 'q', { status: 400, corpo: erroCredencial });

  const verificar = async (t) => {
    const metricas = await metricasSaude(env, t);
    return processarAlertas(env, { condicoes: avaliarCondicoes(metricas, t), metricas, agora: t, fetchImpl: slack.fetch });
  };

  const r1 = await verificar(AGORA + 60);
  assert.ok(r1.novas.includes('credencial'));
  assert.equal(slack.msgs.length, 1);
  assert.match(slack.msgs[0], /Credencial do Meta recusada/);

  await verificar(AGORA + 900);
  assert.equal(slack.msgs.length, 1, 'não repete antes do lembrete');

  await verificar(AGORA + 60 + 6 * 3600);
  assert.equal(slack.msgs.length, 2);
  assert.match(slack.msgs[1], /Ainda acontecendo/);

  // Conserto: a rodada aceita e a condição some.
  await executarRodada(env, AGORA + 7 * 3600, async () => resposta(200, '{}'));
  await verificar(AGORA + 7 * 3600 + 60);
  assert.equal(slack.msgs.length, 3);
  assert.match(slack.msgs[2], /normalizado[\s\S]*Credencial do Meta recusada \(durou[\s\S]*recuperadas pelo reenvio: 1/);
});

test('critério 17: sem canal configurado, a mensagem fica "não entregue" e é reentregue quando o canal volta', async () => {
  const db = novoBanco();
  const semCanal = envCom(db);
  await registrar(semCanal, 'z', { status: 400, corpo: erroCredencial });
  const m = await metricasSaude(semCanal, AGORA + 60);
  await processarAlertas(semCanal, { condicoes: avaliarCondicoes(m, AGORA + 60), metricas: m, agora: AGORA + 60 });
  const log = db.prepare('SELECT entregue, erro FROM meta_alertas_log').get();
  assert.deepEqual([log.entregue, log.erro], [0, 'Nenhum canal de alerta configurado.']);

  const slack = slackFalso();
  const comCanal = envCom(db, { SLACK_WEBHOOK_META: 'https://hooks.slack.test/x' });
  const m2 = await metricasSaude(comCanal, AGORA + 900);
  const r = await processarAlertas(comCanal, { condicoes: avaliarCondicoes(m2, AGORA + 900), metricas: m2, agora: AGORA + 900, fetchImpl: slack.fetch });
  assert.equal(r.reentregas, 1);
  assert.equal(db.prepare('SELECT entregue FROM meta_alertas_log').get().entregue, 1);
});

test('critério 19: alerta de teste entrega e não mexe em condição', async () => {
  const db = novoBanco();
  const slack = slackFalso();
  const env = envCom(db, { SLACK_WEBHOOK_META: 'https://hooks.slack.test/x' });
  const r = await enviarTeste(env, AGORA, slack.fetch);
  assert.equal(r.ok, true);
  assert.match(slack.msgs[0], /Teste do alerta/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM meta_alertas_estado').get().n, 0);
});

test('planejarAvisos: "sem aceitas" não é dada como resolvida só porque a janela de 6 h andou', () => {
  const estados = { sem_aceitas: { ativa: 1, desde: AGORA, ultimo_aviso_em: AGORA } };
  assert.deepEqual(planejarAvisos([], estados, AGORA + 7 * 3600, { ultimaAceitaEm: AGORA - 100 }).resolvidas, []);
  assert.deepEqual(planejarAvisos([], estados, AGORA + 7 * 3600, { ultimaAceitaEm: AGORA + 3600 }).resolvidas, ['sem_aceitas']);
});

test('planejarAvisos: várias condições novas viram um alerta só', () => {
  const p = planejarAvisos(['credencial', 'sem_aceitas'], {}, AGORA);
  assert.deepEqual(p.novas, ['credencial', 'sem_aceitas']);
});

// --- API da aba ---

const req = (path, init) => new Request(`https://x${path}`, init);

test('API: sem chave é 401; período maior que 92 dias é recusado', async () => {
  const db = novoBanco(); const env = { ...envCom(db), DASH_KEY: 'k' };
  assert.equal((await saudeGet({ request: req('/api/meta-saude?key=errada'), env })).status, 401);
  const r = await saudeGet({ request: req(`/api/meta-saude?key=k&from=${AGORA - 100 * 86400}&to=${AGORA}`), env });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'Escolha um período de até 92 dias.');
});

test('API: painel com taxa por tipo, EntrouGrupo, pendentes, captura e taxa "—" sem dados', async () => {
  const db = novoBanco(); const env = { ...envCom(db), DASH_KEY: 'k' };
  const agora = Math.floor(Date.now() / 1000);
  const reg = (id, resultado, nome = 'Lead') => registrarPrimeiraTentativa(env, { origem: 'site', eventId: id, eventName: nome, eventTime: agora - 3600, payload: payload(id), resultado }, agora);
  await reg('ok1', { ok: true, status: 200, corpo: '{}' });
  await reg('ok2', { ok: true, status: 200, corpo: '{}' });
  await reg('pend', { status: 503, corpo: 'x' });
  await reg('fal', { status: 400, corpo: { error: { code: 100, message: 'bad' } } });
  db.prepare(`INSERT INTO whatsapp_group_conversions (event_id, occurred_at, status, tentativas, criado_em, enviado_em) VALUES ('g1', ?, 'enviada', 1, ?, ?)`)
    .run(new Date((agora - 1800) * 1000).toISOString(), agora, agora);
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
  const s = db.prepare('INSERT INTO sessions (session_id, utm_source, utm_medium, fbclid, gclid, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  s.run('s1', 'facebookads', 'cpc', 'abc', '', '1.1.1.1', ua, agora - 100);
  s.run('s2', 'facebookads', 'cpc', '', '', '1.1.1.2', ua, agora - 100);

  const r = await saudeGet({ request: req(`/api/meta-saude?key=k&from=${agora - 86400}&to=${agora}`), env });
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  const lead = d.porTipo.linhas.find((l) => l.tipo === 'Lead');
  assert.deepEqual([lead.total, lead.primeira, lead.pendentes, lead.falhas, lead.taxa], [4, 2, 1, 1, 0.5]);
  assert.ok(d.porTipo.linhas.find((l) => l.tipo === 'EntrouGrupo'));
  assert.equal(d.pendentes.total, 1);
  assert.deepEqual([d.captura.meta.visitas, d.captura.meta.comId, d.captura.meta.taxa], [2, 1, 0.5]);
  assert.equal(d.captura.google.taxa, null, 'sem visitas → null, exibido como "—"');
  assert.equal(d.canalConfigurado, false);
  assert.equal(d.estado.estado, 'atencao');

  const vazio = await (await saudeGet({ request: req(`/api/meta-saude?key=k&from=${agora - 90 * 86400}&to=${agora - 80 * 86400}`), env })).json();
  assert.equal(vazio.porTipo.totais.taxa, null);
});

test('critério 20: "Tentar de novo" devolve a falha à fila dentro da janela e recusa fora dela', async () => {
  const db = novoBanco(); const env = { ...envCom(db), DASH_KEY: 'k' };
  const agora = Math.floor(Date.now() / 1000);
  await registrarPrimeiraTentativa(env, { origem: 'site', eventId: 'f1', eventName: 'Lead', eventTime: agora - 3600, payload: payload('f1'), resultado: { status: 400, corpo: 'bad' } }, agora);
  await registrarPrimeiraTentativa(env, { origem: 'site', eventId: 'f2', eventName: 'Lead', eventTime: agora - 7 * 86400, payload: payload('f2'), resultado: { status: 400, corpo: 'bad' } }, agora);

  const lista = await (await saudeGet({ request: req(`/api/meta-saude?key=k&view=falhas&from=${agora - 8 * 86400}&to=${agora}`), env })).json();
  const f1 = lista.linhas.find((l) => l.id === linha(db, 'f1').id);
  const f2 = lista.linhas.find((l) => l.id === linha(db, 'f2').id);
  assert.equal(f1.podeTentarDeNovo, true);
  assert.equal(f2.podeTentarDeNovo, false);
  assert.equal(f2.dicaTentar, 'O Meta não aceita mais este evento (mais de 6 dias).');

  const post = (id) => saudePost({ request: req('/api/meta-saude?key=k', { method: 'POST', body: JSON.stringify({ acao: 'tentar-de-novo', id }) }), env });
  assert.equal((await post(f1.id)).status, 200);
  assert.deepEqual([linha(db, 'f1').situacao, linha(db, 'f1').tentativas], ['pendente', 0]);
  assert.equal((await post(f2.id)).status, 400);
});

test('sync: exige x-sync-secret e roda rodada + checagem de credenciais + alertas', async () => {
  const db = novoBanco(); const env = { ...envCom(db), SYNC_SECRET: 's' };
  // A checagem de credenciais consulta Meta e ClickUp: aqui, respostas simuladas.
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 200 });
  after(() => { globalThis.fetch = original; });
  assert.equal((await reenvioPost({ request: req('/api/sync/meta-reenvio', { method: 'POST' }), env })).status, 401);
  const r = await reenvioPost({ request: req('/api/sync/meta-reenvio', { method: 'POST', headers: { 'x-sync-secret': 's' } }), env });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.rodada.vazia, true);
  assert.equal(d.credenciais.executada, true, 'primeira rodada do dia checa as credenciais');
  // Credenciais obrigatórias ausentes no ambiente de teste viram condição de alerta.
  assert.ok(d.alertas.condicoes.includes('credencial_problema'));
  const valorQueNaoPodeVazar = 'tok';
  const gravado = JSON.stringify(db.prepare('SELECT * FROM credenciais_estado').all());
  assert.ok(!gravado.includes(valorQueNaoPodeVazar), 'valor de credencial nunca é gravado');
});
