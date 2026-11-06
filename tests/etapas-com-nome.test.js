// Série S6, issue S6-01 (spec-etapas-com-nome.md): etapas do formulário
// gravadas com nome — envio pelo chat e pelo cartão, gravação no /tracker e
// carga do histórico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost } from '../functions/tracker.js';
import { nomeDeEtapa } from '../functions/_etapa-nome.js';
import { enviarFormStep } from '../src/scripts/funil.ts';
import { conferirNomesDasEtapas } from '../src/scripts/etapas-nome.ts';

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), 'utf8');

// Perguntas reais do chat, lidas do próprio componente (a lista STEPS).
function perguntasDoChat() {
  const fonte = ler('../src/components/LeadChat.astro');
  const linhas = fonte.split('\n').filter((l) => /\{ kind: '(input|choice)', key: '/.test(l));
  return linhas.map((l) => ({
    chave: l.match(/key: '([^']+)'/)[1],
    etapa: (l.match(/etapa: '([^']*)'/) || [])[1],
  }));
}

// Captura o corpo que o navegador mandaria ao /tracker.
function capturarEnvio(fn) {
  const enviados = [];
  globalThis.window = { location: { href: 'https://x/' } };
  globalThis.Blob = class { constructor(partes) { this.texto = partes.join(''); } };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { sendBeacon: (_url, blob) => { enviados.push(JSON.parse(blob.texto)); return true; } },
  });
  fn();
  return enviados;
}

test('CA-S6-01: responder a pergunta do cargo no chat registra a etapa com o nome "cargo"', () => {
  const perguntas = perguntasDoChat();
  const cargo = perguntas.find((p) => p.chave === 'cargo');
  assert.equal(cargo.etapa, 'cargo');
  // Posição do cargo entre as perguntas do chat (1-based), como o chat anuncia.
  const posicao = perguntas.indexOf(cargo) + 1;
  const fonte = ler('../src/components/LeadChat.astro');
  assert.match(fonte, /enviarFormStep\(posicao \+ 1, \{ funnel: leadFunnel, nome \}\)/);
  const [evento] = capturarEnvio(() => enviarFormStep(posicao, { funnel: 'sessao-estrategica', nome: cargo.etapa }));
  assert.equal(evento.event_name, 'FormStep');
  assert.equal(evento.step, 6);
  assert.equal(evento.step_nome, 'cargo');
});

test('CA-S6-02: pergunta do chat sem nome é apontada pela conferência', () => {
  const problemas = conferirNomesDasEtapas([{ chave: 'nome', etapa: 'nome' }, { chave: 'novaPergunta' }]);
  assert.deepEqual(problemas, ['pergunta "novaPergunta" está sem nome de etapa']);
  // E o chat de verdade não tem nenhuma pergunta sem nome.
  const reais = perguntasDoChat();
  assert.ok(reais.length >= 8);
  assert.deepEqual(conferirNomesDasEtapas(reais).filter((p) => p.includes('sem nome')), []);
});

test('CA-S6-03: nome de etapa repetido no chat é apontado pela conferência', () => {
  const problemas = conferirNomesDasEtapas([{ chave: 'a', etapa: 'cargo' }, { chave: 'b', etapa: 'cargo' }]);
  assert.deepEqual(problemas, ['nome de etapa repetido: "cargo"']);
  assert.deepEqual(conferirNomesDasEtapas(perguntasDoChat()), []);
});

test('CA-S6-04: concluir os cartões 1 e 2 da aplicação registra "contato" e "perfil"', () => {
  const fonte = ler('../src/components/AplicacaoForm.astro');
  assert.match(fonte, /data-etapa="1" data-etapa-nome="contato"/);
  assert.match(fonte, /data-etapa="2" data-etapa-nome="perfil"/);
  assert.match(fonte, /nome: cartao\?\.dataset\.etapaNome/);
  const enviados = capturarEnvio(() => {
    enviarFormStep(1, { funnel: 'aplicacao-mentoria', nome: 'contato' });
    enviarFormStep(2, { funnel: 'aplicacao-mentoria', nome: 'perfil' });
  });
  assert.deepEqual(enviados.map((e) => [e.step, e.step_nome]), [[1, 'contato'], [2, 'perfil']]);
});

// --- /tracker ---------------------------------------------------------------

const COLUNAS_EVENT_LOG = `session_id, event_name, event_id, timestamp, browser, browser_version, os, is_mobile,
  pixel_was_blocked, fbp_source, fbc_source, fbclid_source, ga_cookie_present, ga_client_id_fallback, itp_cookie_extended,
  is_bot, bot_reason, consent_status, sent_to_meta, meta_status_code, meta_response_ok, meta_response_body, meta_payload_sent,
  sent_to_ga4, ga4_status_code, ga4_response_ok, ga4_response_body, ga4_payload_sent, has_email, has_phone, has_name,
  raw_email, funnel, is_junk, material, step, step_nome`;

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

async function formStep(corpoExtra) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ${COLUNAS_EVENT_LOG});`);
  globalThis.fetch = async () => new Response('{}', { status: 200 });
  const pendentes = [];
  await onRequestPost({
    request: new Request('https://x/tracker', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', 'cf-connecting-ip': '200.1.1.1' },
      body: JSON.stringify({ event_name: 'FormStep', event_id: 'stp-1', event_time: 1793930000, lead_data: { funnel: 'sessao-estrategica' }, ...corpoExtra }),
    }),
    env: { DB: d1(db) },
    waitUntil: (p) => pendentes.push(p),
  });
  await Promise.allSettled(pendentes);
  return db.prepare("SELECT step, step_nome FROM event_log WHERE event_name = 'FormStep'").all().map((r) => ({ ...r }));
}

test('CA-S6-05: etapa com nome e posição fica guardada com os dois', async () => {
  assert.deepEqual(await formStep({ step: 6, step_nome: 'cargo' }), [{ step: 6, step_nome: 'cargo' }]);
});

test('CA-S6-06: nome inválido não derruba a etapa — fica a posição, sem nome', async () => {
  for (const ruim of ['', 'a'.repeat(41), 'Cargo', 'meu cargo', 'cargo!']) {
    assert.equal(nomeDeEtapa(ruim), null, `aceitou "${ruim}"`);
    assert.deepEqual(await formStep({ step: 6, step_nome: ruim }), [{ step: 6, step_nome: null }]);
  }
  assert.equal(nomeDeEtapa('a'.repeat(40)), 'a'.repeat(40));
  // Evento do JS antigo, sem o campo.
  assert.deepEqual(await formStep({ step: 3 }), [{ step: 3, step_nome: null }]);
});

// --- Carga do histórico (migration 0069) ------------------------------------

const CORTE = 1793921561; // 05/11/2026 20h32 BRT, commit 93078bd

function cargaDoHistorico(linhas) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT, funnel TEXT, step INTEGER, timestamp INTEGER, step_nome TEXT);`);
  const ins = db.prepare('INSERT INTO event_log (event_name, funnel, step, timestamp, step_nome) VALUES (?, ?, ?, ?, ?)');
  for (const l of linhas) ins.run(l.evento || 'FormStep', l.funil, l.step, l.ts, l.nome ?? null);
  db.exec(ler('../migrations/0069_backfill_step_nome.sql'));
  return db.prepare('SELECT funnel, step, timestamp, step_nome FROM event_log ORDER BY id').all().map((r) => r.step_nome);
}

test('CA-S6-07: etapa 6 do chat gravada antes do corte passa a se chamar "desafio"', () => {
  const nomes = cargaDoHistorico([1, 2, 3, 4, 5, 6].map((step) => ({ funil: 'sessao-estrategica', step, ts: CORTE - 3600 })));
  assert.deepEqual(nomes, ['nome', 'whatsapp', 'email', 'instagram', 'faturamento', 'desafio']);
});

test('CA-S6-08: etapas 6 e 7 do chat depois do corte passam a se chamar "cargo" e "desafio"', () => {
  const nomes = cargaDoHistorico([
    { funil: 'sessao-estrategica', step: 6, ts: CORTE + 60 },
    { funil: 'sessao-estrategica', step: 7, ts: CORTE + 60 },
    { funil: 'diagnostico', step: 6, ts: CORTE + 60 },
    // Já gravada com nome pelo código novo: a carga não mexe.
    { funil: 'sessao-estrategica', step: 6, ts: CORTE + 90, nome: 'cargo' },
    // Linha que não é FormStep: a carga não mexe.
    { evento: 'Lead', funil: 'sessao-estrategica', step: null, ts: CORTE + 60 },
  ]);
  assert.deepEqual(nomes, ['cargo', 'desafio', 'cargo', 'cargo', null]);
});

test('CA-S6-09: etapas 1 e 2 do cartão passam a se chamar "contato" e "perfil"', () => {
  const nomes = cargaDoHistorico(['aplicacao-mentoria', 'trafego-atacado', 'iscas-manychat'].flatMap((funil) => [
    { funil, step: 1, ts: CORTE - 86400 },
    { funil, step: 2, ts: CORTE + 86400 },
  ]));
  assert.deepEqual(nomes, ['contato', 'perfil', 'contato', 'perfil', 'contato', 'perfil']);
});
