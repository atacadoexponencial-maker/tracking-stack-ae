// Proteções nas integrações contra SQLite real com as migrations 0041 e 0042
// (spec-protecoes-integracoes.md, critérios 1–10, 13, 16, 17).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { executarChecagem, talvezChecarAutomatico, lerCredenciais } from '../functions/api/_credenciais-checagem.js';
import { registrarHorario, avaliarFontes, suspeitosDaFonte } from '../functions/api/_horario-registro.js';
import { verificarAlertas } from '../functions/api/_saude-alertas.js';
import { CATALOGO, MOTIVOS } from '../functions/api/_credenciais.js';
import { searchClickUpTaskPorTelefone, toClickUpPhone } from '../functions/api/_clickup.js';
import { eventIdDaEntrada, telefoneDoJid } from '../functions/api/_grupo-conversao.js';
import { normalizePhone } from '../functions/api/_hash.js';

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
    CREATE TABLE lead_dispatch (id INTEGER PRIMARY KEY, event_id TEXT, email TEXT, phone TEXT, funnel TEXT,
      resultado TEXT, task_id TEXT, task_url TEXT, erro TEXT, criado_em INTEGER, lead_json TEXT, tentativas INTEGER DEFAULT 0);
    CREATE TABLE whatsapp_group_conversions (id INTEGER PRIMARY KEY, group_jid TEXT, phone TEXT, event_id TEXT,
      occurred_at TEXT, status TEXT, tentativas INTEGER DEFAULT 0, enriquecida INTEGER DEFAULT 0, erro TEXT, criado_em INTEGER, enviado_em INTEGER);
  `);
  for (const m of ['0041_meta_envios.sql', '0042_protecoes_integracoes.sql']) {
    db.exec(readFileSync(new URL(`../migrations/${m}`, import.meta.url), 'utf8'));
  }
  return db;
}

const AGORA = 1_789_600_000;
// Ambiente com TODAS as obrigatórias limpas.
function envLimpo(db, extra = {}) {
  const env = { DB: d1(db) };
  for (const c of CATALOGO.filter((i) => i.obrigatoria)) {
    env[c.nome] = c.formato === 'numerico' ? '123456' : c.formato === 'https' ? 'https://exemplo.com/x' : c.formato === 'ga4' ? 'G-ABC123' : 'segredo-limpo-' + c.nome;
  }
  return Object.assign(env, extra);
}
const servicosOk = async () => new Response('{"id":"1"}', { status: 200 });

// --- credenciais ---

test('critério 1 e 5: BOM no token do Meta vira problema, sem gravar nenhum valor', async () => {
  const db = novoBanco();
  const segredo = 'EAAB-token-secreto-9981';
  const env = envLimpo(db, { META_ACCESS_TOKEN_2: '﻿' + segredo });
  const r = await executarChecagem(env, { origem: 'automatica', agora: AGORA, fetchImpl: servicosOk });
  assert.equal(r.executada, true);
  const { itens } = await lerCredenciais(env);
  const token = itens.find((i) => i.nome === 'META_ACCESS_TOKEN_2');
  assert.equal(token.situacao, 'problema');
  assert.deepEqual(token.motivos, [MOTIVOS.invisivel]);
  assert.equal(itens[0].situacao, 'problema', 'problemas no topo');
  const tudo = JSON.stringify([db.prepare('SELECT * FROM credenciais_estado').all(), db.prepare('SELECT * FROM credenciais_rodadas').all()]);
  assert.ok(!tudo.includes(segredo) && !tudo.includes('9981'), 'nada do valor no banco');
});

test('critério 4: token limpo mas revogado → recusada; serviço fora do ar → não confirmado, problema na 2ª automática', async () => {
  const db = novoBanco();
  const env = envLimpo(db);
  const recusa = async (url) => new Response('{"error":{"code":190}}', { status: url.includes('facebook') ? 400 : 200 });
  await executarChecagem(env, { agora: AGORA, fetchImpl: recusa });
  let meta = (await lerCredenciais(env)).itens.find((i) => i.nome === 'META_ACCESS_TOKEN_2');
  assert.deepEqual([meta.situacao, meta.motivos[0]], ['problema', MOTIVOS.recusada]);

  const db2 = novoBanco();
  const env2 = envLimpo(db2);
  const fora = async () => { throw new Error('rede'); };
  await executarChecagem(env2, { agora: AGORA, fetchImpl: fora });
  assert.equal((await lerCredenciais(env2)).itens.find((i) => i.nome === 'CLICKUP_API_TOKEN').situacao, 'nao_confirmado');
  await executarChecagem(env2, { agora: AGORA + 86401, fetchImpl: fora });
  assert.equal((await lerCredenciais(env2)).itens.find((i) => i.nome === 'CLICKUP_API_TOKEN').situacao, 'problema');
});

test('critério 3: obrigatória ausente é problema; opcional ausente é "não se aplica"', async () => {
  const db = novoBanco();
  const env = envLimpo(db);
  delete env.GA4_API_SECRET;
  await executarChecagem(env, { agora: AGORA, fetchImpl: servicosOk });
  const { itens } = await lerCredenciais(env);
  assert.equal(itens.find((i) => i.nome === 'GA4_API_SECRET').motivos[0], MOTIVOS.ausente);
  assert.equal(itens.find((i) => i.nome === 'ENCHARGE_API_KEY').situacao, 'nao_se_aplica');
});

test('critério 8: "Checar agora" duas vezes em menos de 1 minuto não chama os serviços', async () => {
  const db = novoBanco();
  const env = envLimpo(db);
  let chamadas = 0;
  const contar = async () => { chamadas++; return new Response('{}', { status: 200 }); };
  await executarChecagem(env, { origem: 'manual', agora: AGORA, fetchImpl: contar });
  const antes = chamadas;
  const r = await executarChecagem(env, { origem: 'manual', agora: AGORA + 30, fetchImpl: contar });
  assert.deepEqual([r.executada, r.motivo, chamadas], [false, 'Aguarde um minuto para checar de novo.', antes]);
});

test('automática roda 1 vez por dia', async () => {
  const db = novoBanco();
  const env = envLimpo(db);
  assert.equal((await talvezChecarAutomatico(env, AGORA, servicosOk)).executada, true);
  assert.equal((await talvezChecarAutomatico(env, AGORA + 3600, servicosOk)).executada, false);
  assert.equal((await talvezChecarAutomatico(env, AGORA + 86400, servicosOk)).executada, true);
});

test('critério 6 e 7: alerta de credencial, sem repetir antes de 6 h, e recuperação única depois do conserto', async () => {
  const db = novoBanco();
  const msgs = [];
  const slack = async (url, init) => {
    if (String(url).includes('hooks.slack')) { msgs.push(JSON.parse(init.body).text); return new Response('ok'); }
    return new Response('{}', { status: 200 });
  };
  const env = envLimpo(db, { SLACK_WEBHOOK_META: 'https://hooks.slack.test/x', GA4_API_SECRET: 'segredo\n' });
  await executarChecagem(env, { agora: AGORA, fetchImpl: slack });
  await verificarAlertas(env, AGORA + 60, slack);
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /Credencial de integração com problema[\s\S]*GA4_API_SECRET: Tem espaço ou quebra de linha/);
  assert.ok(!msgs[0].includes('segredo'), 'mensagem sem valor');

  await verificarAlertas(env, AGORA + 3600, slack);
  assert.equal(msgs.length, 1, 'não repete antes de 6 h');

  // Uma segunda credencial quebra: alerta só com ela.
  env.CLICKUP_LIST_ID = 'abc';
  await executarChecagem(env, { origem: 'manual', agora: AGORA + 4000, fetchImpl: slack });
  await verificarAlertas(env, AGORA + 4000, slack);
  assert.equal(msgs.length, 2);
  assert.match(msgs[1], /CLICKUP_LIST_ID/);
  assert.ok(!msgs[1].includes('GA4_API_SECRET'), 'o segundo alerta traz só o item novo');

  env.GA4_API_SECRET = 'segredo';
  env.CLICKUP_LIST_ID = '123456';
  await executarChecagem(env, { origem: 'manual', agora: AGORA + 5000, fetchImpl: slack });
  await verificarAlertas(env, AGORA + 5000, slack);
  await verificarAlertas(env, AGORA + 6000, slack);
  assert.equal(msgs.length, 3);
  assert.match(msgs[2], /Integração do tracking normalizada/);
});

// --- horário ---

async function eventos(env, fonte, n, desvioMin, inicio = AGORA) {
  for (let i = 0; i < n; i++) {
    const chegadaMs = (inicio + i * 60) * 1000;
    await registrarHorario(env, fonte, new Date(chegadaMs - desvioMin * 60000).toISOString(), { chegadaMs, ref: `ev${i}` });
  }
}

test('critério 9: fonte deslocada 3 h vira suspeita e alerta', async () => {
  const db = novoBanco();
  const msgs = [];
  const env = envLimpo(db, { SLACK_WEBHOOK_META: 'https://hooks.slack.test/x' });
  await eventos(env, 'greenn', 6, 180);
  const greenn = (await avaliarFontes(env, AGORA + 600)).find((f) => f.fonte === 'greenn');
  assert.equal(greenn.situacao, 'suspeito');
  assert.match(greenn.diagnostico, /3 h atrasados/);
  assert.equal((await suspeitosDaFonte(env, 'greenn')).length, 6);
  await verificarAlertas(env, AGORA + 600, async (u, init) => { msgs.push(JSON.parse(init.body).text); return new Response('ok'); });
  assert.ok(msgs.some((m) => /Horário suspeito numa integração[\s\S]*Greenn/.test(m)));
});

test('critério 10: grupos com correção aparecem como "corrigido", sem alerta', async () => {
  const db = novoBanco();
  const env = envLimpo(db);
  for (let i = 0; i < 6; i++) {
    const chegadaMs = (AGORA + i * 60) * 1000;
    await registrarHorario(env, 'grupos-whatsapp', new Date(chegadaMs - 180 * 60000).toISOString(), { chegadaMs });
    await registrarHorario(env, 'grupos-whatsapp:corrigido', new Date(chegadaMs - 1000).toISOString(), { chegadaMs });
  }
  const g = (await avaliarFontes(env, AGORA + 600)).find((f) => f.fonte === 'grupos-whatsapp');
  assert.equal(g.situacao, 'corrigido');
  assert.ok(g.depoisDaCorrecao.medianaMin <= 5);
  assert.ok(!(await avaliarFontes(env, AGORA + 600)).some((f) => f.fonte === 'grupos-whatsapp:corrigido'), 'fonte interna fica oculta');
});

test('evento sem horário conta e não quebra; amostra de suspeitos fica limitada a 50', async () => {
  const db = novoBanco();
  const env = envLimpo(db);
  await registrarHorario(env, 'clickup', null, { chegadaMs: AGORA * 1000 });
  assert.equal((await avaliarFontes(env, AGORA + 60)).find((f) => f.fonte === 'clickup').semHorario, 1);
  await eventos(env, 'clickup', 55, 120);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM integracao_horario_suspeitos WHERE fonte = 'clickup'`).get().n, 50);
});

// --- telefone ---

test('critério 16: lead antigo sem o 9 no ClickUp é encontrado quando chega com o 9', async () => {
  const buscados = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const valor = JSON.parse(decodeURIComponent(new URL(url).searchParams.get('custom_fields')))[0].value;
    buscados.push(valor);
    return new Response(JSON.stringify({ tasks: valor === '+551187654321' ? [{ id: 'card-antigo' }] : [] }), { status: 200 });
  };
  try {
    const achou = await searchClickUpTaskPorTelefone('campo', '(11) 98765-4321', { CLICKUP_API_TOKEN: 'x', CLICKUP_LIST_ID: '1' });
    assert.equal(achou.id, 'card-antigo');
    assert.deepEqual(buscados, ['+5511987654321', '+551187654321']);
  } finally {
    globalThis.fetch = original;
  }
});

test('critério 17: identificador da entrada em grupo continua com o telefone cru', () => {
  const cru = telefoneDoJid('558496078857@s.whatsapp.net');
  assert.equal(eventIdDaEntrada('g@g.us', cru), 'grupo:g@g.us:558496078857');
});

test('critério 18: todas as portas usam a mesma regra', () => {
  assert.equal(normalizePhone('558496078857'), '5584996078857');
  assert.equal(toClickUpPhone('558496078857'), '+5584996078857');
});
