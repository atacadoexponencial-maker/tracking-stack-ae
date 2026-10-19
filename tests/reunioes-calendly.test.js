// Cards de reunião com as consultorias do Calendly (issue S2-02): /api/cpl e a
// leitura da agenda das taxas contra SQLite real (migrations 0047, 0059, 0063
// e as tabelas mínimas que o CPL lê).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import * as cpl from '../functions/api/cpl.js';
import { lerAgenda, lerCrm } from '../functions/api/agenda/taxas.js';
import { taxasPorFunil } from '../functions/api/_agenda-funil.js';
import { CU_FIELD } from '../functions/api/_clickup.js';

const em = (iso) => Math.floor(Date.parse(`${iso}-03:00`) / 1000);
// Período "12/10 a 18/10" e o anterior, como a Visão geral pede.
const P = { de: em('2026-10-12T00:00:00'), ate: em('2026-10-18T23:59:59') };
const ANT = { de: em('2026-10-05T00:00:00'), ate: em('2026-10-11T23:59:59') };

let db, env, seq;

function banco({ semCalendly = false } = {}) {
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
  for (const f of ['0032_greenn_webhook.sql', '0047_agenda.sql', '0059_agenda_tipos_teste.sql', ...(semCalendly ? [] : ['0063_calendly_consultorias.sql'])]) {
    b.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  }
  b.exec(`INSERT INTO agenda_tipos (id, slug, nome, duracao_min, destino_cal, grade_id, comercial, funil, criado_em, atualizado_em)
          VALUES (1, 'consultoria', 'Consultoria', 45, 'cal', 1, 1, 'sessao-estrategica', 0, 0)`);
  return b;
}

const lead = (email, funil, quando) => {
  seq++;
  db.prepare(`INSERT INTO event_log (session_id, event_name, event_id, timestamp, raw_email, funnel) VALUES (?, 'Lead', ?, ?, ?, ?)`)
    .run(`s${seq}`, `e${seq}`, em(quando), email, funil);
};
const consultoria = (email, agendou, extra = {}) => {
  seq++;
  const c = { situacao: 'ativa', equipe: 0, remarcada: 0, ...extra };
  db.prepare(`INSERT INTO calendly_consultorias (invitee_uri, event_uri, email, agendou_em, inicio, situacao, marcada_pela_equipe, remarcada, atualizado_em)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`)
    .run(`inv${seq}`, `ev${seq}`, email, em(agendou), em(agendou) + 2 * 86400, c.situacao, c.equipe, c.remarcada);
};
const reuniaoAgenda = (email, criada, funil = 'sessao-estrategica') => {
  seq++;
  db.prepare(`INSERT INTO agenda_reunioes (id, tipo_id, inicio, fim, nome, email, funil, token_gestao, criado_em, atualizado_em)
              VALUES (?, 1, ?, ?, 'X', ?, ?, ?, ?, ?)`)
    .run(`r${seq}`, em(criada) + 86400, em(criada) + 86400 + 2700, email, funil, `t${seq}`, em(criada), em(criada));
};
const gasto = (funil, reais) => {
  seq++;
  db.prepare(`INSERT INTO ad_spend VALUES ('meta', '2026-10-13', ?, 'campanha', ?)`).run(`c${seq}`, reais * 100);
  db.prepare(`INSERT INTO campaign_funnel_map VALUES (?, ?)`).run(`c${seq}`, funil);
};

async function reunioes(per = P) {
  const r = await cpl.onRequestGet({
    request: new Request(`https://x/api/cpl?key=k&from=${per.de}&to=${per.ate}`),
    env, waitUntil: () => {},
  });
  assert.equal(r.status, 200);
  return (await r.json()).reunioes;
}

beforeEach(() => {
  seq = 0;
  db = banco();
  env = { DASH_KEY: 'k', DB: d1(db) };
});

test('CA-S2-06: consultorias do Calendly aparecem em Reuniões agendadas', async () => {
  consultoria('a@x.com', '2026-10-12T10:00:00');
  consultoria('b@x.com', '2026-10-14T10:00:00');
  consultoria('c@x.com', '2026-10-18T22:00:00');
  assert.equal((await reunioes()).total.agendadas, 3);
});

test('CA-S2-07: reunião marcada pela equipe não conta', async () => {
  consultoria('a@x.com', '2026-10-13T10:00:00');
  consultoria('b@x.com', '2026-10-13T11:00:00');
  consultoria('c@x.com', '2026-10-13T12:00:00', { equipe: 1 });
  assert.equal((await reunioes()).total.agendadas, 2);
});

test('CA-S2-08: reunião cancelada não conta, remarcada conta uma vez', async () => {
  consultoria('a@x.com', '2026-10-13T10:00:00', { situacao: 'cancelada' });
  consultoria('b@x.com', '2026-10-13T11:00:00', { situacao: 'cancelada', remarcada: 1 });
  consultoria('b@x.com', '2026-10-14T09:00:00');
  assert.equal((await reunioes()).total.agendadas, 1);
});

test('CA-S2-09: entra no período pela data em que agendou', async () => {
  consultoria('a@x.com', '2026-10-11T15:00:00'); // reunião em 13/10
  assert.equal((await reunioes(P)).total.agendadas, 0);
  assert.equal((await reunioes(ANT)).total.agendadas, 1);
});

test('CA-S2-10: a reunião vai para o funil do lead com o mesmo e-mail', async () => {
  lead('ana@gmail.com', 'workshop', '2026-10-10T09:00:00');
  consultoria('ana@gmail.com', '2026-10-13T10:00:00');
  const r = await reunioes();
  assert.equal(r.por_funil.workshop.agendadas, 1);
  assert.equal((r.por_funil['sessao-estrategica'] || { agendadas: 0 }).agendadas, 0);
});

test('CA-S2-10: lead em dois funis vale o mais recente até o agendamento', async () => {
  lead('ana@gmail.com', 'aplicacao-mentoria', '2026-10-01T09:00:00');
  lead('ana@gmail.com', 'workshop', '2026-10-12T09:00:00');
  lead('ana@gmail.com', 'aplicacao-mentoria', '2026-10-16T09:00:00'); // depois do agendamento
  consultoria('ana@gmail.com', '2026-10-13T10:00:00');
  assert.equal((await reunioes()).por_funil.workshop.agendadas, 1);
});

test('CA-S2-11: reunião sem lead conhecido conta na SE', async () => {
  consultoria('ninguem@x.com', '2026-10-13T10:00:00');
  assert.equal((await reunioes()).por_funil['sessao-estrategica'].agendadas, 1);
});

test('CA-S2-12: e-mail com maiúscula ou espaço casa igual', async () => {
  lead('ana@gmail.com', 'workshop', '2026-10-10T09:00:00');
  // A coleta grava o e-mail do Calendly normalizado (S2-01); a busca também normaliza.
  consultoria(' Ana@Gmail.com '.trim().toLowerCase(), '2026-10-13T10:00:00');
  consultoria(' Ana@Gmail.com ', '2026-10-14T10:00:00');
  assert.equal((await reunioes()).por_funil.workshop.agendadas, 2);
});

test('CA-S2-13: mesma pessoa no Calendly e na agenda própria conta uma vez', async () => {
  consultoria('ana@gmail.com', '2026-10-13T10:00:00');
  reuniaoAgenda('Ana@gmail.com', '2026-10-14T10:00:00');
  reuniaoAgenda('bia@gmail.com', '2026-10-14T11:00:00');
  assert.equal((await reunioes()).total.agendadas, 2);
});

test('CA-S2-14: custo por reunião agendada usa as consultorias do Calendly', async () => {
  gasto('sessao-estrategica', 1500);
  for (let i = 0; i < 10; i++) consultoria(`p${i}@x.com`, '2026-10-13T10:00:00');
  assert.equal((await reunioes()).por_funil['sessao-estrategica'].custo_agendada, 150);
});

// CRM simulado para as taxas: o relatório de marketing lê os cards criados no
// período no ClickUp. Card MQL = faturamento acima de R$ 20 mil e não
// desqualificado; o e-mail do card é o que casa com a reunião.
const OPCAO_SE = { id: 'opt-se', name: 'SE', orderindex: 0 };
function cardCrm(email, { mql = true, criado = '2026-10-13T10:00:00' } = {}) {
  seq++;
  return {
    id: `card${seq}`, name: `Lead ${seq}`, status: { status: 'qualificação' }, date_created: String(em(criado) * 1000),
    custom_fields: [
      { id: CU_FIELD.funil, value: 'opt-se', type_config: { options: [OPCAO_SE] } },
      { id: CU_FIELD.faturamento, value: mql ? 'De 50 a 100 mil' : 'Menos de 20 mil' },
      { id: CU_FIELD.email, value: email },
    ],
  };
}
async function taxasDaSe(cards) {
  db.prepare(`INSERT INTO funis_relatorio VALUES (1, 'SE', 'lead_mql', 1, 'sessao-estrategica', '', ?, 'qualquer', 'ativo')`)
    .run(JSON.stringify([{ id: 'opt-se', nome: 'SE' }]));
  env.CLICKUP_API_TOKEN = 't';
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url) => (String(url).includes('/task?')
    ? Response.json({ tasks: cards, last_page: true })
    : new Response('fora do teste', { status: 500 }));
  try {
    const agora = em('2026-10-19T08:00:00');
    const crm = await lerCrm(env, P.de, P.ate, agora);
    const agenda = await lerAgenda(env, P.de, P.ate, agora);
    return taxasPorFunil({ crm, agenda, funisComAgenda: ['sessao-estrategica'] }).por_funil['sessao-estrategica'];
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}
const pct1 = (x) => Number((x * 100).toFixed(1));

test('CA-S2-15: MQL → RA conta quantos MQLs do período agendaram', async () => {
  const cards = Array.from({ length: 11 }, (_, i) => cardCrm(`mql${i}@x.com`));
  cards.push(cardCrm('pouco@x.com', { mql: false })); // lead novo que não é MQL
  // 5 MQLs agendaram: 3 dentro do período, 2 depois dele.
  for (const i of [0, 1, 2]) consultoria(`mql${i}@x.com`, '2026-10-15T10:00:00');
  for (const i of [3, 4]) consultoria(`mql${i}@x.com`, '2026-10-21T10:00:00');
  // 4 consultorias de leads que chegaram antes do período.
  for (let i = 0; i < 4; i++) consultoria(`antigo${i}@x.com`, '2026-10-14T10:00:00');
  const se = await taxasDaSe(cards);
  assert.equal(se.mqls, 11);
  assert.equal(se.mqls_com_reuniao, 5); // números da nota "5 de 11 MQLs agendaram"
  assert.equal(pct1(se.mql_ra), 45.5);
  assert.equal(se.agendadas, 7); // o card Reuniões agendadas segue contando todas do período
});

test('CA-S2-19: MQL com reunião cancelada ou marcada pela equipe não conta como agendou', async () => {
  const cards = ['ativa@x.com', 'cancelou@x.com', 'equipe@x.com'].map((e) => cardCrm(e));
  consultoria('ativa@x.com', '2026-10-14T10:00:00');
  consultoria('cancelou@x.com', '2026-10-14T10:00:00', { situacao: 'cancelada' });
  consultoria('equipe@x.com', '2026-10-14T10:00:00', { equipe: 1 });
  const se = await taxasDaSe(cards);
  assert.equal(se.mqls, 3);
  assert.equal(se.mqls_com_reuniao, 1); // "1 de 3 MQLs agendaram"
  assert.equal(pct1(se.mql_ra), 33.3);
});

test('CA-S2-16: comparação com o período anterior usa a mesma conta', async () => {
  for (const d of ['12', '13', '15', '17']) consultoria(`a${d}@x.com`, `2026-10-${d}T10:00:00`);
  for (const d of ['06', '09']) consultoria(`b${d}@x.com`, `2026-10-${d.padStart(2, '0')}T10:00:00`);
  const agora = (await reunioes(P)).total.agendadas;
  const antes = (await reunioes(ANT)).total.agendadas;
  assert.equal(agora, 4);
  assert.equal(antes, 2);
  // Mesma conta do carimbo e da diferença do dash (delta e comparar em public/dash/index.html).
  assert.equal(((agora - antes) / antes) * 100, 100);
  assert.equal(agora - antes, 2);
});

test('CA-S2-18: sem cópia do Calendly, os cards continuam funcionando', async () => {
  db = banco({ semCalendly: true });
  env = { DASH_KEY: 'k', DB: d1(db) };
  reuniaoAgenda('bia@gmail.com', '2026-10-14T11:00:00');
  const r = await reunioes();
  assert.equal(r.total.agendadas, 1);
});

test('CA-S3-19 reunião de lead da aplicação vindo da bio conta em aquisição', async () => {
  // Lead da /aplicacao-mentoria com UTM do link da bio (spec-funil-pela-utm.md).
  lead('bia@gmail.com', 'aplicacao-mentoria', '2026-10-12T09:00:00');
  db.prepare(`INSERT INTO sessions (session_id, utm_source, utm_campaign) VALUES (?, 'organico', 'bioperfil-felipe')`).run(`s${seq}`);
  consultoria('bia@gmail.com', '2026-10-13T10:00:00');
  // E uma reunião da agenda própria gravada com o funil do formulário.
  lead('caio@gmail.com', 'aplicacao-mentoria', '2026-10-12T10:00:00');
  db.prepare(`INSERT INTO sessions (session_id, utm_source, utm_campaign) VALUES (?, 'organico', 'bioperfil-felipe')`).run(`s${seq}`);
  reuniaoAgenda('caio@gmail.com', '2026-10-13T11:00:00', 'aplicacao-mentoria');
  const r = await reunioes();
  assert.equal(r.por_funil.aquisicao.agendadas, 2);
  assert.equal(r.por_funil['aplicacao-mentoria'], undefined);
});
