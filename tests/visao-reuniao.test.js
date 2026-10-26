// Visão geral da reunião semanal (spec-visao-geral-reuniao-semanal.md, série
// S4): leitura do CRM e das reuniões contra SQLite real (migrations da agenda
// e do Calendly) com o ClickUp simulado, e o desenho de public/dash/visao-reuniao.js
// com um contexto falso no lugar dos ajudantes do index.html.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import * as cpl from '../functions/api/cpl.js';
import { lerCrm, numerosDoCrm } from '../functions/api/agenda/taxas.js';
import { CU_FIELD } from '../functions/api/_clickup.js';
import { CAMPO_SQL } from '../functions/api/_feedback-marketing-mql.js';

const em = (iso) => Math.floor(Date.parse(`${iso}-03:00`) / 1000);
const P = { de: em('2026-10-19T00:00:00'), ate: em('2026-10-25T23:59:59') };
const AGORA = em('2026-10-26T08:00:00');

let db, env, seq;

function banco() {
  const b = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  b.exec(`
    CREATE TABLE sessions (session_id TEXT PRIMARY KEY, ip_address TEXT, funnel TEXT DEFAULT '', utm_source TEXT, utm_campaign TEXT);
    CREATE TABLE event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, event_name TEXT NOT NULL, event_id TEXT,
      timestamp INTEGER NOT NULL, is_bot INTEGER DEFAULT 0, is_junk INTEGER NOT NULL DEFAULT 0, raw_email TEXT DEFAULT '',
      funnel TEXT DEFAULT '', material TEXT, origin TEXT);
    CREATE TABLE lead_dispatch (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, resultado TEXT, task_id TEXT);
    CREATE TABLE ad_spend (platform TEXT, date TEXT, campaign_id TEXT, campaign_name TEXT, spend_cents INTEGER);
    CREATE TABLE campaign_funnel_map (campaign_id TEXT PRIMARY KEY, funnel TEXT);
    CREATE TABLE funis_relatorio (id INTEGER PRIMARY KEY, nome TEXT, tipo TEXT, posicao INTEGER, funil_tracking TEXT,
      trecho_campanha TEXT, opcoes_crm TEXT, origem_lead TEXT, situacao TEXT);
    CREATE TABLE sync_log (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT, status TEXT, run_at INTEGER);
  `);
  for (const f of ['0026_whatsapp_grupos.sql', '0032_greenn_webhook.sql', '0047_agenda.sql', '0059_agenda_tipos_teste.sql',
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

// ---------------------------------------------------------------------------
// CRM simulado: cards criados no período (o ClickUp filtra por date_created).
// ---------------------------------------------------------------------------
const OPCAO_SE = { id: 'opt-se', name: 'SE', orderindex: 0 };
function card({ faturamento = 'De 50 a 100 mil', sql = false, criado = '2026-10-20T10:00:00' } = {}) {
  seq++;
  return {
    id: `card${seq}`, name: `Lead ${seq}`, status: { status: 'qualificação' }, date_created: String(em(criado) * 1000),
    custom_fields: [
      { id: CU_FIELD.funil, value: 'opt-se', type_config: { options: [OPCAO_SE] } },
      { id: CU_FIELD.faturamento, value: faturamento },
      { id: CU_FIELD.email, value: `lead${seq}@x.com` },
      ...(sql ? [{ id: CAMPO_SQL.id, type: 'emoji', value: 1 }] : []),
    ],
  };
}

async function crmDaSe(cards) {
  db.prepare(`INSERT INTO funis_relatorio VALUES (1, 'SE', 'lead_mql', 1, 'sessao-estrategica', '', ?, 'qualquer', 'ativo')`)
    .run(JSON.stringify([{ id: 'opt-se', nome: 'SE' }]));
  env.CLICKUP_API_TOKEN = 't';
  const fetchOriginal = globalThis.fetch;
  // Como o ClickUp: só devolve os cards criados dentro do período pedido.
  globalThis.fetch = async (url) => {
    if (!String(url).includes('/task?')) return new Response('fora do teste', { status: 500 });
    const u = new URL(String(url));
    const de = Number(u.searchParams.get('date_created_gt')), ate = Number(u.searchParams.get('date_created_lt'));
    const dentro = cards.filter((c) => (!de || Number(c.date_created) > de) && (!ate || Number(c.date_created) < ate));
    return Response.json({ tasks: dentro, last_page: true });
  };
  try {
    return numerosDoCrm(await lerCrm(env, P.de, P.ate, AGORA));
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}

test('CA-S4-02: SQL conta os leads novos com o campo de SQL preenchido no CRM', async () => {
  const cards = [card({ sql: true }), card({ sql: true }), card(), card({ sql: true, criado: '2026-10-10T10:00:00' })];
  const r = await crmDaSe(cards);
  assert.equal(r.crm_total.sqls, 2);
  assert.equal(r.crm['sessao-estrategica'].sqls, 2);
});

test('CA-S4-03: MQLs conta só os leads novos', async () => {
  const cards = [card({ faturamento: 'R$ 50.000' }), card({ faturamento: 'R$ 10.000' }), card({ faturamento: 'R$ 80.000', criado: '2026-10-01T10:00:00' })];
  const r = await crmDaSe(cards);
  assert.equal(r.crm_total.mqls, 1);
  assert.equal(r.crm_total.leads_novos, 2);
});

// ---------------------------------------------------------------------------
// Reunião realizada: agenda própria + Calendly com presença marcada no dash.
// ---------------------------------------------------------------------------
const reuniaoAgenda = (situacao, dia) => {
  seq++;
  db.prepare(`INSERT INTO agenda_reunioes (id, tipo_id, inicio, fim, nome, email, funil, situacao, token_gestao, criado_em, atualizado_em)
              VALUES (?, 1, ?, ?, 'X', ?, 'sessao-estrategica', ?, ?, ?, ?)`)
    .run(`r${seq}`, em(dia), em(dia) + 2700, `a${seq}@x.com`, situacao, `t${seq}`, em(dia) - 86400, em(dia));
};
const consultoria = (presenca, dia) => {
  seq++;
  db.prepare(`INSERT INTO calendly_consultorias (invitee_uri, event_uri, email, agendou_em, inicio, situacao, presenca, atualizado_em)
              VALUES (?, ?, ?, ?, ?, 'ativa', ?, 0)`)
    .run(`inv${seq}`, `ev${seq}`, `c${seq}@x.com`, em(dia) - 86400, em(dia), presenca);
};

test('CA-S4-04: Reunião realizada soma agenda própria e Calendly', async () => {
  reuniaoAgenda('realizada', '2026-10-21T14:00:00');
  reuniaoAgenda('faltou', '2026-10-22T14:00:00');
  consultoria('realizada', '2026-10-22T16:00:00');
  consultoria(null, '2026-10-23T16:00:00');
  const r = await cpl.onRequestGet({ request: new Request(`https://x/api/cpl?key=k&from=${P.de}&to=${P.ate}`), env, waitUntil: () => {} });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).reunioes.total.realizadas, 2);
});

// ---------------------------------------------------------------------------
// Desenho: public/dash/visao-reuniao.js com um contexto falso.
// ---------------------------------------------------------------------------
globalThis.window = globalThis.window || {};
new Function(readFileSync(new URL('../public/dash/visao-reuniao.js', import.meta.url), 'utf8'))();
const VR = globalThis.window.VisaoReuniao;
const ctx = {
  esc: (x) => String(x), fmtInt: (x) => String(x), fmtNum: (x) => String(Math.round(x)), fmtPct: (x) => `${Math.round(x)}%`,
  money: (x) => `R$ ${x.toFixed(2)}`,
  tile: (k) => `<tile rotulo="${k.rotulo}" valor="${k.valor ?? '—'}" delta="${k.delta ?? ''}" anterior="${k.anterior ?? ''}" nota="${k.nota || ''}"></tile>`,
  tabela: () => {}, comparar: (a, b, fmt) => ({ anterior: b === null || b === undefined ? null : fmt(b) }),
  delta: (a, b) => (b ? ((a - b) / b) * 100 : null), deltaChip: () => '',
};
const quadros = (html) => [...html.matchAll(/<tile rotulo="([^"]+)" valor="([^"]*)" delta="([^"]*)" anterior="([^"]*)" nota="([^"]*)"/g)]
  .map(([, rotulo, valor, delta, anterior, nota]) => ({ rotulo, valor, delta, anterior, nota }));
function telaCom(respostas) {
  const raiz = { innerHTML: '', querySelector: () => ({}) };
  VR.desenhar(raiz, VR.montarNumeros(respostas, ctx), ctx);
  return raiz.innerHTML;
}
const taxasCom = (atual, anterior) => ({ atual: { crm_lido: true, ...atual }, anterior: { crm_lido: true, ...anterior } });
const RESPOSTAS = {
  leadsA: { funnelCounts: [{ funnel: 'sessao-estrategica', count: 6 }, { funnel: 'workshop', count: 4 }] },
  leadsB: { funnelCounts: [{ funnel: 'sessao-estrategica', count: 5 }, { funnel: 'workshop', count: 3 }] },
  cplA: {
    total_leads_novos: 7,
    por_funil: [{ funnel: 'sessao-estrategica', spend: 300, leads_novos: 4 }, { funnel: 'workshop', spend: 100, leads_novos: 3 }],
    reunioes: { total: { agendadas: 5, realizadas: 3 }, por_funil: { 'sessao-estrategica': { agendadas: 4, realizadas: 2 }, workshop: { agendadas: 1, realizadas: 1 } } },
  },
  cplB: {
    total_leads_novos: 6,
    por_funil: [{ funnel: 'sessao-estrategica', spend: 250, leads_novos: 4 }, { funnel: 'workshop', spend: 90, leads_novos: 2 }],
    reunioes: { total: { agendadas: 4, realizadas: 2 }, por_funil: { 'sessao-estrategica': { agendadas: 3, realizadas: 1 }, workshop: { agendadas: 1, realizadas: 1 } } },
  },
  atrA: { meta_spend: 400 }, atrB: { meta_spend: 340 },
  taxas: taxasCom(
    { crm_total: { leads_novos: 7, mqls: 3, sqls: 2 }, crm: { 'sessao-estrategica': { mqls: 3, sqls: 2 }, workshop: { mqls: 0, sqls: 0 } } },
    { crm_total: { leads_novos: 6, mqls: 2, sqls: 1 }, crm: { 'sessao-estrategica': { mqls: 2, sqls: 1 }, workshop: { mqls: 0, sqls: 0 } } },
  ),
  fSel: '', quando: 'nos últimos 7 dias',
};
const OITO = ['Leads', 'Leads novos', 'CPL', 'CPL lead novo', 'MQLs', 'SQL', 'Reunião agendada', 'Reunião realizada'];

test('CA-S4-01: a Visão geral mostra só os oito números da reunião, nesta ordem', () => {
  const html = telaCom(RESPOSTAS);
  const linha = html.slice(html.indexOf('vr-numeros'), html.indexOf('Taxas de passagem'));
  assert.ok(html.indexOf('class="manchete"') < html.indexOf('vr-numeros'), 'manchete antes dos quadros');
  assert.deepEqual(quadros(linha).map((q) => q.rotulo), OITO);
  for (const fora of ['Conversão geral', 'Visitantes', 'Investimento', 'Receita', 'ROAS', 'Leads por dia', 'Conversão por LP', 'Metas', 'Agenda: do lead']) {
    assert.ok(!html.includes(fora), `não mostra ${fora}`);
  }
});

test('CA-S4-05: números comparados com o período anterior', () => {
  const q = quadros(telaCom(RESPOSTAS)).slice(0, 8);
  assert.equal(q[0].valor, '10');
  assert.equal(Number(q[0].delta), 25);
  for (const x of q) assert.notEqual(x.anterior, '', `${x.rotulo} tem o valor anterior`);
});

test('CA-S4-06: filtro de funil vale para todos os quadros', () => {
  const q = quadros(telaCom({ ...RESPOSTAS, fSel: 'workshop' })).slice(0, 8);
  assert.deepEqual(q.map((x) => x.valor), ['4', '3', 'R$ 25.00', 'R$ 33.33', '0', '0', '1', '1']);
  const se = quadros(telaCom({ ...RESPOSTAS, fSel: 'sessao-estrategica' })).slice(0, 8);
  assert.deepEqual(se.map((x) => x.valor), ['6', '4', 'R$ 50.00', 'R$ 75.00', '3', '2', '4', '2']);
});

test('CA-S4-07: CRM fora do ar não derruba a tela', () => {
  for (const taxas of [null, taxasCom({ crm: null, crm_total: null }, {})]) {
    if (taxas) taxas.atual.crm_lido = false;
    const q = quadros(telaCom({ ...RESPOSTAS, taxas })).slice(0, 8);
    const por = Object.fromEntries(q.map((x) => [x.rotulo, x]));
    assert.equal(por.MQLs.valor, '—');
    assert.equal(por.MQLs.nota, 'sem dados do CRM');
    assert.equal(por.SQL.nota, 'sem dados do CRM');
    for (const r of ['Leads', 'Leads novos', 'CPL', 'CPL lead novo', 'Reunião agendada', 'Reunião realizada']) {
      assert.notEqual(por[r].valor, '—', `${r} tem número`);
    }
  }
});
