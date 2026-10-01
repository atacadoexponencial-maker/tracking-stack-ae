import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/conversion.js';

// DB falso: a 1ª consulta (agrupada) devolve `linhas`; as demais, vazio.
// Guarda o SQL para conferir que o modo antigo não mudou.
function contexto(query, linhas) {
  const sqls = [];
  const env = {
    DASH_KEY: 'k',
    DB: {
      prepare(sql) {
        sqls.push(sql);
        const primeira = sqls.length === 1;
        return { bind: () => ({ all: async () => ({ results: primeira ? linhas : [] }) }) };
      },
    },
  };
  // Período corrente: não entra no cache (_cache.js).
  const agora = Math.floor(Date.now() / 1000);
  const request = new Request(`https://x/api/conversion?key=k&from=${agora - 3600}&to=${agora}${query}`);
  return { ctx: { request, env, waitUntil() {} }, sqls };
}

const URL_BASE = 'https://atacadoexponencial.com';
// Agrupado por (página, funil do lead): lead_funil null = não converteu.
const LINHAS = [
  { landing_url: `${URL_BASE}/`, lead_funil: null, visitors: 90, leads: 0, cliques: 0, form_starts: 0 },
  { landing_url: `${URL_BASE}/`, lead_funil: 'sessao-estrategica', visitors: 4, leads: 4, cliques: 0, form_starts: 0 },
  { landing_url: `${URL_BASE}/`, lead_funil: 'workshop', visitors: 1, leads: 1, cliques: 0, form_starts: 0 },
  { landing_url: `${URL_BASE}/?utm_source=x`, lead_funil: null, visitors: 5, leads: 0, cliques: 0, form_starts: 0 },
  { landing_url: `${URL_BASE}/workshop-gratuito/`, lead_funil: null, visitors: 36, leads: 0, cliques: 0, form_starts: 0 },
  { landing_url: `${URL_BASE}/workshop-gratuito/`, lead_funil: 'workshop', visitors: 4, leads: 4, cliques: 0, form_starts: 0 },
  // Página sem funil na lista (_funil-paginas.js): entra em `rows`, não em funil.
  { landing_url: `${URL_BASE}/obrigada/`, lead_funil: null, visitors: 7, leads: 0, cliques: 0, form_starts: 0 },
];

test('by=funnel: visitantes pela página de entrada, leads só do funil daquela página', async () => {
  const { ctx, sqls } = contexto('&by=funnel', LINHAS);
  const r = await (await onRequestGet(ctx)).json();
  const f = Object.fromEntries(r.por_funil.map((x) => [x.funnel, x]));
  // Home: 100 visitas; 4 viraram lead de SE (o lead de workshop vindo da home não conta para SE).
  assert.deepEqual(f['sessao-estrategica'], { funnel: 'sessao-estrategica', visitors: 100, leads: 4, rate: 0.04 });
  assert.deepEqual(f.workshop, { funnel: 'workshop', visitors: 40, leads: 4, rate: 0.1 });
  assert.equal(r.por_funil.length, 2);
  assert.match(sqls[0], /GROUP BY s\.landing_url, lead_funil/);
  // A lista por página não muda com o funil no agrupamento.
  const home = r.rows.find((x) => x.lp === '/');
  assert.equal(home.visitors, 100);
  assert.equal(home.leads, 5);
  assert.ok(r.rows.find((x) => x.lp === '/obrigada'));
});

test('by=funnel também vem no only=totals (período anterior da Visão geral)', async () => {
  const { ctx } = contexto('&by=funnel&only=totals', LINHAS);
  const r = await (await onRequestGet(ctx)).json();
  assert.equal(r.visitors, 147);
  assert.equal(r.leads, 9);
  assert.equal(r.por_funil.length, 2);
});

test('&funnel= filtra o denominador pelas páginas do funil, não por sessions.funnel', async () => {
  const linhas = [
    { landing_url: `${URL_BASE}/`, visitors: 100, leads: 1, cliques: 0, form_starts: 0 },
    { landing_url: `${URL_BASE}/workshop-gratuito/`, visitors: 40, leads: 4, cliques: 0, form_starts: 0 },
  ];
  const { ctx, sqls } = contexto('&funnel=workshop&only=totals', linhas);
  const r = await (await onRequestGet(ctx)).json();
  assert.equal(r.visitors, 40);
  assert.equal(r.leads, 4);
  assert.doesNotMatch(sqls[0], /s\.funnel = \?/);
});

test('sem by=funnel, a consulta não agrupa por funil e a resposta não traz por_funil', async () => {
  const { ctx, sqls } = contexto('', LINHAS.map(({ lead_funil, ...resto }) => resto));
  const r = await (await onRequestGet(ctx)).json();
  assert.equal(r.por_funil, undefined);
  assert.doesNotMatch(sqls[0], /lead_funil/);
});
