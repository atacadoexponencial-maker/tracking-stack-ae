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
function reuniao({ situacao = 'marcada', criada = '2026-11-03T10:00:00', dia = '2026-11-12T15:00:00', funil = 'sessao-estrategica' } = {}) {
  seq++;
  db.prepare(`INSERT INTO agenda_reunioes (id, tipo_id, inicio, fim, nome, email, funil, situacao, token_gestao, criado_em, atualizado_em)
              VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(`r${seq}`, em(dia), em(dia) + 2700, `Lead ${seq}`, `l${seq}@x.com`, funil, situacao, `t${seq}`, em(criada), em(criada));
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
