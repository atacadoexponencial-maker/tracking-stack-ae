// Issue S12-01: card "Investido até agora" em destaque e connect rate só com as
// visitas vindas das campanhas da Imersão. Endpoint contra SQLite real (com as
// migrations de verdade) e o desenho de public/dash/imersao.js.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import { onRequestGet as imersaoGet } from '../functions/api/imersao/index.js';
import { ymdBrt } from '../functions/api/_data-brt.js';

const em = (iso) => Math.floor(Date.parse(`${iso}-03:00`) / 1000);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const HOJE = ymdBrt(Math.floor(Date.now() / 1000));

let db, env, seq;
const migration = (nome) => db.exec(readFileSync(new URL(`../migrations/${nome}`, import.meta.url), 'utf8'));

beforeEach(() => {
  seq = 0;
  db = new DatabaseSync(':memory:');
  migration('0001_create_tables.sql');
  migration('0011_sessions_utms.sql');
  migration('0013_ad_spend.sql');
  migration('0070_imersao.sql');
  migration('0072_imersao_cadastros.sql');
  env = { DASH_KEY: 'k', DB: d1(db) };
  db.prepare("INSERT INTO imersao_vendas (id, produto, valor_centavos, pago_em, email) VALUES ('z1', 'ingresso', 2900, ?, 'a@x.com')")
    .run(em('2026-11-17T10:00:00'));
});

function gasto({ dia, campanha = 'ae_vendas-imersao-12-12_publico-frio', centavos, impressoes = 0, cliques = 0 }) {
  seq += 1;
  db.prepare(`INSERT INTO ad_spend (platform, date, campaign_id, campaign_name, spend_cents, impressions, clicks, synced_at)
              VALUES ('meta', ?, ?, ?, ?, ?, ?, 0)`).run(dia, `c${seq}`, campanha, centavos, impressoes, cliques);
}

function visita({ quando = '2026-11-18T10:00:00', campanha = null, url = 'https://atacadoexponencial.com/imersao-planejamento-atacado' }) {
  seq += 1;
  db.prepare(`INSERT INTO sessions (session_id, external_id, landing_url, user_agent, utm_campaign, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`).run(`s${seq}`, `e${seq}`, url, UA, campanha, em(quando), em(quando));
}

async function getImersao() {
  const res = await imersaoGet({ request: new Request('https://x/api/imersao?key=k'), env });
  assert.equal(res.status, 200);
  return res.json();
}

// Desenho da subaba "Tráfego e página" com um contexto falso, como em imersao.test.js.
globalThis.window = globalThis.window || {};
new Function(readFileSync(new URL('../public/dash/imersao.js', import.meta.url), 'utf8'))();
const IM = globalThis.window.Imersao;
const CTX = {
  esc: (s) => String(s ?? ''),
  fmtInt: (n) => Number(n || 0).toLocaleString('pt-BR'),
  fmtPct: (n, c = 1) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: c, minimumFractionDigits: c }) + '%',
  fmtNum: (n, c = 2) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: c }),
  money: (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
};
function telaTrafego(resposta) {
  IM._definir({ ordem: 'vendas', aba: 'trafego' });
  const raiz = { innerHTML: '' };
  IM.desenhar(raiz, resposta, CTX);
  return raiz.innerHTML;
}

test('CA-S12-01: a resposta traz o total investido e, à parte, o investido de hoje', async () => {
  gasto({ dia: '2026-11-16', centavos: 50000 });
  gasto({ dia: HOJE, centavos: 12345 });
  gasto({ dia: HOJE, campanha: 'ae_vendas-imersao-12-12_publico-quente', centavos: 10000 });
  gasto({ dia: HOJE, campanha: 'ae_leads_publico-frio_evento-lead_sessao-estrategica', centavos: 99999 });
  const r = await getImersao();
  assert.equal(r.trafego.investimento, 723.45);
  assert.equal(r.trafego.investimento_hoje, 223.45);

  db.exec(`DELETE FROM ad_spend WHERE date = '${HOJE}'`);
  const semHoje = await getImersao();
  assert.equal(semHoje.trafego.investimento, 500);
  assert.equal(semHoje.trafego.investimento_hoje, 0);
});

test('CA-S12-02: o primeiro card do bloco é "Investido até agora", em destaque, com o do dia na nota', async () => {
  gasto({ dia: '2026-11-16', centavos: 160369 });
  gasto({ dia: HOJE, centavos: 1246 });
  const html = telaTrafego(await getImersao());
  const primeiro = html.indexOf('data-im-card=');
  assert.ok(html.startsWith('data-im-card="Investido até agora"', primeiro), 'primeiro card');
  const card = html.slice(html.lastIndexOf('<div class="etiqueta', primeiro), html.indexOf('data-im-card=', primeiro + 15));
  assert.match(card, /etiqueta heroi/);
  assert.match(card, /R\$\s?1\.616,15/);
  assert.match(card, /hoje: R\$\s?12,46/);
});

test('CA-S12-03: o connect rate divide só as visitas com UTM de campanha da Imersão pelos cliques', async () => {
  gasto({ dia: '2026-11-18', centavos: 10000, impressoes: 1000, cliques: 10 });
  for (let i = 0; i < 6; i += 1) visita({ campanha: 'ae_vendas-imersao-12-12_publico-frio' });
  visita({ campanha: 'AE_Vendas-Imersao-12-12_publico-quente' });
  // Orgânicas e de outra campanha: contam como visita da página, não no connect rate.
  for (let i = 0; i < 5; i += 1) visita({});
  visita({ campanha: 'ae_leads_publico-frio_evento-lead_sessao-estrategica' });
  // Visita de anúncio em outra página: fora.
  visita({ campanha: 'ae_vendas-imersao-12-12_publico-frio', url: 'https://atacadoexponencial.com/se-v5' });

  const r = await getImersao();
  assert.equal(r.trafego.connect.valor, 70);
  assert.equal(r.resumo.venda_por_dia.find((l) => l.dia === '2026-11-18').visitas, 13);
});
