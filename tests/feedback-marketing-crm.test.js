import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarTexto,
  valorDoCampo,
  lerCampo,
  cardEstrutural,
  opcaoFunilDoCard,
  ehTrafegoPago,
  atribuirCards,
  avisosOpcoesInexistentes,
  lerCardsCriadosNoPeriodo,
  lerTaskIdsDeTesteOuBot,
  AVISO_CRM_INDISPONIVEL,
  AVISO_CRM_TETO,
  ROTULO_SEM_OPCAO,
} from '../functions/api/_feedback-marketing-crm.js';
import { CU_FIELD } from '../functions/api/_clickup.js';

// Opções reais do "🔻 Funil" (conferidas em 15/09/2026), só as usadas.
const OPCOES = [
  { id: 'a158d342-c1ac-4705-a6da-ce39019f0a2a', name: 'SESSÃO ESTRATÉGICA', orderindex: 0 },
  { id: '420877c7-44de-4d46-a934-718889443f49', name: 'WO PAGO', orderindex: 9 },
  { id: 'e6893b0b-5a69-4f48-9c99-a3c0a415a118', name: 'LIVES SEMANAIS', orderindex: 13 },
  { id: 'f88ef3e2-2928-439b-83ad-c7ff55083f60', name: 'TRAFEGO PAGO', orderindex: 15 },
];
const opcaoJson = (o) => JSON.stringify([{ id: o.id, nome: o.name }]);
const [SESSAO, WO_PAGO, LIVES, TRAFEGO] = OPCOES;

// Cadastro inicial (migration 0040).
const SE = { id: 1, nome: 'SE', tipo: 'lead_mql', opcoes_crm: opcaoJson(SESSAO), origem_lead: 'trafego_pago' };
const LIVE = { id: 2, nome: 'LIVE', tipo: 'manual', opcoes_crm: opcaoJson(LIVES), origem_lead: null };
const WO = { id: 3, nome: 'WO PAGO', tipo: 'venda_greenn', opcoes_crm: opcaoJson(WO_PAGO), origem_lead: null };
const AQ = { id: 4, nome: 'AQUISIÇÃO', tipo: 'lead_mql', opcoes_crm: opcaoJson(SESSAO), origem_lead: 'exceto_trafego_pago' };
const ATIVOS = [SE, LIVE, WO, AQ];

// 14/09/2026 em Brasília: [03:00 UTC do dia 14, 03:00 UTC do dia 15).
const LIMITES = { desde: Date.UTC(2026, 8, 14, 3) / 1000, ate: Date.UTC(2026, 8, 15, 3) / 1000 };
const DENTRO = LIMITES.desde * 1000 + 3600000;

let seq = 0;
function card({ id, name = 'Fulano', created = DENTRO, opcao, utm, fat, status = 'leads de entrada' } = {}) {
  const custom_fields = [
    { id: '1bfecba1', name: '🔻 FUNIL', type: 'short_text', value: 'texto que não é o dropdown' },
    { id: CU_FIELD.funil, name: '🔻 Funil', type: 'drop_down', type_config: { options: OPCOES }, value: opcao },
    { id: CU_FIELD.utmSource, name: 'utm_source', type: 'short_text', value: utm },
    { id: CU_FIELD.faturamento, name: '🤑 Faturamento Mensal', type: 'short_text', value: fat },
  ];
  return { id: id || `t${++seq}`, name, date_created: String(created), status: { status }, custom_fields };
}
const nomes = (lista) => lista.map((c) => c.id);

test('normalizarTexto tira acento, caixa e espaços extras', () => {
  assert.equal(normalizarTexto('  Sessão   ESTRATÉGICA '), 'sessao estrategica');
  assert.equal(normalizarTexto(null), '');
});

test('valorDoCampo resolve dropdown por orderindex ou id, e lê texto, lista e objeto', () => {
  const dd = (value) => ({ value, type_config: { options: OPCOES } });
  assert.equal(valorDoCampo(dd(0)), 'SESSÃO ESTRATÉGICA');
  assert.equal(valorDoCampo(dd('9')), 'WO PAGO');
  assert.equal(valorDoCampo(dd(WO_PAGO.id)), 'WO PAGO');
  assert.equal(valorDoCampo({ value: 'De 20 a 30 Mil' }), 'De 20 a 30 Mil');
  assert.equal(valorDoCampo({ value: [0, 13], type_config: { options: OPCOES } }), 'SESSÃO ESTRATÉGICA, LIVES SEMANAIS');
  assert.equal(valorDoCampo({ value: { name: 'x' } }), 'x');
  assert.equal(valorDoCampo({ value: null }), '');
  assert.equal(valorDoCampo({ value: [] }), '');
  assert.equal(valorDoCampo(undefined), '');
});

test('lerCampo acha pelo id ou pelo nome e pula valor vazio', () => {
  const c = { custom_fields: [
    { id: 'x', name: ':money_mouth_face: Faturamento Mensal', value: '' },
    { id: 'y', name: '🤑 Faturamento Mensal', value: 'Menos de 20 Mil' },
  ] };
  assert.equal(lerCampo(c, { nomes: [':money_mouth_face: Faturamento Mensal', '🤑 Faturamento Mensal'] }), 'Menos de 20 Mil');
  assert.equal(lerCampo(c, { id: 'y' }), 'Menos de 20 Mil');
  assert.equal(lerCampo(c, { id: 'z' }), '');
});

test('cards estruturais: FUNIL, GERAL, LEADS MÊS ANTERIOR e nome vazio', () => {
  for (const n of ['FUNIL SE', 'funil lives', 'GERAL', 'LEADS MÊS ANTERIOR', 'Leads mes anterior', '', '  ']) {
    assert.equal(cardEstrutural(n), true, n);
  }
  for (const n of ['Maria Funil', 'Geraldo Silva', 'FUNILARIA X', 'Leads']) {
    assert.equal(cardEstrutural(n), false, n);
  }
});

test('opção do funil vem do campo por ID, nunca do texto "🔻 FUNIL"', () => {
  assert.deepEqual(opcaoFunilDoCard(card({ opcao: 0 })), { id: SESSAO.id, nome: 'SESSÃO ESTRATÉGICA' });
  assert.deepEqual(opcaoFunilDoCard(card({ opcao: TRAFEGO.id })), { id: TRAFEGO.id, nome: 'TRAFEGO PAGO' });
  assert.equal(opcaoFunilDoCard(card({ opcao: null })), null);
  assert.equal(opcaoFunilDoCard(card({ opcao: 99 })), null);
});

test('tráfego pago = utm_source de anúncio pela regra de canal', () => {
  assert.equal(ehTrafegoPago('facebookads'), true);
  assert.equal(ehTrafegoPago(' FacebookAds '), true);
  for (const u of ['organico', 'instagram', 'manychat', 'email', '', null]) assert.equal(ehTrafegoPago(u), false, String(u));
});

test('SESSÃO ESTRATÉGICA: anúncio vai para SE; bio, outra UTM e sem utm_source vão para AQUISIÇÃO', () => {
  const r = atribuirCards({
    cards: [
      card({ id: 'se1', opcao: 0, utm: 'facebookads' }),
      card({ id: 'aq1', opcao: 0, utm: 'organico' }),
      card({ id: 'aq2', opcao: 0, utm: 'instagram' }),
      card({ id: 'aq3', opcao: SESSAO.id }),
    ],
    funisAtivos: ATIVOS,
    limites: LIMITES,
  });
  assert.deepEqual(nomes(r.blocos.get(1)), ['se1']);
  assert.deepEqual(nomes(r.blocos.get(4)), ['aq1', 'aq2', 'aq3']);
  assert.deepEqual([...r.blocos.keys()], [1, 4]);
  assert.deepEqual(r.sem_funil, []);
});

test('comprador e opção de funil Manual não contam em bloco nenhum nem em sem funil', () => {
  const r = atribuirCards({
    cards: [
      card({ opcao: 9 }), card({ opcao: 9, utm: 'facebookads' }),
      card({ opcao: 13, utm: 'facebookads' }), card({ opcao: 13 }),
    ],
    funisAtivos: ATIVOS,
    limites: LIMITES,
  });
  assert.equal(r.blocos.get(1).length + r.blocos.get(4).length, 0);
  assert.deepEqual(r.sem_funil, []);
});

test('opção fora do cadastro, card sem opção e origem não cadastrada vão para sem funil', () => {
  const r = atribuirCards({
    cards: [
      card({ id: 'tp1', opcao: 15, utm: 'facebookads' }),
      card({ id: 'tp2', opcao: 15 }),
      card({ id: 'so1', opcao: null, utm: 'facebookads' }),
      card({ id: 'bio', opcao: 0, utm: 'organico' }),
    ],
    // Só SE ativo: o card orgânico de SESSÃO ESTRATÉGICA não tem funil que o aceite.
    funisAtivos: [SE, LIVE, WO],
    limites: LIMITES,
  });
  assert.deepEqual(r.sem_funil.map((g) => [g.opcao, nomes(g.cards)]), [
    ['TRAFEGO PAGO', ['tp1', 'tp2']],
    ['opção SESSÃO ESTRATÉGICA com origem não cadastrada', ['bio']],
    [ROTULO_SEM_OPCAO, ['so1']],
  ]);
});

test('opção de funil de venda arquivado segue sendo comprador: nem bloco nem sem funil', () => {
  const r = atribuirCards({
    cards: [card({ id: 'w', opcao: 9 }), card({ id: 'w2', opcao: 9, utm: 'facebookads' }), card({ id: 'so', opcao: null })],
    funisAtivos: [SE, AQ],
    funisDeVenda: [{ ...WO, situacao: 'arquivado' }],
    limites: LIMITES,
  });
  assert.deepEqual(r.sem_funil.map((g) => [g.opcao, nomes(g.cards)]), [[ROTULO_SEM_OPCAO, ['so']]]);
});

test('opção de venda arquivada usada hoje por funil ativo lead+MQL: o ativo vence', () => {
  const LEAD_WO = { ...AQ, id: 7, nome: 'WO LEAD', opcoes_crm: opcaoJson(WO_PAGO), origem_lead: 'qualquer' };
  const r = atribuirCards({
    cards: [card({ id: 'w', opcao: 9 })],
    funisAtivos: [SE, LEAD_WO],
    funisDeVenda: [{ ...WO, situacao: 'arquivado' }],
    limites: LIMITES,
  });
  assert.deepEqual(nomes(r.blocos.get(7)), ['w']);
  assert.deepEqual(r.sem_funil, []);
});

test('sem cadastro de venda nenhum, a opção WO PAGO fora do cadastro vai para sem funil', () => {
  const r = atribuirCards({ cards: [card({ id: 'w', opcao: 9 })], funisAtivos: [SE, AQ], limites: LIMITES });
  assert.deepEqual(r.sem_funil.map((g) => [g.opcao, nomes(g.cards)]), [['WO PAGO', ['w']]]);
});

test('origens sobrepostas nunca vão para o primeiro que casou', () => {
  const QUALQUER = { ...AQ, id: 5, origem_lead: 'qualquer' };
  const r = atribuirCards({ cards: [card({ id: 'x', opcao: 0, utm: 'facebookads' })], funisAtivos: [SE, QUALQUER], limites: LIMITES });
  assert.equal(r.blocos.get(1).length, 0);
  assert.deepEqual(r.sem_funil.map((g) => g.opcao), ['opção SESSÃO ESTRATÉGICA em mais de um funil']);
});

test('fora do período (lead que voltou), estruturais, teste/bot e card repetido não contam', () => {
  const r = atribuirCards({
    cards: [
      card({ id: 'velho', opcao: 0, utm: 'facebookads', created: LIMITES.desde * 1000 - 1 }),
      card({ id: 'amanha', opcao: 0, utm: 'facebookads', created: LIMITES.ate * 1000 }),
      card({ id: 'borda', opcao: 0, utm: 'facebookads', created: LIMITES.desde * 1000 }),
      card({ id: 'est', name: 'FUNIL SE', opcao: 0, utm: 'facebookads' }),
      card({ id: 'junk', opcao: 0, utm: 'facebookads' }),
      card({ id: 'borda', opcao: 0, utm: 'facebookads', created: LIMITES.desde * 1000 }),
      card({ id: 'sem-data', opcao: 0, utm: 'facebookads', created: 'x' }),
    ],
    funisAtivos: ATIVOS,
    limites: LIMITES,
    taskIdsExcluidos: ['junk'],
  });
  assert.deepEqual(nomes(r.blocos.get(1)), ['borda']);
  assert.deepEqual(r.sem_funil, []);
});

test('nenhum funil ativo: todo lead vai para sem funil pela opção', () => {
  const r = atribuirCards({ cards: [card({ opcao: 0, utm: 'facebookads' })], funisAtivos: [], limites: LIMITES });
  assert.equal(r.blocos.size, 0);
  assert.deepEqual(r.sem_funil.map((g) => [g.opcao, g.cards.length]), [['SESSÃO ESTRATÉGICA', 1]]);
});

test('aviso de opção cadastrada que não existe mais no CRM', () => {
  const atuais = OPCOES.filter((o) => o !== LIVES).map((o) => ({ id: o.id, nome: o.name }));
  assert.deepEqual(avisosOpcoesInexistentes(ATIVOS, atuais), ['A opção LIVES SEMANAIS do bloco LIVE não existe mais no CRM.']);
  assert.deepEqual(avisosOpcoesInexistentes(ATIVOS, OPCOES.map((o) => ({ id: o.id, nome: o.name }))), []);
  // CRM não respondeu: não dá para afirmar que sumiu.
  assert.deepEqual(avisosOpcoesInexistentes(ATIVOS, null), []);
});

// --- I/O com fetch simulado --------------------------------------------------

function simularFetch(respostas) {
  const chamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    chamadas.push({ url: String(url), opts });
    const r = respostas[chamadas.length - 1];
    if (r instanceof Error) throw r;
    return { ok: r.status === 200, status: r.status, json: async () => r.body };
  };
  return { chamadas, restaurar: () => { globalThis.fetch = original; } };
}
const ENV = { CLICKUP_API_TOKEN: 'tok' };

test('lê só os cards criados no período, página a página até last_page', async () => {
  const f = simularFetch([
    { status: 200, body: { tasks: [{ id: 'a' }], last_page: false } },
    { status: 200, body: { tasks: [{ id: 'b' }], last_page: true } },
  ]);
  try {
    const r = await lerCardsCriadosNoPeriodo(ENV, LIMITES);
    assert.deepEqual(r, { ok: true, cards: [{ id: 'a' }, { id: 'b' }] });
    assert.equal(f.chamadas.length, 2);
    const u = new URL(f.chamadas[1].url);
    assert.equal(u.pathname, '/api/v2/list/205126080/task');
    assert.equal(u.searchParams.get('include_closed'), 'true');
    assert.equal(u.searchParams.get('subtasks'), 'false');
    assert.equal(u.searchParams.get('page'), '1');
    assert.equal(u.searchParams.get('date_created_gt'), String(LIMITES.desde * 1000 - 1));
    assert.equal(u.searchParams.get('date_created_lt'), String(LIMITES.ate * 1000));
    assert.equal(f.chamadas[0].opts.method, 'GET');
    assert.equal(f.chamadas[0].opts.headers.Authorization, 'tok');
  } finally { f.restaurar(); }
});

test('sem last_page na resposta, página com menos de 100 cards é a última', async () => {
  const f = simularFetch([{ status: 200, body: { tasks: [{ id: 'a' }] } }]);
  try {
    assert.deepEqual(await lerCardsCriadosNoPeriodo(ENV, LIMITES), { ok: true, cards: [{ id: 'a' }] });
  } finally { f.restaurar(); }
});

test('passou do teto de páginas: não devolve número parcial, devolve aviso', async () => {
  const f = simularFetch([
    { status: 200, body: { tasks: [{ id: 'a' }], last_page: false } },
    { status: 200, body: { tasks: [{ id: 'b' }], last_page: false } },
  ]);
  try {
    assert.deepEqual(await lerCardsCriadosNoPeriodo(ENV, LIMITES, { tetoPaginas: 2 }), { ok: false, aviso: AVISO_CRM_TETO });
    assert.equal(f.chamadas.length, 2);
  } finally { f.restaurar(); }
});

test('CRM indisponível (status, rede, resposta estranha, sem token) devolve o aviso', async () => {
  for (const resposta of [{ status: 500, body: {} }, new Error('rede'), { status: 200, body: { erro: 1 } }]) {
    const f = simularFetch([resposta]);
    try {
      assert.deepEqual(await lerCardsCriadosNoPeriodo(ENV, LIMITES), { ok: false, aviso: AVISO_CRM_INDISPONIVEL });
    } finally { f.restaurar(); }
  }
  assert.deepEqual(await lerCardsCriadosNoPeriodo({}, LIMITES), { ok: false, aviso: AVISO_CRM_INDISPONIVEL });
});

test('teste/bot: uma consulta só, com os ids num bind JSON; sem card não consulta', async () => {
  const consultas = [];
  const db = {
    prepare(sql) {
      return { bind(...binds) { consultas.push({ sql, binds }); return { all: async () => ({ results: [{ task_id: 'b' }] }) }; } };
    },
  };
  assert.deepEqual(await lerTaskIdsDeTesteOuBot(db, ['a', 'b', 'a', null]), ['b']);
  assert.equal(consultas.length, 1);
  assert.deepEqual(consultas[0].binds, ['["a","b"]']);
  assert.match(consultas[0].sql, /json_each\(\?\)/);
  assert.match(consultas[0].sql, /is_junk = 1 OR e\.is_bot = 1/);
  assert.match(consultas[0].sql, /LEFT JOIN sessions s ON s\.session_id = e\.session_id/);
  assert.deepEqual(await lerTaskIdsDeTesteOuBot(db, []), []);
  assert.equal(consultas.length, 1);
});

test('teste/bot no SQLite: junk, bot por user-agent e bot por IP saem; sem sessão ou IP comum ficam', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE lead_dispatch (task_id TEXT, event_id TEXT);
    CREATE TABLE event_log (event_id TEXT, session_id TEXT, is_junk INTEGER DEFAULT 0, is_bot INTEGER DEFAULT 0);
    CREATE TABLE sessions (session_id TEXT PRIMARY KEY, ip_address TEXT);
  `);
  // [task, is_junk, is_bot, ip] — ip undefined = sem linha em sessions.
  const casos = [
    ['humano', 0, 0, '177.10.20.30'],
    ['junk', 1, 0, '177.10.20.31'],
    ['ua', 0, 1, '177.10.20.32'],
    ['ip-exato', 0, 0, '82.197.67.74'],
    ['ip-24', 0, 0, '45.148.10.201'],
    ['ip-64', 0, 0, '2605:a143:2218:7058::1'],
    ['sem-sessao', 0, 0, undefined],
    ['ip-nulo', 0, 0, null],
  ];
  for (const [task, junk, bot, ip] of casos) {
    sqlite.prepare('INSERT INTO lead_dispatch VALUES (?, ?)').run(task, `ev-${task}`);
    sqlite.prepare('INSERT INTO event_log VALUES (?, ?, ?, ?)').run(`ev-${task}`, `s-${task}`, junk, bot);
    if (ip !== undefined) sqlite.prepare('INSERT INTO sessions VALUES (?, ?)').run(`s-${task}`, ip);
  }
  const db = {
    prepare: (sql) => ({ bind: (...b) => ({ all: async () => ({ results: sqlite.prepare(sql).all(...b) }) }) }),
  };
  const r = await lerTaskIdsDeTesteOuBot(db, casos.map((c) => c[0]));
  assert.deepEqual(r.sort(), ['ip-24', 'ip-64', 'ip-exato', 'junk', 'ua']);
});
