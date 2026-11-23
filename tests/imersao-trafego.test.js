// Issue S11-01: tráfego real na aba Imersão 2027. O endpoint /api/imersao, com
// venda real, lê o gasto do Meta (ad_spend) e as visitas da página (sessions)
// contra SQLite real, com as migrations de verdade.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import { onRequestGet as imersaoGet } from '../functions/api/imersao/index.js';

const em = (iso) => Math.floor(Date.parse(`${iso}-03:00`) / 1000);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';

let db, env, seq;
const migration = (nome) => db.exec(readFileSync(new URL(`../migrations/${nome}`, import.meta.url), 'utf8'));

beforeEach(() => {
  seq = 0;
  db = new DatabaseSync(':memory:');
  migration('0001_create_tables.sql');
  migration('0013_ad_spend.sql');
  migration('0070_imersao.sql');
  migration('0072_imersao_cadastros.sql');
  env = { DASH_KEY: 'k', DB: d1(db) };
  // Uma venda real: a aba sai do modo exemplo.
  db.prepare("INSERT INTO imersao_vendas (id, produto, valor_centavos, pago_em, email) VALUES ('z1', 'ingresso', 2900, ?, 'a@x.com')")
    .run(em('2026-11-17T10:00:00'));
});

function gasto({ dia = '2026-11-17', campanha, centavos, impressoes = 0, cliques = 0 }) {
  seq += 1;
  db.prepare(`INSERT INTO ad_spend (platform, date, campaign_id, campaign_name, spend_cents, impressions, clicks, synced_at)
              VALUES ('meta', ?, ?, ?, ?, ?, ?, 0)`).run(dia, `c${seq}`, campanha, centavos, impressoes, cliques);
}

function visita({ quando, url = 'https://atacadoexponencial.com/imersao-planejamento-atacado', ua = UA }) {
  seq += 1;
  db.prepare(`INSERT INTO sessions (session_id, external_id, landing_url, user_agent, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`).run(`s${seq}`, `e${seq}`, url, ua, em(quando), em(quando));
}

async function getImersao() {
  const res = await imersaoGet({ request: new Request('https://x/api/imersao?key=k'), env });
  assert.equal(res.status, 200);
  return res.json();
}

test('CA-S11-01: investimento, impressões e cliques somam só as campanhas da Imersão', async () => {
  gasto({ dia: '2026-11-16', campanha: 'ae_vendas-imersao-12-12_publico-frio', centavos: 60000, impressoes: 20000, cliques: 200 });
  gasto({ dia: '2026-11-17', campanha: 'AE_Vendas-Imersao-12-12_publico-quente', centavos: 40000, impressoes: 5000, cliques: 50 });
  gasto({ dia: '2026-11-17', campanha: 'ae_leads_publico-frio_evento-lead_sessao-estrategica', centavos: 999900, impressoes: 99999, cliques: 999 });
  gasto({ dia: '2026-11-17', campanha: 'Post do Instagram: Uma polêmica no Bom Retiro...', centavos: 12300, impressoes: 777, cliques: 7 });

  const r = await getImersao();
  assert.equal(r.exemplo, false);
  assert.equal(r.trafego.investimento, 1000);
  // CPM = 1000 / 25000 × 1000 = 40; CTR = 250 / 25000 = 1%.
  assert.equal(r.trafego.cpm.valor, 40);
  assert.equal(r.trafego.ctr.valor, 1);
});

test('CA-S11-02: visitas contam só a página da Imersão, por dia, sem bots', async () => {
  visita({ quando: '2026-11-17T09:00:00' });
  visita({ quando: '2026-11-17T22:30:00', url: 'https://atacadoexponencial.com/imersao-planejamento-atacado/?utm_source=facebookads' });
  visita({ quando: '2026-11-18T08:00:00', url: '/imersao-planejamento-atacado?fbclid=abc' });
  // Fora: outra página, a página de obrigado, bot e visita antes da venda abrir.
  visita({ quando: '2026-11-18T09:00:00', url: 'https://atacadoexponencial.com/se-v5' });
  visita({ quando: '2026-11-18T09:00:00', url: 'https://atacadoexponencial.com/obrigado-imersao-planejamento-atacado' });
  visita({ quando: '2026-11-18T10:00:00', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
  visita({ quando: '2026-11-15T10:00:00' });

  const r = await getImersao();
  const dia = (d) => r.resumo.venda_por_dia.find((l) => l.dia === d);
  assert.equal(dia('2026-11-16').visitas, 0);
  assert.equal(dia('2026-11-17').visitas, 2);
  assert.equal(dia('2026-11-18').visitas, 1);
  // 1 ingresso em 17/11 sobre 2 visitas.
  assert.equal(dia('2026-11-17').conversao, 50);
});

test('CA-S11-03: sem gasto de campanha da Imersão, o investimento fica vazio', async () => {
  gasto({ campanha: 'ae_leads_publico-frio_evento-lead_sessao-estrategica', centavos: 50000, impressoes: 1000, cliques: 10 });
  const r = await getImersao();
  assert.equal(r.trafego.investimento, null);
  assert.equal(r.trafego.cpm.valor, null);
  assert.equal(r.trafego.ctr.valor, null);
});
