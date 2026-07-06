# 55: Endpoint `/api/conversion` — conversão por LP (visitantes × leads via D1)

**Tipo:** Implementação
**Página:** Módulo: Endpoint `/api/conversion` (arquivo novo `functions/api/conversion.js`)

## Descrição

Criar o endpoint GET `/api/conversion` que devolve, por landing page (path normalizado de `sessions.landing_url`), o número de visitantes únicos não-bot no período, quantos desses viraram lead e a taxa de conversão calculada no backend. Segue exatamente os padrões do `/api/leads` (`functions/api/leads.js`): autenticação por `DASH_KEY`, período `days`/`from`/`to` (semântica do `resolvePeriod`), filtro `&funnel=`, resposta via `json()` com CORS `*` e mesmo tratamento de erro.

## Comportamentos

- **Autenticação:** lê `?key=` da query string e compara com `env.DASH_KEY`; se `DASH_KEY` não estiver configurada ou a chave não bater, responde 401 `{ error: 'Unauthorized' }` sem tocar no banco.
- **Período:** aceita `?days=` (default 30, clamp 1–365) e `?from=`/`?to=` (unix seconds), com `from/to` tendo prioridade sobre `days` e `until` default = agora. O período se aplica a `sessions.created_at` (define o denominador).
- **Normalização da LP:** extrai apenas o path de `sessions.landing_url` (remove protocolo, domínio, query e fragmento); barra final normalizada (`/pagina/` e `/pagina` agregam juntas; raiz vira `/`). Normalização no backend (SQL ou JS pós-query), nunca no front.
- **Sessão sem landing_url:** `landing_url` NULL/vazia entra no bucket `(sem página)` — não é descartada silenciosamente.
- **Exclusão de bots:** sessões cujo `user_agent` casa com a lógica do `detectBot(userAgent)` de `functions/tracker.js` não contam como visitantes. A função/lista de padrões é **replicada dentro de `conversion.js`** (copiar), pois `tracker.js` não pode ser alterado e não há módulo compartilhado.
- **Leads por LP:** visitante conta como lead se existe ≥ 1 linha em `event_log` com `event_name = 'Lead'`, `is_bot = 0` e `session_id` da sessão; cada sessão conta **no máximo 1 lead** (taxa nunca passa de 100%).
- **Filtro de funil:** `?funnel=` opcional — denominador filtra `sessions.funnel = ?` e numerador usa funil efetivo `COALESCE(NULLIF(e.funnel,''), s.funnel) = ?` (padrão do `/api/leads`). Ausente = todas as LPs de todos os funis.
- **Resposta de sucesso:** `{ days, funnel, rows }` onde `rows` é array de `{ lp, visitors, leads, rate }` ordenado por `visitors` desc (empate: `lp` alfabético); `rate` é fração 0–1 calculada no backend.
- **LP sem lead:** aparece com `leads: 0` e `rate: 0` (não é omitida).
- **Divisão por zero:** `visitors` 0 → `rate` `0` (nunca `NaN`/`null`/`Infinity`).
- **Período sem sessões:** 200 com `rows: []`.
- **Falha de query no D1:** 500 `{ error: err.message }`, no mesmo `try/catch` + `json()` do `/api/leads`.

## Dependências

- Nenhuma. **Fazer primeiro** — a issue 56 (seção no dashboard) consome este endpoint.

## Decisões de Implementação

### 1. Filtro de bots: SQL `NOT LIKE` (escolhido) vs filtrar em JS

**Escolhido: filtrar em SQL com `NOT LIKE`.** Justificativa:

- Todos os 10 padrões regex do `detectBot` de `functions/tracker.js:702-722` são **alternâncias de substrings simples** (`/googlebot|google-inspectiontool/i` etc.) — nenhum usa âncoras, classes ou quantificadores. Cada alternativa decompõe 1:1 em `user_agent NOT LIKE '%<substring>%'`. `LIKE` do SQLite é case-insensitive para ASCII por padrão, então a semântica do flag `/i` é preservada sem `LOWER()`.
- A regra "UA ausente ou < 10 chars = bot" vira `s.user_agent IS NOT NULL AND LENGTH(s.user_agent) >= 10`.
- Filtrar em JS exigiria trazer o `user_agent` de cada sessão do período (ou agregar por `landing_url + user_agent`, cuja cardinalidade ≈ nº de sessões, já que UA varia por visitante). Com janelas de até 365 dias isso significa milhares de linhas trafegadas do D1 só para descartar bots — agregar em SQL devolve dezenas de linhas.
- Contra do SQL (aceito): a lista fica duplicada em forma de substrings. Mitigação: declarar em `conversion.js` uma constante `BOT_UA_SUBSTRINGS` (array JS com as ~23 substrings, espelhando fielmente cada alternativa dos 10 padrões) com comentário apontando a origem (`replicado de detectBot em functions/tracker.js — manter em sincronia; tracker.js não pode ser alterado nesta feature`). As cláusulas `NOT LIKE` são geradas por `.map()` sobre o array (substrings são literais estáticos sem aspas — sem risco de injeção; **não** interpolar input do usuário).

Substrings a espelhar (fiéis a `detectBot`): `googlebot`, `google-inspectiontool`, `bingbot`, `msnbot`, `facebookexternalhit`, `facebot`, `twitterbot`, `linkedinbot`, `slackbot`, `whatsapp`, `bot`, `crawler`, `spider`, `scraper`, `headless`, `python-requests`, `axios`, `node-fetch`, `curl`, `wget`, `httpie`, `phantomjs`, `selenium`, `puppeteer`, `playwright`. (Manter a lista completa mesmo com `bot` subsumindo várias, para rastreabilidade 1:1 com a origem.)

### 2. Normalização de `landing_url` → path: em JS pós-query (escolhido), agregação em SQL por `landing_url` cru

**Escolhido: híbrido — SQL agrega por `s.landing_url` cru; JS normaliza o path e re-agrega.** Justificativa:

- Extrair path em SQLite puro (sem `regexp` no D1) exige encadear `instr`/`substr` para protocolo, domínio, `?` e `#` — frágil para URLs malformadas. `new URL()` em JS é robusto e já disponível no runtime Workers.
- O `GROUP BY s.landing_url` no SQL reduz o volume: mesmo com fbclid/UTMs tornando muitas URLs únicas, cada linha do resultado é só `(landing_url, visitors, leads)` — ordens de grandeza menor que sessões cruas.
- A re-agregação em JS (somar `visitors` e `leads` dos grupos que normalizam para o mesmo path) é **correta por construção**: cada sessão tem exatamente 1 `landing_url`, então os conjuntos de sessões de grupos crus distintos são disjuntos — somar não conta ninguém duas vezes.

Função `normalizePath(raw)` em JS:
1. `raw` NULL/vazio (após `trim`) → `(sem página)`.
2. `try { path = new URL(raw).pathname }`; se lançar (URL relativa/malformada), tentar `new URL(raw, 'https://x').pathname` (resolve paths relativos tipo `/pagina?a=b`); se lançar de novo → `(sem página)`.
3. `pathname` já descarta query e fragmento. Normalizar barra final: `path.replace(/\/+$/, '') || '/'` (raiz vira `/`; `/pagina/` e `/pagina` agregam juntas).

### 3. Regra de janela (período)

O período (`since`/`until` do `resolvePeriod`) filtra **`sessions.created_at`** — define o denominador. Os leads contados são os das sessões dessa janela, **independente do timestamp do evento**: um lead cujo evento caiu fora do período mas cuja sessão nasceu dentro dele conta. Motivo: a pergunta da feature é "das pessoas que visitaram a LP no período, quantas converteram" — coorte por visita, não por evento.

### 4. Regra do filtro `?funnel=`

Filtra **numerador E denominador**, com semânticas diferentes por necessidade:
- **Denominador:** `AND s.funnel = ?` — sessão só tem o funil first-touch dela; não existe funil de evento para visitante que não converteu.
- **Numerador:** funil efetivo `COALESCE(NULLIF(e.funnel,''), s.funnel) = ?` — mesmo padrão do `/api/leads`, para que o total de leads desta tabela bata com o card "Leads por funil" do dashboard (evento manda; sessão é fallback histórico).

Consequência aceita: um lead cujo funil efetivo difere do funil da sessão (visitante entrou por um funil e converteu noutro) sai do numerador quando se filtra pelo funil da sessão — a taxa reflete conversões *daquele funil* entre visitantes *daquele funil*, nunca > 100%.

### 5. Query única (denominador + numerador juntos)

```sql
SELECT
  s.landing_url,
  COUNT(DISTINCT s.session_id) AS visitors,
  COUNT(DISTINCT CASE WHEN e.id IS NOT NULL {AND_FUNIL_EFETIVO} THEN s.session_id END) AS leads
FROM sessions s
LEFT JOIN event_log e
  ON e.session_id = s.session_id
 AND e.event_name = 'Lead'
 AND e.is_bot = 0
WHERE s.created_at >= ? AND s.created_at <= ?
  AND s.user_agent IS NOT NULL AND LENGTH(s.user_agent) >= 10
  {NOT_LIKE_BOTS}          -- literais gerados de BOT_UA_SUBSTRINGS
  {AND s.funnel = ?}       -- só com ?funnel=
GROUP BY s.landing_url
```

- `COUNT(DISTINCT ...)` garante **máx. 1 lead por sessão** mesmo com N eventos `Lead` (fan-out do JOIN não infla nem visitors nem leads).
- **Atenção à ordem dos binds** (posicional na ordem do texto SQL): o bind do funil efetivo no `CASE` (SELECT) vem **antes** de `since`/`until`; o do `s.funnel = ?` vem por último. Com `?funnel=`: `[funnel, since, until, funnel]`. Sem: `[since, until]`.
- `rate` calculada em JS após a re-agregação: `visitors > 0 ? leads / visitors : 0`.
- Ordenação final em JS (pós-merge, não no SQL — o merge muda os totais): `visitors` desc, empate `lp` asc (`localeCompare` ou `<`).

## Cenários

### Happy Path

1. `GET /api/conversion?key=<DASH_KEY>&days=30` → 200 `{ days: 30, funnel: null, rows: [...] }`.
2. `rows` = array de `{ lp, visitors, leads, rate }`: `lp` path normalizado (ex.: `/lives-semanais-v1`), `visitors` int ≥ 0 (sessões não-bot do período), `leads` int ≥ 0 (≤ visitors), `rate` fração 0–1.
3. Sessões de `https://atacadoexponencial.com/lives-semanais-v1?utm_source=fb&fbclid=X` e `.../lives-semanais-v1/` agregam na mesma linha `/lives-semanais-v1`.
4. Ordenado por `visitors` desc; empate por `lp` alfabético.
5. Com `&funnel=lives-semanais-v1`: denominador só sessões `s.funnel = 'lives-semanais-v1'`, numerador só leads com funil efetivo igual; resposta ecoa `funnel: 'lives-semanais-v1'`.
6. Com `&from=...&to=...` (unix seconds): janela explícita tem prioridade sobre `days` (que ainda é ecoado na resposta, como no `/api/leads`).

### Edge Cases

- **Sessão sem `landing_url`** (NULL ou `''`): agrega no bucket `lp: '(sem página)'` — não é descartada; participa da ordenação como qualquer linha.
- **LP com visitantes e 0 leads:** aparece com `leads: 0`, `rate: 0` — não é omitida.
- **`visitors` 0 num grupo** (teórico): `rate: 0`, nunca `NaN`/`null`/`Infinity` (guard `visitors > 0` na divisão).
- **Lead com evento fora do período mas sessão dentro:** conta (regra de janela — coorte por `sessions.created_at`; ver Decisão 3).
- **Sessão dentro do período com 2+ eventos `Lead`:** conta 1 lead (`COUNT(DISTINCT session_id)` no `CASE`).
- **`?funnel=` presente:** filtra numerador E denominador (ver Decisão 4); visitante que entrou por outro funil não entra no denominador mesmo que a LP seja a mesma.
- **`landing_url` com query/hash:** `?utm...`/`#secao` removidos pelo `pathname` do `new URL()`.
- **`landing_url` malformada** (não parseável nem como relativa): bucket `(sem página)` — nunca lança.
- **Sessão bot** (UA NULL, UA < 10 chars, ou casando substring de bot): fora do denominador; como o numerador só conta sessões do denominador (`CASE` dentro do mesmo `GROUP BY`), lead de sessão bot também não aparece.
- **Período sem sessões:** 200 `{ days, funnel, rows: [] }`.
- **`days` fora do range** (`0`, `9999`, `abc`): clamp 1–365 / fallback 30 via `clampInt` (mesmo helper do `/api/leads`).

### Cenário de Erro

- **Sem `?key=` ou chave errada, ou `env.DASH_KEY` não configurada:** 401 `{ error: 'Unauthorized' }` **antes** de qualquer acesso ao banco.
- **D1 indisponível / erro de query:** o `try/catch` envolve o `prepare().bind().all()` e devolve 500 `{ error: err.message }` via `json()` — mesmo padrão do `/api/leads` (headers `Content-Type: application/json` + `Access-Control-Allow-Origin: *` em TODAS as respostas, inclusive 401/500).

## Banco de Dados

Somente leitura — **nenhuma migration**. Colunas confirmadas nas migrations:

- **`sessions`** (`0001_create_tables.sql` + `0016_sessions_funnel.sql`): `session_id` (TEXT PK), `user_agent` (TEXT, nullable), `landing_url` (TEXT, nullable), `created_at` (INTEGER, unix seconds, indexado por `idx_sessions_created`), `funnel` (TEXT DEFAULT `''`).
- **`event_log`** (`0001_create_tables.sql` + `0017_event_log_funnel.sql`): `id` (INTEGER PK), `session_id` (TEXT, nullable, **sem índice** — aceito, o filtro por `idx_event_log_event_name`/`event_name='Lead'` reduz o lado direito do JOIN a poucas linhas), `event_name` (TEXT), `is_bot` (INTEGER DEFAULT 0), `funnel` (TEXT DEFAULT `''`).

## Arquivos

- **Criar:** `functions/api/conversion.js` — único arquivo tocado na issue. Único export: `onRequestGet(context)`. Estrutura interna (espelhando `functions/api/leads.js`):
  1. **Comentário de cabeçalho** explicando o endpoint (padrão dos outros arquivos de `functions/api/`).
  2. **Auth:** `url.searchParams.get('key')` vs `env.DASH_KEY` → 401 antes de qualquer query (copiar leads.js:13-17).
  3. **Período:** helpers `clampInt` e `resolvePeriod` **copiados** de `functions/api/leads.js:153-168` (são funções privadas de módulo — não há como importar sem alterar leads.js, o que está fora do escopo).
  4. **`BOT_UA_SUBSTRINGS`** (const de módulo): as 25 substrings da Decisão 1 + comentário `// Replicado de detectBot() em functions/tracker.js (linha ~702). tracker.js não pode ser alterado nesta feature — manter em sincronia manualmente.` Gerar as cláusulas: `BOT_UA_SUBSTRINGS.map(s => \`AND s.user_agent NOT LIKE '%${s}%'\`).join('\n')` (literais estáticos do próprio módulo, nunca input do request).
  5. **Query única** da Decisão 5, com `EFFECTIVE_FUNNEL = "COALESCE(NULLIF(e.funnel, ''), s.funnel)"` (mesma const do leads.js:35) e binds na ordem `[funnel?, since, until, funnel?]`.
  6. **`normalizePath(raw)`** (função privada): Decisão 2, passo a passo.
  7. **Re-agregação em JS:** `Map` de `lp → { visitors, leads }` somando os grupos crus; depois `rows = [...map].map(([lp, v]) => ({ lp, visitors: v.visitors, leads: v.leads, rate: v.visitors > 0 ? v.leads / v.visitors : 0 }))`.
  8. **Ordenação:** `rows.sort((a, b) => b.visitors - a.visitors || a.lp.localeCompare(b.lp))`.
  9. **Resposta:** `json({ days, funnel: funnel || null, rows })`; helper `json()` copiado de leads.js:143-151.
- **Não tocar:** `functions/tracker.js`, `functions/_middleware.js`, `functions/api/leads.js`, `public/dash/index.html` (issue 56), `migrations/`.

## Checklist

- [x] `functions/api/conversion.js` criado; único export `onRequestGet(context)`; nenhum outro arquivo modificado (`git status` mostra só ele)
- [x] 401 `{ error: 'Unauthorized' }` sem `key`, com key errada e com `DASH_KEY` ausente — sem nenhuma chamada a `env.DB` antes do check
- [x] `clampInt` + `resolvePeriod` copiados de `functions/api/leads.js` com semântica idêntica (default 30, clamp 1–365, `from`/`to` unix com prioridade, `until` default agora); janela aplicada a `s.created_at`
- [x] `BOT_UA_SUBSTRINGS` com as 25 substrings espelhando fielmente `detectBot` de `functions/tracker.js:702-722` + regra `LENGTH(user_agent) >= 10` e `IS NOT NULL` no SQL + comentário apontando a origem
- [x] Query única com `LEFT JOIN event_log` (`event_name='Lead'`, `is_bot=0` no ON) e `COUNT(DISTINCT CASE ...)` para máx. 1 lead por sessão; binds na ordem `[funnel?, since, until, funnel?]`
- [x] `?funnel=`: denominador `s.funnel = ?`, numerador `COALESCE(NULLIF(e.funnel,''), s.funnel) = ?`; ausente = tudo
- [x] `normalizePath`: remove query/fragmento via `new URL().pathname` (com fallback base `https://x` e fallback final `(sem página)`); barra final normalizada; raiz = `/`; NULL/vazio → `(sem página)`
- [x] Re-agregação em JS por path normalizado somando `visitors`/`leads`; `rate = visitors > 0 ? leads/visitors : 0`; ordenação `visitors` desc + `lp` asc feita **depois** do merge
- [x] Todas as respostas via `json()` com `Content-Type: application/json` + `Access-Control-Allow-Origin: *`; erro de query → 500 `{ error: err.message }`
- [x] Teste local com `npx wrangler pages dev` (D1 local):
  - [x] `curl "http://localhost:8788/api/conversion?days=30"` → 401
  - [x] `curl "http://localhost:8788/api/conversion?key=<DASH_KEY>&days=30"` → 200 `{ days: 30, funnel: null, rows: [...] }` com rows ordenados por visitors desc
  - [x] `curl "...&funnel=lives-semanais-v1"` → `funnel` ecoado e contagens ≤ às sem filtro
  - [x] URLs com querystring/barra final no D1 local agregam no mesmo `lp`; sessão com `landing_url` NULL aparece como `(sem página)`
- [ ] Verificar em preview (`tracking-ae.pages.dev` branch preview): `curl "/api/conversion?key=...&days=30"` retorna `{ days, funnel, rows }`; sem `key` retorna 401
