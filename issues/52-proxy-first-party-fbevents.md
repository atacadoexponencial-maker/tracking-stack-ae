# 52: Proxy first-party do script do Pixel (fbevents.js)

**Tipo:** Implementação
**Página:** Módulo: Proxy first-party do script do Pixel (`functions/scripts/[[path]].js`)

## Descrição

Estender o módulo que hoje serve o script de analytics como first-party (`functions/scripts/[[path]].js`) para servir **também** o `fbevents.js` do Meta pelo mesmo caminho `/scripts/…` do próprio domínio, com cache, contornando bloqueadores que barram o domínio do Meta. O comportamento atual do script de analytics permanece intacto.

## Comportamentos

- Requisição ao caminho do script de analytics continua respondendo exatamente como hoje (nada muda para o analytics).
- Requisição ao novo caminho do script do Pixel devolve o conteúdo do `fbevents.js` do Meta, servido como arquivo do próprio domínio.
- Resposta do script do Pixel é entregue com tipo de conteúdo de script e é cacheada, respondendo do cache nas visitas seguintes enquanto válido (mesmo padrão do analytics).
- Se a busca na origem do Meta falhar, a resposta é um script vazio inofensivo (sem erro na página do visitante), no mesmo padrão do analytics.
- Qualquer outro caminho sob `/scripts/…` que não seja um dos dois scripts conhecidos não é proxiado para lugar nenhum (sem proxy aberto).

## Dependências

- Nenhuma. **Fazer primeiro** — as issues 53 e 54 dependem deste proxy para carregar o Pixel.

## Cenários

### Happy Path

1. O navegador solicita `GET /scripts/fbevents.js` (será referenciado pelo `BaseLayout.astro` na issue 53, ao lado do `<script async is:inline src="/scripts/gtag.js?id=...">` que já existe na linha ~34).
2. `functions/scripts/[[path]].js` (`onRequestGet`) extrai o nome do script do caminho da requisição (último segmento de `url.pathname`, via `context.params.path`).
3. O nome é `fbevents.js` → o handler monta a URL de origem fixa `https://connect.facebook.net/en_US/fbevents.js` (script estático, sem parâmetros — diferente do gtag, não há `?id=`).
4. Consulta o cache da edge (`caches.default`) com uma `cacheKey` baseada na URL de origem do Meta — mesmo padrão do gtag.
5. Cache miss → `fetch` na origem do Meta repassando o `User-Agent` do visitante (mesmo padrão do gtag).
6. Origem responde 200 → o corpo é devolvido com `Content-Type: application/javascript`, `Cache-Control: public, max-age=3600` e `Access-Control-Allow-Origin: *`, e a resposta é gravada no cache via `context.waitUntil(cache.put(...))`.
7. Visitas seguintes (enquanto o cache é válido) respondem direto do cache, sem tocar a origem do Meta.
8. Em paralelo, `GET /scripts/gtag.js?id=G-...` continua caindo no ramo do gtag e respondendo **exatamente** como hoje (mesmos corpos de fallback `// no measurement id`, `// fetch failed`, `// proxy error`, mesmos headers, mesma cacheKey).

### Edge Cases

- **Origem do Meta fora do ar / responde não-2xx:** `origin.ok` falso → responde `// fetch failed` com status 200 e `Content-Type: application/javascript`. A página do visitante não quebra; `fbq` simplesmente não existe (as chamadas das issues 53/54 já são protegidas por try/catch conforme `docs/page-types/lead-form-page.md`).
- **`fetch` lança exceção (rede, timeout):** capturado no `try/catch` → responde `// proxy error` com status 200, mesmo padrão do gtag.
- **Caminho desconhecido sob `/scripts/…`** (ex.: `/scripts/qualquer.js`, `/scripts/a/b.js`): responde `404` sem corpo de script e **sem nenhum fetch a origem externa** — elimina o comportamento atual em que qualquer caminho sob `/scripts/` servia o gtag, e garante que o módulo não vira proxy aberto.
- **Cache expirado (após 1h):** cache miss normal → refaz o fetch na origem e regrava; se a origem estiver fora nesse momento, cai no fallback de script vazio (a resposta de fallback não é cacheada, então a próxima visita tenta a origem de novo — igual ao gtag hoje).
- **`/scripts/fbevents.js` com query string qualquer:** ignorada; a URL de origem é fixa e a cacheKey é a URL do Meta, então variações de query não fragmentam o cache nem alteram a resposta.

### Cenário de Erro

- Toda falha na busca do `fbevents.js` (origem não-ok ou exceção) devolve um **script vazio inofensivo** (comentário JS, status 200, `Content-Type: application/javascript`) — o mesmo padrão já usado pelo ramo do gtag. O visitante nunca vê erro de console por script 4xx/5xx; o tracking server-side via `/tracker` segue sendo a via autoritativa.

## Arquivos

- **Modificar:** `functions/scripts/[[path]].js` — único arquivo tocado. Mudanças exatas:
  1. No início de `onRequestGet`, extrair o nome do script solicitado a partir do caminho (`context.params.path` — array do catch-all `[[path]]` do Pages — ou último segmento de `url.pathname`).
  2. Roteamento por nome de script:
     - `gtag.js` → executa o bloco atual (linhas 4–52) **sem nenhuma alteração de comportamento**: mesma leitura de `?id=`/`env.GA4_MEASUREMENT_ID`, mesma URL do googletagmanager, mesma cacheKey, mesmos headers e mesmos fallbacks byte a byte.
     - `fbevents.js` → novo ramo: URL de origem fixa `https://connect.facebook.net/en_US/fbevents.js`, sem exigir parâmetros; mesma sequência cache-match → fetch → resposta com `Content-Type: application/javascript` + `Cache-Control: public, max-age=3600` + `Access-Control-Allow-Origin: *` → `cache.put` via `waitUntil`; fallbacks `// fetch failed` / `// proxy error` com status 200.
     - Qualquer outro nome → `return new Response('Not found', { status: 404 })` — **não** proxia para lugar nenhum.
  3. A lógica compartilhada (cache + fetch + fallback) pode ser extraída para uma função interna reutilizada pelos dois ramos, desde que a resposta do gtag permaneça idêntica à atual (incluindo o fallback `// no measurement id`, exclusivo do gtag).

Nenhum outro arquivo é tocado nesta issue. O consumo no `src/layouts/BaseLayout.astro` (tag `<script>` do fbevents + `fbq('init', ...)`) é escopo da issue 53.

## Checklist

- [x] `functions/scripts/[[path]].js`: extrair o nome do script do caminho da requisição (via `context.params.path` / `url.pathname`)
- [x] Ramo `gtag.js`: comportamento atual preservado byte a byte (fallbacks `// no measurement id`, `// fetch failed`, `// proxy error`; headers; cacheKey na URL do googletagmanager)
- [x] Ramo `fbevents.js`: busca `https://connect.facebook.net/en_US/fbevents.js`, responde com `Content-Type: application/javascript`, `Cache-Control: public, max-age=3600` e `Access-Control-Allow-Origin: *`
- [x] Ramo `fbevents.js`: cache na edge (`caches.default` + `context.waitUntil(cache.put(...))`), respondendo do cache em visitas seguintes
- [x] Ramo `fbevents.js`: falha na origem (não-ok ou exceção) responde script vazio inofensivo com status 200, sem cachear o fallback
- [x] Qualquer outro caminho sob `/scripts/…` responde 404 sem fetch externo (sem proxy aberto)
- [x] Verificar localmente/preview: `curl -I /scripts/gtag.js?id=G-3C24BQVR59` (resposta idêntica à atual), `curl /scripts/fbevents.js` (retorna o conteúdo do fbevents com os headers acima) e `curl -I /scripts/foo.js` (404)
