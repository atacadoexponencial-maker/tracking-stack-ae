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
// Desenho em funil: public/dash/visao-reuniao.js com um contexto falso.
// ---------------------------------------------------------------------------
globalThis.window = globalThis.window || {};
new Function(readFileSync(new URL('../public/dash/visao-reuniao.js', import.meta.url), 'utf8'))();
const VR = globalThis.window.VisaoReuniao;
const ctx = {
  esc: (x) => String(x), fmtInt: (x) => String(x), fmtNum: (x) => String(Math.round(x)), fmtPct: (x) => `${Math.round(x)}%`,
  money: (x) => `R$ ${x.toFixed(2)}`,
  tile: (k) => `<tile rotulo="${k.rotulo}" valor="${k.valor ?? '—'}" delta="${k.delta ?? ''}" anterior="${k.anterior ?? ''}" nota="${k.nota || ''}"></tile>`,
  tabela: (el, cols, rows) => {
    el.innerHTML = `<thead>${cols.map((c) => `<th>${c.titulo}</th>`).join('')}</thead>`
      + rows.map((r) => `<tr>${cols.map((c) => `<td>${c.render(r)}</td>`).join('')}</tr>`).join('');
  },
  comparar: (a, b, fmt) => ({ anterior: b === null || b === undefined ? null : fmt(b) }),
  delta: (a, b) => (b ? ((a - b) / b) * 100 : null), deltaChip: (p) => `<chip>${Math.round(p)}%</chip>`,
};
const texto = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function telaCom(respostas) {
  const tabelaFunis = { innerHTML: '' };
  const raiz = { innerHTML: '', querySelector: () => tabelaFunis };
  const dados = VR.montarNumeros(respostas, ctx);
  VR.desenhar(raiz, dados, ctx);
  return { html: raiz.innerHTML, tabela: tabelaFunis.innerHTML, dados };
}
// Etapas do funil, lidas bloco a bloco: rótulo, número (com variação), custo e nota.
function etapas(html) {
  return html.split('class="vr-etapa"').slice(1).map((b) => {
    const pega = (re) => { const m = b.match(re); return m ? texto(m[1]) : ''; };
    return {
      rotulo: pega(/vr-etapa__nome"><b>([^<]+)/),
      num: pega(/vr-etapa__faixa"><span>([\s\S]*?)<\/span><\/div>/),
      custoRotulo: pega(/vr-etapa__custo"><small>([^<]+)<\/small>/),
      custo: pega(/vr-etapa__custo"><small>[^<]+<\/small>([\s\S]*?)<\/div>/),
      nota: pega(/vr-etapa__nota">([^<]*)<\/small>/),
    };
  });
}
// Taxas de passagem: os quadros logo abaixo do funil.
function passagens(html) {
  return quadros(html.slice(html.indexOf('vr-taxas'), html.indexOf('vr-lateral')))
    .map((q) => ({ rotulo: q.rotulo, valor: q.valor, detalhe: q.nota }));
}
const quadros = (html) => [...html.matchAll(/<tile rotulo="([^"]+)" valor="([^"]*)" delta="([^"]*)" anterior="([^"]*)" nota="([^"]*)"/g)]
  .map(([, rotulo, valor, delta, anterior, nota]) => ({ rotulo, valor, delta, anterior, nota }));
const lateral = (html) => quadros(html.slice(html.indexOf('vr-lateral')));
const linhasFunil = (tab) => [...tab.matchAll(/<tr>(.*?)<\/tr>/gs)].map((m) => [...m[1].matchAll(/<td>(.*?)<\/td>/gs)].map((c) => texto(c[1])));
const colunas = (tab) => [...tab.matchAll(/<th>([^<]+)<\/th>/g)].map((m) => m[1]);
const primeiro = (s) => s.split(' ')[0];

const taxasCom = (atual, anterior) => ({
  atual: { crm_lido: true, mql_funis: ['sessao-estrategica', 'aquisicao'], ...atual },
  anterior: anterior === null ? null : { crm_lido: true, mql_funis: ['sessao-estrategica', 'aquisicao'], ...anterior },
});
const CRM_A = { 'sessao-estrategica': { leads_novos: 5, mqls: 3, sqls: 2, mqls_com_reuniao: 2 }, workshop: { leads_novos: 2, mqls: 1, sqls: 0, mqls_com_reuniao: 0 } };
const CRM_B = { 'sessao-estrategica': { leads_novos: 4, mqls: 2, sqls: 1, mqls_com_reuniao: 1 }, workshop: { leads_novos: 2, mqls: 0, sqls: 0, mqls_com_reuniao: 0 } };
const RESPOSTAS = {
  leadsA: { funnelCounts: [{ funnel: 'sessao-estrategica', count: 6 }, { funnel: 'workshop', count: 4 }] },
  leadsB: { funnelCounts: [{ funnel: 'sessao-estrategica', count: 5 }, { funnel: 'workshop', count: 3 }] },
  cplA: {
    total_leads_novos: 7,
    por_funil: [{ funnel: 'sessao-estrategica', spend: 300, leads_novos: 4 }, { funnel: 'workshop', spend: 100, leads_novos: 3 }],
    reunioes: {
      total: { agendadas: 5, realizadas: 3, custo_agendada: 60, custo_realizada: 100 },
      por_funil: { 'sessao-estrategica': { agendadas: 4, realizadas: 2, custo_agendada: 75, custo_realizada: 150 }, workshop: { agendadas: 1, realizadas: 1, custo_agendada: 100, custo_realizada: 100 } },
    },
    entradas_grupos: { workshop: 7 },
  },
  cplB: {
    total_leads_novos: 6,
    por_funil: [{ funnel: 'sessao-estrategica', spend: 250, leads_novos: 4 }, { funnel: 'workshop', spend: 90, leads_novos: 2 }],
    reunioes: {
      total: { agendadas: 4, realizadas: 2, custo_agendada: 62.5, custo_realizada: 125 },
      por_funil: { 'sessao-estrategica': { agendadas: 3, realizadas: 1, custo_agendada: 83.33, custo_realizada: 250 }, workshop: { agendadas: 1, realizadas: 1, custo_agendada: 90, custo_realizada: 90 } },
    },
    entradas_grupos: { workshop: 5 },
  },
  atrA: { meta_spend: 400 }, atrB: { meta_spend: 340 },
  taxas: taxasCom(
    { crm_total: { leads_novos: 7, mqls: 4, sqls: 2 }, crm: CRM_A, mql: { leads_novos: 5, mqls: 3, mqls_com_reuniao: 2 }, total: { mqls: 3, mqls_com_reuniao: 2, ocorridas: 4, realizadas: 3 },
      por_funil: { 'sessao-estrategica': { mqls: 3, mqls_com_reuniao: 2, ocorridas: 4, realizadas: 3 } },
      qualificacao: { abaixo: 2, acima: 3, nao_informado: 0, total: 5 } },
    { crm_total: { leads_novos: 6, mqls: 2, sqls: 1 }, crm: CRM_B, mql: { leads_novos: 4, mqls: 2, mqls_com_reuniao: 1 }, total: { mqls: 2, mqls_com_reuniao: 1, ocorridas: 2, realizadas: 1 },
      por_funil: { 'sessao-estrategica': { mqls: 2, mqls_com_reuniao: 1, ocorridas: 2, realizadas: 1 } },
      qualificacao: { abaixo: 2, acima: 2, nao_informado: 0, total: 4 } },
  ),
  fSel: '', quando: 'nos últimos 7 dias',
};
const ETAPAS = ['Leads novos', 'MQL', 'SQL', 'Reunião agendada', 'Reunião realizada'];

test('CA-S4-01: a Visão geral mostra a manchete, o funil da reunião e a lateral, sem os blocos antigos', () => {
  const { html } = telaCom(RESPOSTAS);
  assert.ok(html.indexOf('class="manchete"') < html.indexOf('vr-funil'), 'manchete antes do funil');
  assert.deepEqual(etapas(html).map((e) => e.rotulo), ETAPAS);
  assert.deepEqual(lateral(html).map((q) => q.rotulo), ['Investimento em ads', 'Leads', 'CPL']);
  assert.deepEqual(passagens(html).map((p) => p.rotulo), ['Lead → MQL', 'MQL → RA', 'RA → RR'], 'taxas logo abaixo do funil');
  assert.ok(html.indexOf('vr-funil') < html.indexOf('vr-taxas'));
  for (const fora of ['Conversão geral', 'Visitantes', 'Receita', 'ROAS', 'Leads por dia', 'Conversão por LP', 'Metas', 'Agenda: do lead']) {
    assert.ok(!html.includes(fora), `não mostra ${fora}`);
  }
});

test('CA-S4-05: números comparados com o período anterior', () => {
  const { html } = telaCom({
    ...RESPOSTAS,
    leadsA: { funnelCounts: [{ funnel: 'sessao-estrategica', count: 10 }] },
    leadsB: { funnelCounts: [{ funnel: 'sessao-estrategica', count: 8 }] },
  });
  const leads = quadros(html).find((q) => q.rotulo === 'Leads');
  assert.equal(leads.valor, '10');
  assert.equal(Number(leads.delta), 25);
  for (const e of etapas(html)) {
    assert.match(e.num, /[▲▼=]/, `${e.rotulo}: variação do número`);
    assert.match(e.custo, /[▲▼=]/, `${e.rotulo}: variação do custo`);
  }
});

test('CA-S4-06: filtro de funil vale para todos os quadros', () => {
  const wo = telaCom({ ...RESPOSTAS, fSel: 'workshop' });
  assert.deepEqual(etapas(wo.html).map((e) => primeiro(e.num)), ['3', '—', '0', '1', '1']);
  assert.equal(quadros(wo.html).find((q) => q.rotulo === 'Investimento em ads').valor, 'R$ 100.00');
  const se = telaCom({ ...RESPOSTAS, fSel: 'sessao-estrategica' });
  assert.deepEqual(etapas(se.html).map((e) => primeiro(e.num)), ['4', '3', '2', '4', '2']);
  assert.equal(linhasFunil(se.tabela).length, 1);
});

test('CA-S4-07: CRM fora do ar não derruba a tela', () => {
  for (const taxas of [null, { atual: { crm_lido: false, crm: null }, anterior: null }]) {
    const { html } = telaCom({ ...RESPOSTAS, taxas });
    const e = Object.fromEntries(etapas(html).map((x) => [x.rotulo, x]));
    assert.equal(e.MQL.num, '—');
    assert.equal(e.MQL.nota, 'sem dados do CRM');
    assert.equal(e.SQL.nota, 'sem dados do CRM');
    for (const r of ['Leads novos', 'Reunião agendada', 'Reunião realizada']) assert.notEqual(e[r].num, '—', `${r} tem número`);
    assert.ok(lateral(html).every((q) => q.valor !== '—'), 'investimento, leads e CPL aparecem');
  }
});

test('CA-S4-08: três taxas de passagem dos leads novos', () => {
  const atual = {
    crm_total: { leads_novos: 50, mqls: 13, sqls: 0 },
    crm: { 'sessao-estrategica': { leads_novos: 40, mqls: 12, sqls: 0 }, workshop: { leads_novos: 10, mqls: 1, sqls: 0 } },
    mql: { leads_novos: 40, mqls: 12, mqls_com_reuniao: 6 },
    total: { mqls: 13, mqls_com_reuniao: 7, ocorridas: 5, realizadas: 3 },
    por_funil: { 'sessao-estrategica': { mqls: 12, mqls_com_reuniao: 6, ocorridas: 4, realizadas: 2 } },
  };
  const p = passagens(telaCom({ ...RESPOSTAS, taxas: taxasCom(atual, atual) }).html);
  assert.deepEqual(p.map((x) => [x.rotulo, x.valor, x.detalhe.split(' · ')[0]]), [
    ['Lead → MQL', '30%', '12 de 40'],
    ['MQL → RA', '50%', '6 de 12'],
    ['RA → RR', '60%', '3 de 5'],
  ]);
});

test('CA-S4-09: RA → RR conta as reuniões do Calendly', async () => {
  const { lerAgenda } = await import('../functions/api/agenda/taxas.js');
  const { taxasPorFunil } = await import('../functions/api/_agenda-funil.js');
  reuniaoAgenda('realizada', '2026-10-21T14:00:00');
  consultoria('realizada', '2026-10-22T16:00:00');
  consultoria('faltou', '2026-10-23T16:00:00');
  consultoria('realizada', '2026-10-30T16:00:00'); // ainda no futuro: não entra
  const agenda = await lerAgenda(env, P.de, P.ate, AGORA);
  const t = taxasPorFunil({ crm: null, agenda, funisComAgenda: ['sessao-estrategica'] }).total;
  assert.equal(t.realizadas, 2);
  assert.equal(t.ocorridas, 3);
  const p = passagens(telaCom({ ...RESPOSTAS, taxas: taxasCom({ ...RESPOSTAS.taxas.atual, total: t }, null) }).html);
  assert.deepEqual([p[2].valor, p[2].detalhe.split(' · ')[0]], ['67%', '2 de 3']);
});

test('CA-S4-10: taxa sem base mostra traço', () => {
  const zero = { leads_novos: 0, mqls: 0, sqls: 0 };
  const vazio = { crm_total: zero, crm: { 'sessao-estrategica': zero }, mql: { ...zero, mqls_com_reuniao: 0 }, total: { mqls: 0, mqls_com_reuniao: 0, ocorridas: 0, realizadas: 0 }, por_funil: {} };
  const p = passagens(telaCom({ ...RESPOSTAS, taxas: taxasCom(vazio, vazio) }).html);
  assert.equal(p[0].rotulo, 'Lead → MQL');
  assert.equal(p[0].valor, '—');
});

// ---------------------------------------------------------------------------
// Níveis de qualificação da Sessão Estratégica (S4-05)
// ---------------------------------------------------------------------------
// Linhas da qualificação: [faixa, agora, semana anterior, variação].
const faixasNaTela = (html) => html.split('class="vr-faixa"').slice(1).map((b) => [
  texto(b.match(/vr-faixa__rotulo">([^<]+)</)[1]),
  texto(b.match(/vr-faixa__agora">([\s\S]*?)<\/span>\s*<span class="vr-faixa__ant/)[1]),
  texto(b.match(/vr-faixa__ant">([\s\S]*?)<\/span>\s*<span class="vr-faixa__var/)[1]),
  texto(b.match(/vr-faixa__var">([\s\S]*?)<\/span>\s*<\/div>/)[1]),
]);

test('CA-S4-11: leads novos de SE separados por faixa de faturamento', async () => {
  const OPCAO_WO = { id: 'opt-wo', name: 'WORKSHOP', orderindex: 3 };
  db.prepare(`INSERT INTO funis_relatorio VALUES (2, 'Workshop', 'lead_mql', 2, 'workshop', '', ?, 'qualquer', 'ativo')`)
    .run(JSON.stringify([{ id: 'opt-wo', nome: 'WORKSHOP' }]));
  const workshop = () => {
    const c = card({ faturamento: 'R$ 80.000' });
    c.custom_fields[0] = { id: CU_FIELD.funil, value: 'opt-wo', type_config: { options: [OPCAO_WO] } };
    return c;
  };
  const cards = [
    card({ faturamento: 'Até R$ 20 mil' }), card({ faturamento: 'Até R$ 20 mil' }),
    card({ faturamento: 'R$ 50 mil' }), card({ faturamento: 'R$ 50 mil' }), card({ faturamento: '' }),
    workshop(), workshop(), workshop(),
  ];
  const r = await crmDaSe(cards);
  assert.deepEqual(r.qualificacao, { abaixo: 2, acima: 2, nao_informado: 1, total: 5 });
  assert.equal(r.crm.workshop.leads_novos, 3, 'workshop lido, mas fora da qualificação');
  const { html } = telaCom({ ...RESPOSTAS, taxas: taxasCom({ ...RESPOSTAS.taxas.atual, qualificacao: r.qualificacao }, null) });
  assert.deepEqual(faixasNaTela(html).map((l) => l.slice(0, 2)), [
    ['Abaixo de R$ 20 mil', '2 (40%)'], ['Acima de R$ 20 mil', '2 (40%)'], ['Não informado', '1 (20%)'], ['Total', '5 (100%)'],
  ]);
});

test('CA-S4-12: faixa usa a mesma leitura de faturamento do MQL', async () => {
  const { faixaDeFaturamento, ehMql } = await import('../functions/api/_feedback-marketing-mql.js');
  const com = (t) => ({ status: { status: 'qualificação' }, custom_fields: [{ id: CU_FIELD.faturamento, value: t }] });
  const casos = { 'menos de 20 mil': 'abaixo', '20k': 'abaixo', 'R$ 35.000': 'acima', 'entre 50 e 100 mil': 'acima' };
  for (const [t, faixa] of Object.entries(casos)) {
    assert.equal(faixaDeFaturamento(com(t)), faixa, t);
    assert.equal(ehMql(com(t)), faixa === 'acima', `${t}: mesma régua do MQL`);
  }
});

test('CA-S4-13: bloco some com filtro de funil que não é SE', () => {
  assert.ok(!telaCom({ ...RESPOSTAS, fSel: 'workshop' }).html.includes('Níveis de qualificação'));
  assert.ok(telaCom({ ...RESPOSTAS, fSel: 'sessao-estrategica' }).html.includes('Níveis de qualificação'));
  assert.ok(telaCom(RESPOSTAS).html.includes('Níveis de qualificação'));
});

// ---------------------------------------------------------------------------
// Por funil e entradas nos grupos do workshop (S4-06)
// ---------------------------------------------------------------------------
const linhasComColunas = (tabela) => {
  const cols = colunas(tabela);
  return linhasFunil(tabela).map((l) => Object.fromEntries(cols.map((c, i) => [c, l[i]])));
};

test('CA-S4-14: tabela por funil com leads e leads novos', () => {
  const r = {
    ...RESPOSTAS,
    leadsA: { funnelCounts: [{ funnel: 'workshop', count: 6 }, { funnel: 'sessao-estrategica', count: 10 }] },
    leadsB: { funnelCounts: [{ funnel: 'workshop', count: 3 }, { funnel: 'sessao-estrategica', count: 8 }] },
    cplA: { ...RESPOSTAS.cplA, por_funil: [{ funnel: 'sessao-estrategica', spend: 0, leads_novos: 4 }, { funnel: 'workshop', spend: 0, leads_novos: 6 }] },
    cplB: { ...RESPOSTAS.cplB, por_funil: [{ funnel: 'sessao-estrategica', spend: 0, leads_novos: 2 }, { funnel: 'workshop', spend: 0, leads_novos: 4 }] },
  };
  assert.deepEqual(linhasComColunas(telaCom(r).tabela).map((l) => [l.Funil, l.Leads, l['Leads novos']]), [
    ['sessao-estrategica', '10 ▲ 25%', '4 ▲ 100%'],
    ['workshop', '6 ▲ 100%', '6 ▲ 50%'],
  ]);
});

test('CA-S4-15: workshop mostra quem entrou nos grupos', async () => {
  db.exec(`INSERT INTO whatsapp_groups_tracked (group_jid, label, enabled) VALUES ('wo@g.us', 'Workshops', 1), ('live@g.us', 'Lives Semanais', 1)`);
  const evento = db.prepare(`INSERT INTO whatsapp_group_events (group_jid, participant_jid, action, occurred_at, day_local, received_at)
                             VALUES (?, ?, ?, ?, ?, 0)`);
  for (let i = 0; i < 7; i++) evento.run('wo@g.us', `p${i}@s`, 'entrou', `2026-10-21T13:0${i}:00.000Z`, '2026-10-21');
  evento.run('wo@g.us', 'px@s', 'saiu', '2026-10-21T15:00:00.000Z', '2026-10-21');
  evento.run('wo@g.us', 'py@s', 'entrou', '2026-10-27T13:00:00.000Z', '2026-10-27'); // fora do período
  for (let i = 0; i < 3; i++) evento.run('live@g.us', `l${i}@s`, 'entrou', `2026-10-22T13:0${i}:00.000Z`, '2026-10-22');
  const resp = await cpl.onRequestGet({ request: new Request(`https://x/api/cpl?key=k&from=${P.de}&to=${P.ate}`), env, waitUntil: () => {} });
  const cplA = await resp.json();
  assert.deepEqual(cplA.entradas_grupos, { workshop: 7 });
  const linhas = linhasComColunas(telaCom({ ...RESPOSTAS, cplA: { ...RESPOSTAS.cplA, entradas_grupos: cplA.entradas_grupos } }).tabela);
  const por = Object.fromEntries(linhas.map((l) => [l.Funil, l['Entraram nos grupos']]));
  assert.equal(primeiro(por.workshop), '7');
  assert.equal(por['sessao-estrategica'], '');
});

// ---------------------------------------------------------------------------
// Ajustes de 26/10 (depois da entrega): MQL só SE, custos por etapa,
// investimento, comparativo nas faixas e o funil completo por funil.
// ---------------------------------------------------------------------------
test('ajuste 26/10: MQL e Lead → MQL olham só Sessão Estratégica + Aquisição', async () => {
  // Backend: a base de MQL soma SE e Aquisição, sem o workshop.
  const { numerosDoCrm } = await import('../functions/api/agenda/taxas.js');
  const n = numerosDoCrm({
    'sessao-estrategica': { leads_novos: 5, mqls: 3, sqls: 1, mqls_com_reuniao: 2, faixas: { abaixo: 1, acima: 3, nao_informado: 1 } },
    aquisicao: { leads_novos: 2, mqls: 1, sqls: 0, mqls_com_reuniao: 0, faixas: { abaixo: 1, acima: 1, nao_informado: 0 } },
    workshop: { leads_novos: 9, mqls: 2, sqls: 0, mqls_com_reuniao: 0, faixas: { abaixo: 0, acima: 0, nao_informado: 9 } },
  });
  assert.deepEqual(n.mql, { leads_novos: 7, mqls: 4, mqls_com_reuniao: 2 });
  assert.deepEqual(n.qualificacao, { abaixo: 2, acima: 4, nao_informado: 1, total: 7 });
  // Tela: o funil usa a base de MQL; com o filtro no workshop, "—".
  const { html } = telaCom(RESPOSTAS);
  assert.equal(primeiro(etapas(html)[1].num), '3', 'MQL da base, sem o 1 do workshop');
  assert.equal(passagens(html)[0].detalhe.split(' · ')[0], '3 de 5');
  const wo = telaCom({ ...RESPOSTAS, fSel: 'workshop' }).html;
  assert.equal(etapas(wo)[1].nota, 'só Sessão Estratégica e Aquisição');
  assert.equal(passagens(wo)[0].valor, '—');
  const aq = telaCom({ ...RESPOSTAS, fSel: 'aquisicao', taxas: taxasCom({ ...RESPOSTAS.taxas.atual, crm: { ...CRM_A, aquisicao: { leads_novos: 2, mqls: 1, sqls: 0, mqls_com_reuniao: 1 } } }, null) }).html;
  assert.equal(primeiro(etapas(aq)[1].num), '1', 'aquisição tem MQL');
});

test('ajuste 26/10: MQL → RA usa a base de MQL, RA → RR todas as reuniões', () => {
  const atual = {
    ...RESPOSTAS.taxas.atual,
    mql: { leads_novos: 26, mqls: 16, mqls_com_reuniao: 10 },
    total: { mqls: 17, mqls_com_reuniao: 11, ocorridas: 13, realizadas: 1 },
  };
  const p = passagens(telaCom({ ...RESPOSTAS, taxas: taxasCom(atual, null) }).html);
  assert.equal(p[1].detalhe.split(' · ')[0], '10 de 16');
  assert.equal(p[2].detalhe.split(' · ')[0], '1 de 13');
});

test('ajuste 26/10: custo de cada etapa do funil', () => {
  const e = etapas(telaCom(RESPOSTAS).html);
  assert.deepEqual(e.map((x) => [x.custoRotulo, x.custo.split(' ').slice(0, 2).join(' ')]), [
    ['CPL lead novo', 'R$ 57.14'], // 400 ÷ 7
    ['por MQL', 'R$ 100.00'], // investimento da SE (300) ÷ 3 MQLs
    ['por SQL', 'R$ 200.00'], // 400 ÷ 2
    ['por reunião agendada', 'R$ 60.00'],
    ['por reunião realizada', 'R$ 100.00'],
  ]);
});

test('ajuste 26/10: faixas de faturamento com o comparativo da semana anterior', () => {
  const f = faixasNaTela(telaCom(RESPOSTAS).html);
  assert.deepEqual(f[1], ['Acima de R$ 20 mil', '3 (60%)', '2 (50%)', '▲ 50%']);
  assert.deepEqual(f[0], ['Abaixo de R$ 20 mil', '2 (40%)', '2 (50%)', 'igual']);
  assert.ok(telaCom(RESPOSTAS).html.includes('<span>Semana anterior</span>'), 'colunas com título');
});

test('ajuste 26/10: tabela por funil com o funil completo e o investimento', () => {
  const { tabela } = telaCom(RESPOSTAS);
  assert.deepEqual(colunas(tabela), ['Funil', 'Investimento', 'Leads', 'Leads novos', 'MQL', 'SQL',
    'Reunião agendada', 'Reunião realizada', 'CPL', 'CPL lead novo', 'Custo por MQL', 'Custo por SQL', 'Custo por RA', 'Custo por RR',
    'Lead → MQL', 'MQL → RA', 'RA → RR', 'Entraram nos grupos']);
  const [se, wo] = linhasComColunas(tabela);
  assert.equal(se.Funil, 'sessao-estrategica');
  assert.equal(se.Investimento.split(' ').slice(0, 2).join(' '), 'R$ 300.00');
  assert.equal(primeiro(se.MQL), '3');
  assert.equal(wo.MQL, '—', 'workshop não tem MQL');
  assert.equal(wo['MQL → RA'], '—', 'workshop não agenda reunião');
});
