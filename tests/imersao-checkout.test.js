// Issue S14-01: inícios de checkout do Meta na coleta diária (ad_spend) e nas
// taxas "Page to checkout" e "Checkout to compra" da aba Imersão 2027.
// SQLite real com as migrations de verdade; o Windsor é um fetch falso.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import { onRequestPost as syncMeta } from '../functions/api/sync/meta-ads.js';
import { onRequestGet as imersaoGet } from '../functions/api/imersao/index.js';

const em = (iso) => Math.floor(Date.parse(`${iso}-03:00`) / 1000);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';

let db, env, seq;
const fetchOriginal = globalThis.fetch;
const migration = (nome) => db.exec(readFileSync(new URL(`../migrations/${nome}`, import.meta.url), 'utf8'));

/** d1 do projeto + batch, que o upsert da coleta usa. */
function d1ComBatch(banco) {
  const base = d1(banco);
  return { ...base, batch: async (stmts) => Promise.all(stmts.map((s) => s.run())) };
}

function montar({ comColuna = true } = {}) {
  seq = 0;
  db = new DatabaseSync(':memory:');
  migration('0001_create_tables.sql');
  migration('0011_sessions_utms.sql');
  migration('0014_sync_log.sql');
  migration('0013_ad_spend.sql');
  if (comColuna) migration('0073_ad_spend_inicios_checkout.sql');
  migration('0070_imersao.sql');
  migration('0072_imersao_cadastros.sql');
  env = { DASH_KEY: 'k', SYNC_SECRET: 's', WINDSOR_API_KEY: 'w', WINDSOR_META_ACCOUNT: 'conta', DB: d1ComBatch(db) };
}
beforeEach(() => montar());
afterEach(() => { globalThis.fetch = fetchOriginal; });

function venda({ id, utm_source = null, utm_medium = null, utm_campaign = null }) {
  db.prepare(`INSERT INTO imersao_vendas (id, produto, valor_centavos, pago_em, email, utm_source, utm_medium, utm_campaign)
              VALUES (?, 'ingresso', 2900, ?, ?, ?, ?, ?)`).run(id, em('2026-11-18T10:00:00'), `${id}@x.com`, utm_source, utm_medium, utm_campaign);
}
function gasto({ dia = '2026-11-18', campanha = 'ae_vendas-imersao-12-12_publico-frio', centavos = 10000, cliques = 10, inicios }) {
  seq += 1;
  const cols = inicios === undefined ? '' : ', initiate_checkouts';
  const vals = inicios === undefined ? '' : `, ${inicios}`;
  db.prepare(`INSERT INTO ad_spend (platform, date, campaign_id, campaign_name, spend_cents, impressions, clicks, synced_at${cols})
              VALUES ('meta', ?, ?, ?, ?, 1000, ?, 0${vals})`).run(dia, `c${seq}`, campanha, centavos, cliques);
}
function visita(campanha) {
  seq += 1;
  db.prepare(`INSERT INTO sessions (session_id, external_id, landing_url, user_agent, utm_campaign, created_at, updated_at)
              VALUES (?, ?, 'https://atacadoexponencial.com/imersao-planejamento-atacado', ?, ?, ?, ?)`)
    .run(`s${seq}`, `e${seq}`, UA, campanha, em('2026-11-18T09:00:00'), em('2026-11-18T09:00:00'));
}
async function getImersao() {
  const res = await imersaoGet({ request: new Request('https://x/api/imersao?key=k'), env });
  assert.equal(res.status, 200);
  return res.json();
}

test('CA-S14-01: a coleta do Meta grava os inícios de checkout por campanha e dia', async () => {
  let urlPedida = '';
  globalThis.fetch = async (url) => {
    urlPedida = String(url);
    return Response.json({ data: [
      { date: '2026-11-18', campaign_id: '1', campaign: 'ae_vendas-imersao-12-12_publico-frio', spend: 100.5, impressions: 3000, clicks: 40, actions_offsite_conversion_fb_pixel_initiate_checkout: 3 },
      { date: '2026-11-18', campaign_id: '2', campaign: 'ae_vendas-imersao-12-12_publico-quente', spend: 50, impressions: 1000, clicks: 9, actions_offsite_conversion_fb_pixel_initiate_checkout: null },
    ] });
  };
  const res = await syncMeta({
    request: new Request('https://x/api/sync/meta-ads', { method: 'POST', headers: { 'x-sync-secret': 's' }, body: JSON.stringify({ date_from: '2026-11-18', date_to: '2026-11-18' }) }),
    env,
  });
  assert.equal(res.status, 200);
  assert.match(urlPedida, /actions_offsite_conversion_fb_pixel_initiate_checkout/);
  const linhas = db.prepare('SELECT campaign_id, spend_cents, initiate_checkouts FROM ad_spend ORDER BY campaign_id').all()
    .map((l) => ({ ...l }));
  assert.deepEqual(linhas, [
    { campaign_id: '1', spend_cents: 10050, initiate_checkouts: 3 },
    { campaign_id: '2', spend_cents: 5000, initiate_checkouts: 0 },
  ]);
});

test('CA-S14-02: page to checkout e checkout to compra usam o número do Meta e só o que veio de anúncio', async () => {
  const pago = { utm_source: 'facebookads', utm_medium: 'auto_ig_advt-aberto_cpc', utm_campaign: 'ae_vendas-imersao-12-12_publico-frio' };
  venda({ id: 'a', ...pago });
  venda({ id: 'b', ...pago });
  venda({ id: 'c' }); // orgânica: fora do checkout to compra
  gasto({ inicios: 3 });
  gasto({ campanha: 'ae_vendas-imersao-12-12_publico-quente', inicios: 1 });
  gasto({ campanha: 'ae_leads_publico-frio_evento-lead_sessao-estrategica', inicios: 50 });
  for (let i = 0; i < 40; i += 1) visita('ae_vendas-imersao-12-12_publico-frio');
  for (let i = 0; i < 10; i += 1) visita(null); // orgânicas: fora do page to checkout

  const r = await getImersao();
  assert.equal(r.trafego.ingressos_trafego, 2);
  assert.equal(r.trafego.page_checkout.valor, 10); // 4 ÷ 40
  assert.equal(r.trafego.checkout_compra.valor, 50); // 2 ÷ 4
});

test('CA-S14-03: zero início de checkout dá 0% e "—"; sem a coluna nova, investimento aparece e as taxas ficam vazias', async () => {
  venda({ id: 'a' });
  gasto({ centavos: 20000, inicios: 0 });
  for (let i = 0; i < 5; i += 1) visita('ae_vendas-imersao-12-12_publico-frio');
  const zero = await getImersao();
  assert.equal(zero.trafego.page_checkout.valor, 0);
  assert.equal(zero.trafego.checkout_compra.valor, null);

  montar({ comColuna: false });
  venda({ id: 'a' });
  gasto({ centavos: 20000 });
  for (let i = 0; i < 5; i += 1) visita('ae_vendas-imersao-12-12_publico-frio');
  const r = await getImersao();
  assert.equal(r.trafego.investimento, 200);
  assert.equal(r.trafego.page_checkout.valor, null);
  assert.equal(r.trafego.checkout_compra.valor, null);
});
