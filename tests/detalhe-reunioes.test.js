// Detalhe das reuniões na Visão geral (spec-detalhe-reunioes.md, série S7, com
// a régua da série S9, spec-funil-leads-novos.md: as reuniões que caem no
// período, pela data da reunião) contra SQLite real (migrations da agenda e do
// Calendly), comparecimento e no-show calculados no servidor
// (/api/agenda/coorte) e o desenho
// de public/dash/detalhe-reunioes.js com um contexto falso no lugar dos
// ajudantes do index.html.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import { onRequestGet as coorteGet } from '../functions/api/agenda/coorte.js';

const em = (iso) => Math.floor(Date.parse(`${iso}-03:00`) / 1000);
const SEMANA = { de: em('2026-11-02T00:00:00'), ate: em('2026-11-08T23:59:59') };
const ANTERIOR = { de: em('2026-10-26T00:00:00'), ate: em('2026-11-01T23:59:59') };

let db, env, seq;

function banco() {
  const b = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  b.exec(`
    CREATE TABLE sessions (session_id TEXT PRIMARY KEY, ip_address TEXT, funnel TEXT DEFAULT '', utm_source TEXT, utm_campaign TEXT);
    CREATE TABLE event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, event_name TEXT NOT NULL, event_id TEXT,
      timestamp INTEGER NOT NULL, is_bot INTEGER DEFAULT 0, is_junk INTEGER NOT NULL DEFAULT 0, raw_email TEXT DEFAULT '',
      funnel TEXT DEFAULT '', material TEXT, origin TEXT);
    CREATE TABLE campaign_funnel_map (campaign_id TEXT PRIMARY KEY, funnel TEXT);
    CREATE TABLE lead_dispatch (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, resultado TEXT, task_id TEXT);
    CREATE TABLE ad_spend (platform TEXT, date TEXT, campaign_id TEXT, campaign_name TEXT, spend_cents INTEGER);
    CREATE TABLE sync_log (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT, status TEXT, run_at INTEGER);
    CREATE TABLE funis_relatorio (id INTEGER PRIMARY KEY, nome TEXT, tipo TEXT, posicao INTEGER, funil_tracking TEXT,
      trecho_campanha TEXT, opcoes_crm TEXT, origem_lead TEXT, situacao TEXT);
  `);
  for (const f of ['0032_greenn_webhook.sql', '0047_agenda.sql', '0059_agenda_tipos_teste.sql',
    '0063_calendly_consultorias.sql', '0065_calendly_detalhes.sql', '0066_calendly_presenca.sql']) {
    b.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  }
  b.exec(`INSERT INTO agenda_tipos (id, slug, nome, duracao_min, destino_cal, grade_id, comercial, funil, criado_em, atualizado_em)
          VALUES (1, 'consultoria', 'Consultoria', 45, 'cal', 1, 1, 'sessao-estrategica', 0, 0)`);
  return b;
}

beforeEach(() => {
  seq = 0;
  db = banco();
  env = { DASH_KEY: 'k', DB: d1(db) };
});

/** Reunião da agenda própria criada em `criada`, marcada para `dia` (horários de Brasília). */
function reuniao({ situacao = 'marcada', criada = '2026-11-03T10:00:00', dia = '2026-11-07T15:00:00', funil = 'sessao-estrategica', nome, email } = {}) {
  seq++;
  db.prepare(`INSERT INTO agenda_reunioes (id, tipo_id, inicio, fim, nome, email, funil, situacao, token_gestao, criado_em, atualizado_em)
              VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(`r${seq}`, em(dia), em(dia) + 2700, nome || `Lead ${seq}`, email || `l${seq}@x.com`, funil, situacao, `t${seq}`, em(criada), em(criada));
  return `r${seq}`;
}

/** A resposta de /api/agenda/coorte para a semana 02–08/11 (e a anterior), vista de `agora`. */
async function coorte(agora = '2026-11-09T08:00:00') {
  const real = Date.now;
  Date.now = () => em(agora) * 1000;
  try {
    const url = `https://x/api/agenda/coorte?key=k&from=${SEMANA.de}&to=${SEMANA.ate}&antFrom=${ANTERIOR.de}&antTo=${ANTERIOR.ate}`;
    const res = await coorteGet({ request: new Request(url), env });
    assert.equal(res.status, 200);
    return res.json();
  } finally {
    Date.now = real;
  }
}

// ---------------------------------------------------------------------------
// Desenho: public/dash/detalhe-reunioes.js com um contexto falso. O `tile`
// falso escreve cada card numa linha "rótulo | valor | anterior | variação | nota".
// ---------------------------------------------------------------------------
globalThis.window = globalThis.window || {};
new Function(readFileSync(new URL('../public/dash/detalhe-reunioes.js', import.meta.url), 'utf8'))();
const DR = globalThis.window.DetalheReunioes;

const fmtInt = (n) => Number(n || 0).toLocaleString('pt-BR');
const fmtPct = (n, c = 1) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: c, minimumFractionDigits: c }) + '%';
const CTX = {
  esc: (s) => String(s), fmtInt, fmtPct,
  tile: (k) => `<card>${k.rotulo} | ${k.valor ?? '—'} | ${k.anterior ?? ''} | ${k.delta === undefined ? '' : Math.round(k.delta)} | ${k.nota || ''}</card>`,
};

/** { rótulo: { valor, anterior, delta, nota } } dos cards na tela. */
function tela(resposta, fSel = '', taxas) {
  const raiz = { innerHTML: '' };
  DR.desenhar(raiz, resposta, fSel, CTX, undefined, taxas);
  const cards = {};
  for (const [, c] of raiz.innerHTML.matchAll(/<card>(.*?)<\/card>/g)) {
    const [rotulo, valor, anterior, delta, nota] = c.split(' | ');
    cards[rotulo] = { valor, anterior, delta, nota };
  }
  return { html: raiz.innerHTML, cards };
}

const SITUACOES = ['Realizadas', 'Faltaram', 'Canceladas', 'A acontecer', 'Sem presença marcada'];
// Sábado de manhã, ainda dentro da semana 02–08/11: o que está marcado para
// sábado à tarde e domingo ainda vai acontecer.
const SABADO = '2026-11-07T08:00:00';

test('CA-S9-14: a seção conta as reuniões pela data em que acontecem', async () => {
  // Agendada no período anterior para um dia desta semana: entra.
  reuniao({ nome: 'Antiga', situacao: 'realizada', criada: '2026-10-30T10:00:00', dia: '2026-11-04T09:00:00' });
  // Agendada nesta semana para depois dela: não entra nos quadros de situação nem nas listas.
  reuniao({ nome: 'Depois', criada: '2026-11-03T10:00:00', dia: '2026-11-12T15:00:00' });

  const { listas, numeros } = await listasNaTela();
  assert.match(numeros, /<card>Na agenda \| 1 \|/);
  assert.match(numeros, /<card>Realizadas \| 1 \|/);
  assert.match(numeros, /<card>A acontecer \| 0 \|/);
  assert.match(numeros, /<card>Agendadas no período \| 1 \|/);
  assert.ok(Object.values(listas).every((l) => !l.linhas.some((x) => x.includes('Depois'))));
});

test('CA-S9-16: os quadros de situação fecham com o total da agenda', async () => {
  reuniao({ situacao: 'realizada', dia: '2026-11-03T15:00:00' });
  reuniao({ situacao: 'realizada', dia: '2026-11-03T16:00:00' });
  reuniao({ situacao: 'faltou', dia: '2026-11-03T17:00:00' });
  reuniao({ situacao: 'cancelada', dia: '2026-11-04T15:00:00', funil: 'aplicacao-mentoria' });
  reuniao({ dia: '2026-11-07T15:00:00' }); // ainda vai acontecer
  reuniao({ dia: '2026-11-04T16:00:00' }); // passou e ninguém marcou

  const { cards } = tela(await coorte(SABADO));
  assert.equal(cards['Na agenda'].valor, '6');
  assert.equal(cards['Realizadas'].valor, '2');
  assert.equal(cards['Faltaram'].valor, '1');
  assert.equal(cards['Canceladas'].valor, '1');
  assert.equal(cards['A acontecer'].valor, '1');
  assert.equal(cards['Sem presença marcada'].valor, '1');
  const soma = SITUACOES.reduce((t, r) => t + Number(cards[r].valor), 0);
  assert.equal(soma, Number(cards['Na agenda'].valor));
});

test('CA-S9-17: comparecimento e no-show', async () => {
  for (let i = 0; i < 3; i++) reuniao({ situacao: 'realizada', dia: `2026-11-0${3 + i}T15:00:00` });
  reuniao({ situacao: 'faltou', dia: '2026-11-06T16:00:00' });
  reuniao({ situacao: 'cancelada', dia: '2026-11-06T17:00:00' }); // fora da conta
  reuniao({ situacao: 'sem_info', dia: '2026-11-07T11:00:00' }); // fora da conta

  const resposta = await coorte();
  assert.equal(resposta.atual.total.no_show, 25);
  assert.equal(resposta.atual.total.comparecimento, 75);
  const { cards } = tela(resposta);
  assert.equal(cards['Comparecimento'].valor, '75%');
  assert.equal(cards['Comparecimento'].nota, '3 de 4');
  assert.equal(cards['No-show'].valor, '25%');
  assert.equal(cards['No-show'].nota, '1 de 4');
});

test('CA-S9-18: sem presença marcada, comparecimento e no-show não viram 0%', async () => {
  reuniao({ situacao: 'cancelada', dia: '2026-11-06T15:00:00' });
  reuniao({ dia: '2026-11-04T10:00:00' }); // passou sem presença
  reuniao({ dia: '2026-11-07T15:00:00' }); // a acontecer

  const resposta = await coorte(SABADO);
  assert.equal(resposta.atual.total.no_show, null);
  assert.equal(resposta.atual.total.comparecimento, null);
  const { cards } = tela(resposta);
  for (const r of ['Comparecimento', 'No-show']) {
    assert.equal(cards[r].valor, '—');
    assert.equal(cards[r].nota, 'sem presença marcada');
  }
});

test('CA-S9-22: filtro de funil restringe quadros e listas', async () => {
  reuniao({ nome: 'Ana', situacao: 'realizada', dia: '2026-11-06T15:00:00' });
  // Aplicação Mentoria é porta da SE (SUP-S7-07): conta em SE.
  reuniao({ nome: 'Bia', situacao: 'faltou', dia: '2026-11-06T16:00:00', funil: 'aplicacao-mentoria' });
  reuniao({ nome: 'Caio', situacao: 'faltou', dia: '2026-11-06T17:00:00', funil: 'aquisicao' });

  const aq = await listasNaTela({ funil: 'aquisicao' });
  assert.match(aq.numeros, /<card>Na agenda \| 1 \|/);
  assert.match(aq.numeros, /<card>No-show \| 100% \|/);
  assert.deepEqual(aq.listas['Faltaram'].linhas, ['Caio Aquisição sex., 06/11, 17:00']);
  const se = tela(await coorte(), 'sessao-estrategica').cards;
  assert.equal(se['Na agenda'].valor, '2');
  assert.equal(se['Realizadas'].valor, '1');
  assert.equal(se['No-show'].valor, '50%');
  // Sem filtro, as três.
  assert.equal(tela(await coorte()).cards['Na agenda'].valor, '3');
});

test('CA-S9-23: quadros comparados com o período anterior', async () => {
  // Semana 02–08/11: 4 na agenda (1 realizada, 1 falta).
  reuniao({ situacao: 'realizada', dia: '2026-11-06T15:00:00' });
  reuniao({ situacao: 'faltou', dia: '2026-11-06T16:00:00' });
  for (let i = 0; i < 2; i++) reuniao({ situacao: 'cancelada', dia: '2026-11-05T15:00:00' });
  // Anterior 26/10–01/11: 2 na agenda, as duas realizadas.
  for (let i = 0; i < 2; i++) reuniao({ criada: '2026-10-27T10:00:00', situacao: 'realizada', dia: '2026-10-30T15:00:00' });
  // Agendada na semana anterior para depois desta: não cai em nenhuma das duas agendas.
  reuniao({ criada: '2026-10-31T10:00:00', dia: '2026-11-10T15:00:00' });

  const { cards } = tela(await coorte());
  assert.equal(cards['Na agenda'].valor, '4');
  assert.equal(cards['Na agenda'].anterior, '2');
  assert.equal(cards['Na agenda'].delta, '100');
  assert.equal(cards['Realizadas'].anterior, '2');
  assert.equal(cards['No-show'].valor, '50%');
  assert.equal(cards['No-show'].anterior, '0%');
  assert.equal(cards['Agendadas no período'].valor, '4');
  assert.equal(cards['Agendadas no período'].anterior, '3');
});

// ---------------------------------------------------------------------------
// Agendadas no período, separadas em lead novo e lead antigo: o CRM simulado
// devolve os cards criados no período (/api/agenda/taxas lê pelo `recorte`).
// ---------------------------------------------------------------------------
import { recorte as recorteDasTaxas } from '../functions/api/agenda/taxas.js';
import { CU_FIELD } from '../functions/api/_clickup.js';

function cardCrm(email, criado = '2026-11-03T09:00:00') {
  seq++;
  return {
    id: `card${seq}`, name: `Lead ${seq}`, status: { status: 'qualificação' }, date_created: String(em(criado) * 1000),
    custom_fields: [
      { id: CU_FIELD.funil, value: 'opt-se', type_config: { options: [{ id: 'opt-se', name: 'SE', orderindex: 0 }] } },
      { id: CU_FIELD.faturamento, value: 'De 50 a 100 mil' },
      { id: CU_FIELD.email, value: email },
    ],
  };
}

/** A resposta de /api/agenda/taxas ({ atual, anterior }); `cards` null = CRM fora do ar. */
async function taxas(cards, agora = '2026-11-09T08:00:00') {
  db.prepare(`INSERT INTO funis_relatorio VALUES (1, 'SE', 'lead_mql', 1, 'sessao-estrategica', '', ?, 'qualquer', 'ativo')`)
    .run(JSON.stringify([{ id: 'opt-se', nome: 'SE' }]));
  env.CLICKUP_API_TOKEN = 't';
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!cards || !String(url).includes('/task?')) return new Response('fora do ar', { status: 500 });
    const u = new URL(String(url));
    const de = Number(u.searchParams.get('date_created_gt')), ate = Number(u.searchParams.get('date_created_lt'));
    return Response.json({ tasks: cards.filter((c) => Number(c.date_created) > de && Number(c.date_created) < ate), last_page: true });
  };
  try {
    const lado = (p) => recorteDasTaxas(env, p.de, p.ate, em(agora), ['sessao-estrategica']);
    return { atual: await lado(SEMANA), anterior: await lado(ANTERIOR) };
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}

test('CA-S9-15: leads novos e antigos entram juntos', async () => {
  reuniao({ email: 'novo@x.com', situacao: 'realizada', dia: '2026-11-05T15:00:00' });
  reuniao({ email: 'antigo@x.com', situacao: 'realizada', dia: '2026-11-05T16:00:00' });
  const cards = [cardCrm('novo@x.com'), cardCrm('antigo@x.com', '2026-01-28T15:00:00')];

  const tx = await taxas(cards);
  const c = tela(await coorte(), '', tx).cards;
  assert.equal(c['Na agenda'].valor, '2');
  assert.equal(c['Realizadas'].valor, '2');
  assert.equal(c['Agendadas no período'].nota, '1 de lead novo · 1 de lead antigo');
});

test('CA-S9-19: Agendadas no período separa lead novo de lead antigo', async () => {
  reuniao({ email: 'n1@x.com', dia: '2026-11-06T15:00:00' });
  reuniao({ email: 'n2@x.com', dia: '2026-11-12T15:00:00' }); // agendou na semana, acontece depois
  reuniao({ email: 'velho@x.com', dia: '2026-11-06T16:00:00' });
  const cards = [cardCrm('n1@x.com'), cardCrm('N2@x.com'), cardCrm('velho@x.com', '2026-10-01T09:00:00')];

  const tx = await taxas(cards);
  assert.deepEqual(tx.atual.agendou_lead_novo, { total: 2, por_funil: { 'sessao-estrategica': 2 } });
  const c = tela(await coorte(), '', tx).cards;
  assert.equal(c['Agendadas no período'].valor, '3');
  assert.equal(c['Agendadas no período'].nota, '2 de lead novo · 1 de lead antigo');
});

test('CA-S9-20: Agendadas no período aparece mesmo sem o CRM', async () => {
  for (let i = 0; i < 3; i++) reuniao({ dia: '2026-11-06T15:00:00' });

  const tx = await taxas(null);
  assert.equal(tx.atual.crm_lido, false);
  for (const semCrm of [tx, null]) {
    const c = tela(await coorte(), '', semCrm).cards;
    assert.equal(c['Agendadas no período'].valor, '3');
    assert.equal(c['Agendadas no período'].nota, 'sem dados do CRM');
  }
});

// ---------------------------------------------------------------------------
// Listas de nomes (S7-03): /api/agenda/detalhe e os cinco drops.
// ---------------------------------------------------------------------------
import { onRequestGet as detalheGet } from '../functions/api/agenda/detalhe.js';

/** Remarcação gravada no histórico, como o _agenda.js e o sync do Google gravam. */
function remarcou(id, detalhe, quando) {
  db.prepare(`INSERT INTO agenda_historico (reuniao_id, acao, detalhe, por, criado_em) VALUES (?, 'remarcou', ?, 'equipe', ?)`)
    .run(id, detalhe, em(quando));
}

async function detalhe({ agora = '2026-11-09T08:00:00', funil = '', key = 'k', de = SEMANA.de, ate = SEMANA.ate } = {}) {
  const real = Date.now;
  Date.now = () => em(agora) * 1000;
  try {
    const q = new URLSearchParams({ from: String(de), to: String(ate), funil });
    if (key !== null) q.set('key', key);
    return await detalheGet({ request: new Request(`https://x/api/agenda/detalhe?${q}`), env });
  } finally {
    Date.now = real;
  }
}

/** { título: { qtd, aberta, linhas: [texto da linha], vazia } } das listas na tela. */
async function listasNaTela({ agora, funil = '' } = {}) {
  const resposta = await (await detalhe({ agora, funil })).json();
  const { html } = tela(await coorte(agora), funil);
  const raiz = { innerHTML: '' };
  DR.desenhar(raiz, await coorte(agora), funil, CTX, resposta);
  const listas = {};
  for (const bloco of raiz.innerHTML.split('<details').slice(1)) {
    const [, attrs, titulo, qtd] = bloco.match(/^([^>]*)><summary>(.*?) <span class="dr-qtd">\((\d+)\)<\/span><\/summary>/);
    const linhas = [...bloco.matchAll(/<li class="dr-linha[^"]*">([\s\S]*?)<\/li>(?=<li class="dr-linha|<\/ul>)/g)]
      .map(([, l]) => l.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    const vazia = (bloco.match(/<p class="dr-vazio">(.*?)<\/p>/) || [])[1] || null;
    listas[titulo] = { qtd: Number(qtd), aberta: /\bopen\b/.test(attrs), linhas, vazia };
  }
  return { listas, html: raiz.innerHTML, numeros: html };
}

test('CA-S9-21: as listas trazem os nomes das reuniões que caem no período', async () => {
  reuniao({ nome: 'Fabiane', dia: '2026-11-07T15:00:00' }); // ainda vai acontecer
  reuniao({ nome: 'Patricia', situacao: 'faltou', dia: '2026-11-05T16:00:00' });
  reuniao({ nome: 'Daniel', situacao: 'cancelada', dia: '2026-11-05T15:00:00', funil: 'workshop' });
  reuniao({ nome: 'Ellen', dia: '2026-11-04T15:00:00' }); // passou e ninguém marcou
  const id = reuniao({ nome: 'Caio', situacao: 'remarcada', dia: '2026-11-08T10:00:00' });
  remarcou(id, 'qua., 04/11, 15:00 → dom., 08/11, 10:00', '2026-11-03T12:00:00');

  const { listas } = await listasNaTela({ agora: SABADO });
  assert.deepEqual(listas['Ainda vão acontecer'].linhas, [
    'Fabiane Sessão Estratégica sáb., 07/11, 15:00',
    'Caio remarcada Sessão Estratégica dom., 08/11, 10:00',
  ]);
  assert.deepEqual(listas['Faltaram'].linhas, ['Patricia Sessão Estratégica qui., 05/11, 16:00']);
  assert.deepEqual(listas['Cancelaram'].linhas, ['Daniel Workshop qui., 05/11, 15:00']);
  assert.deepEqual(listas['Sem presença marcada'].linhas, ['Ellen Sessão Estratégica qua., 04/11, 15:00']);
  assert.equal(listas['Reagendamentos'].qtd, 1);
  assert.match(listas['Reagendamentos'].linhas[0], /^Caio Sessão Estratégica 1 remarcação · agora: a acontecer/);
});

test('CA-S7-04: lista de quem ainda vai fazer mostra todas as futuras do período', async () => {
  reuniao({ nome: 'Yago', criada: '2026-11-03T23:07:00', dia: '2026-11-08T17:00:00' });
  reuniao({ nome: 'Fabiane', criada: '2026-11-04T18:07:00', dia: '2026-11-07T14:00:00' });
  reuniao({ nome: 'Erica', criada: '2026-11-06T15:17:00', dia: '2026-11-07T15:00:00' });
  reuniao({ nome: 'Depois', criada: '2026-11-06T10:00:00', dia: '2026-11-10T09:00:00' }); // acontece depois do período

  const { listas } = await listasNaTela({ agora: SABADO });
  const lista = listas['Ainda vão acontecer'];
  assert.equal(lista.qtd, 3);
  assert.deepEqual(lista.linhas, [
    'Fabiane Sessão Estratégica sáb., 07/11, 14:00',
    'Erica Sessão Estratégica sáb., 07/11, 15:00',
    'Yago Sessão Estratégica dom., 08/11, 17:00',
  ]);
  assert.ok(!lista.linhas.some((l) => l.includes('Depois')));
});

test('CA-S7-05: reunião remarcada para o futuro conta como a acontecer', async () => {
  const id = reuniao({ nome: 'Caio', situacao: 'remarcada', criada: '2026-11-03T05:43:00', dia: '2026-11-07T15:00:00' });
  remarcou(id, 'qui., 05/11, 15:00 → sáb., 07/11, 15:00', '2026-11-04T10:00:00');

  const { listas, numeros } = await listasNaTela({ agora: SABADO });
  assert.match(numeros, /<card>A acontecer \| 1 \|/);
  assert.deepEqual(listas['Ainda vão acontecer'].linhas, ['Caio remarcada Sessão Estratégica sáb., 07/11, 15:00']);
});

test('CA-S7-06: listas de faltaram e cancelaram com os nomes', async () => {
  reuniao({ nome: 'Patricia', situacao: 'faltou', criada: '2026-11-02T13:47:00', dia: '2026-11-06T16:00:00' });
  reuniao({ nome: 'Daniel Aguiar', situacao: 'cancelada', criada: '2026-11-02T20:35:00', dia: '2026-11-06T15:00:00', funil: 'workshop' });

  const { listas } = await listasNaTela();
  assert.deepEqual(listas['Faltaram'].linhas, ['Patricia Sessão Estratégica sex., 06/11, 16:00']);
  assert.deepEqual(listas['Cancelaram'].linhas, ['Daniel Aguiar Workshop sex., 06/11, 15:00']);
});

test('CA-S7-07: reunião que passou sem presença fica em lista própria', async () => {
  reuniao({ nome: 'Izabell', situacao: 'realizada', dia: '2026-11-06T15:00:00' });
  reuniao({ nome: 'Patricia', situacao: 'faltou', dia: '2026-11-06T16:00:00' });
  reuniao({ nome: 'Ellen', dia: '2026-11-07T15:00:00' }); // passou e ninguém marcou

  const { listas, numeros } = await listasNaTela();
  assert.deepEqual(listas['Sem presença marcada'].linhas, ['Ellen Sessão Estratégica sáb., 07/11, 15:00']);
  assert.equal(listas['Ainda vão acontecer'].qtd, 0);
  assert.match(numeros, /<card>No-show \| 50% \|/); // 1 de 2: a Ellen não entra
});

test('CA-S7-08: reagendamentos com o histórico das trocas', async () => {
  const id = reuniao({ nome: 'Hugo', situacao: 'realizada', criada: '2026-11-02T22:16:00', dia: '2026-11-06T17:00:00' });
  remarcou(id, 'ter., 03/11, 15:00 → qui., 05/11, 15:00', '2026-11-03T09:00:00');
  remarcou(id, 'qui., 05/11, 15:00 → sex., 06/11, 17:00', '2026-11-04T11:00:00');
  reuniao({ nome: 'Miqueias', criada: '2026-11-04T16:50:00', dia: '2026-11-07T17:00:00' }); // não remarcou

  const { listas, numeros } = await listasNaTela();
  const reag = listas['Reagendamentos'];
  assert.equal(reag.qtd, 1);
  assert.equal(reag.linhas[0],
    'Hugo Sessão Estratégica 2 remarcações · agora: realizada ter., 03/11, 15:00 → qui., 05/11, 15:00 qui., 05/11, 15:00 → sex., 06/11, 17:00');
  assert.match(numeros, /<card>Realizadas \| 1 \|/);
});

test('CA-S7-10: só a equipe com a chave do dash vê os nomes', async () => {
  reuniao({ nome: 'Patricia', situacao: 'faltou', dia: '2026-11-06T16:00:00' });
  for (const key of [null, 'errada']) {
    const res = await detalhe({ key });
    assert.equal(res.status, 401);
    const corpo = await res.text();
    assert.ok(!corpo.includes('Patricia'));
    assert.ok(!corpo.includes('@x.com'));
  }
  assert.equal((await detalhe()).status, 200);
});

test('CA-S9-24: período sem reunião avisa em vez de sumir', async () => {
  // Período sem nenhuma reunião na agenda e nenhuma agendada.
  const vazio = await listasNaTela();
  assert.match(vazio.html, /Nenhuma reunião no período\./);
  assert.equal(Object.keys(vazio.listas).length, 0);
  // Período em que ninguém faltou: a lista avisa (CA-S7-11).
  reuniao({ nome: 'Izabell', situacao: 'realizada', dia: '2026-11-06T15:00:00' });
  const { listas } = await listasNaTela();
  assert.equal(listas['Faltaram'].qtd, 0);
  assert.equal(listas['Faltaram'].vazia, 'Ninguém faltou.');
});

test('CA-S7-13: listas começam fechadas, cada uma num drop próprio', async () => {
  reuniao({ nome: 'Patricia', situacao: 'faltou', dia: '2026-11-06T16:00:00' });
  for (let i = 0; i < 8; i++) reuniao({ nome: `Futuro ${i}`, dia: '2026-11-07T15:00:00' });

  const { listas, html } = await listasNaTela({ agora: SABADO });
  assert.deepEqual(Object.keys(listas), ['Ainda vão acontecer', 'Faltaram', 'Cancelaram', 'Sem presença marcada', 'Reagendamentos']);
  assert.equal(listas['Ainda vão acontecer'].qtd, 8);
  assert.equal(listas['Faltaram'].qtd, 1);
  // Fechadas ao abrir a tela; cada uma é um <details> à parte (abre e fecha sozinha).
  assert.ok(Object.values(listas).every((l) => !l.aberta));
  assert.equal((html.match(/<details /g) || []).length, 5);
  assert.equal((html.match(/<\/details>/g) || []).length, 5);
});
