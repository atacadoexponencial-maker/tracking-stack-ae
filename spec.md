# Spec: Conversão por LP no dashboard (visitantes × leads via D1)

## Visão Geral

Hoje o dashboard (`public/dash/index.html`) mostra quantos leads chegaram e de onde vieram (UTMs, funil), mas não mostra **quantas pessoas visitaram cada landing page** nem **qual percentual delas virou lead**. Sem isso, não dá para comparar a eficiência das LPs (`/lives-semanais-v1`, `/consultoria-gratuita-atacado`, etc.) — só o volume absoluto de leads.

Esta feature adiciona o acompanhamento de **taxa de conversão por landing page**, 100% baseado nos dados que o D1 já captura (sem GA4, sem novas migrations):

- **Denominador (visitantes):** a tabela `sessions` — o middleware (`functions/_middleware.js`) grava uma linha por visitante novo, server-side (imune a adblock), com `landing_url`, `user_agent`, `funnel` (first-touch) e `created_at`. Cada linha = um visitante único (cookie `_krob_sid` impede duplicata na revisita).
- **Numerador (leads):** a tabela `event_log` — eventos `Lead` com `session_id` apontando para a sessão de origem, no mesmo padrão de "funil efetivo" já usado pelo `/api/leads`.
- **Taxa:** leads ÷ visitantes, calculada **no backend**. O dashboard apenas exibe.

Público: a operação de tráfego do Atacado Exponencial, que precisa saber qual LP converte melhor para decidir onde investir.

Restrições respeitadas:
- Toda a lógica (normalização de URL, filtro de bots, agregação, cálculo da taxa) fica no backend; o front só renderiza o que o endpoint devolve.
- `functions/tracker.js` e `functions/_middleware.js` **não** são alterados.
- Nenhuma migration nova — só leitura das tabelas existentes.
- Exatamente 2 módulos: 1 endpoint novo + 1 seção nova no dashboard.

## Páginas / Módulos

### Módulo 1: Endpoint `/api/conversion` (arquivo novo `functions/api/conversion.js`)

**Descrição:** Endpoint GET que devolve, por landing page (path normalizado de `sessions.landing_url`), o número de visitantes únicos no período, o número desses visitantes que viraram lead e a taxa de conversão. Segue exatamente os padrões do `/api/leads` (`functions/api/leads.js`): mesma autenticação por `DASH_KEY`, mesmos parâmetros de período (`days`/`from`/`to` resolvidos pelo mesmo padrão do `resolvePeriod`), mesmo filtro `&funnel=`, mesmo formato de resposta JSON (`json()` com CORS `*`), mesmo tratamento de erro.

**Componentes:**
- Handler `onRequestGet(context)`: único export; recebe `request` e `env` do contexto Cloudflare Pages Functions.
- Resposta JSON de sucesso: objeto com `days`, `funnel` (o filtro aplicado ou `null`) e `rows` — array de `{ lp, visitors, leads, rate }`, ordenado por `visitors` decrescente, onde:
  - `lp`: path normalizado da landing page (string, ex.: `/lives-semanais-v1`);
  - `visitors`: inteiro ≥ 0 (sessões únicas não-bot no período);
  - `leads`: inteiro ≥ 0 (sessões dessas que têm pelo menos 1 evento `Lead`);
  - `rate`: número entre 0 e 1 (fração `leads / visitors`, calculada no SQL/backend — o front não divide nada).
- Resposta de erro: `{ error: '...' }` com status 401 (chave errada/ausente) ou 500 (falha de query), no mesmo formato do `/api/leads`.

**Comportamentos:**
- Autenticação: lê `?key=` da query string e compara com `env.DASH_KEY`; se `DASH_KEY` não estiver configurada ou a chave não bater, responde 401 `{ error: 'Unauthorized' }` sem tocar no banco.
- Período: aceita `?days=` (default 30, clampado entre 1 e 365) e o intervalo explícito `?from=`/`?to=` (unix seconds), com `from/to` tendo prioridade sobre `days` e `until` default = agora — mesma semântica do `resolvePeriod` do `/api/leads`. O período se aplica a `sessions.created_at` (define quais visitantes entram no denominador).
- Normalização da LP: extrai de `sessions.landing_url` **apenas o path** — remove protocolo, domínio, query string e fragmento (ex.: `https://atacadoexponencial.com/lives-semanais-v1?utm_source=fb&funnel=x` → `/lives-semanais-v1`). Barra final é normalizada (`/pagina/` e `/pagina` agregam juntas; a raiz vira `/`). A normalização acontece no backend (em SQL ou em JS pós-query, o que for mais simples), nunca no front.
- Sessão sem landing_url: sessões com `landing_url` NULL ou vazia são agregadas num bucket próprio rotulado `(sem página)` (valor `lp` = `(sem página)`), para a soma dos visitantes bater com o total de sessões válidas do período — não são descartadas silenciosamente.
- Exclusão de bots do denominador: sessões cujo `sessions.user_agent` casa com a lógica do `detectBot(userAgent)` de `functions/tracker.js` (user-agent ausente/curto ou batendo na lista de padrões de bot — Googlebot, Bingbot, facebookexternalhit, WhatsApp preview, Slackbot, etc.) **não contam como visitantes**. A lista de padrões é **replicada/duplicada dentro de `conversion.js`** (copiar a função), já que `tracker.js` não pode ser alterado (não dá para exportar dele) e não há módulo compartilhado hoje.
- Contagem de leads por LP: um visitante conta como lead se existe pelo menos 1 linha em `event_log` com `event_name = 'Lead'`, `is_bot = 0` e `session_id` igual ao da sessão. Cada sessão conta **no máximo 1 lead** (lead por visitante, não por evento — se a pessoa preencher o form 2 vezes, é 1 conversão), para a taxa nunca passar de 100%.
- Filtro de funil: aceita `?funnel=` opcional. Quando presente, o denominador filtra por `sessions.funnel = ?` e o numerador usa o padrão de funil efetivo do `/api/leads` (`COALESCE(NULLIF(e.funnel,''), s.funnel) = ?`). Quando ausente, devolve todas as LPs de todos os funis (comportamento igual ao `/api/leads` sem filtro).
- Ordenação: `rows` vem ordenado por `visitors` decrescente (empate: por `lp` alfabético), pronto para exibição — o front não reordena.
- LP sem lead: LPs com visitantes mas 0 leads aparecem normalmente com `leads: 0` e `rate: 0` (não são omitidas — LP que não converte é exatamente o que se quer enxergar).
- Divisão por zero: se por qualquer razão `visitors` for 0 num grupo, `rate` é `0` (nunca `NaN`/`null`/`Infinity`).
- Período sem sessões: responde 200 com `rows: []` (não é erro).
- Falha de query no D1: responde 500 `{ error: err.message }`, no mesmo `try/catch` + `json()` do `/api/leads`.

### Módulo 2: Seção "Conversão por LP" no dashboard (`public/dash/index.html`)

**Descrição:** Nova seção (card) na **aba Leads** do dashboard existente, com uma tabela "Conversão por LP" — colunas **LP | Visitantes | Leads | Taxa de conversão** — alimentada exclusivamente pelo `/api/conversion`. Segue o padrão visual dos cards já existentes (classe `.card`, cabeçalho `font-semibold` + subtítulo `text-xs`, tabela com `thead` uppercase, `tbody` com `row-hover`, wrapper `overflow-x-auto`) e todo o texto em PT-BR.

**Componentes:**
- `<section class="card p-5 fade-in" data-tab="leads">`: card novo, posicionado na aba Leads (sugestão: entre "Leads por funil" e "Leads recentes"), com título "Conversão por LP" e subtítulo explicativo (ex.: "Visitantes únicos por landing page vs. leads capturados, sem bots").
- Tabela HTML: cabeçalho com 4 colunas — "LP" (alinhada à esquerda), "Visitantes", "Leads" e "Taxa de conversão" (alinhadas à direita, fonte `mono` para os números, como as demais tabelas numéricas do dash).
- `<tbody id="conversion-tbody">`: corpo da tabela, com a linha inicial "Carregando…" (mesmo placeholder `colspan` centralizado dos outros cards).
- Função JS `loadConversion()`: busca `/api/conversion?${periodQuery}${funnelQuery}` via o helper `fetchJson` existente (que já anexa a `key`) e renderiza `data.rows` no `tbody`.

**Comportamentos:**
- Carga inicial: `loadConversion()` entra na lista do `Promise.all` de `loadAll()`, carregando junto com o resto do dashboard após o portão de acesso.
- Integração com o filtro de data: usa a variável `periodQuery` já existente; ao clicar em 7/30/90 dias ou aplicar o intervalo personalizado, a seção recarrega automaticamente (via o `loadAll()` que esses botões já chamam — sem novos listeners de data).
- Integração com o filtro de funil: usa a variável `funnelQuery` já existente; o listener `change` do `#funnel-picker` (que hoje chama só `loadLeads()`) passa a chamar **também** `loadConversion()`, para a tabela refletir o funil selecionado.
- Renderização de cada linha: `lp` como texto (escapado com o `escapeHtml` existente), `visitors` e `leads` formatados com o `fmtInt` existente (pt-BR), e `rate` exibida como percentual pt-BR com 1 casa decimal (ex.: `data.rows[i].rate = 0.0325` → "3,3%") — a formatação é só apresentação; o valor vem pronto do backend.
- Ordenação: exibe as linhas na ordem em que chegam do endpoint (visitantes desc) — o front **não** reordena nem recalcula nada.
- LP sem lead: linha renderizada normalmente com Leads "0" e taxa "0,0%".
- Bucket `(sem página)`: renderizado como qualquer outra linha, com o rótulo que veio do backend.
- Estado vazio: se `data.rows` for ausente ou vazio, o `tbody` mostra uma única linha centralizada "Nenhuma visita no período." (ou "Nenhuma visita deste funil no período." quando há filtro de funil ativo — mesmo padrão condicional do `loadLeads()`).
- Erro de fetch/endpoint: se a chamada lançar exceção ou a resposta trouxer `error`, o `tbody` mostra uma única linha "Não foi possível carregar a conversão por LP." em vermelho (`--accent-red`), sem quebrar o restante do `loadAll()` (o `catch` fica dentro de `loadConversion()`).
- Sem interação de clique: as linhas não abrem modal nem aplicam filtros (diferente de "Leads recentes") — é uma tabela somente-leitura nesta versão.
- Nenhum cálculo no front: visitantes, leads e taxa chegam prontos do `/api/conversion`; o JS da seção só formata e injeta HTML.
