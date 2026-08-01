# Sistema de teste A/B de páginas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servir duas versões de uma mesma página a metades comparáveis do tráfego, fixando o visitante numa versão, e mostrar no dashboard quando (e se) existe vencedor.

**Architecture:** O `functions/_middleware.js` — que já intercepta toda requisição de página HTML e já cria o `_krob_sid` — consulta os testes ativos no D1 (com cache de 60s em memória), sorteia a variante por hash determinístico do `session_id`, e serve o HTML da variante B reescrevendo o request para `/ab/<slug>/b` sem mudar a URL na barra. A exposição é registrada em `ab_assignments`, que passa a ser o denominador do teste. Toda a lógica de decisão vive em duas funções puras testáveis (`_ab-sorteio.js` e `_ab-estatistica.js`), no mesmo padrão de `functions/_links-destino.js`.

**Tech Stack:** Astro 6 (estático) + Cloudflare Pages Functions (JS puro, ESM) + D1 (SQLite). Testes com `node --test`. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-08-01-teste-ab-paginas-design.md`

## Global Constraints

- **Sem dependências novas.** O `package.json` tem apenas `astro` e `sharp`; nada é adicionado.
- **Pages Functions em JS puro, ESM.** Nada de TypeScript dentro de `functions/`.
- **Prefixo `_` em módulos de `functions/`** que não são rota (o Cloudflare Pages não os transforma em endpoint).
- **Migration aplicada com `wrangler d1 execute --remote`**, NUNCA `wrangler d1 migrations apply --remote` — as migrations 0021/0022/0025 quebram ao reaplicar.
- **Timestamps em segundos** (unix seconds), como todo o schema existente. `sessions.created_at` e `event_log.timestamp` são segundos.
- **Autenticação de endpoint de painel:** `?key=` comparado com `env.DASH_KEY`, retornando `{ error: 'Unauthorized' }` com status 401. Mesmo padrão de `functions/api/links.js`.
- **Nomes de identificadores em português** nos arquivos novos (o projeto mistura, mas o código recente — `_links-destino.js`, `_grupo-conversao.js` — é em português).
- **Comentários explicam o porquê, não o quê.** É o padrão estabelecido em todo o `functions/`.
- **Nenhum comportamento existente pode mudar** quando não há teste ativo: sem teste, o middleware segue exatamente o fluxo de hoje.
- **Testes rodam com** `node --test tests/*.test.js`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `functions/_bots.js` | **Criar.** Lista única de assinaturas de bot + `detectBot()` + gerador das cláusulas SQL. Elimina a duplicação atual. |
| `functions/_ab-sorteio.js` | **Criar.** Função pura: (teste, variantes, session_id) → `'a'` \| `'b'`. |
| `functions/api/_ab-estatistica.js` | **Criar.** Função pura: contagens → veredito, valor-p, SRM. |
| `functions/_ab-consulta.js` | **Criar.** Leitura dos testes ativos no D1 com cache de 60s. |
| `migrations/0031_ab_testes.sql` | **Criar.** `ab_tests`, `ab_variants`, `ab_assignments`. |
| `functions/_middleware.js` | **Modificar.** Sorteio, reescrita, 404 em `/ab/`, preview, registro de exposição. |
| `functions/api/ab-tests.js` | **Criar.** GET resultados + POST criar/editar/ativar/pausar/encerrar. |
| `functions/tracker.js` | **Modificar.** Lista de eventos internos (não vão a Meta/GA4). |
| `functions/api/conversion.js` | **Modificar.** Passa a importar a lista de bots de `_bots.js`. |
| `src/scripts/form-start.ts` | **Criar.** Dispara `FormStart` no primeiro input de um formulário. |
| `src/components/AplicacaoForm.astro` | **Modificar.** Liga o `FormStart`. |
| `src/components/LeadChat.astro` | **Modificar.** Liga o `FormStart`. |
| `src/components/LeadFormModal.astro` | **Modificar.** Liga o `FormStart`. |
| `src/pages/materiais/[slug].astro` | **Modificar.** Liga o `FormStart`. |
| `src/layouts/BaseLayout.astro` | **Modificar.** Prop `noindex` para as páginas de variante. |
| `public/dash/index.html` | **Modificar.** Aba "Testes A/B". |
| `tests/bots.test.js`, `tests/ab-sorteio.test.js`, `tests/ab-estatistica.test.js` | **Criar.** |

**Desvio consciente da spec:** a spec previa o disparo do `FormStart` dentro de `src/scripts/lead-validacao.ts`. O plano cria um módulo próprio (`src/scripts/form-start.ts`) porque `lead-validacao.ts` tem uma responsabilidade só — validar e mascarar campos — e disparo de evento de tracking não é validação. O objetivo da spec (não repetir a lógica em quatro lugares) é atendido igual.

**Sobre `robots.txt`:** a spec menciona manter as variantes fora do índice. O projeto não tem `robots.txt` nem integração de sitemap, e o middleware responde 404 a qualquer acesso direto a `/ab/*` — o Googlebot nunca consegue buscar a página. Com o `noindex` da Task 9 como segunda camada, criar um `robots.txt` novo (que afeta o site inteiro) não se justifica dentro desta feature.

---

### Task 1: Módulo único de assinaturas de bot

Hoje a mesma lista existe em dois lugares: `detectBot()` em `functions/tracker.js:1028` e `BOT_UA_SUBSTRINGS` em `functions/api/conversion.js:109`, com um comentário pedindo sincronia manual. A leitura dos resultados A/B precisaria da mesma lista — esta task extrai o módulo compartilhado em vez de criar a terceira cópia.

**Files:**
- Create: `functions/_bots.js`
- Create: `tests/bots.test.js`
- Modify: `functions/tracker.js:1028-1048` (remover `detectBot`, importar)
- Modify: `functions/api/conversion.js:105-127` e `:41-43` (remover a lista, importar)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `detectBot(userAgent: string) → { isBot: boolean, botReason: string }`
  - `BOT_UA_SUBSTRINGS: string[]`
  - `clausulasBotSql(alias: string) → string` — devolve as linhas `AND <alias>.user_agent NOT LIKE '%x%'` já unidas por quebra de linha.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/bots.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectBot, BOT_UA_SUBSTRINGS, clausulasBotSql } from '../functions/_bots.js';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

test('user-agent de navegador real não é bot', () => {
  const r = detectBot(CHROME);
  assert.equal(r.isBot, false);
  assert.equal(r.botReason, '');
});

test('user-agent ausente ou curto é bot', () => {
  assert.equal(detectBot('').isBot, true);
  assert.equal(detectBot('curto').isBot, true);
});

test('crawlers conhecidos são identificados com o motivo certo', () => {
  assert.equal(detectBot('Googlebot/2.1 (+http://www.google.com/bot.html)').botReason, 'Googlebot');
  assert.equal(detectBot('facebookexternalhit/1.1').botReason, 'Facebook crawler');
  assert.equal(detectBot('WhatsApp/2.19.81 A').botReason, 'WhatsApp preview');
  assert.equal(detectBot('curl/8.4.0 aaaaaa').botReason, 'HTTP library');
});

test('cada substring da lista SQL casa com o detectBot', () => {
  // Protege a equivalência entre a checagem em JS (escrita) e a em SQL
  // (leitura). Sem isso, um bot poderia entrar no event_log como humano e
  // continuar sendo filtrado no dash — ou o contrário.
  for (const s of BOT_UA_SUBSTRINGS) {
    const ua = `Agente-${s}-de-teste/1.0`;
    assert.equal(detectBot(ua).isBot, true, `"${s}" deveria ser bot`);
  }
});

test('clausulasBotSql usa o alias pedido e cobre a lista inteira', () => {
  const sql = clausulasBotSql('s');
  assert.equal(sql.split('\n').length, BOT_UA_SUBSTRINGS.length);
  assert.ok(sql.includes("AND s.user_agent NOT LIKE '%googlebot%'"));
  assert.ok(clausulasBotSql('a').includes("AND a.user_agent NOT LIKE '%curl%'"));
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test tests/bots.test.js`
Expected: FAIL — `Cannot find module '.../functions/_bots.js'`

- [ ] **Step 3: Criar o módulo**

Criar `functions/_bots.js`:

```js
// Assinaturas de bot em UM lugar só. Antes existiam duas cópias — o regex de
// detectBot() em tracker.js (usado na ESCRITA de event_log) e a lista de
// substrings em api/conversion.js (usada na LEITURA, em SQL) — com um
// comentário pedindo sincronia manual. Duas listas que precisam concordar e
// não se falam divergem: um bot marcado como humano na escrita e filtrado na
// leitura some das duas contas, e ninguém percebe.
//
// A forma canônica é a lista de SUBSTRINGS, porque é a que o SQL consegue
// expressar (LIKE não faz regex). O detectBot é construído a partir dela.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

// Ordem importa: o primeiro que casar define o motivo registrado no
// event_log, e os específicos precisam vir antes do genérico 'bot'.
const GRUPOS = [
  { r: 'Googlebot', s: ['googlebot', 'google-inspectiontool'] },
  { r: 'Bingbot', s: ['bingbot', 'msnbot'] },
  { r: 'Facebook crawler', s: ['facebookexternalhit', 'facebot'] },
  { r: 'Twitter crawler', s: ['twitterbot'] },
  { r: 'LinkedIn crawler', s: ['linkedinbot'] },
  { r: 'Slackbot', s: ['slackbot'] },
  { r: 'WhatsApp preview', s: ['whatsapp'] },
  { r: 'Generic bot', s: ['bot', 'crawler', 'spider', 'scraper', 'headless'] },
  { r: 'HTTP library', s: ['python-requests', 'axios', 'node-fetch', 'curl', 'wget', 'httpie'] },
  { r: 'Automation tool', s: ['phantomjs', 'selenium', 'puppeteer', 'playwright'] },
  // Scanners de vulnerabilidade vistos em produção ('TLM-Audit-Scanner/1.0',
  // 'pathscan/1.0'). Estava só na lista da conversion.js; ao unificar, passa a
  // valer também na escrita — bot é bot nos dois lados.
  { r: 'Scanner', s: ['scan'] },
];

export const BOT_UA_SUBSTRINGS = GRUPOS.flatMap((g) => g.s);

export function detectBot(userAgent) {
  if (!userAgent || userAgent.length < 10) {
    return { isBot: true, botReason: 'Missing or short user-agent' };
  }
  const ua = userAgent.toLowerCase();
  for (const grupo of GRUPOS) {
    if (grupo.s.some((sub) => ua.includes(sub))) {
      return { isBot: true, botReason: grupo.r };
    }
  }
  return { isBot: false, botReason: '' };
}

// Cláusulas de exclusão para o WHERE. As substrings são literais estáticos
// deste módulo, nunca entrada do request — sem risco de injeção. O LIKE do
// SQLite é case-insensitive para ASCII, o que preserva a semântica do
// toLowerCase() acima. A regra "UA ausente ou < 10 chars" NÃO está aqui:
// vira `IS NOT NULL AND LENGTH(...) >= 10`, que cada consulta escreve.
export function clausulasBotSql(alias) {
  return BOT_UA_SUBSTRINGS
    .map((s) => `AND ${alias}.user_agent NOT LIKE '%${s}%'`)
    .join('\n');
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test tests/bots.test.js`
Expected: PASS, 5 testes

- [ ] **Step 5: Fazer o `tracker.js` importar**

Em `functions/tracker.js`, apagar a função `detectBot` inteira (linhas 1028-1048) e adicionar o import junto aos que já existem no topo do arquivo:

```js
import { detectBot } from './_bots.js';
```

- [ ] **Step 6: Fazer o `conversion.js` importar**

Em `functions/api/conversion.js`:

Adicionar no topo:
```js
import { clausulasBotSql } from '../_bots.js';
```

Substituir o bloco das linhas 37-43 por:
```js
  // Exclusão de bot: lista única em functions/_bots.js, a mesma que o
  // tracker.js usa na escrita.
  const botClauses = clausulasBotSql('s');
```

Apagar o bloco `const BOT_UA_SUBSTRINGS = [...]` inteiro (linhas 105-127, incluindo o comentário acima dele que pede sincronia manual).

- [ ] **Step 7: Rodar a suíte inteira**

Run: `node --test tests/*.test.js`
Expected: PASS em todos os arquivos

- [ ] **Step 8: Conferir que nada mais referencia as listas antigas**

Run: `grep -rn "BOT_UA_SUBSTRINGS\|function detectBot" functions/`
Expected: só `functions/_bots.js` aparece

- [ ] **Step 9: Commit**

```bash
git add functions/_bots.js tests/bots.test.js functions/tracker.js functions/api/conversion.js
git commit -m "refactor: lista de assinaturas de bot em modulo unico"
```

---

### Task 2: Sorteio da variante (função pura)

**Files:**
- Create: `functions/_ab-sorteio.js`
- Create: `tests/ab-sorteio.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `hashSessao(sessionId: string, slug: string) → number` (inteiro 32 bits sem sinal)
  - `escolherVariante(teste, sessionId) → 'a' | 'b'`, onde `teste` é `{ slug: string, status: string, variantes: Array<{ chave: 'a'|'b', peso: number, page_path: string }> }`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/ab-sorteio.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escolherVariante, hashSessao } from '../functions/_ab-sorteio.js';

const teste = (over = {}) => ({
  slug: 'home-oferta',
  status: 'ativo',
  variantes: [
    { chave: 'a', peso: 50, page_path: '' },
    { chave: 'b', peso: 50, page_path: '/ab/home-oferta/b' },
  ],
  ...over,
});

const ids = (n) => Array.from({ length: n }, (_, i) => `sessao-${i}-${(i * 7919) % 1000}`);

test('o mesmo session_id sempre cai na mesma variante', () => {
  const t = teste();
  const primeira = escolherVariante(t, 'abc-123');
  for (let i = 0; i < 50; i++) {
    assert.equal(escolherVariante(t, 'abc-123'), primeira);
  }
});

test('session_ids diferentes caem em variantes diferentes', () => {
  const t = teste();
  const vistas = new Set(ids(200).map((id) => escolherVariante(t, id)));
  assert.deepEqual([...vistas].sort(), ['a', 'b']);
});

test('10 mil ids distribuem conforme o peso 50/50 (tolerancia 2 pontos)', () => {
  const t = teste();
  const lista = ids(10000);
  const bs = lista.filter((id) => escolherVariante(t, id) === 'b').length;
  const pct = (bs / lista.length) * 100;
  assert.ok(Math.abs(pct - 50) <= 2, `esperado ~50%, veio ${pct.toFixed(2)}%`);
});

test('peso 80/20 e respeitado (tolerancia 2 pontos)', () => {
  const t = teste({
    variantes: [
      { chave: 'a', peso: 80, page_path: '' },
      { chave: 'b', peso: 20, page_path: '/ab/home-oferta/b' },
    ],
  });
  const lista = ids(10000);
  const pct = (lista.filter((id) => escolherVariante(t, id) === 'b').length / lista.length) * 100;
  assert.ok(Math.abs(pct - 20) <= 2, `esperado ~20%, veio ${pct.toFixed(2)}%`);
});

test('o slug muda a divisao: dois testes nao repartem o publico igual', () => {
  const a = teste({ slug: 'teste-um' });
  const b = teste({ slug: 'teste-dois' });
  const lista = ids(1000);
  const iguais = lista.filter((id) => escolherVariante(a, id) === escolherVariante(b, id)).length;
  // Se o slug fosse ignorado, seriam 100% iguais.
  assert.ok(iguais > 350 && iguais < 650, `esperado ~50% de coincidencia, veio ${iguais / 10}%`);
});

test('teste pausado, encerrado, rascunho ou ausente devolve a', () => {
  assert.equal(escolherVariante(teste({ status: 'pausado' }), 'x'), 'a');
  assert.equal(escolherVariante(teste({ status: 'encerrado' }), 'x'), 'a');
  assert.equal(escolherVariante(teste({ status: 'rascunho' }), 'x'), 'a');
  assert.equal(escolherVariante(null, 'x'), 'a');
  assert.equal(escolherVariante(undefined, 'x'), 'a');
});

test('pesos que nao somam 100 devolvem a', () => {
  const t = teste({
    variantes: [
      { chave: 'a', peso: 50, page_path: '' },
      { chave: 'b', peso: 30, page_path: '/ab/home-oferta/b' },
    ],
  });
  assert.equal(escolherVariante(t, 'x'), 'a');
});

test('teste sem as duas variantes devolve a', () => {
  assert.equal(escolherVariante(teste({ variantes: [] }), 'x'), 'a');
  assert.equal(escolherVariante(teste({ variantes: [{ chave: 'a', peso: 100, page_path: '' }] }), 'x'), 'a');
});

test('session_id vazio devolve a', () => {
  assert.equal(escolherVariante(teste(), ''), 'a');
  assert.equal(escolherVariante(teste(), null), 'a');
});

test('hashSessao devolve inteiro nao-negativo e estavel', () => {
  const h = hashSessao('abc', 'slug');
  assert.ok(Number.isInteger(h) && h >= 0);
  assert.equal(h, hashSessao('abc', 'slug'));
  assert.notEqual(h, hashSessao('abd', 'slug'));
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test tests/ab-sorteio.test.js`
Expected: FAIL — `Cannot find module '.../functions/_ab-sorteio.js'`

- [ ] **Step 3: Implementar**

Criar `functions/_ab-sorteio.js`:

```js
// Escolha da variante do teste A/B, isolada e PURA: sem I/O, sem D1, sem env.
// Mesmo padrão de functions/_links-destino.js.
//
// O sorteio é DETERMINÍSTICO em cima do session_id, não Math.random(). Duas
// razões: (1) requisições simultâneas do mesmo visitante poderiam receber
// variantes diferentes antes do cookie existir; (2) a variante continua a
// mesma se o cookie de variante se perder, porque ela é uma função do
// visitante — o cookie é só atalho.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

// FNV-1a de 32 bits. Escolhido por ser curto, sem dependência e com
// distribuição boa o bastante para repartir tráfego — não é hash
// criptográfico, e não precisa ser.
export function hashSessao(sessionId, slug) {
  const texto = `${sessionId}:${slug}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Devolve 'a' em toda situação duvidosa (teste inexistente, fora do ar,
// malformado, sem sessão). 'a' é a página que já estava no ar, então falhar
// para 'a' é falhar para o comportamento atual do site — nunca para uma tela
// quebrada.
export function escolherVariante(teste, sessionId) {
  if (!teste || teste.status !== 'ativo' || !sessionId) return 'a';

  const lista = Array.isArray(teste.variantes) ? teste.variantes : [];
  const a = lista.find((v) => v && v.chave === 'a');
  const b = lista.find((v) => v && v.chave === 'b');
  if (!a || !b) return 'a';

  const pesoA = Number(a.peso);
  const pesoB = Number(b.peso);
  if (!Number.isFinite(pesoA) || !Number.isFinite(pesoB)) return 'a';
  // Pesos que não somam 100 significam configuração inconsistente (só deveria
  // ser possível por escrita manual no banco — a API valida na gravação).
  // Repartir tráfego com regra torta estragaria o teste em silêncio.
  if (pesoA + pesoB !== 100) return 'a';

  // O slug entra no hash para que dois testes seguidos não mandem exatamente
  // as mesmas pessoas para o mesmo lado — o que faria o segundo teste herdar
  // qualquer viés do primeiro.
  return hashSessao(sessionId, teste.slug) % 100 < pesoB ? 'b' : 'a';
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test tests/ab-sorteio.test.js`
Expected: PASS, 10 testes

- [ ] **Step 5: Commit**

```bash
git add functions/_ab-sorteio.js tests/ab-sorteio.test.js
git commit -m "feat: sorteio deterministico da variante do teste A/B"
```

---

### Task 3: Estatística do teste (função pura)

**Files:**
- Create: `functions/api/_ab-estatistica.js`
- Create: `tests/ab-estatistica.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `cdfNormalPadrao(z: number) → number`
  - `testeDuasProporcoes(nA, cA, nB, cB) → { z: number, p: number }`
  - `checarSrm(nA, nB, pesoA) → { chi2: number, p: number, alerta: boolean }`
  - `avaliarTeste({ teste, a, b, agora }) → veredito` — `teste` é `{ meta_leads_variante, meta_dias, started_at }`; `a` e `b` são `{ visitas, leads, peso }`; `agora` em segundos. O veredito é `{ estado: 'rodando'|'sem-diferenca'|'conclusivo', vencedor: 'a'|'b'|null, z, p, srm, metaLeads, metaDias, diasCorridos, faltamDias, faltamLeads }`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/ab-estatistica.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cdfNormalPadrao,
  testeDuasProporcoes,
  checarSrm,
  avaliarTeste,
} from '../functions/api/_ab-estatistica.js';

const perto = (obtido, esperado, tol) =>
  assert.ok(Math.abs(obtido - esperado) <= tol, `esperado ~${esperado}, veio ${obtido}`);

const DIA = 86400;
const AGORA = 1_800_000_000;

test('cdfNormalPadrao bate com valores tabelados', () => {
  perto(cdfNormalPadrao(0), 0.5, 1e-6);
  perto(cdfNormalPadrao(1.96), 0.975, 1e-4);
  perto(cdfNormalPadrao(-1.96), 0.025, 1e-4);
  perto(cdfNormalPadrao(1.645), 0.95, 1e-4);
  perto(cdfNormalPadrao(-3), 0.00135, 1e-5);
});

test('z de duas proporcoes: 10% vs 15% em 1000 cada', () => {
  const { z, p } = testeDuasProporcoes(1000, 100, 1000, 150);
  perto(z, 3.381, 0.01);
  assert.ok(p < 0.001, `p deveria ser < 0.001, veio ${p}`);
});

test('taxas identicas dao z zero e p um', () => {
  const { z, p } = testeDuasProporcoes(1000, 100, 1000, 100);
  perto(z, 0, 1e-9);
  perto(p, 1, 1e-9);
});

test('z negativo quando A converte mais que B', () => {
  const { z } = testeDuasProporcoes(1000, 150, 1000, 100);
  assert.ok(z < 0);
});

test('amostra vazia ou sem conversao nenhuma nao quebra', () => {
  assert.deepEqual(testeDuasProporcoes(0, 0, 0, 0), { z: 0, p: 1 });
  assert.deepEqual(testeDuasProporcoes(100, 0, 100, 0), { z: 0, p: 1 });
  assert.deepEqual(testeDuasProporcoes(100, 100, 100, 100), { z: 0, p: 1 });
});

test('SRM: 600/400 esperando 50/50 dispara alerta', () => {
  const r = checarSrm(600, 400, 50);
  perto(r.chi2, 40, 0.001);
  assert.ok(r.p < 0.01);
  assert.equal(r.alerta, true);
});

test('SRM: 52/48 esperando 50/50 nao dispara', () => {
  const r = checarSrm(52, 48, 50);
  assert.equal(r.alerta, false);
});

test('SRM: divisao 80/20 configurada e observada nao dispara', () => {
  assert.equal(checarSrm(800, 200, 80).alerta, false);
});

test('SRM: amostra pequena demais nunca dispara', () => {
  // 30 x 0 e uma divisao absurda, mas com 30 visitas ainda pode ser o comeco
  // do teste; alarme aqui so geraria ruido.
  assert.equal(checarSrm(30, 0, 50).alerta, false);
});

const testeBase = { meta_leads_variante: 60, meta_dias: 14, started_at: AGORA - 20 * DIA };

test('alvo de leads nao atingido: fica rodando mesmo com p baixo', () => {
  const r = avaliarTeste({
    teste: testeBase,
    a: { visitas: 1000, leads: 10, peso: 50 },
    b: { visitas: 1000, leads: 40, peso: 50 },
    agora: AGORA,
  });
  assert.ok(r.p < 0.05, 'o cenario precisa ter p baixo para o teste fazer sentido');
  assert.equal(r.estado, 'rodando');
  assert.equal(r.vencedor, null);
  // A variante mais atrasada é a A, com 10 leads: faltam 50 para a meta de 60.
  assert.equal(r.faltamLeads, 50);
});

test('alvo de dias nao atingido: fica rodando mesmo com leads suficientes', () => {
  const r = avaliarTeste({
    teste: { ...testeBase, started_at: AGORA - 5 * DIA },
    a: { visitas: 4000, leads: 100, peso: 50 },
    b: { visitas: 4000, leads: 200, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.estado, 'rodando');
  assert.equal(r.diasCorridos, 5);
  assert.equal(r.faltamDias, 9);
});

test('alvos batidos e diferenca real: conclusivo com vencedor', () => {
  const r = avaliarTeste({
    teste: testeBase,
    a: { visitas: 4000, leads: 100, peso: 50 },
    b: { visitas: 4000, leads: 200, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.estado, 'conclusivo');
  assert.equal(r.vencedor, 'b');
  assert.equal(r.faltamLeads, 0);
  assert.equal(r.faltamDias, 0);
});

test('alvos batidos e taxas parecidas: sem diferenca detectavel', () => {
  const r = avaliarTeste({
    teste: testeBase,
    a: { visitas: 4000, leads: 100, peso: 50 },
    b: { visitas: 4000, leads: 104, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.estado, 'sem-diferenca');
  assert.equal(r.vencedor, null);
});

test('vencedor pode ser A', () => {
  const r = avaliarTeste({
    teste: testeBase,
    a: { visitas: 4000, leads: 200, peso: 50 },
    b: { visitas: 4000, leads: 100, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.estado, 'conclusivo');
  assert.equal(r.vencedor, 'a');
});

test('teste nunca ativado (sem started_at) fica rodando com zero dias', () => {
  const r = avaliarTeste({
    teste: { ...testeBase, started_at: null },
    a: { visitas: 0, leads: 0, peso: 50 },
    b: { visitas: 0, leads: 0, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.estado, 'rodando');
  assert.equal(r.diasCorridos, 0);
  assert.equal(r.faltamDias, 14);
});

test('o SRM vem junto do veredito', () => {
  const r = avaliarTeste({
    teste: testeBase,
    a: { visitas: 600, leads: 60, peso: 50 },
    b: { visitas: 400, leads: 60, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.srm.alerta, true);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test tests/ab-estatistica.test.js`
Expected: FAIL — `Cannot find module '.../functions/api/_ab-estatistica.js'`

- [ ] **Step 3: Implementar**

Criar `functions/api/_ab-estatistica.js`:

```js
// Leitura estatística do teste A/B, isolada e PURA: sem I/O, sem D1, sem env.
//
// O que este módulo protege: parar um teste no instante em que ele "dá 95%"
// infla a taxa de falso positivo de 5% para mais de 30% (o chamado peeking).
// Por isso o veredito NÃO é função só do valor-p: ele exige que os alvos
// declarados na CRIAÇÃO do teste (leads por variante e dias) tenham sido
// atingidos. Enquanto não forem, o estado é 'rodando', doa a quem doer.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

// Amostra mínima para a checagem de SRM valer alguma coisa. Abaixo disso,
// desequilíbrio é o normal do início do teste, não sinal de defeito.
const MIN_AMOSTRA_SRM = 100;
// Nível do veredito e do alarme de SRM. O SRM é mais frouxo (0,01) de
// propósito: ele roda a cada carregamento do painel, e a 0,05 daria alarme
// falso em 1 de cada 20 leituras.
const ALFA_VEREDITO = 0.05;
const ALFA_SRM = 0.01;

// Φ(z) pela aproximação de Abramowitz & Stegun 26.2.17 (erro < 7,5e-8).
// Implementada aqui porque JS não tem função de erro na biblioteca padrão e
// puxar uma dependência para cinco linhas de polinômio não se justifica.
export function cdfNormalPadrao(z) {
  const B = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const densidade = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
  let soma = 0;
  for (let i = 0; i < B.length; i++) soma += B[i] * Math.pow(t, i + 1);
  const cauda = densidade * soma;
  return z > 0 ? 1 - cauda : cauda;
}

// Teste z de duas proporções com variância combinada (pooled), bicaudal.
// nA/nB = visitas; cA/cB = conversões.
export function testeDuasProporcoes(nA, cA, nB, cB) {
  // Sem amostra dos dois lados não existe comparação. p = 1 significa
  // "nenhuma evidência de diferença", que é exatamente o caso.
  if (!(nA > 0) || !(nB > 0)) return { z: 0, p: 1 };

  const combinada = (cA + cB) / (nA + nB);
  // Ninguém converteu, ou converteram todos: a variância é zero e a divisão
  // estouraria. Nos dois casos não há diferença a detectar.
  if (combinada <= 0 || combinada >= 1) return { z: 0, p: 1 };

  const erroPadrao = Math.sqrt(combinada * (1 - combinada) * (1 / nA + 1 / nB));
  const z = (cB / nB - cA / nA) / erroPadrao;
  const p = 2 * (1 - cdfNormalPadrao(Math.abs(z)));
  return { z, p };
}

// Sample Ratio Mismatch: a divisão observada bate com a configurada?
// Qui-quadrado com 1 grau de liberdade. Split torto ocorre em 6-10% dos
// testes A/B (bug, bot, cache) e invalida o resultado em silêncio — sem esta
// checagem, o painel mostraria com toda a confiança um número que não vale.
export function checarSrm(nA, nB, pesoA) {
  const total = nA + nB;
  const peso = Number(pesoA);
  if (total < MIN_AMOSTRA_SRM || !Number.isFinite(peso) || peso <= 0 || peso >= 100) {
    return { chi2: 0, p: 1, alerta: false };
  }

  const esperadoA = (total * peso) / 100;
  const esperadoB = total - esperadoA;
  const chi2 =
    Math.pow(nA - esperadoA, 2) / esperadoA + Math.pow(nB - esperadoB, 2) / esperadoB;
  // Com 1 grau de liberdade, P(χ² > x) = 2·(1 − Φ(√x)).
  const p = 2 * (1 - cdfNormalPadrao(Math.sqrt(chi2)));
  return { chi2, p, alerta: p < ALFA_SRM };
}

export function avaliarTeste({ teste, a, b, agora }) {
  const metaLeads = Number(teste?.meta_leads_variante) || 0;
  const metaDias = Number(teste?.meta_dias) || 0;
  const inicio = Number(teste?.started_at) || 0;

  const diasCorridos = inicio ? Math.max(0, Math.floor((agora - inicio) / 86400)) : 0;
  const menorLeads = Math.min(a.leads, b.leads);
  const faltamLeads = Math.max(0, metaLeads - menorLeads);
  const faltamDias = Math.max(0, metaDias - diasCorridos);

  const { z, p } = testeDuasProporcoes(a.visitas, a.leads, b.visitas, b.leads);
  const srm = checarSrm(a.visitas, b.visitas, a.peso);

  let estado = 'rodando';
  let vencedor = null;
  // Os DOIS alvos, não um ou outro: leads de sobra em 5 dias medem dia da
  // semana, e 14 dias com 3 leads não medem nada.
  if (faltamLeads === 0 && faltamDias === 0) {
    if (p < ALFA_VEREDITO) {
      estado = 'conclusivo';
      vencedor = b.leads / b.visitas > a.leads / a.visitas ? 'b' : 'a';
    } else {
      estado = 'sem-diferenca';
    }
  }

  return { estado, vencedor, z, p, srm, metaLeads, metaDias, diasCorridos, faltamDias, faltamLeads };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test tests/ab-estatistica.test.js`
Expected: PASS, 16 testes

- [ ] **Step 5: Commit**

```bash
git add functions/api/_ab-estatistica.js tests/ab-estatistica.test.js
git commit -m "feat: estatistica do teste A/B com alvo declarado e checagem de SRM"
```

---

### Task 4: Migration das tabelas

**Files:**
- Create: `migrations/0031_ab_testes.sql`

**Interfaces:**
- Consumes: nada.
- Produces: tabelas `ab_tests`, `ab_variants`, `ab_assignments` conforme colunas abaixo. As tasks 5, 6 e 8 dependem exatamente destes nomes.

- [ ] **Step 1: Criar o arquivo da migration**

Criar `migrations/0031_ab_testes.sql`:

```sql
-- Teste A/B de páginas (spec 2026-08-01). Uma mesma URL serve duas versões a
-- metades comparáveis do tráfego. Nenhuma tabela existente é alterada aqui.

-- Um registro por teste. Os alvos (meta_leads_variante, meta_dias) são
-- declarados na CRIAÇÃO, antes de existir qualquer dado — é isso que impede
-- decidir no primeiro dia em que o número parecer bonito.
CREATE TABLE IF NOT EXISTS ab_tests (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    slug                 TEXT NOT NULL UNIQUE,  -- [a-z0-9-], entra no path da variante
    nome                 TEXT NOT NULL,         -- rótulo exibido no painel
    path                 TEXT NOT NULL,         -- path testado, sem barra final (ex.: '/')
    -- rascunho → ativo ⇄ pausado → encerrado. Só 'ativo' reparte tráfego.
    status               TEXT NOT NULL DEFAULT 'rascunho',
    meta_leads_variante  INTEGER NOT NULL DEFAULT 60,
    meta_dias            INTEGER NOT NULL DEFAULT 14,
    -- Preenchido na PRIMEIRA ativação e nunca mais: pausar e retomar não
    -- reinicia a contagem de dias, senão bastaria pausar para adiar o veredito.
    started_at           INTEGER,
    ended_at             INTEGER,
    vencedor             TEXT,                  -- 'a' | 'b' | 'nenhum'
    criado_em            INTEGER NOT NULL,
    atualizado_em        INTEGER NOT NULL
);

-- O middleware busca o teste pelo path a cada carregamento de página (com
-- cache de 60s). Filtra por status junto porque só 'ativo' interessa.
CREATE INDEX IF NOT EXISTS idx_ab_tests_path ON ab_tests(path, status);

-- As duas variantes de cada teste. Tabela separada (e não duas colunas em
-- ab_tests) porque peso e destino são atributos DA VARIANTE — com colunas
-- seria peso_a/peso_b/path_b, e cada regra teria de saber qual sufixo ler.
CREATE TABLE IF NOT EXISTS ab_variants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id    INTEGER NOT NULL,
    chave      TEXT NOT NULL,   -- 'a' | 'b'
    -- Vazio na variante 'a': ela É a página original, servida como sempre.
    -- '/ab/<slug>/b' na variante 'b'.
    page_path  TEXT NOT NULL DEFAULT '',
    peso       INTEGER NOT NULL,  -- soma 100 entre as duas
    UNIQUE (test_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_ab_variants_teste ON ab_variants(test_id);

-- Log de EXPOSIÇÃO: quem foi sorteado, para qual variante, quando. É o
-- denominador do teste.
--
-- Existe uma tabela em vez de uma coluna em `sessions` por dois motivos. O
-- primeiro é que o cookie de 400 dias faz um visitante atravessar vários
-- testes ao longo do tempo, e uma coluna só guardaria o primeiro. O segundo é
-- que decidir a variante só no edge, confiando no cookie, enviesa a amostra —
-- registrar a exposição no servidor é o que torna o denominador confiável.
--
-- Efeito colateral bem-vindo: o denominador deixa de depender de normalizar
-- `sessions.landing_url`, que hoje faz '/se-v1', '/se-v1/' e o domínio com
-- 'www.' aparecerem como três linhas diferentes no relatório de conversão.
CREATE TABLE IF NOT EXISTS ab_assignments (
    session_id   TEXT NOT NULL,
    test_id      INTEGER NOT NULL,
    variante     TEXT NOT NULL,     -- 'a' | 'b'
    assigned_at  INTEGER NOT NULL,  -- unix seconds
    -- Sessão que abriu a variante pelo modo preview. Fica FORA de toda
    -- estatística: conferir a própria página antes de ligar o teste não pode
    -- contar como visitante sorteado.
    is_preview   INTEGER NOT NULL DEFAULT 0,
    -- Garante o first-touch no BANCO, e não só no cookie: quem já foi
    -- exposto não é reatribuído nem que o cookie suma.
    PRIMARY KEY (session_id, test_id)
);

-- Agregação dos resultados por teste (a consulta do painel).
CREATE INDEX IF NOT EXISTS idx_ab_assign_teste ON ab_assignments(test_id, variante);
```

- [ ] **Step 2: Conferir que o SQL é válido rodando no banco local**

Run: `npx --yes wrangler@4 d1 execute tracking-ae-db --local --file=migrations/0031_ab_testes.sql`
Expected: `Executed 8 commands` (ou equivalente), sem erro de sintaxe

- [ ] **Step 3: Conferir que as tabelas nasceram com as colunas certas**

Run: `npx --yes wrangler@4 d1 execute tracking-ae-db --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ab_%'"`
Expected: `ab_tests`, `ab_variants`, `ab_assignments`

- [ ] **Step 4: Commit**

```bash
git add migrations/0031_ab_testes.sql
git commit -m "feat: migration das tabelas de teste A/B"
```

- [ ] **Step 5: PARAR e pedir confirmação antes de aplicar em produção**

A aplicação no banco remoto escreve em produção. **Não rodar sem a usuária confirmar.** Quando ela confirmar:

Run: `npx --yes wrangler@4 d1 execute tracking-ae-db --remote --file=migrations/0031_ab_testes.sql`

⚠️ **Nunca** usar `wrangler d1 migrations apply --remote` neste projeto — as migrations 0021/0022/0025 quebram ao reaplicar.

---

### Task 5: Leitura dos testes ativos com cache

**Files:**
- Create: `functions/_ab-consulta.js`

**Interfaces:**
- Consumes: tabelas `ab_tests` e `ab_variants` (Task 4).
- Produces:
  - `carregarTestesAtivos(env) → Promise<Array<{ id, slug, path, status, variantes: Array<{ chave, page_path, peso }> }>>`
  - `normalizarPath(pathname: string) → string`
  - `invalidarCacheAb() → void`

- [ ] **Step 1: Implementar**

Não há teste automatizado nesta task: o módulo é I/O puro contra o D1 (o que ele tem de lógica — agrupar linhas — é exercitado de ponta a ponta na Task 6). O que é testável foi isolado nas Tasks 2 e 3 de propósito.

Criar `functions/_ab-consulta.js`:

```js
// Leitura dos testes A/B ativos, com cache curto em memória.
//
// Isto roda em TODA requisição de página HTML, então uma ida ao D1 por
// carregamento seria latência cobrada de cada visitante para consultar uma
// tabela de 1 a 3 linhas. O cache de 60s corta isso: na prática quase todo
// request responde da memória do isolate.
//
// O preço é que ligar ou pausar um teste pelo painel leva até 1 minuto para
// valer em todos os isolates. É um preço aceitável — e a aba avisa isso.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

const TTL_MS = 60_000;

let cache = { em: 0, testes: [] };

// Paths comparáveis: '/se-v1/' e '/se-v1' são a mesma página, e o path
// cadastrado no teste precisa casar com os dois. A raiz continua '/'.
export function normalizarPath(pathname) {
  const p = (pathname || '/').split('?')[0].split('#')[0];
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p || '/';
}

export function invalidarCacheAb() {
  cache = { em: 0, testes: [] };
}

export async function carregarTestesAtivos(env) {
  const agoraMs = Date.now();
  if (agoraMs - cache.em < TTL_MS) return cache.testes;

  const { results } = await env.DB.prepare(`
    SELECT t.id, t.slug, t.path, t.status, v.chave, v.page_path, v.peso
    FROM ab_tests t
    JOIN ab_variants v ON v.test_id = t.id
    WHERE t.status = 'ativo'
  `).all();

  const porId = new Map();
  for (const linha of results || []) {
    if (!porId.has(linha.id)) {
      porId.set(linha.id, {
        id: linha.id,
        slug: linha.slug,
        path: normalizarPath(linha.path),
        status: linha.status,
        variantes: [],
      });
    }
    porId.get(linha.id).variantes.push({
      chave: linha.chave,
      page_path: linha.page_path,
      peso: linha.peso,
    });
  }

  cache = { em: agoraMs, testes: [...porId.values()] };
  return cache.testes;
}
```

- [ ] **Step 2: Conferir que o arquivo importa sem erro**

Run: `node --input-type=module -e "import('./functions/_ab-consulta.js').then(m => console.log(m.normalizarPath('/se-v1/'), m.normalizarPath('/'), m.normalizarPath('')))"`
Expected: `/se-v1 / /`

- [ ] **Step 3: Rodar a suíte para garantir que nada quebrou**

Run: `node --test tests/*.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add functions/_ab-consulta.js
git commit -m "feat: leitura dos testes A/B ativos com cache de 60s"
```

---

### Task 6: Middleware — sorteio, reescrita e registro da exposição

Esta é a única task que altera o caminho de toda requisição do site. A regra que a governa: **sem teste ativo, o comportamento é bit a bit o de hoje.**

**Files:**
- Modify: `functions/_middleware.js`

**Interfaces:**
- Consumes: `escolherVariante` (Task 2), `carregarTestesAtivos` e `normalizarPath` (Task 5), tabela `ab_assignments` (Task 4).
- Produces: cookie `_krob_ab` com formato `slug:variante|slug2:variante2`; linhas em `ab_assignments`.

- [ ] **Step 1: Adicionar os imports no topo do arquivo**

Em `functions/_middleware.js`, antes de `export async function onRequest`:

```js
import { escolherVariante } from './_ab-sorteio.js';
import { carregarTestesAtivos, normalizarPath } from './_ab-consulta.js';
```

- [ ] **Step 2: Bloquear acesso direto às páginas de variante**

Logo depois do bloco `if (!isPageRequest) { return next(); }` (linha 23-25), inserir:

```js
  const caminho = normalizarPath(url.pathname);

  // As páginas de variante são detalhe interno: quem chega em /aplicacao-mentoria
  // recebe uma delas por reescrita, sem nunca ver este endereço. Deixá-las
  // abertas criaria conteúdo duplicado para o Google e, pior, permitiria entrar
  // na variante por fora do sorteio — visitas que sujariam a medição sem
  // aparecer como anomalia.
  //
  // O preview é a exceção: serve para conferir a variante antes de ligar o
  // teste, e a sessão que o usa é marcada e excluída da estatística.
  const ehPathDeVariante = caminho.startsWith('/ab/');
  const querPreview = url.searchParams.get('ab_preview') === '1';
  if (ehPathDeVariante && !querPreview) {
    return new Response('Not found', { status: 404 });
  }
```

- [ ] **Step 3: Sortear a variante antes de servir a página**

Logo depois do bloco que gera `fbp` (linha 78-82, terminando em `}`), inserir:

```js
  // --- Teste A/B ---
  // Toda esta seção é inerte quando não há teste ativo para o path.
  let abTeste = null;
  let abVariante = 'a';
  let abPreviewDoTeste = null;

  try {
    const testes = await carregarTestesAtivos(env);

    if (ehPathDeVariante) {
      // Preview: /ab/<slug>/b?ab_preview=1 → descobre o teste pelo slug para
      // marcar a sessão como contaminada.
      const slug = caminho.split('/')[2] || '';
      abPreviewDoTeste = testes.find((t) => t.slug === slug) || null;
    } else {
      abTeste = testes.find((t) => t.path === caminho) || null;
    }
  } catch (e) {
    // D1 indisponível não pode derrubar o site: sem teste, a página original.
    console.error('AB: falha ao ler testes ativos:', e.message);
  }

  if (abTeste) {
    // O cookie vem ANTES do sorteio: quem já foi exposto continua onde estava,
    // mesmo que os pesos mudem no meio do teste. Trocar alguém de variante em
    // andamento creditaria a conversão à página errada.
    const salva = lerCookieAb(cookies['_krob_ab'] || '')[abTeste.slug];
    abVariante = salva === 'a' || salva === 'b' ? salva : escolherVariante(abTeste, sessionId);
  }
```

- [ ] **Step 4: Servir a variante escolhida**

Substituir a linha 91 (`const response = await next();`) por:

```js
  // --- Serve the page FIRST, then write to D1 in background ---
  let response;
  if (abTeste && abVariante === 'b') {
    const destino = (abTeste.variantes.find((v) => v.chave === 'b') || {}).page_path || '';
    const alvo = new URL(url);
    alvo.pathname = destino;
    response = await next(new Request(alvo.toString(), request));
    // Variante apontando para página inexistente (deploy pela metade, slug
    // renomeado): cai para a original em vez de entregar 404 a metade do
    // tráfego pago.
    if (response.status === 404) {
      console.error('AB: variante B sem página em', destino, '— servindo A');
      abVariante = 'a';
      response = await next();
    }
  } else {
    response = await next();
  }
```

- [ ] **Step 5: Gravar o cookie da variante e impedir cache**

Logo depois do bloco `if (fbc) { newHeaders.append(...) }` (linhas 102-104), inserir:

```js
  if (abTeste) {
    // 30 dias, e não os 400 dos cookies de atribuição: passado o teste, a
    // marca não serve mais para nada e só atrapalharia o próximo.
    const abAtual = lerCookieAb(cookies['_krob_ab'] || '');
    abAtual[abTeste.slug] = abVariante;
    newHeaders.append('Set-Cookie', `_krob_ab=${escreverCookieAb(abAtual)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`);

    // Duas versões da mesma URL: um cache intermediário que guardasse uma
    // delas serviria a variante errada para o visitante errado. O Set-Cookie
    // acima já impede o cache de borda da Cloudflare; o cabeçalho explícito
    // cobre proxies no caminho.
    newHeaders.set('Cache-Control', 'private, no-store');
  }
```

- [ ] **Step 6: Registrar a exposição no D1**

Dentro do `context.waitUntil` existente (linhas 120-145), logo depois do `await env.DB.prepare(...).run()` do UPSERT em `sessions` e ainda dentro do `if (env.DB) {`, inserir:

```js
            // Exposição ao teste. ON CONFLICT DO NOTHING garante o
            // first-touch no banco: o visitante entra uma vez e fica.
            if (abTeste) {
              await env.DB.prepare(`
                INSERT INTO ab_assignments (session_id, test_id, variante, assigned_at, is_preview)
                VALUES (?, ?, ?, ?, 0)
                ON CONFLICT(session_id, test_id) DO NOTHING
              `).bind(sessionId, abTeste.id, abVariante, now).run();
            }

            // Preview marca a sessão como contaminada — inclusive se ela já
            // tinha sido sorteada antes. Quem espiou a variante não pode
            // continuar valendo como visitante do teste.
            if (abPreviewDoTeste) {
              await env.DB.prepare(`
                INSERT INTO ab_assignments (session_id, test_id, variante, assigned_at, is_preview)
                VALUES (?, ?, 'b', ?, 1)
                ON CONFLICT(session_id, test_id) DO UPDATE SET is_preview = 1
              `).bind(sessionId, abPreviewDoTeste.id, now).run();
            }
```

- [ ] **Step 7: Adicionar os dois helpers de cookie no fim do arquivo**

Depois da função `parseCookies` (linha 158), inserir:

```js
// O cookie guarda VÁRIOS testes ('slug:variante|outro:variante') porque o
// visitante pode atravessar mais de um teste em páginas diferentes, e um
// cookie por teste encheria o cabeçalho de toda requisição.
function lerCookieAb(valor) {
  const mapa = {};
  for (const par of (valor || '').split('|')) {
    const [slug, variante] = par.split(':');
    if (slug && (variante === 'a' || variante === 'b')) mapa[slug] = variante;
  }
  return mapa;
}

function escreverCookieAb(mapa) {
  return Object.entries(mapa)
    .map(([slug, variante]) => `${slug}:${variante}`)
    .join('|');
}
```

- [ ] **Step 8: Conferir que o build do Astro continua passando**

Run: `npm run build`
Expected: build conclui sem erro

- [ ] **Step 9: Rodar a suíte**

Run: `node --test tests/*.test.js`
Expected: PASS

- [ ] **Step 10: Teste manual do caminho sem teste ativo**

Run: `npm run build && npx --yes wrangler@4 pages dev dist --port 8788` (em background) e, noutro terminal, `curl -si http://localhost:8788/ | head -20`

Expected: HTTP 200 com o HTML da home; cabeçalhos `Set-Cookie` de `_krob_sid`/`_krob_eid`/`_fbp` presentes; **nenhum** `_krob_ab` (não há teste ativo); **nenhum** `Cache-Control: private, no-store`.

- [ ] **Step 11: Teste manual do 404 em `/ab/`**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/ab/qualquer/b`
Expected: `404`

- [ ] **Step 12: Commit**

```bash
git add functions/_middleware.js
git commit -m "feat: middleware sorteia e serve a variante do teste A/B"
```

---

### Task 7: Endpoint `/api/ab-tests`

**Files:**
- Create: `functions/api/ab-tests.js`

**Interfaces:**
- Consumes: `avaliarTeste` (Task 3), `clausulasBotSql` (Task 1), `invalidarCacheAb` e `normalizarPath` (Task 5), tabelas da Task 4.
- Produces: a resposta que a Task 9 (aba do dash) consome:
  ```
  GET  → { agora, rows: [{ id, slug, nome, path, status, meta_leads_variante,
           meta_dias, started_at, ended_at, vencedor, url_preview,
           variantes: [{ chave, peso, visitas, form_starts, leads, taxa }],
           veredito: { estado, vencedor, p, srm, diasCorridos, faltamDias, faltamLeads, metaLeads, metaDias } }] }
  POST → { ok: true, id } | { error: string }
  ```

- [ ] **Step 1: Implementar**

Criar `functions/api/ab-tests.js`:

```js
// GET  /api/ab-tests?key=...  → testes A/B com resultados e veredito
// POST /api/ab-tests?key=...  → cria, edita, ativa, pausa ou encerra um teste
//
// Consome a aba "Testes A/B" do dashboard. Endpoint ADITIVO: nenhum endpoint
// existente foi alterado.
//
// O veredito NÃO é calculado aqui — vem de _ab-estatistica.js, função pura e
// testada. E a contagem de visitas vem de ab_assignments, não de
// sessions.landing_url: o denominador do teste é quem foi SORTEADO.

import { avaliarTeste } from './_ab-estatistica.js';
import { clausulasBotSql } from '../_bots.js';
import { invalidarCacheAb, normalizarPath } from '../_ab-consulta.js';

// Menos que isso não é teste, é chute: com 14 dias e 60 leads por variante já
// é preciso quase um mês na home. Ver a tabela de amostra na spec.
const MIN_DIAS = 14;
const MIN_LEADS = 10;

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const agora = Math.floor(Date.now() / 1000);

  const { results: testes } = await env.DB.prepare(`
    SELECT id, slug, nome, path, status, meta_leads_variante, meta_dias,
           started_at, ended_at, vencedor, criado_em
    FROM ab_tests
    ORDER BY (status = 'ativo') DESC, criado_em DESC
  `).all();

  const { results: variantes } = await env.DB.prepare(
    'SELECT test_id, chave, page_path, peso FROM ab_variants'
  ).all();

  // Contagens por teste e variante. Agregado em SQL, não no navegador: a
  // tabela de exposições cresce com o tráfego.
  //
  // Sessões de preview ficam fora, e os bots também — eles são sorteados como
  // qualquer visitante (o middleware não os distingue no instante da
  // requisição), então a filtragem só pode acontecer aqui, na leitura.
  const { results: contagens } = await env.DB.prepare(`
    SELECT a.test_id,
           a.variante,
           COUNT(DISTINCT a.session_id) AS visitas,
           COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN a.session_id END) AS form_starts,
           COUNT(DISTINCT CASE WHEN l.id IS NOT NULL THEN a.session_id END) AS leads
    FROM ab_assignments a
    JOIN sessions s ON s.session_id = a.session_id
    LEFT JOIN event_log l
      ON l.session_id = a.session_id
     AND l.event_name = 'Lead' AND l.is_bot = 0 AND l.is_junk = 0
    LEFT JOIN event_log f
      ON f.session_id = a.session_id
     AND f.event_name = 'FormStart' AND f.is_bot = 0 AND f.is_junk = 0
    WHERE a.is_preview = 0
      AND s.user_agent IS NOT NULL AND LENGTH(s.user_agent) >= 10
      ${clausulasBotSql('s')}
    GROUP BY a.test_id, a.variante
  `).all();

  const contagemDe = (testId, chave) =>
    (contagens || []).find((c) => c.test_id === testId && c.variante === chave) || {
      visitas: 0, form_starts: 0, leads: 0,
    };

  const rows = (testes || []).map((t) => {
    const minhas = (variantes || []).filter((v) => v.test_id === t.id);
    const lado = (chave) => {
      const v = minhas.find((x) => x.chave === chave) || { peso: 50, page_path: '' };
      const c = contagemDe(t.id, chave);
      return {
        chave,
        peso: v.peso,
        page_path: v.page_path,
        visitas: c.visitas || 0,
        form_starts: c.form_starts || 0,
        leads: c.leads || 0,
        taxa: c.visitas ? c.leads / c.visitas : 0,
      };
    };

    const a = lado('a');
    const b = lado('b');

    return {
      id: t.id,
      slug: t.slug,
      nome: t.nome,
      path: t.path,
      status: t.status,
      meta_leads_variante: t.meta_leads_variante,
      meta_dias: t.meta_dias,
      started_at: t.started_at,
      ended_at: t.ended_at,
      vencedor: t.vencedor,
      url_preview: `${b.page_path}?ab_preview=1`,
      variantes: [a, b],
      // O veredito vem pronto do backend: a tela nunca decide se pode ou não
      // declarar vencedor. Regra na tela é regra que diverge da real.
      veredito: avaliarTeste({ teste: t, a, b, agora }),
    };
  });

  return json({ agora, rows });
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

  const agora = Math.floor(Date.now() / 1000);
  const id = parseInt(corpo.id, 10);
  const acao = str(corpo.acao);

  // --- mudanças de estado ---
  if (acao === 'ativar' || acao === 'pausar' || acao === 'encerrar') {
    if (!Number.isFinite(id)) return json({ error: 'id obrigatório' }, 400);

    const teste = await env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(id).first();
    if (!teste) return json({ error: 'Teste não encontrado' }, 404);
    if (teste.status === 'encerrado') return json({ error: 'Teste já encerrado.' }, 400);

    if (acao === 'ativar') {
      const conflito = await env.DB.prepare(`
        SELECT id FROM ab_tests
        WHERE path = ? AND id != ? AND status IN ('ativo', 'pausado')
      `).bind(teste.path, id).first();
      if (conflito) {
        return json({ error: 'Já existe outro teste em andamento nesta página. Encerre-o antes.' }, 400);
      }
      // started_at só na PRIMEIRA ativação: se pausar e retomar reiniciasse a
      // contagem, bastaria pausar um dia para adiar o veredito para sempre.
      await env.DB.prepare(`
        UPDATE ab_tests
        SET status = 'ativo', started_at = COALESCE(started_at, ?), atualizado_em = ?
        WHERE id = ?
      `).bind(agora, agora, id).run();
    } else if (acao === 'pausar') {
      await env.DB.prepare("UPDATE ab_tests SET status = 'pausado', atualizado_em = ? WHERE id = ?")
        .bind(agora, id).run();
    } else {
      const vencedor = str(corpo.vencedor);
      if (!['a', 'b', 'nenhum'].includes(vencedor)) {
        return json({ error: 'Informe o vencedor: a, b ou nenhum.' }, 400);
      }
      await env.DB.prepare(`
        UPDATE ab_tests
        SET status = 'encerrado', ended_at = ?, vencedor = ?, atualizado_em = ?
        WHERE id = ?
      `).bind(agora, vencedor, agora, id).run();
    }

    invalidarCacheAb();
    return json({ ok: true, id });
  }

  // --- criar / editar ---
  const nome = str(corpo.nome);
  if (!nome) return json({ error: 'Dê um nome ao teste (ex.: "Home — oferta nova").' }, 400);

  const slug = str(corpo.slug).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    return json({ error: 'Identificador inválido: use letras minúsculas, números e hífens (ex.: home-oferta-2026-08).' }, 400);
  }

  const caminho = normalizarPath(str(corpo.path));
  if (!caminho.startsWith('/') || caminho.startsWith('/ab/')) {
    return json({ error: 'Informe a página testada começando com / (ex.: /aplicacao-mentoria).' }, 400);
  }

  const metaLeads = parseInt(corpo.meta_leads_variante, 10);
  if (!Number.isFinite(metaLeads) || metaLeads < MIN_LEADS) {
    return json({ error: `A meta de leads por variante precisa ser de pelo menos ${MIN_LEADS}.` }, 400);
  }

  const metaDias = parseInt(corpo.meta_dias, 10);
  if (!Number.isFinite(metaDias) || metaDias < MIN_DIAS || metaDias % 7 !== 0) {
    return json({ error: `A duração precisa ser de no mínimo ${MIN_DIAS} dias e em semanas inteiras (14, 21, 28...).` }, 400);
  }

  const pesoB = parseInt(corpo.peso_b, 10);
  if (!Number.isFinite(pesoB) || pesoB < 1 || pesoB > 99) {
    return json({ error: 'A fatia da variante B precisa ficar entre 1% e 99%.' }, 400);
  }
  const pesoA = 100 - pesoB;

  if (Number.isFinite(id)) {
    const teste = await env.DB.prepare('SELECT status FROM ab_tests WHERE id = ?').bind(id).first();
    if (!teste) return json({ error: 'Teste não encontrado' }, 404);
    // Mexer em alvo ou divisão com o teste no ar é reescrever a régua no meio
    // da corrida — exatamente o que o alvo declarado antes existe para impedir.
    if (teste.status !== 'rascunho') {
      return json({ error: 'Só dá para editar um teste em rascunho. Pause e encerre para mudar os alvos.' }, 400);
    }

    await env.DB.prepare(`
      UPDATE ab_tests
      SET nome = ?, slug = ?, path = ?, meta_leads_variante = ?, meta_dias = ?, atualizado_em = ?
      WHERE id = ?
    `).bind(nome, slug, caminho, metaLeads, metaDias, agora, id).run();

    await env.DB.prepare("UPDATE ab_variants SET peso = ? WHERE test_id = ? AND chave = 'a'")
      .bind(pesoA, id).run();
    await env.DB.prepare("UPDATE ab_variants SET peso = ?, page_path = ? WHERE test_id = ? AND chave = 'b'")
      .bind(pesoB, `/ab/${slug}/b`, id).run();

    invalidarCacheAb();
    return json({ ok: true, id });
  }

  const jaExiste = await env.DB.prepare('SELECT id FROM ab_tests WHERE slug = ?').bind(slug).first();
  if (jaExiste) return json({ error: 'Já existe um teste com esse identificador.' }, 400);

  const r = await env.DB.prepare(`
    INSERT INTO ab_tests (slug, nome, path, status, meta_leads_variante, meta_dias, criado_em, atualizado_em)
    VALUES (?, ?, ?, 'rascunho', ?, ?, ?, ?)
  `).bind(slug, nome, caminho, metaLeads, metaDias, agora, agora).run();

  const novoId = r.meta ? r.meta.last_row_id : null;

  await env.DB.batch([
    env.DB.prepare("INSERT INTO ab_variants (test_id, chave, page_path, peso) VALUES (?, 'a', '', ?)")
      .bind(novoId, pesoA),
    env.DB.prepare("INSERT INTO ab_variants (test_id, chave, page_path, peso) VALUES (?, 'b', ?, ?)")
      .bind(novoId, `/ab/${slug}/b`, pesoB),
  ]);

  invalidarCacheAb();
  return json({ ok: true, id: novoId });
}

const str = (v) => (v == null ? '' : String(v)).trim();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Subir o ambiente local e criar um teste de ponta a ponta**

Run:
```bash
npm run build
npx --yes wrangler@4 d1 execute tracking-ae-db --local --file=migrations/0031_ab_testes.sql
npx --yes wrangler@4 pages dev dist --port 8788 --binding DASH_KEY=teste-local
```
(deixar rodando em background)

- [ ] **Step 3: Conferir a autenticação**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/api/ab-tests`
Expected: `401`

- [ ] **Step 4: Criar um teste e conferir a validação**

Run:
```bash
curl -s -X POST "http://localhost:8788/api/ab-tests?key=teste-local" -H 'Content-Type: application/json' \
  -d '{"nome":"Home teste","slug":"home-teste","path":"/","meta_leads_variante":60,"meta_dias":10,"peso_b":50}'
```
Expected: erro sobre semanas inteiras (`meta_dias: 10` é inválido)

Run:
```bash
curl -s -X POST "http://localhost:8788/api/ab-tests?key=teste-local" -H 'Content-Type: application/json' \
  -d '{"nome":"Home teste","slug":"home-teste","path":"/","meta_leads_variante":60,"meta_dias":14,"peso_b":50}'
```
Expected: `{"ok":true,"id":1}`

- [ ] **Step 5: Conferir o GET com o teste em rascunho**

Run: `curl -s "http://localhost:8788/api/ab-tests?key=teste-local"`
Expected: um item em `rows`, `status: "rascunho"`, `veredito.estado: "rodando"`, `variantes` com duas entradas zeradas, `url_preview: "/ab/home-teste/b?ab_preview=1"`

- [ ] **Step 6: Commit**

```bash
git add functions/api/ab-tests.js
git commit -m "feat: endpoint /api/ab-tests com resultados e veredito"
```

---

### Task 8: Evento `FormStart`

**Files:**
- Create: `src/scripts/form-start.ts`
- Modify: `functions/tracker.js` (linhas ~84, ~99, ~229-230, ~268-269)
- Modify: `src/components/AplicacaoForm.astro`
- Modify: `src/components/LeadChat.astro`
- Modify: `src/components/LeadFormModal.astro`
- Modify: `src/pages/materiais/[slug].astro`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `ativarFormStart(elemento: HTMLElement, dados: { funnel: string; material?: string }) → void`
  - Linhas em `event_log` com `event_name = 'FormStart'` — consumidas pela consulta da Task 7.

- [ ] **Step 1: Criar o módulo do front**

Criar `src/scripts/form-start.ts`:

```ts
/**
 * Dispara o evento `FormStart` no primeiro toque do visitante num formulário.
 *
 * Existe por causa da amostra: com ~1% de conversão, esperar o `Lead` para
 * comparar duas versões de página leva meses. Quem COMEÇA a preencher é um
 * sinal 3 a 5 vezes mais frequente — não decide o teste A/B (isso continua
 * sendo do `Lead`), mas mostra a tendência muito antes.
 *
 * O evento é interno: o /tracker grava no event_log e não repassa a Meta,
 * GA4, ClickUp nem GoHighLevel.
 */
export function ativarFormStart(elemento: HTMLElement, dados: { funnel: string; material?: string }) {
  if (!elemento) return;

  // `once` porque o interesse é no PRIMEIRO toque: o listener se remove
  // sozinho depois de disparar, sem estado para controlar.
  elemento.addEventListener(
    'input',
    () => {
      fetch('/tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'FormStart',
          // Mesmo padrão de event_id dos demais pontos (pv-, fs-).
          event_id: 'fs-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          event_time: Math.floor(Date.now() / 1000),
          event_source_url: window.location.href,
          lead_data: { funnel: dados.funnel, material: dados.material || '' },
        }),
      }).catch(function () {
        /* silencioso: sinal de apoio nunca pode atrapalhar quem está preenchendo */
      });
    },
    { once: true }
  );
}
```

- [ ] **Step 2: Fazer o `/tracker` tratar `FormStart` como evento interno**

Em `functions/tracker.js`, logo antes da linha 84 (`const eventFunnel = ...`), inserir:

```js
    // Eventos INTERNOS: existem só para medir o site por dentro. Vão ao
    // event_log e param aí — mandá-los ao Meta/GA4 poluiria o pixel com
    // conversões que não são conversões, e ao ClickUp com leads que ainda não
    // existem (a pessoa apenas começou a digitar).
    const nomeEvento = (body.event_name || '').toLowerCase();
    const ehEventoInterno = EVENTOS_INTERNOS.has(nomeEvento);
```

Na linha 99, trocar a condição do fan-out:

```js
    const results = (isBot || ehEventoInterno) ? [] : await Promise.allSettled([
```

Na linha 229, trocar a declaração para reaproveitar a variável já calculada:

```js
    const loggedEventName = nomeEvento;
```

Nas linhas 268 e 269, trocar as duas flags `sent_to_*` para refletirem que nada foi enviado:

```js
              (isBot || ehEventoInterno) ? 0 : 1, metaStatusCode, metaResponseOk, metaResponseBody, metaPayloadSent ?? null,
              (isBot || ehEventoInterno) ? 0 : 1, ga4StatusCode, ga4ResponseOk, ga4ResponseBody, ga4PayloadSent ?? null,
```

E, junto das outras constantes de módulo no fim do arquivo (perto de `INTERNAL_TEST_DOMAINS`, linha 345), inserir:

```js
// Eventos que ficam dentro de casa. Em minúsculas: a comparação é feita sobre
// o event_name já normalizado.
const EVENTOS_INTERNOS = new Set(['formstart']);
```

- [ ] **Step 3: Ligar no `AplicacaoForm.astro`**

No bloco `<script>` do componente, adicionar o import junto aos que já existem de `lead-validacao`:

```ts
import { ativarFormStart } from '../scripts/form-start';
```

E, logo depois de o `form` ser obtido no script (a mesma referência usada em `form.dataset.funnel`), adicionar:

```ts
ativarFormStart(form, { funnel: form.dataset.funnel ?? '' });
```

- [ ] **Step 4: Ligar no `LeadChat.astro`**

No `<script>` do componente, junto dos imports:

```ts
import { ativarFormStart } from '../scripts/form-start';
```

E, logo depois da linha que define `leadFunnel` (`const leadFunnel = overlay.dataset.funnel || 'diagnostico'`):

```ts
ativarFormStart(overlay, { funnel: leadFunnel });
```

- [ ] **Step 5: Ligar no `LeadFormModal.astro`**

No `<script>` do componente, junto dos imports:

```ts
import { ativarFormStart } from '../scripts/form-start';
```

E, junto do `form` usado no submit (o mesmo que envia `funnel: 'workshop'`):

```ts
ativarFormStart(form, { funnel: 'workshop' });
```

- [ ] **Step 6: Ligar no `materiais/[slug].astro`**

No `<script>` da página, junto dos imports:

```ts
import { ativarFormStart } from '../../scripts/form-start';
```

E, junto do `form` já obtido no script:

```ts
ativarFormStart(form, { funnel: form.dataset.funnel ?? '', material: form.dataset.slug ?? '' });
```

- [ ] **Step 7: Conferir que o build passa**

Run: `npm run build`
Expected: build conclui sem erro de TypeScript

- [ ] **Step 8: Rodar a suíte**

Run: `node --test tests/*.test.js`
Expected: PASS

- [ ] **Step 9: Teste manual — o evento chega ao `event_log` sem sair para fora**

Com `npx --yes wrangler@4 pages dev dist --port 8788` rodando:

```bash
curl -s -X POST http://localhost:8788/tracker -H 'Content-Type: application/json' \
  -d '{"event_name":"FormStart","event_id":"fs-teste-1","event_time":1800000000,"event_source_url":"http://localhost:8788/","lead_data":{"funnel":"aplicacao-mentoria"}}'
npx --yes wrangler@4 d1 execute tracking-ae-db --local \
  --command "SELECT event_name, funnel, sent_to_meta, sent_to_ga4 FROM event_log WHERE event_id='fs-teste-1'"
```

Expected: uma linha com `event_name = FormStart`, `funnel = aplicacao-mentoria`, `sent_to_meta = 0`, `sent_to_ga4 = 0`

- [ ] **Step 10: Conferir que o `Lead` continua indo para fora**

```bash
curl -s -X POST http://localhost:8788/tracker -H 'Content-Type: application/json' \
  -d '{"event_name":"Lead","event_id":"lead-teste-1","event_time":1800000000,"event_source_url":"http://localhost:8788/","lead_data":{"funnel":"aplicacao-mentoria"}}'
npx --yes wrangler@4 d1 execute tracking-ae-db --local \
  --command "SELECT event_name, sent_to_meta, sent_to_ga4 FROM event_log WHERE event_id='lead-teste-1'"
```

Expected: `sent_to_meta = 1`, `sent_to_ga4 = 1` — a regressão que mais importa evitar nesta task

- [ ] **Step 11: Commit**

```bash
git add src/scripts/form-start.ts functions/tracker.js src/components/AplicacaoForm.astro src/components/LeadChat.astro src/components/LeadFormModal.astro src/pages/materiais/\[slug\].astro
git commit -m "feat: evento FormStart como metrica de acompanhamento"
```

---

### Task 9: Suporte a `noindex` e documentação da variante

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Create: `docs/como-criar-variante-ab.md`

**Interfaces:**
- Consumes: nada.
- Produces: prop `noindex?: boolean` em `BaseLayout`.

- [ ] **Step 1: Adicionar a prop no `BaseLayout.astro`**

No frontmatter, junto das props já existentes, acrescentar `noindex` com padrão `false`:

```astro
const { noindex = false } = Astro.props;
```

E dentro do `<head>`, antes das tags de tracking:

```astro
{noindex && <meta name="robots" content="noindex, nofollow" />}
```

- [ ] **Step 2: Escrever o guia de criação de variante**

Criar `docs/como-criar-variante-ab.md`:

````markdown
# Como criar uma variante de teste A/B

## 1. Crie a página da variante

O arquivo precisa estar exatamente em `src/pages/ab/<slug>/b.astro`, onde
`<slug>` é o identificador do teste cadastrado no painel.

**Variação pontual** (mesma página, copy diferente) — reusa os componentes:

```astro
---
import BaseLayout from '../../../layouts/BaseLayout.astro';
import Hero from '../../../components/sections/Hero.astro';
// ...as mesmas seções da página original
---
<BaseLayout noindex>
  <Hero headline="A nova headline que está sendo testada" />
  <!-- ...o resto igual à original -->
</BaseLayout>
```

**Página inteira nova** — escreva o que quiser, só mantenha o `noindex`:

```astro
---
import BaseLayout from '../../../layouts/BaseLayout.astro';
---
<BaseLayout noindex>
  <!-- layout completamente diferente -->
</BaseLayout>
```

O `noindex` não é opcional: sem ele, o Google poderia indexar a variante como
página separada e ela competiria com a original nos resultados de busca.

## 2. Cadastre o teste no painel

Aba **Testes A/B** do dashboard → **Novo teste**. O identificador precisa ser
o mesmo `<slug>` da pasta.

## 3. Confira a variante antes de ligar

O painel mostra o link de preview de cada teste em rascunho. Ele abre a
variante direto, e marca sua sessão para ficar fora da contagem.

## 4. Ative

O teste só começa a repartir tráfego depois de ativado, e a mudança leva até
1 minuto para valer em todos os servidores de borda.

## O que NÃO fazer

- **Não mexa na página A enquanto o teste roda.** Mudar a original no meio do
  caminho compara duas coisas que não existiram ao mesmo tempo.
- **Não encerre antes dos alvos.** O painel diz `Ainda rodando` por um motivo:
  parar assim que o número fica bonito transforma 5% de chance de erro em mais
  de 30%.
- **Não rode dois testes na mesma página.** O endpoint recusa, mas vale saber
  por quê: os efeitos se misturam e nenhum dos dois resultados vale.
````

- [ ] **Step 3: Conferir que o build passa e que o `noindex` não vazou para as páginas normais**

Run: `npm run build && grep -rl "noindex" dist/ | head`
Expected: build passa; nenhuma página existente contém `noindex` (o `grep` não retorna nada)

- [ ] **Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro docs/como-criar-variante-ab.md
git commit -m "feat: suporte a noindex no layout e guia de criacao de variante"
```

---

### Task 10: Aba "Testes A/B" no dashboard

**Files:**
- Modify: `public/dash/index.html`

**Interfaces:**
- Consumes: `GET`/`POST /api/ab-tests` (Task 7).
- Produces: nada.

- [ ] **Step 1: Adicionar o item de menu**

Depois da linha 141 (`<a href="#links" data-secao="links">Links</a>`):

```html
      <a href="#ab" data-secao="ab">Testes A/B</a>
```

- [ ] **Step 2: Adicionar a seção**

Depois do fechamento da `<section class="secao" id="secao-links">` (por volta da linha 266):

```html
    <section class="secao" id="secao-ab">
      <div class="card">
        <h2>Testes em andamento <small>a divisão de tráfego muda em até 1 minuto após ativar ou pausar</small></h2>
        <div id="ab-lista"></div>
      </div>

      <div class="card">
        <h2 id="ab-form-titulo">Novo teste</h2>
        <form id="ab-form" style="display:grid; gap:0.6rem; max-width:640px">
          <input type="hidden" id="ab-id">
          <input type="text" id="ab-nome" placeholder="Nome do teste (ex.: Home — oferta nova)" required>
          <input type="text" id="ab-slug" placeholder="Identificador (ex.: home-oferta-2026-08)" required>
          <input type="text" id="ab-path" placeholder="Página testada (ex.: /aplicacao-mentoria)" required>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
            <label style="flex:1; min-width:180px">Leads por variante
              <input type="number" id="ab-leads" min="10" step="1" value="60" style="width:100%"></label>
            <label style="flex:1; min-width:180px">Dias (semanas inteiras)
              <input type="number" id="ab-dias" min="14" step="7" value="14" style="width:100%"></label>
            <label style="flex:1; min-width:180px">Fatia da variante B (%)
              <input type="number" id="ab-peso" min="1" max="99" step="1" value="50" style="width:100%"></label>
          </div>
          <p class="mini">A variante B precisa existir em <code>src/pages/ab/&lt;identificador&gt;/b.astro</code> antes de ativar.</p>
          <div id="ab-erro" class="aviso falha" hidden></div>
          <div style="display:flex; gap:0.5rem">
            <button class="btn" type="submit">Salvar</button>
            <button class="btn" type="button" id="ab-cancelar" hidden>Cancelar edição</button>
          </div>
        </form>
      </div>
    </section>
```

- [ ] **Step 3: Adicionar o render e as ações**

No fim do bloco de scripts, depois da seção `// ---------- links ----------` (por volta da linha 995):

```js
// ---------- testes A/B ----------
// A aba NÃO decide nada: veredito, alerta de divisão torta e progresso vêm
// prontos de /api/ab-tests. Regra repetida na tela é regra que um dia diverge
// da real — e aqui a regra existe justamente para conter a vontade de decidir
// cedo demais.
const AB_ESTADOS = {
  rodando: '⏳ Ainda rodando — não decida agora',
  'sem-diferenca': '➖ Sem diferença detectável entre as versões',
  conclusivo: '✅ Resultado confiável (95%)',
};
const AB_STATUS = { rascunho: 'rascunho', ativo: 'ATIVO', pausado: 'pausado', encerrado: 'encerrado' };
const pct = (n) => (n * 100).toFixed(2).replace('.', ',') + '%';

R.ab = async () => {
  const dados = await fetchJson('/api/ab-tests');
  const linhas = dados.rows || [];

  if (!linhas.length) {
    $('#ab-lista').innerHTML = '<p class="mini">Nenhum teste cadastrado ainda.</p>';
    return;
  }

  $('#ab-lista').innerHTML = linhas.map((t) => {
    const v = t.veredito;
    const [a, b] = t.variantes;

    const corpo = [a, b].map((x) => `
      <tr>
        <td>${x.chave === 'a' ? 'A (atual)' : 'B (nova)'} <span class="mini">${x.peso}%</span></td>
        <td style="text-align:right">${x.visitas}</td>
        <td style="text-align:right">${x.form_starts}</td>
        <td style="text-align:right">${x.leads}</td>
        <td style="text-align:right">${pct(x.taxa)}</td>
      </tr>`).join('');

    const progresso = t.status === 'encerrado'
      ? `<p class="mini">Encerrado — vencedor declarado: <b>${esc(t.vencedor || 'nenhum')}</b></p>`
      : `<p class="mini">Progresso: faltam ${v.faltamLeads} leads na variante mais atrasada e ${v.faltamDias} dias · alvo ${v.metaLeads} leads/variante em ${v.metaDias} dias</p>
         <p>${AB_ESTADOS[v.estado] || ''}${v.estado === 'conclusivo' && v.vencedor ? ` — vence a variante <b>${v.vencedor.toUpperCase()}</b>` : ''}</p>`;

    const srm = v.srm.alerta
      ? '<div class="aviso falha">⚠️ A divisão do tráfego está torta (bug, bot ou cache). Enquanto isso não for resolvido, o resultado deste teste não vale.</div>'
      : '';

    const acoes = t.status === 'encerrado' ? '' : `
      ${t.status !== 'ativo' ? `<button class="btn" type="button" data-ab-ativar="${t.id}">ativar</button>` : ''}
      ${t.status === 'ativo' ? `<button class="btn" type="button" data-ab-pausar="${t.id}">pausar</button>` : ''}
      ${t.status === 'rascunho' ? `<button class="btn" type="button" data-ab-editar="${t.id}">editar</button>` : ''}
      <button class="btn" type="button" data-ab-encerrar="${t.id}">encerrar</button>
      <a class="btn" href="${esc(t.url_preview)}" target="_blank" rel="noopener">ver variante B</a>`;

    return `
      <div style="margin-bottom:1.5rem">
        <h3 style="margin:0 0 0.2rem">${esc(t.nome)} <span class="mini">${AB_STATUS[t.status] || esc(t.status)} · ${esc(t.path)} · dia ${v.diasCorridos} de ${v.metaDias}</span></h3>
        ${srm}
        <div class="tabela-wrap"><table>
          <thead><tr><th>Variante</th><th style="text-align:right">Visitas</th><th style="text-align:right">Form. inic.</th><th style="text-align:right">Leads</th><th style="text-align:right">Conversão</th></tr></thead>
          <tbody>${corpo}</tbody>
        </table></div>
        ${progresso}
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem">${acoes}</div>
      </div>`;
  }).join('');

  $('#ab-lista').onclick = async (ev) => {
    const ativar = ev.target.closest('[data-ab-ativar]');
    if (ativar) return salvarAb({ id: ativar.dataset.abAtivar, acao: 'ativar' });

    const pausar = ev.target.closest('[data-ab-pausar]');
    if (pausar) return salvarAb({ id: pausar.dataset.abPausar, acao: 'pausar' });

    const encerrar = ev.target.closest('[data-ab-encerrar]');
    if (encerrar) {
      const vencedor = prompt('Quem venceu? Digite a, b ou nenhum.');
      if (!vencedor) return;
      return salvarAb({ id: encerrar.dataset.abEncerrar, acao: 'encerrar', vencedor: vencedor.trim().toLowerCase() });
    }

    const editar = ev.target.closest('[data-ab-editar]');
    if (editar) {
      const t = linhas.find((x) => String(x.id) === editar.dataset.abEditar);
      $('#ab-id').value = t.id;
      $('#ab-nome').value = t.nome;
      $('#ab-slug').value = t.slug;
      $('#ab-path').value = t.path;
      $('#ab-leads').value = t.meta_leads_variante;
      $('#ab-dias').value = t.meta_dias;
      $('#ab-peso').value = (t.variantes.find((x) => x.chave === 'b') || {}).peso ?? 50;
      $('#ab-form-titulo').textContent = 'Editar teste';
      $('#ab-cancelar').hidden = false;
    }
  };
};

async function salvarAb(corpo) {
  const erro = $('#ab-erro');
  erro.hidden = true;
  const r = await fetch(`/api/ab-tests?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    erro.textContent = dados.error || 'Não deu para salvar.';
    erro.hidden = false;
    return;
  }
  limparFormAb();
  await R.ab();
}

function limparFormAb() {
  $('#ab-form').reset();
  $('#ab-id').value = '';
  $('#ab-form-titulo').textContent = 'Novo teste';
  $('#ab-cancelar').hidden = true;
  $('#ab-erro').hidden = true;
}

$('#ab-cancelar').addEventListener('click', limparFormAb);
$('#ab-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  await salvarAb({
    id: $('#ab-id').value || undefined,
    nome: $('#ab-nome').value,
    slug: $('#ab-slug').value,
    path: $('#ab-path').value,
    meta_leads_variante: $('#ab-leads').value,
    meta_dias: $('#ab-dias').value,
    peso_b: $('#ab-peso').value,
  });
});
```

- [ ] **Step 4: Conferir a aba no navegador**

Com `npx --yes wrangler@4 pages dev dist --port 8788 --binding DASH_KEY=teste-local` rodando, abrir `http://localhost:8788/dash/#ab` e informar a chave `teste-local`.

Expected: a aba aparece no menu; o teste criado na Task 7 aparece com `rascunho`, tabela zerada e `⏳ Ainda rodando`; o formulário salva e mostra o erro do backend quando `dias` não é múltiplo de 7.

- [ ] **Step 5: Commit**

```bash
git add public/dash/index.html
git commit -m "feat: aba Testes A/B no dashboard"
```

---

### Task 11: Validação de ponta a ponta

Nenhuma task anterior exercitou o caminho completo — um visitante sendo sorteado, vendo a variante B, convertendo e aparecendo no painel do lado certo. Esta task faz isso antes de qualquer coisa ir para produção.

**Files:**
- Create: `src/pages/ab/teste-fumaca/b.astro` (temporário, apagado no fim)

**Interfaces:**
- Consumes: tudo das tasks 1-10.
- Produces: nada.

- [ ] **Step 1: Criar uma variante de fumaça**

Criar `src/pages/ab/teste-fumaca/b.astro`:

```astro
---
import BaseLayout from '../../../layouts/BaseLayout.astro';
---
<BaseLayout noindex>
  <h1 data-variante="b">VARIANTE B DE FUMAÇA</h1>
</BaseLayout>
```

- [ ] **Step 2: Subir o ambiente e cadastrar o teste**

```bash
npm run build
npx --yes wrangler@4 pages dev dist --port 8788 --binding DASH_KEY=teste-local
```

Noutro terminal:
```bash
curl -s -X POST "http://localhost:8788/api/ab-tests?key=teste-local" -H 'Content-Type: application/json' \
  -d '{"nome":"Fumaca","slug":"teste-fumaca","path":"/vsl","meta_leads_variante":10,"meta_dias":14,"peso_b":50}'
curl -s -X POST "http://localhost:8788/api/ab-tests?key=teste-local" -H 'Content-Type: application/json' \
  -d '{"id":2,"acao":"ativar"}'
```
(ajustar o `id` conforme o retorno do primeiro comando)

- [ ] **Step 3: Confirmar que o tráfego se divide na mesma URL**

```bash
for i in $(seq 1 20); do
  curl -s -c /dev/null "http://localhost:8788/vsl" | grep -c 'VARIANTE B DE FUMAÇA'
done | sort | uniq -c
```

Expected: uma mistura de `0` e `1` — cada `curl` sem cookie é um visitante novo, então alguns recebem A e outros B. A URL pedida é sempre `/vsl`.

- [ ] **Step 4: Confirmar que o visitante fica na mesma variante**

```bash
curl -s -c /tmp/ab-cookies.txt "http://localhost:8788/vsl" | grep -c 'VARIANTE B'
for i in 1 2 3 4 5; do
  curl -s -b /tmp/ab-cookies.txt "http://localhost:8788/vsl" | grep -c 'VARIANTE B'
done
```

Expected: as cinco repetições devolvem todas o mesmo número da primeira (todas `1` ou todas `0`)

- [ ] **Step 5: Confirmar o cabeçalho de cache e o cookie**

```bash
curl -si "http://localhost:8788/vsl" | grep -i 'cache-control\|_krob_ab'
```

Expected: `Cache-Control: private, no-store` e um `Set-Cookie: _krob_ab=teste-fumaca:a` (ou `:b`)

- [ ] **Step 6: Confirmar que a exposição foi registrada**

```bash
npx --yes wrangler@4 d1 execute tracking-ae-db --local \
  --command "SELECT variante, COUNT(*) FROM ab_assignments GROUP BY variante"
```

Expected: linhas para `a` e para `b`, somando o número de visitantes distintos criados acima

- [ ] **Step 7: Confirmar que o preview funciona e fica fora da contagem**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8788/ab/teste-fumaca/b"
curl -s -c /tmp/ab-preview.txt "http://localhost:8788/ab/teste-fumaca/b?ab_preview=1" | grep -c 'VARIANTE B'
npx --yes wrangler@4 d1 execute tracking-ae-db --local \
  --command "SELECT COUNT(*) AS previews FROM ab_assignments WHERE is_preview = 1"
```

Expected: `404` no primeiro (acesso direto bloqueado), `1` no segundo (preview abre), `previews = 1` no terceiro

- [ ] **Step 8: Confirmar que um Lead aparece do lado certo do painel**

Pegar o `_krob_sid` de `/tmp/ab-cookies.txt` e enviar um Lead com ele:

```bash
SID=$(grep _krob_sid /tmp/ab-cookies.txt | awk '{print $7}')
curl -s -X POST http://localhost:8788/tracker -H 'Content-Type: application/json' \
  -H "Cookie: _krob_sid=$SID" \
  -d '{"event_name":"Lead","event_id":"lead-fumaca","event_time":1800000000,"event_source_url":"http://localhost:8788/vsl","lead_data":{"funnel":"diagnostico","email":"fumaca@exemplo.com"}}'
curl -s "http://localhost:8788/api/ab-tests?key=teste-local"
```

Expected: no JSON, a variante que aquele cookie recebeu mostra `leads: 1`; a outra mostra `leads: 0`

- [ ] **Step 9: Confirmar que o veredito segura a decisão**

No JSON do passo anterior, conferir `veredito`.

Expected: `estado: "rodando"`, `vencedor: null` — mesmo com 1 lead contra 0, porque nem os 10 leads nem os 14 dias foram atingidos. **Este é o comportamento mais importante do sistema inteiro.**

- [ ] **Step 10: Confirmar que pausar devolve todo o tráfego para A**

```bash
curl -s -X POST "http://localhost:8788/api/ab-tests?key=teste-local" -H 'Content-Type: application/json' \
  -d '{"id":2,"acao":"pausar"}'
sleep 61
for i in $(seq 1 10); do curl -s "http://localhost:8788/vsl" | grep -c 'VARIANTE B'; done | sort | uniq -c
```

Expected: dez zeros — nenhum visitante novo cai em B. (O `sleep` é o cache de 60s do `_ab-consulta.js`.)

- [ ] **Step 11: Apagar a variante de fumaça**

```bash
rm -rf src/pages/ab/teste-fumaca
npm run build
```

- [ ] **Step 12: Rodar a suíte inteira uma última vez**

Run: `node --test tests/*.test.js`
Expected: PASS em todos os arquivos

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: validacao de ponta a ponta do teste A/B"
```

---

## Depois do plano

O que fica para a usuária, fora do código:

1. **Aplicar a migration em produção** (Task 4, Step 5) — precisa de confirmação dela.
2. **Escrever a primeira variante de verdade.** O guia está em `docs/como-criar-variante-ab.md`. Com base nos números de julho, o primeiro teste com chance real de concluir é na home (`/`), com uma mudança grande o bastante para dobrar a conversão de 1,1%.
3. **Não decidir antes do painel liberar.** É a razão de o sistema existir do jeito que existe.
