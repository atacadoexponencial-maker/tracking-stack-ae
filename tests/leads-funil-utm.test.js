// /api/leads com o funil pela origem (spec-funil-pela-utm.md, S3-02), contra
// SQLite real com as colunas que o endpoint lê.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import { onRequestGet } from '../functions/api/leads.js';
import { calcularCpl } from '../functions/api/_cpl-calculo.js';

const URL_BASE = 'https://atacadoexponencial.com';
const SE_ADS = 'ae_leads_publico-frio_evento-lead_sessao-estrategica';
let db, env, seq;

function banco() {
  const b = new DatabaseSync(':memory:');
  b.exec(`
    CREATE TABLE sessions (session_id TEXT PRIMARY KEY, ip_address TEXT, funnel TEXT DEFAULT '', utm_source TEXT, utm_medium TEXT,
      utm_campaign TEXT, utm_content TEXT, utm_term TEXT, fbclid TEXT, gclid TEXT, referrer TEXT, landing_url TEXT);
    CREATE TABLE event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, event_name TEXT NOT NULL, event_id TEXT,
      timestamp INTEGER NOT NULL, raw_email TEXT DEFAULT '', browser TEXT, os TEXT, is_mobile INTEGER DEFAULT 0,
      is_bot INTEGER DEFAULT 0, bot_reason TEXT, meta_status_code INTEGER, meta_response_ok INTEGER, meta_response_body TEXT,
      meta_payload_sent TEXT, ga4_status_code INTEGER, ga4_response_ok INTEGER, ga4_response_body TEXT, ga4_payload_sent TEXT,
      fbp_source TEXT, fbc_source TEXT, fbclid_source TEXT, origin TEXT DEFAULT 'site', material TEXT,
      is_junk INTEGER NOT NULL DEFAULT 0, funnel TEXT DEFAULT '');
    CREATE TABLE lead_dispatch (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, resultado TEXT, task_id TEXT, task_url TEXT);
    CREATE TABLE crm_status_log (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT, status TEXT, recebido_em INTEGER, hist_date INTEGER);
    CREATE TABLE ad_spend (platform TEXT, date TEXT, campaign_id TEXT, campaign_name TEXT, spend_cents INTEGER);
    CREATE TABLE campaign_funnel_map (campaign_id TEXT PRIMARY KEY, funnel TEXT);
  `);
  b.prepare(`INSERT INTO ad_spend VALUES ('meta', '2026-10-13', '1', ?, 1000)`).run(SE_ADS);
  return b;
}

const agora = Math.floor(Date.now() / 1000);
function lead({ funil, pagina = '/', utm_source = null, utm_campaign = null, material = null, novo = false, email }) {
  seq++;
  db.prepare(`INSERT INTO sessions (session_id, utm_source, utm_campaign, landing_url) VALUES (?, ?, ?, ?)`)
    .run(`s${seq}`, utm_source, utm_campaign, `${URL_BASE}${pagina}?x=1`);
  db.prepare(`INSERT INTO event_log (session_id, event_name, event_id, timestamp, raw_email, funnel, material) VALUES (?, 'Lead', ?, ?, ?, ?, ?)`)
    .run(`s${seq}`, `e${seq}`, agora - 3600 + seq, email || `p${seq}@x.com`, funil, material);
  if (novo) db.prepare(`INSERT INTO lead_dispatch (event_id, resultado, task_id) VALUES (?, 'criado', ?)`).run(`e${seq}`, `T${seq}`);
}

async function pedir(query) {
  const r = await onRequestGet({
    request: new Request(`https://x/api/leads?key=k&from=${agora - 86400}&to=${agora}${query}`),
    env, waitUntil: () => {},
  });
  assert.equal(r.status, 200);
  return r.json();
}

// Os leads do critério de aceite do seletor (CA-S3-15): aplicação da bio,
// isca do ManyChat, home vinda de anúncio de SE e workshop.
function cenarioSeletor() {
  lead({ funil: 'aplicacao-mentoria', pagina: '/aplicacao-mentoria', utm_source: 'organico', utm_campaign: 'bioperfil-felipe', email: 'bio@x.com' });
  lead({ funil: 'iscas-manychat', pagina: '/materiais/icp', utm_source: 'manychat', material: 'icp', email: 'isca@x.com' });
  lead({ funil: 'sessao-estrategica', utm_source: 'facebookads', utm_campaign: SE_ADS, email: 'home@x.com' });
  lead({ funil: 'workshop', pagina: '/workshop-gratuito', utm_source: 'facebookads', utm_campaign: SE_ADS, email: 'wo@x.com' });
}

beforeEach(() => {
  seq = 0;
  db = banco();
  env = { DASH_KEY: 'k', DB: d1(db) };
});

test('CA-S3-14 leads por funil seguem a regra e a soma fecha com o total', async () => {
  lead({ funil: 'aplicacao-mentoria', utm_source: 'organico', utm_campaign: 'bioperfil-felipe', novo: true }); // 01 aquisição
  lead({ funil: 'sessao-estrategica', utm_source: 'organico', utm_campaign: 'bioperfil-atacadoexponencial' }); // 02 aquisição
  lead({ funil: 'iscas-manychat', material: 'icp', novo: true }); // 03 aquisição
  lead({ funil: 'aplicacao-mentoria', utm_source: 'facebookads', utm_campaign: SE_ADS, novo: true }); // 04 SE
  lead({ funil: 'aplicacao-mentoria', utm_source: 'facebookads', utm_campaign: '{{campaign.name}}' }); // 07 SE
  lead({ funil: 'workshop', utm_source: 'facebookads', utm_campaign: SE_ADS }); // 08 workshop
  const r = await pedir('&limit=500');
  const n = Object.fromEntries(r.funnelCounts.map((c) => [c.funnel, c.count]));
  assert.deepEqual(n, { aquisicao: 3, 'sessao-estrategica': 2, workshop: 1 });
  assert.equal(r.funnelCounts.reduce((s, c) => s + c.count, 0), 6);
  assert.equal(r.leads.length, 6);

  // Leads novos por funil (painel da Visão geral, via /api/cpl): mesma regra.
  const cpl = calcularCpl({
    leads: r.leads.map((l) => ({ ...l, funnel: l.formulario, task_novo: l.crm_resultado === 'criado' ? l.event_id : null })),
    campanhas: [{ campaign_id: '1', campaign_name: SE_ADS }],
    funisConhecidos: ['sessao-estrategica', 'workshop'],
  });
  const novos = Object.fromEntries(cpl.por_funil.map((f) => [f.funnel, [f.leads, f.leads_novos]]));
  assert.deepEqual(novos, { aquisicao: [3, 2], 'sessao-estrategica': [2, 1], workshop: [1, 0] });
});

test('CA-S3-15 seletor de funil lista funis, não formulários', async () => {
  cenarioSeletor();
  const r = await pedir('&with=funnels');
  assert.ok(r.funnels.includes('aquisicao'));
  assert.ok(r.funnels.includes('sessao-estrategica'));
  assert.ok(r.funnels.includes('workshop'));
  assert.ok(!r.funnels.includes('aplicacao-mentoria'));
  assert.ok(!r.funnels.includes('iscas-manychat'));
});

test('CA-S3-16 filtrar por aquisição traz só bio e ManyChat', async () => {
  cenarioSeletor();
  const r = await pedir('&funnel=aquisicao');
  assert.deepEqual(r.leads.map((l) => l.raw_email).sort(), ['bio@x.com', 'isca@x.com']);
  assert.ok(r.leads.every((l) => l.funnel === 'aquisicao'));
  // As contagens por funil continuam mostrando a distribuição inteira.
  assert.equal(r.funnelCounts.reduce((s, c) => s + c.count, 0), 4);
  // Material da isca respeita o filtro.
  assert.deepEqual(r.materialCounts, [{ material: 'icp', count: 1 }]);
});

test('CA-S3-17 lista de leads mostra funil e página de entrada', async () => {
  lead({ funil: 'aplicacao-mentoria', pagina: '/aplicacao-mentoria/', utm_source: 'organico', utm_campaign: 'bioperfil-felipe' });
  const r = await pedir('');
  assert.equal(r.leads[0].funnel, 'aquisicao');
  assert.equal(r.leads[0].pagina, '/aplicacao-mentoria');
  assert.equal(r.leads[0].formulario, 'aplicacao-mentoria');
});
