// Detalhe das reuniões na Visão geral (spec-detalhe-reunioes.md, série S7):
// a coorte de agendamento contra SQLite real (migrations da agenda e do
// Calendly), o no-show calculado no servidor (/api/agenda/coorte) e o desenho
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
    CREATE TABLE funis_relatorio (id INTEGER PRIMARY KEY, nome TEXT, tipo TEXT, posicao INTEGER, funil_tracking TEXT,
      trecho_campanha TEXT, opcoes_crm TEXT, origem_lead TEXT, situacao TEXT);
  `);
  for (const f of ['0047_agenda.sql', '0059_agenda_tipos_teste.sql',
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
function reuniao({ situacao = 'marcada', criada = '2026-11-03T10:00:00', dia = '2026-11-12T15:00:00', funil = 'sessao-estrategica', nome } = {}) {
  seq++;
  db.prepare(`INSERT INTO agenda_reunioes (id, tipo_id, inicio, fim, nome, email, funil, situacao, token_gestao, criado_em, atualizado_em)
              VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(`r${seq}`, em(dia), em(dia) + 2700, nome || `Lead ${seq}`, `l${seq}@x.com`, funil, situacao, `t${seq}`, em(criada), em(criada));
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
function tela(resposta, fSel = '') {
  const raiz = { innerHTML: '' };
  DR.desenhar(raiz, resposta, fSel, CTX);
  const cards = {};
  for (const [, c] of raiz.innerHTML.matchAll(/<card>(.*?)<\/card>/g)) {
    const [rotulo, valor, anterior, delta, nota] = c.split(' | ');
    cards[rotulo] = { valor, anterior, delta, nota };
  }
  return { html: raiz.innerHTML, cards };
}

const SITUACOES = ['Realizadas', 'Faltaram', 'Canceladas', 'A acontecer', 'Sem presença marcada'];

test('CA-S7-01: os números da seção fecham com o total de criadas', async () => {
  reuniao({ situacao: 'realizada', criada: '2026-11-02T00:44:00', dia: '2026-11-06T15:00:00' });
  reuniao({ situacao: 'faltou', criada: '2026-11-02T13:47:00', dia: '2026-11-06T16:00:00' });
  reuniao({ situacao: 'cancelada', criada: '2026-11-02T20:35:00', dia: '2026-11-06T15:00:00', funil: 'aplicacao-mentoria' });
  for (let i = 0; i < 6; i++) reuniao({ criada: '2026-11-04T18:00:00', dia: `2026-11-1${i}T15:00:00` });
  for (let i = 0; i < 2; i++) reuniao({ situacao: 'remarcada', criada: '2026-11-03T05:43:00', dia: `2026-11-1${i}T17:00:00` });
  reuniao({ criada: '2026-10-30T10:00:00', dia: '2026-11-10T09:00:00' }); // criada antes da semana: fora

  const { cards } = tela(await coorte());
  assert.equal(cards['Criadas'].valor, '11');
  assert.equal(cards['Realizadas'].valor, '1');
  assert.equal(cards['Faltaram'].valor, '1');
  assert.equal(cards['Canceladas'].valor, '1');
  assert.equal(cards['A acontecer'].valor, '8');
  assert.equal(cards['Sem presença marcada'].valor, '0');
  const soma = SITUACOES.reduce((t, r) => t + Number(cards[r].valor), 0);
  assert.equal(soma, Number(cards['Criadas'].valor));
});

test('CA-S7-02: no-show é faltou sobre realizada mais faltou', async () => {
  reuniao({ situacao: 'realizada', dia: '2026-11-06T15:00:00' });
  reuniao({ situacao: 'faltou', dia: '2026-11-06T16:00:00' });
  reuniao({ situacao: 'cancelada', dia: '2026-11-06T17:00:00' });
  for (let i = 0; i < 8; i++) reuniao({ dia: '2026-11-12T15:00:00' });
  reuniao({ dia: '2026-11-07T10:00:00' }); // já passou, ninguém marcou
  reuniao({ situacao: 'sem_info', dia: '2026-11-07T11:00:00' });

  const resposta = await coorte();
  assert.equal(resposta.atual.total.no_show, 50);
  const { cards } = tela(resposta);
  assert.equal(cards['Sem presença marcada'].valor, '2');
  assert.equal(cards['A acontecer'].valor, '8');
  assert.equal(cards['No-show'].valor, '50%');
  assert.equal(cards['No-show'].nota, '1 de 2');
});

test('CA-S7-03: sem nenhuma presença marcada o no-show não vira 0%', async () => {
  reuniao({ situacao: 'cancelada', dia: '2026-11-06T15:00:00' });
  reuniao({ dia: '2026-11-07T10:00:00' }); // passou sem presença
  reuniao({ dia: '2026-11-12T15:00:00' }); // a acontecer

  const resposta = await coorte();
  assert.equal(resposta.atual.total.no_show, null);
  const { cards } = tela(resposta);
  assert.equal(cards['No-show'].valor, '—');
  assert.notEqual(cards['No-show'].valor, '0%');
});

test('CA-S7-09: filtro de funil restringe os números', async () => {
  reuniao({ situacao: 'realizada', dia: '2026-11-06T15:00:00' });
  reuniao({ situacao: 'faltou', dia: '2026-11-06T16:00:00' });
  reuniao({ dia: '2026-11-12T15:00:00' });
  // Aplicação Mentoria é porta da SE (SUP-S7-07): conta em SE.
  reuniao({ situacao: 'realizada', dia: '2026-11-06T18:00:00', funil: 'aplicacao-mentoria' });
  reuniao({ situacao: 'cancelada', dia: '2026-11-06T15:00:00', funil: 'workshop' });
  reuniao({ situacao: 'faltou', dia: '2026-11-06T17:00:00', funil: 'workshop' });

  const resposta = await coorte();
  const se = tela(resposta, 'sessao-estrategica').cards;
  assert.equal(se['Criadas'].valor, '4');
  assert.equal(se['Realizadas'].valor, '2');
  assert.equal(se['Faltaram'].valor, '1');
  assert.equal(se['Canceladas'].valor, '0');
  assert.equal(se['A acontecer'].valor, '1');
  assert.equal(se['No-show'].valor, '33%');
  const ws = tela(resposta, 'workshop').cards;
  assert.equal(ws['Criadas'].valor, '2');
  assert.equal(ws['Canceladas'].valor, '1');
  assert.equal(ws['No-show'].valor, '100%');
  // Sem filtro, as seis.
  assert.equal(tela(resposta).cards['Criadas'].valor, '6');
});

test('CA-S7-14: números comparados com o período anterior', async () => {
  // Semana 02–08/11: 11 criadas, 1 realizada e 1 falta (no-show 50%).
  reuniao({ situacao: 'realizada', dia: '2026-11-06T15:00:00' });
  reuniao({ situacao: 'faltou', dia: '2026-11-06T16:00:00' });
  for (let i = 0; i < 9; i++) reuniao({ dia: '2026-11-12T15:00:00' });
  // Anterior 26/10–01/11: 8 criadas, 3 realizadas e 1 falta (no-show 25%).
  const antes = { criada: '2026-10-27T10:00:00' };
  for (let i = 0; i < 3; i++) reuniao({ ...antes, situacao: 'realizada', dia: '2026-10-30T15:00:00' });
  reuniao({ ...antes, situacao: 'faltou', dia: '2026-10-30T16:00:00' });
  // A última foi agendada no período anterior e só acontece nesta semana: conta lá, não aqui.
  for (let i = 0; i < 3; i++) reuniao({ ...antes, situacao: 'cancelada', dia: '2026-10-31T15:00:00' });
  reuniao({ criada: '2026-10-31T10:00:00', situacao: 'cancelada', dia: '2026-11-04T15:00:00' });

  const { cards } = tela(await coorte());
  assert.deepEqual(cards['Criadas'], { valor: '11', anterior: '8', delta: '38', nota: '' });
  assert.equal(cards['Realizadas'].anterior, '3');
  assert.equal(cards['No-show'].valor, '50%');
  assert.equal(cards['No-show'].anterior, '25%');
  assert.equal(cards['No-show'].delta, '100');
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

test('CA-S7-04: lista de quem ainda vai fazer mostra todas as futuras do período', async () => {
  reuniao({ nome: 'Yago', criada: '2026-11-03T23:07:00', dia: '2026-11-16T17:00:00' });
  reuniao({ nome: 'Fabiane', criada: '2026-11-04T18:07:00', dia: '2026-11-09T14:00:00' });
  reuniao({ nome: 'Erica', criada: '2026-11-06T15:17:00', dia: '2026-11-10T15:00:00' });
  reuniao({ nome: 'Antiga', criada: '2026-10-30T10:00:00', dia: '2026-11-10T09:00:00' }); // criada antes do período

  const { listas } = await listasNaTela();
  const lista = listas['Ainda vão acontecer'];
  assert.equal(lista.qtd, 3);
  assert.deepEqual(lista.linhas, [
    'Fabiane Sessão Estratégica seg., 09/11, 14:00',
    'Erica Sessão Estratégica ter., 10/11, 15:00',
    'Yago Sessão Estratégica seg., 16/11, 17:00',
  ]);
  assert.ok(!lista.linhas.some((l) => l.includes('Antiga')));
});

test('CA-S7-05: reunião remarcada para o futuro conta como a acontecer', async () => {
  const id = reuniao({ nome: 'Caio', situacao: 'remarcada', criada: '2026-11-03T05:43:00', dia: '2026-11-12T15:00:00' });
  remarcou(id, 'sex., 06/11, 15:00 → qui., 12/11, 15:00', '2026-11-05T10:00:00');

  const { listas, numeros } = await listasNaTela();
  assert.match(numeros, /<card>A acontecer \| 1 \|/);
  assert.deepEqual(listas['Ainda vão acontecer'].linhas, ['Caio remarcada Sessão Estratégica qui., 12/11, 15:00']);
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
  const id = reuniao({ nome: 'Hugo', situacao: 'realizada', criada: '2026-11-04T22:16:00', dia: '2026-11-12T17:00:00' });
  remarcou(id, 'sex., 06/11, 15:00 → ter., 10/11, 15:00', '2026-11-05T09:00:00');
  remarcou(id, 'ter., 10/11, 15:00 → qui., 12/11, 17:00', '2026-11-07T11:00:00');
  reuniao({ nome: 'Miqueias', criada: '2026-11-07T16:50:00', dia: '2026-11-13T17:00:00' }); // não remarcou

  const { listas, numeros } = await listasNaTela({ agora: '2026-11-13T08:00:00' });
  const reag = listas['Reagendamentos'];
  assert.equal(reag.qtd, 1);
  assert.equal(reag.linhas[0],
    'Hugo Sessão Estratégica 2 remarcações · agora: realizada sex., 06/11, 15:00 → ter., 10/11, 15:00 ter., 10/11, 15:00 → qui., 12/11, 17:00');
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

test('CA-S7-11: período ou lista vazios avisam em vez de sumir', async () => {
  // Período sem nenhuma reunião criada.
  const vazio = await listasNaTela();
  assert.match(vazio.html, /Nenhuma reunião criada no período\./);
  assert.equal(Object.keys(vazio.listas).length, 0);
  // Período em que ninguém faltou.
  reuniao({ nome: 'Izabell', situacao: 'realizada', dia: '2026-11-06T15:00:00' });
  const { listas } = await listasNaTela();
  assert.equal(listas['Faltaram'].qtd, 0);
  assert.equal(listas['Faltaram'].vazia, 'Ninguém faltou.');
});

test('CA-S7-13: listas começam fechadas, cada uma num drop próprio', async () => {
  reuniao({ nome: 'Patricia', situacao: 'faltou', dia: '2026-11-06T16:00:00' });
  for (let i = 0; i < 8; i++) reuniao({ nome: `Futuro ${i}`, dia: '2026-11-12T15:00:00' });

  const { listas, html } = await listasNaTela();
  assert.deepEqual(Object.keys(listas), ['Ainda vão acontecer', 'Faltaram', 'Cancelaram', 'Sem presença marcada', 'Reagendamentos']);
  assert.equal(listas['Ainda vão acontecer'].qtd, 8);
  assert.equal(listas['Faltaram'].qtd, 1);
  // Fechadas ao abrir a tela; cada uma é um <details> à parte (abre e fecha sozinha).
  assert.ok(Object.values(listas).every((l) => !l.aberta));
  assert.equal((html.match(/<details /g) || []).length, 5);
  assert.equal((html.match(/<\/details>/g) || []).length, 5);
}); 
