# CPL por funil e canal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quebrar o CPL do dashboard por funil (oferta) e por canal (origem), com mapeamento campanha→funil automático e corrigível pela própria interface.

**Architecture:** Toda a regra de negócio vive em três módulos puros sem I/O (`_canal.js`, `_funil-campanha.js`, `_cpl-calculo.js`), testáveis com `node --test`. Os endpoints só fazem consulta ao D1 e chamam esses módulos. O agrupamento acontece em JavaScript, não em SQL: o volume é de centenas de leads por período, e isso evita ter a mesma regra escrita duas vezes (uma em JS, outra em SQL) — que divergiria na primeira manutenção. O frontend só desenha o que o backend devolve.

**Tech Stack:** Cloudflare Pages Functions (JS puro, sem framework), D1 (SQLite), `node:test` para testes, dashboard em HTML/JS puro (`public/dash/index.html`).

## Global Constraints

- **Idioma:** todo texto visível ao usuário em português, com acentuação correta. Comentários de código em português, seguindo o padrão dos arquivos vizinhos.
- **Autenticação:** todo endpoint valida `key` contra `env.DASH_KEY` e devolve 401 sem ela. Mesmo padrão de `functions/api/ad-spend.js:15-18`.
- **Nenhuma regra de negócio no frontend.** O dashboard só renderiza; classificação e cálculo ficam no backend.
- **Módulos com prefixo `_`** não viram rota nas Pages Functions — é assim que `functions/api/webhooks/_classificar.js` já faz.
- **Funil efetivo do lead** é sempre `COALESCE(NULLIF(e.funnel, ''), s.funnel)` — mesma definição de `functions/api/leads.js:81` e `functions/api/conversion.js:27`. Não inventar outra.
- **Período:** `days` (padrão 30) ou `from`/`to` em unix seconds, via os helpers `clampInt`/`resolvePeriod` já replicados em cada endpoint.
- **Leads válidos:** `event_name = 'Lead'` com `is_bot = 0` e `COALESCE(is_junk,0) = 0`. Coluna de tempo é `e.timestamp` (unix seconds).
- **`wrangler d1 migrations apply --remote` é PROIBIDO neste projeto** (migrations 0021/0022/0025 quebram ao reaplicar). Aplicar schema novo só com `d1 execute --remote --file=...`, e o arquivo precisa ser idempotente.
- **Não alterar** `functions/tracker.js`, landing pages, nem qualquer endpoint existente. Esta entrega é aditiva.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `functions/api/_canal.js` (novo) | Regra única: dados do lead → canal. Sem I/O. |
| `functions/api/_funil-campanha.js` (novo) | Resolução automática nome-de-campanha → funil, e leitura da lista de funis conhecidos. |
| `functions/api/_cpl-calculo.js` (novo) | Agregação: leads + gastos + mapa → os três recortes. Sem I/O. |
| `functions/api/campaign-funnel.js` (novo) | `GET` lista campanhas com funil resolvido; `POST` grava/apaga override manual. |
| `functions/api/cpl.js` (novo) | `GET` devolve `por_funil`, `por_canal`, `aquisicao_estimativa` e `cruzado`. |
| `migrations/0028_campaign_funnel_map.sql` (novo) | Tabela dos overrides manuais. |
| `public/dash/index.html` (modificar) | Aba Meta Ads: três tabelas novas + coluna de funil editável. |
| `tests/canal.test.js`, `tests/funil-campanha.test.js`, `tests/cpl-calculo.test.js` (novos) | Testes das regras puras. |

**Divergência consciente da spec:** a spec descrevia uma coluna `origem` (`auto`/`manual`) na tabela. O plano guarda **apenas os overrides manuais** — o automático é recalculado a cada consulta, então gravá-lo criaria duas verdades que podem divergir. A origem continua sendo exposta na API (`auto`/`manual`/`sem-funil`), só que **derivada**: tem linha na tabela → `manual`; senão resolve automático → `auto`; senão → `sem-funil`.

---

### Task 1: Regra de canal

**Files:**
- Create: `functions/api/_canal.js`
- Test: `tests/canal.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `canalDeLead({ material, utm_campaign, utm_source }) -> string`; `CANAIS` (array de strings, ordem de exibição); `CANAL_AQUISICAO = 'aquisicao'`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/canal.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canalDeLead, CANAIS } from '../functions/api/_canal.js';

test('material preenchido vence tudo e vira manychat', () => {
  assert.equal(canalDeLead({ material: 'icp', utm_source: 'facebookads' }), 'manychat');
});

test('campanha bioperfil vira bio', () => {
  assert.equal(canalDeLead({ utm_campaign: 'bioperfil-felipe', utm_source: 'organico' }), 'bio');
  assert.equal(canalDeLead({ utm_campaign: 'BioPerfil-Barbara' }), 'bio');
});

test('facebookads vira meta-ads', () => {
  assert.equal(canalDeLead({ utm_source: 'facebookads', utm_campaign: 'ae_leads_x' }), 'meta-ads');
});

test('email e ghl viram email', () => {
  assert.equal(canalDeLead({ utm_source: 'email-marketing' }), 'email');
  assert.equal(canalDeLead({ utm_source: 'ghl' }), 'email');
});

test('utm_source desconhecida vira outro', () => {
  assert.equal(canalDeLead({ utm_source: 'youtube' }), 'outro');
});

test('sem utm nenhuma vira direto', () => {
  assert.equal(canalDeLead({}), 'direto');
  assert.equal(canalDeLead({ utm_source: '', utm_campaign: '   ' }), 'direto');
  assert.equal(canalDeLead({ utm_source: null, material: null }), 'direto');
});

test('bio vence meta-ads quando as duas condições batem', () => {
  assert.equal(canalDeLead({ utm_campaign: 'bioperfil-day', utm_source: 'facebookads' }), 'bio');
});

test('CANAIS contém todos os valores que canalDeLead sabe devolver', () => {
  for (const c of ['manychat', 'bio', 'meta-ads', 'email', 'outro', 'direto']) {
    assert.ok(CANAIS.includes(c), `${c} faltando em CANAIS`);
  }
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Cannot find module '../functions/api/_canal.js'`

- [ ] **Step 3: Implementar o módulo**

Criar `functions/api/_canal.js`:

```js
// Regra única de canal do lead (spec 2026-07-28).
//
// Canal = por ONDE a pessoa chegou (bio, anúncio, ManyChat...). Não confundir
// com funil, que é PARA ONDE ela foi (a oferta). O tracking historicamente
// misturou os dois no campo `funnel`; este módulo separa a metade "canal".
//
// Derivado do que a sessão já grava — nenhuma coluna nova, e vale para o
// histórico inteiro. Cascata: a PRIMEIRA condição que casar vence.

export const CANAL_AQUISICAO = 'aquisicao';

// Ordem de exibição no dashboard.
export const CANAIS = ['meta-ads', 'bio', 'manychat', 'email', 'outro', 'direto'];

// `aquisicao` NÃO entra nesta função de propósito: post impulsionado não manda
// ninguém para o site, então não existe sessão com esse canal. Ele é rótulo do
// lado do INVESTIMENTO (ver _cpl-calculo.js), não do lado do lead.
export function canalDeLead(lead) {
  const texto = (v) => (v == null ? '' : String(v)).trim().toLowerCase();

  // ManyChat primeiro: as páginas /materiais/* podem chegar com ou sem UTM.
  if (texto(lead.material)) return 'manychat';

  if (texto(lead.utm_campaign).startsWith('bioperfil')) return 'bio';

  const fonte = texto(lead.utm_source);
  if (fonte === 'facebookads') return 'meta-ads';
  if (fonte.includes('email') || fonte.includes('ghl')) return 'email';
  if (fonte) return 'outro';
  return 'direto';
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS — 8 testes de `canal.test.js` verdes.

- [ ] **Step 5: Commit**

```bash
git add functions/api/_canal.js tests/canal.test.js
git commit -m "feat: regra de canal do lead derivada das UTMs"
```

---

### Task 2: Resolução automática campanha → funil

**Files:**
- Create: `functions/api/_funil-campanha.js`
- Test: `tests/funil-campanha.test.js`

**Interfaces:**
- Consumes: `CANAL_AQUISICAO` de `functions/api/_canal.js`.
- Produces: `resolverFunilAuto(campaignName, funisConhecidos) -> string|null`; `listarFunisConhecidos(DB) -> Promise<string[]>`; `FUNIL_SEM_CLASSIFICACAO = 'sem-funil'`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/funil-campanha.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverFunilAuto, FUNIL_SEM_CLASSIFICACAO } from '../functions/api/_funil-campanha.js';

// Os funis que existem de verdade no D1 hoje.
const FUNIS = ['lives-semanais-v1', 'sessao-estrategica', 'workshop', 'trafego-atacado', 'aplicacao-mentoria', 'iscas-manychat'];

test('último segmento igual ao funil casa', () => {
  assert.equal(resolverFunilAuto('ae_leads_publico-frio_evento-lead_sessao-estrategica', FUNIS), 'sessao-estrategica');
  assert.equal(resolverFunilAuto('ae_leads_publico-frio_form-nativo_sessao-estrategica', FUNIS), 'sessao-estrategica');
});

test('último segmento como prefixo casa com o sufixo de versão', () => {
  assert.equal(resolverFunilAuto('ae_leads_publico-frio_evento-lead_lives-semanais', FUNIS), 'lives-semanais-v1');
});

test('nome sem underscore é impulsionamento', () => {
  assert.equal(resolverFunilAuto('Post do Instagram: No atacado, a primeira compra...', FUNIS), 'aquisicao');
  assert.equal(resolverFunilAuto('Publicação impulsionada', FUNIS), 'aquisicao');
});

test('trafego-pago não casa com trafego-atacado — exige override manual', () => {
  assert.equal(resolverFunilAuto('ae_leads_publico-frio_evento-lead_trafego-pago', FUNIS), null);
});

test('prefixo só casa em fronteira de hífen', () => {
  // 'workshop' não pode casar um funil hipotético 'workshopping'
  assert.equal(resolverFunilAuto('ae_leads_x_workshop', ['workshopping']), null);
  assert.equal(resolverFunilAuto('ae_leads_x_workshop', ['workshop-vip']), 'workshop-vip');
});

test('igualdade exata ganha de prefixo quando os dois existem', () => {
  assert.equal(resolverFunilAuto('ae_x_workshop', ['workshop-vip', 'workshop']), 'workshop');
});

test('entre dois prefixos, vence o mais curto', () => {
  assert.equal(resolverFunilAuto('ae_x_lives-semanais', ['lives-semanais-v2-turbo', 'lives-semanais-v1']), 'lives-semanais-v1');
});

test('nome vazio ou nulo devolve null', () => {
  assert.equal(resolverFunilAuto('', FUNIS), null);
  assert.equal(resolverFunilAuto(null, FUNIS), null);
  assert.equal(resolverFunilAuto('ae_leads_', FUNIS), null);
});

test('lista de funis vazia devolve null sem quebrar', () => {
  assert.equal(resolverFunilAuto('ae_x_sessao-estrategica', []), null);
});

test('comparação ignora caixa e devolve o slug como está no banco', () => {
  assert.equal(resolverFunilAuto('AE_X_Sessao-Estrategica', FUNIS), 'sessao-estrategica');
});

test('FUNIL_SEM_CLASSIFICACAO é o rótulo do balde', () => {
  assert.equal(FUNIL_SEM_CLASSIFICACAO, 'sem-funil');
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Cannot find module '../functions/api/_funil-campanha.js'`

- [ ] **Step 3: Implementar o módulo**

Criar `functions/api/_funil-campanha.js`:

```js
// Campanha do Meta → funil (spec 2026-07-28).
//
// O automático resolve o previsível; o que não casa fica para o override
// manual gravado em campaign_funnel_map. Nada é descartado em silêncio: sem
// automático e sem override, a campanha cai no balde FUNIL_SEM_CLASSIFICACAO,
// que aparece no relatório com o gasto à mostra.

import { CANAL_AQUISICAO } from './_canal.js';

export const FUNIL_SEM_CLASSIFICACAO = 'sem-funil';

export function resolverFunilAuto(campaignName, funisConhecidos) {
  const nome = (campaignName == null ? '' : String(campaignName)).trim();
  if (!nome) return null;

  // Impulsionamento ("Post do Instagram: ...") não segue a nomenclatura
  // ae_<objetivo>_<publico>_<otimizacao>_<funil> — não tem underscore nenhum.
  if (!nome.includes('_')) return CANAL_AQUISICAO;

  const ultimo = nome.split('_').pop().trim().toLowerCase();
  if (!ultimo) return null;

  const candidatos = (funisConhecidos || [])
    .map((f) => (f == null ? '' : String(f)).trim())
    .filter(Boolean)
    // Prefixo só vale em fronteira de hífen: 'lives-semanais' casa
    // 'lives-semanais-v1' (e um futuro -v2), mas 'workshop' não casa
    // 'workshopping'.
    .filter((f) => {
      const alvo = f.toLowerCase();
      return alvo === ultimo || alvo.startsWith(ultimo + '-');
    });

  if (!candidatos.length) return null;

  const exato = candidatos.find((f) => f.toLowerCase() === ultimo);
  if (exato) return exato;

  // Mais curto = mais genérico, menos chance de chutar uma variante errada.
  return candidatos.sort((a, b) => a.length - b.length)[0];
}

// Funis efetivamente capturados, na mesma definição usada por /api/leads e
// /api/conversion (evento manda, sessão é fallback). Independente de período,
// para o dropdown do dashboard não perder opção ao trocar a data.
export async function listarFunisConhecidos(DB) {
  const { results } = await DB.prepare(`
    SELECT DISTINCT COALESCE(NULLIF(e.funnel, ''), s.funnel) AS funnel
    FROM event_log e
    LEFT JOIN sessions s ON e.session_id = s.session_id
    WHERE COALESCE(NULLIF(e.funnel, ''), s.funnel) IS NOT NULL
      AND COALESCE(NULLIF(e.funnel, ''), s.funnel) <> ''
    ORDER BY funnel
  `).all();
  return (results || []).map((r) => r.funnel);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS — 11 testes de `funil-campanha.test.js` verdes.

- [ ] **Step 5: Commit**

```bash
git add functions/api/_funil-campanha.js tests/funil-campanha.test.js
git commit -m "feat: resolução automática de campanha para funil"
```

---

### Task 3: Cálculo dos recortes de CPL

**Files:**
- Create: `functions/api/_cpl-calculo.js`
- Test: `tests/cpl-calculo.test.js`

**Interfaces:**
- Consumes: `canalDeLead`, `CANAIS`, `CANAL_AQUISICAO` de `_canal.js`; `resolverFunilAuto`, `FUNIL_SEM_CLASSIFICACAO` de `_funil-campanha.js`.
- Produces: `calcularCpl({ leads, gastos, overrides, funisConhecidos }) -> { por_funil, por_canal, aquisicao_estimativa, cruzado, total_investimento, total_leads }`.

Formatos de entrada (o endpoint da Task 5 monta exatamente assim):
- `leads`: `[{ funnel, utm_source, utm_campaign, material }]` — uma entrada por lead válido do período.
- `gastos`: `[{ campaign_id, campaign_name, spend_cents }]` — já agregado por campanha no período.
- `overrides`: `[{ campaign_id, funnel }]` — vindos de `campaign_funnel_map`.
- `funisConhecidos`: `string[]`.

Saída: `spend` e `cpl` em **reais** (número), `leads` inteiro, `cpl` é `null` quando não há lead.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/cpl-calculo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularCpl } from '../functions/api/_cpl-calculo.js';

const FUNIS = ['lives-semanais-v1', 'sessao-estrategica', 'trafego-atacado', 'aplicacao-mentoria'];

function cenario(extra = {}) {
  return {
    funisConhecidos: FUNIS,
    gastos: [
      { campaign_id: '1', campaign_name: 'ae_leads_publico-frio_evento-lead_sessao-estrategica', spend_cents: 200000 },
      { campaign_id: '2', campaign_name: 'ae_leads_publico-frio_evento-lead_trafego-pago', spend_cents: 100000 },
      { campaign_id: '3', campaign_name: 'Post do Instagram: no atacado...', spend_cents: 20000 },
    ],
    overrides: [],
    leads: [
      { funnel: 'sessao-estrategica', utm_source: 'facebookads', utm_campaign: 'ae_leads_x' },
      { funnel: 'sessao-estrategica', utm_source: 'facebookads', utm_campaign: 'ae_leads_x' },
      { funnel: 'sessao-estrategica', utm_source: '', utm_campaign: '' },
      { funnel: 'aplicacao-mentoria', utm_source: 'organico', utm_campaign: 'bioperfil-felipe' },
      { funnel: 'iscas-manychat', material: 'icp', utm_source: '', utm_campaign: '' },
    ],
    ...extra,
  };
}

const linha = (rows, chave, valor) => rows.find((r) => r[chave] === valor);

test('CPL por funil divide gasto da campanha pelos leads do funil', () => {
  const r = calcularCpl(cenario());
  const se = linha(r.por_funil, 'funnel', 'sessao-estrategica');
  assert.equal(se.spend, 2000);
  assert.equal(se.leads, 3);
  assert.ok(Math.abs(se.cpl - 666.6667) < 0.001);
});

test('campanha que o automático não resolve cai em sem-funil com o gasto visível', () => {
  const r = calcularCpl(cenario());
  const sem = linha(r.por_funil, 'funnel', 'sem-funil');
  assert.equal(sem.spend, 1000);
});

test('override manual tira a campanha do balde e leva para o funil certo', () => {
  const r = calcularCpl(cenario({ overrides: [{ campaign_id: '2', funnel: 'trafego-atacado' }] }));
  assert.equal(linha(r.por_funil, 'funnel', 'sem-funil'), undefined);
  assert.equal(linha(r.por_funil, 'funnel', 'trafego-atacado').spend, 1000);
});

test('funil com gasto e zero lead devolve cpl null, nunca Infinity', () => {
  const r = calcularCpl(cenario({ overrides: [{ campaign_id: '2', funnel: 'trafego-atacado' }] }));
  const ta = linha(r.por_funil, 'funnel', 'trafego-atacado');
  assert.equal(ta.leads, 0);
  assert.equal(ta.cpl, null);
});

test('impulsionamento vira o funil aquisicao', () => {
  const r = calcularCpl(cenario());
  assert.equal(linha(r.por_funil, 'funnel', 'aquisicao').spend, 200);
});

test('invariante: soma do gasto das linhas por funil = total do periodo', () => {
  const r = calcularCpl(cenario());
  const soma = r.por_funil.reduce((s, l) => s + l.spend, 0);
  assert.equal(soma, r.total_investimento);
  assert.equal(r.total_investimento, 3200);
});

test('por canal separa bio, manychat, meta-ads e direto', () => {
  const r = calcularCpl(cenario());
  assert.equal(linha(r.por_canal, 'canal', 'meta-ads').leads, 2);
  assert.equal(linha(r.por_canal, 'canal', 'bio').leads, 1);
  assert.equal(linha(r.por_canal, 'canal', 'manychat').leads, 1);
  assert.equal(linha(r.por_canal, 'canal', 'direto').leads, 1);
});

test('gasto do meta vai todo para o canal meta-ads, menos o impulsionamento', () => {
  const r = calcularCpl(cenario());
  assert.equal(linha(r.por_canal, 'canal', 'meta-ads').spend, 3000);
  assert.equal(linha(r.por_canal, 'canal', 'bio').spend, 0);
});

test('aquisicao vem fora de por_canal, com leads de bio+manychat e marcado como estimativa', () => {
  const r = calcularCpl(cenario());
  assert.equal(r.aquisicao_estimativa.spend, 200);
  assert.equal(r.aquisicao_estimativa.leads, 2);
  assert.equal(r.aquisicao_estimativa.cpl, 100);
  assert.equal(r.aquisicao_estimativa.estimado, true);
  assert.equal(linha(r.por_canal, 'canal', 'aquisicao'), undefined);
});

test('aquisicao sem lead de bio nem manychat devolve cpl null', () => {
  const r = calcularCpl(cenario({ leads: [{ funnel: 'sessao-estrategica', utm_source: 'facebookads' }] }));
  assert.equal(r.aquisicao_estimativa.leads, 0);
  assert.equal(r.aquisicao_estimativa.cpl, null);
});

test('cruzado separa o mesmo funil por canal', () => {
  const r = calcularCpl(cenario({
    leads: [
      { funnel: 'aplicacao-mentoria', utm_source: 'organico', utm_campaign: 'bioperfil-felipe' },
      { funnel: 'aplicacao-mentoria', utm_source: 'facebookads', utm_campaign: 'ae_x' },
      { funnel: 'aplicacao-mentoria', utm_source: 'facebookads', utm_campaign: 'ae_x' },
    ],
  }));
  const bio = r.cruzado.find((c) => c.funnel === 'aplicacao-mentoria' && c.canal === 'bio');
  const pago = r.cruzado.find((c) => c.funnel === 'aplicacao-mentoria' && c.canal === 'meta-ads');
  assert.equal(bio.leads, 1);
  assert.equal(pago.leads, 2);
});

test('lead sem funil cai em sem-funil em vez de sumir', () => {
  const r = calcularCpl(cenario({ leads: [{ funnel: '', utm_source: '' }] }));
  assert.equal(linha(r.por_funil, 'funnel', 'sem-funil').leads, 1);
  assert.equal(r.total_leads, 1);
});

test('entradas vazias nao quebram', () => {
  const r = calcularCpl({ leads: [], gastos: [], overrides: [], funisConhecidos: [] });
  assert.deepEqual(r.por_funil, []);
  assert.equal(r.total_investimento, 0);
  assert.equal(r.total_leads, 0);
  assert.equal(r.aquisicao_estimativa.cpl, null);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Cannot find module '../functions/api/_cpl-calculo.js'`

- [ ] **Step 3: Implementar o módulo**

Criar `functions/api/_cpl-calculo.js`:

```js
// Agregação do CPL por funil e por canal (spec 2026-07-28).
//
// Função pura: recebe leads, gastos e overrides já lidos do D1 e devolve os
// recortes prontos. Todo o cálculo acontece aqui — o endpoint só faz I/O e o
// dashboard só desenha.
//
// O agrupamento é em JS, não em SQL, de propósito: são centenas de leads por
// período e assim a regra de canal existe UMA vez (em _canal.js), em vez de
// uma cópia em JS e outra em SQL que divergem na primeira manutenção. Se um
// dia o volume passar de dezenas de milhares de leads por período, vale mover
// para SQL — aí com a regra gerada a partir deste módulo.

import { canalDeLead, CANAIS, CANAL_AQUISICAO } from './_canal.js';
import { resolverFunilAuto, FUNIL_SEM_CLASSIFICACAO } from './_funil-campanha.js';

export function calcularCpl({ leads = [], gastos = [], overrides = [], funisConhecidos = [] }) {
  const mapaOverride = new Map((overrides || []).map((o) => [String(o.campaign_id), o.funnel]));

  // 1. Gasto por funil. Override manual vence; depois o automático; senão balde.
  const gastoPorFunil = new Map();
  let totalCentavos = 0;
  let centavosAquisicao = 0;
  let centavosMetaAds = 0;

  for (const g of gastos) {
    const centavos = Number(g.spend_cents) || 0;
    totalCentavos += centavos;

    const funil =
      mapaOverride.get(String(g.campaign_id)) ||
      resolverFunilAuto(g.campaign_name, funisConhecidos) ||
      FUNIL_SEM_CLASSIFICACAO;

    gastoPorFunil.set(funil, (gastoPorFunil.get(funil) || 0) + centavos);

    // Do lado do canal, o gasto do Meta é 'meta-ads' — exceto o
    // impulsionamento, que é o gasto de topo de funil.
    if (funil === CANAL_AQUISICAO) centavosAquisicao += centavos;
    else centavosMetaAds += centavos;
  }

  // 2. Leads por funil, por canal e no cruzamento.
  const leadsPorFunil = new Map();
  const leadsPorCanal = new Map();
  const leadsCruzado = new Map();

  for (const l of leads) {
    const funil = (l.funnel == null ? '' : String(l.funnel)).trim() || FUNIL_SEM_CLASSIFICACAO;
    const canal = canalDeLead(l);

    leadsPorFunil.set(funil, (leadsPorFunil.get(funil) || 0) + 1);
    leadsPorCanal.set(canal, (leadsPorCanal.get(canal) || 0) + 1);
    const chave = funil + '||' + canal;
    leadsCruzado.set(chave, (leadsCruzado.get(chave) || 0) + 1);
  }

  // 3. Montagem das linhas.
  const cpl = (centavos, qtd) => (qtd > 0 ? centavos / 100 / qtd : null);

  const funis = new Set([...gastoPorFunil.keys(), ...leadsPorFunil.keys()]);
  const por_funil = [...funis]
    .map((funnel) => {
      const centavos = gastoPorFunil.get(funnel) || 0;
      const qtd = leadsPorFunil.get(funnel) || 0;
      return {
        funnel,
        spend: centavos / 100,
        leads: qtd,
        cpl: cpl(centavos, qtd),
        share: totalCentavos > 0 ? (centavos / totalCentavos) * 100 : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend || b.leads - a.leads);

  const gastoPorCanal = new Map([['meta-ads', centavosMetaAds]]);
  const canais = new Set([...gastoPorCanal.keys(), ...leadsPorCanal.keys()]);
  const por_canal = [...canais]
    .map((canal) => {
      const centavos = gastoPorCanal.get(canal) || 0;
      const qtd = leadsPorCanal.get(canal) || 0;
      return { canal, spend: centavos / 100, leads: qtd, cpl: cpl(centavos, qtd) };
    })
    .sort((a, b) => CANAIS.indexOf(a.canal) - CANAIS.indexOf(b.canal));

  // Numerador e denominador de origens diferentes: o turbinar não manda
  // ninguém ao site, o lead aparece depois pela bio ou pelo ManyChat. É
  // dedução, não rastreio — por isso sai separado e marcado.
  const leadsAquisicao = (leadsPorCanal.get('bio') || 0) + (leadsPorCanal.get('manychat') || 0);
  const aquisicao_estimativa = {
    canal: CANAL_AQUISICAO,
    spend: centavosAquisicao / 100,
    leads: leadsAquisicao,
    cpl: cpl(centavosAquisicao, leadsAquisicao),
    estimado: true,
    nota: 'estimativa: leads de bio e ManyChat, ligação por dedução',
  };

  const cruzado = [...leadsCruzado.entries()]
    .map(([chave, qtd]) => {
      const [funnel, canal] = chave.split('||');
      return { funnel, canal, leads: qtd };
    })
    .sort((a, b) => b.leads - a.leads);

  return {
    por_funil,
    por_canal,
    aquisicao_estimativa,
    cruzado,
    total_investimento: totalCentavos / 100,
    total_leads: leads.length,
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS — 13 testes de `cpl-calculo.test.js` verdes, e os de Tasks 1 e 2 continuam verdes.

- [ ] **Step 5: Commit**

```bash
git add functions/api/_cpl-calculo.js tests/cpl-calculo.test.js
git commit -m "feat: cálculo do CPL por funil, canal e cruzamento"
```

---

### Task 4: Tabela de overrides e endpoint de mapeamento

**Files:**
- Create: `migrations/0028_campaign_funnel_map.sql`
- Create: `functions/api/campaign-funnel.js`

**Interfaces:**
- Consumes: `resolverFunilAuto`, `listarFunisConhecidos`, `FUNIL_SEM_CLASSIFICACAO` de `_funil-campanha.js`; `CANAL_AQUISICAO` de `_canal.js`.
- Produces: rota `GET /api/campaign-funnel` → `{ rows: [{ campaign_id, campaign_name, spend, funnel, origem }], funis: string[] }` com `origem ∈ {auto, manual, sem-funil}`; rota `POST /api/campaign-funnel` com corpo `{ campaign_id, campaign_name, funnel }` (funnel vazio remove o override).

- [ ] **Step 1: Criar a migration**

Criar `migrations/0028_campaign_funnel_map.sql`:

```sql
-- Override manual do mapeamento campanha → funil (spec 2026-07-28).
--
-- Guarda SÓ o que a pessoa corrigiu na mão. O mapeamento automático é
-- recalculado a cada consulta por resolverFunilAuto() — gravá-lo aqui criaria
-- duas verdades que divergem quando a regra mudar.
CREATE TABLE IF NOT EXISTS campaign_funnel_map (
    campaign_id TEXT PRIMARY KEY,
    campaign_name TEXT,               -- nome no momento da correção, para leitura humana
    funnel TEXT NOT NULL,             -- slug do funil, ou 'aquisicao' para impulsionamento
    atualizado_em INTEGER NOT NULL    -- unix seconds
);
```

- [ ] **Step 2: Aplicar a migration local e remotamente**

```bash
npx wrangler@latest d1 execute tracking-ae-db --local --file=migrations/0028_campaign_funnel_map.sql
npx wrangler@latest d1 execute tracking-ae-db --remote --file=migrations/0028_campaign_funnel_map.sql
```

Expected: `success: true` nas duas. **Nunca** usar `d1 migrations apply --remote` neste projeto.

Verificar: `npx wrangler@latest d1 execute tracking-ae-db --remote --command "SELECT COUNT(*) FROM campaign_funnel_map"` → 0.

- [ ] **Step 3: Implementar o endpoint**

Criar `functions/api/campaign-funnel.js`:

```js
// GET  /api/campaign-funnel?key=...&days=30  → campanhas do período com o funil resolvido
// POST /api/campaign-funnel?key=...          → grava (ou remove) override manual
//
// A coluna "Funil" da tabela de campanhas do dashboard consome as duas rotas.
// Endpoint ADITIVO: nenhum endpoint existente foi alterado.

import { resolverFunilAuto, listarFunisConhecidos, FUNIL_SEM_CLASSIFICACAO } from './_funil-campanha.js';
import { CANAL_AQUISICAO } from './_canal.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const { since, until } = resolvePeriod(url, days);
  const sinceDate = new Date(since * 1000).toISOString().slice(0, 10);
  const untilDate = new Date(until * 1000).toISOString().slice(0, 10);

  const [campanhas, overrides, funis] = await Promise.all([
    env.DB.prepare(`
      SELECT campaign_id, MAX(campaign_name) AS campaign_name, SUM(spend_cents) AS spend_cents
      FROM ad_spend
      WHERE platform = 'meta' AND date BETWEEN ? AND ?
      GROUP BY campaign_id
      ORDER BY spend_cents DESC
      LIMIT 200
    `).bind(sinceDate, untilDate).all(),
    env.DB.prepare('SELECT campaign_id, funnel FROM campaign_funnel_map').all(),
    listarFunisConhecidos(env.DB),
  ]);

  const mapaOverride = new Map((overrides.results || []).map((o) => [String(o.campaign_id), o.funnel]));

  const rows = (campanhas.results || []).map((c) => {
    const manual = mapaOverride.get(String(c.campaign_id));
    const auto = manual ? null : resolverFunilAuto(c.campaign_name, funis);
    return {
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name || c.campaign_id,
      spend: (c.spend_cents || 0) / 100,
      funnel: manual || auto || FUNIL_SEM_CLASSIFICACAO,
      origem: manual ? 'manual' : (auto ? 'auto' : 'sem-funil'),
    };
  });

  return json({ rows, funis: [...funis, CANAL_AQUISICAO] });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const campaignId = (corpo.campaign_id == null ? '' : String(corpo.campaign_id)).trim();
  if (!campaignId) return json({ error: 'campaign_id obrigatório' }, 400);

  const funil = (corpo.funnel == null ? '' : String(corpo.funnel)).trim();

  // Funil vazio = "volta para o automático": apaga o override.
  if (!funil) {
    await env.DB.prepare('DELETE FROM campaign_funnel_map WHERE campaign_id = ?').bind(campaignId).run();
    return json({ ok: true, removido: true });
  }

  // Só aceita funil que existe de verdade (ou o rótulo de impulsionamento).
  // Sem isso, um erro de digitação cria um funil fantasma no relatório.
  const funis = await listarFunisConhecidos(env.DB);
  const permitidos = new Set([...funis, CANAL_AQUISICAO]);
  if (!permitidos.has(funil)) {
    return json({ error: `funil desconhecido: ${funil}` }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO campaign_funnel_map (campaign_id, campaign_name, funnel, atualizado_em)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(campaign_id) DO UPDATE SET
      campaign_name = excluded.campaign_name,
      funnel = excluded.funnel,
      atualizado_em = excluded.atualizado_em
  `).bind(
    campaignId,
    (corpo.campaign_name == null ? '' : String(corpo.campaign_name)).trim() || null,
    funil,
    Math.floor(Date.now() / 1000),
  ).run();

  return json({ ok: true, funnel: funil });
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw || '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function resolvePeriod(url, days) {
  const now = Math.floor(Date.now() / 1000);
  const fromTs = parseInt(url.searchParams.get('from') || '', 10);
  const toTs = parseInt(url.searchParams.get('to') || '', 10);
  const since = Number.isFinite(fromTs) && fromTs > 0 ? fromTs : now - days * 86400;
  const until = Number.isFinite(toTs) && toTs > 0 ? toTs : now;
  return { since, until };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 4: Testar manualmente contra produção**

```bash
npx wrangler@latest pages dev . --port 8788
```

Em outro terminal (trocar `SUACHAVE` pela `DASH_KEY`):

```bash
curl -s "http://localhost:8788/api/campaign-funnel?key=SUACHAVE&days=30" | head -40
curl -s "http://localhost:8788/api/campaign-funnel?days=30"            # espera 401
curl -s -X POST "http://localhost:8788/api/campaign-funnel?key=SUACHAVE" \
  -H 'Content-Type: application/json' -d '{"campaign_id":"999","funnel":"nao-existe"}'   # espera 400
```

Expected: a lista traz `sessao-estrategica` com `origem: "auto"`, a campanha `trafego-pago` com `origem: "sem-funil"` e os posts do Instagram com `funnel: "aquisicao"`. Sem chave → 401. Funil inexistente → 400.

- [ ] **Step 5: Commit**

```bash
git add migrations/0028_campaign_funnel_map.sql functions/api/campaign-funnel.js
git commit -m "feat: mapeamento campanha para funil com override manual"
```

---

### Task 5: Endpoint /api/cpl

**Files:**
- Create: `functions/api/cpl.js`

**Interfaces:**
- Consumes: `calcularCpl` de `_cpl-calculo.js`; `listarFunisConhecidos` de `_funil-campanha.js`.
- Produces: rota `GET /api/cpl` → `{ por_funil, por_canal, aquisicao_estimativa, cruzado, total_investimento, total_leads, avisos: string[] }`.

- [ ] **Step 1: Implementar o endpoint**

Criar `functions/api/cpl.js`:

```js
// GET /api/cpl?key=...&days=30 (ou from=<unix>&to=<unix>)
//
// CPL por funil (a oferta) e por canal (a origem), mais o cruzamento dos dois.
// Todo o cálculo mora em _cpl-calculo.js; aqui só acontece I/O.
//
// Investimento vem de ad_spend (Meta). Leads vêm de event_log com o mesmo
// filtro de validade do /api/leads: não-bot, não-junk, funil efetivo.

import { calcularCpl } from './_cpl-calculo.js';
import { listarFunisConhecidos } from './_funil-campanha.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const { since, until } = resolvePeriod(url, days);
  const sinceDate = new Date(since * 1000).toISOString().slice(0, 10);
  const untilDate = new Date(until * 1000).toISOString().slice(0, 10);

  const [gastos, leads, overrides, funisConhecidos] = await Promise.all([
    env.DB.prepare(`
      SELECT campaign_id, MAX(campaign_name) AS campaign_name, SUM(spend_cents) AS spend_cents
      FROM ad_spend
      WHERE platform = 'meta' AND date BETWEEN ? AND ?
      GROUP BY campaign_id
    `).bind(sinceDate, untilDate).all(),

    env.DB.prepare(`
      SELECT
        COALESCE(NULLIF(e.funnel, ''), s.funnel) AS funnel,
        s.utm_source,
        s.utm_campaign,
        e.material,
        e.origin
      FROM event_log e
      LEFT JOIN sessions s ON e.session_id = s.session_id
      WHERE e.event_name = 'Lead'
        AND e.timestamp >= ? AND e.timestamp <= ?
        AND e.is_bot = 0
        AND COALESCE(e.is_junk, 0) = 0
    `).bind(since, until).all(),

    env.DB.prepare('SELECT campaign_id, funnel FROM campaign_funnel_map').all(),

    listarFunisConhecidos(env.DB),
  ]);

  const resultado = calcularCpl({
    leads: leads.results || [],
    gastos: gastos.results || [],
    overrides: overrides.results || [],
    funisConhecidos,
  });

  // Avisos: o painel diz o que não sabe, em vez de deixar a pessoa concluir
  // errado a partir de um número vazio.
  const avisos = [];
  const semFunil = resultado.por_funil.find((l) => l.funnel === 'sem-funil');
  if (semFunil && semFunil.spend > 0) {
    avisos.push(`R$ ${semFunil.spend.toFixed(2)} de investimento sem funil definido — classifique as campanhas na tabela abaixo.`);
  }
  const formNativo = (gastos.results || []).find(
    (g) => (g.campaign_name || '').includes('form-nativo'),
  );
  if (formNativo) {
    const temLeadDeForm = (leads.results || []).some((l) => (l.origin || '') === 'meta-form');
    if (!temLeadDeForm) {
      avisos.push('A campanha de formulário nativo tem investimento e nenhum lead no tracking: o sync de leads do Meta depende de um cron que ainda não foi agendado (issue 145). Não é a campanha que está ruim.');
    }
  }

  return json({ ...resultado, avisos });
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw || '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function resolvePeriod(url, days) {
  const now = Math.floor(Date.now() / 1000);
  const fromTs = parseInt(url.searchParams.get('from') || '', 10);
  const toTs = parseInt(url.searchParams.get('to') || '', 10);
  const since = Number.isFinite(fromTs) && fromTs > 0 ? fromTs : now - days * 86400;
  const until = Number.isFinite(toTs) && toTs > 0 ? toTs : now;
  return { since, until };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Testar manualmente e conferir o invariante**

```bash
npx wrangler@latest pages dev . --port 8788
curl -s "http://localhost:8788/api/cpl?key=SUACHAVE&days=30" | python -m json.tool | head -60
```

Conferir na saída:
- A soma de `spend` de todas as linhas de `por_funil` é igual a `total_investimento`.
- `total_investimento` bate com o KPI "Investimento" já exibido na aba Meta Ads no mesmo período.
- Nenhum `cpl` vem `Infinity` ou `NaN` — quando não há lead, vem `null`.
- `aquisicao_estimativa.estimado` é `true`.

- [ ] **Step 3: Commit**

```bash
git add functions/api/cpl.js
git commit -m "feat: endpoint /api/cpl com recortes por funil e canal"
```

---

### Task 6: Aba Meta Ads no dashboard

**Files:**
- Modify: `public/dash/index.html:206` (HTML da seção), `public/dash/index.html:572-597` (função `R.metaads`)

**Interfaces:**
- Consumes: `GET /api/cpl`, `GET /api/campaign-funnel`, `POST /api/campaign-funnel`.
- Produces: nada (ponta final).

- [ ] **Step 1: Acrescentar os contêineres no HTML**

Em `public/dash/index.html`, logo após a linha 205 (`<div class="grid-kpi" id="meta-kpis"></div>`) e antes do card "Campanhas", inserir:

```html
      <div id="cpl-avisos"></div>
      <div class="card"><h2>CPL por funil</h2><div class="tabela-wrap" id="cpl-funil"></div></div>
      <div class="card"><h2>CPL por canal</h2><div class="tabela-wrap" id="cpl-canal"></div></div>
      <div class="card"><h2>Funil × canal <small>leads por cruzamento</small></h2><div class="tabela-wrap" id="cpl-cruzado"></div></div>
```

- [ ] **Step 2: Buscar os dados novos em R.metaads**

Em `public/dash/index.html:574-579`, trocar o `Promise.all` por:

```js
  const [atr, atrAnt, camp, leads, cpl, mapa] = await Promise.all([
    fetchJson(`/api/attribution?${q(p.de, p.ate)}`),
    fetchJson(`/api/attribution?${q(p.antDe, p.antAte)}`),
    fetchJson(`/api/ad-spend?${q(p.de, p.ate)}`),
    fetchJson(`/api/leads?${q(p.de, p.ate)}&limit=1`),
    fetchJson(`/api/cpl?${q(p.de, p.ate)}`),
    fetchJson(`/api/campaign-funnel?${q(p.de, p.ate)}`),
  ]);
```

- [ ] **Step 3: Renderizar avisos e as três tabelas**

Logo depois da linha do `#meta-sync-nota` (atual linha 588), inserir:

```js
  $('#cpl-avisos').innerHTML = (cpl.avisos || [])
    .map((a) => `<div class="aviso">${esc(a)}</div>`).join('');

  const cplCel = (r) => r.cpl == null
    ? `<span class="semdado">—</span>${r.leads === 0 ? '<div class="mini">sem lead no período</div>' : ''}`
    : money(r.cpl);

  tabela($('#cpl-funil'), [
    { titulo: 'Funil', campo: 'funnel', render: (r) => esc(r.funnel === 'sem-funil' ? 'Sem funil' : r.funnel) },
    { titulo: 'Investimento', num: true, campo: 'spend', render: (r) => money(r.spend) },
    { titulo: 'Leads', num: true, campo: 'leads', render: (r) => fmtInt(r.leads) },
    { titulo: 'CPL', num: true, campo: 'cpl', render: cplCel },
    { titulo: '% do gasto', num: true, campo: 'share', render: (r) => fmtNum(r.share, 1) + '%' },
  ], cpl.por_funil || []);

  // A linha de aquisição entra no fim, visualmente separada: o denominador
  // dela vem de outros canais (bio + ManyChat), então somá-la às demais
  // contaria os mesmos leads duas vezes.
  const linhasCanal = [...(cpl.por_canal || [])];
  if (cpl.aquisicao_estimativa && (cpl.aquisicao_estimativa.spend > 0 || cpl.aquisicao_estimativa.leads > 0)) {
    linhasCanal.push(cpl.aquisicao_estimativa);
  }
  tabela($('#cpl-canal'), [
    { titulo: 'Canal', campo: 'canal', render: (r) => esc(r.canal) + (r.estimado ? ` <span class="mini">${esc(r.nota)}</span>` : '') },
    { titulo: 'Investimento', num: true, campo: 'spend', render: (r) => money(r.spend) },
    { titulo: 'Leads', num: true, campo: 'leads', render: (r) => fmtInt(r.leads) },
    { titulo: 'CPL', num: true, campo: 'cpl', render: cplCel },
  ], linhasCanal);

  tabela($('#cpl-cruzado'), [
    { titulo: 'Funil', campo: 'funnel', render: (r) => esc(r.funnel === 'sem-funil' ? 'Sem funil' : r.funnel) },
    { titulo: 'Canal', campo: 'canal', render: (r) => esc(r.canal) },
    { titulo: 'Leads', num: true, campo: 'leads', render: (r) => fmtInt(r.leads) },
  ], cpl.cruzado || []);
```

- [ ] **Step 4: Acrescentar a coluna Funil editável na tabela de campanhas**

Trocar a chamada `tabela($('#meta-campanhas'), ...)` (atual linha 589-596) por:

```js
  const funilPorCampanha = new Map((mapa.rows || []).map((r) => [String(r.campaign_id), r]));
  const opcoesFunil = (mapa.funis || []);

  tabela($('#meta-campanhas'), [
    { titulo: 'Campanha', campo: 'campaign_name', render: (r) => esc(r.campaign_name) },
    { titulo: 'Funil', campo: 'funnel', render: (r) => {
      const m = funilPorCampanha.get(String(r.campaign_id)) || { funnel: 'sem-funil', origem: 'sem-funil' };
      const opcoes = opcoesFunil.map((f) =>
        `<option value="${esc(f)}"${f === m.funnel ? ' selected' : ''}>${esc(f)}</option>`).join('');
      const marca = m.origem === 'auto' ? '<div class="mini">automático</div>' : '';
      return `<select class="sel-funil" data-campanha="${esc(r.campaign_id)}" data-nome="${esc(r.campaign_name)}">
        <option value=""${m.origem === 'sem-funil' ? ' selected' : ''}>— sem funil —</option>${opcoes}
      </select>${marca}`;
    } },
    { titulo: 'Investimento', num: true, campo: 'spend', render: (r) => money(r.spend) },
    { titulo: 'Impressões', num: true, campo: 'impressions', render: (r) => fmtInt(r.impressions) },
    { titulo: 'Cliques', num: true, campo: 'clicks', render: (r) => fmtInt(r.clicks) },
    { titulo: 'CPC', num: true, campo: 'cpc', render: (r) => r.cpc == null ? '—' : money(r.cpc) },
    { titulo: 'CPM', num: true, campo: 'cpm', render: (r) => r.cpm == null ? '—' : money(r.cpm) },
  ], camp.rows || []);

  // `tabela()` usa onclick para ordenar; onchange não conflita com isso. O
  // listener fica no contêiner porque a tabela é redesenhada ao ordenar.
  $('#meta-campanhas').onchange = async (ev) => {
    const sel = ev.target.closest('select.sel-funil');
    if (!sel) return;
    sel.disabled = true;
    try {
      const r = await fetch(`/api/campaign-funnel?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: sel.dataset.campanha,
          campaign_name: sel.dataset.nome,
          funnel: sel.value,
        }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      await R.metaads();   // redesenha com o CPL já recalculado
    } catch {
      sel.disabled = false;
      alert('Não foi possível salvar o funil desta campanha. Tente de novo.');
    }
  };
```

- [ ] **Step 5: Verificar no navegador**

```bash
npx wrangler@latest pages dev . --port 8788
```

Abrir `http://localhost:8788/dash/?key=SUACHAVE`, ir na aba Meta Ads e conferir:
- As três tabelas novas aparecem preenchidas.
- A campanha `..._trafego-pago` está como "— sem funil —"; trocar para `trafego-atacado` faz a tabela de CPL por funil se atualizar sozinha, e a linha "Sem funil" desaparece.
- Recarregar a página mantém a escolha.
- Os posts do Instagram aparecem como `aquisicao` com a marca "automático".
- O investimento total das linhas continua igual ao KPI "Investimento".

- [ ] **Step 6: Rodar a suíte inteira e commitar**

```bash
npm test
git add public/dash/index.html
git commit -m "feat: CPL por funil e canal na aba Meta Ads"
```

Expected: todos os testes verdes.

---

## Verificação final antes do merge

- [ ] `npm test` passa inteiro.
- [ ] `npm run build` passa (o dashboard é estático, mas o Astro precisa continuar buildando).
- [ ] Soma do investimento das linhas de CPL por funil = KPI "Investimento" do mesmo período.
- [ ] Nenhum `Infinity` / `NaN` / `undefined` visível no painel.
- [ ] Endpoints novos devolvem 401 sem `key`.
- [ ] Nenhum arquivo fora da lista do plano foi modificado (`git diff --stat main`).

## Fora de escopo (não fazer neste plano)

- Mover `iscas-manychat` de funil para canal — seguro só depois que houver leads.
- Integração com o CRM em Supabase (`docs/crm-integracao/perguntas-em-aberto.md`).
- As 239 sessões com `utm_campaign={{campaign.name}}` (macro do Meta não substituída).
- Google Ads em `ad_spend`.
