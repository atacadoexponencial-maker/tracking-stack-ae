# Spec: Higienização anti-scanner do tracking (2 camadas)

## Visão Geral

Scanners de vulnerabilidade varrem o site em busca de brechas conhecidas — requisitam milhares de paths que não existem (`/wp-admin/setup-config.php`, `/.env`, `/admin.php`, `/.git/HEAD`, etc.) e todos retornam **404**. Como o middleware de tracking (`functions/_middleware.js`) grava uma sessão no D1 para **toda** requisição de página, cada hit desses vira uma linha em `sessions` com `landing_url` lixo. O resultado prático: a tabela "Conversão por LP" do dashboard fica poluída com dezenas de paths de scanner, com visitantes inflados e taxa 0%.

O filtro de bots atual (lista `BOT_UA_SUBSTRINGS` em `functions/api/conversion.js`, replicada do `detectBot` do tracker) não resolve, por dois motivos observados em produção:

1. Muitos scanners usam User-Agent de **Chrome real** — indistinguível de visitante legítimo pelo UA.
2. Os que se identificam usam UAs como `TLM-Audit-Scanner/1.0` e `pathscan/1.0`, que **não** casam com nenhuma substring da lista atual (`scanner`/`pathscan` não contêm `bot`, `crawler`, `spider`, `scraper`...).

A solução tem **2 camadas**, em exatamente 2 módulos:

- **Camada 1 — na origem (`functions/_middleware.js`):** parar de gravar sessão quando a página respondida é 404. Scanner pede path inexistente → 404 → nenhuma linha nova no D1. Ataca a causa para os dados futuros, independente do UA.
- **Camada 2 — na leitura (`functions/api/conversion.js`):** o histórico já poluído **não será apagado** (regra: nada de deletar dados). O endpoint de conversão passa a (a) excluir das rows os paths que não são páginas do site (ponto em algum segmento — extensão de arquivo ou diretório oculto — ou prefixo `/wp-`) e (b) reconhecer `scan` como substring de bot, cobrindo `scanner` e `pathscan`.

Restrições respeitadas:
- `functions/tracker.js` **não** é alterado (a lista de bot do conversion continua sendo réplica manual + adição local documentada).
- Nenhuma migration; nenhum dado histórico deletado — a higienização do passado é só no read path.
- Toda a lógica no backend; o dashboard não muda (só passa a receber rows limpas).
- Cookies, headers, atribuição (fbc/fbp/UTMs/funnel) e todo o resto do comportamento do middleware permanecem intactos.

## Páginas / Módulos

### Módulo 1: Middleware de tracking (`functions/_middleware.js`)

**Descrição:** O middleware hoje serve a página primeiro (`const response = await next()`, linha ~86), anexa os `Set-Cookie` numa `newResponse` e depois agenda o UPSERT em `sessions` dentro de `context.waitUntil(...)` (linha ~108). A mudança é uma só: condicionar esse UPSERT ao status da resposta — se a página respondida for **404**, o bloco do `waitUntil` não grava nada no D1. O objeto `response` já está disponível no ponto da decisão; basta checar `response.status !== 404` como guarda do UPSERT (a checagem pode envolver o próprio `context.waitUntil` ou o `env.DB` interno — o essencial é que nenhuma escrita em `sessions` aconteça no 404).

**Componentes:**
- `onRequest(context)`: único export; ganha a guarda de status 404 em volta do UPSERT em `sessions`.
- Comentário pt-BR junto à guarda explicando o porquê: scanners de vulnerabilidade tomam 404 em massa e não devem virar sessão.

**Comportamentos:**
- Requisição de página cuja resposta do `next()` tem `status === 404` **não** executa o UPSERT em `sessions` — nenhuma linha criada nem atualizada no D1.
- Somente 404 é excluído. Resposta `500` (ou qualquer outro status de erro) **continua gravando sessão** normalmente: um visitante real que pegou um erro transitório ainda deve ter atribuição quando voltar.
- Respostas 200/3xx/etc. seguem exatamente o fluxo atual: UPSERT com todos os campos (fbclid, gclid, msclkid, fbc, fbp, IP, UA, referrer, landing_url, UTMs, funnel, timestamps) e semântica first-touch do `ON CONFLICT` inalterada.
- Cookies (`_krob_sid`, `_krob_eid`, `_fbp`, `_fbc` quando houver) continuam sendo setados **inclusive na resposta 404** — só a escrita no D1 é suprimida; headers, status e body da resposta não mudam em nada.
- Visitante real que cai numa página 404 do site também não gera sessão — **aceitável e desejado**: uma página inexistente não é landing page de campanha, e se ele navegar em seguida para uma página real, a sessão é criada ali (mesmo `_krob_sid`, já setado pelo cookie).
- Sessão já existente cujo dono revisita e toma um 404 **não é atualizada** (nem `updated_at`, nem merge de UTMs daquele hit) — ok: o hit 404 não carrega informação de atribuição que valha registrar.
- O filtro `isPageRequest` (extensões estáticas, `/tracker`, `/api/`, `/dash`, etc.) permanece como está; a nova guarda atua **depois** dele, apenas sobre requisições que já passariam a gravar sessão.
- O `try/catch` com `console.error('Middleware D1 error: ...')` dentro do `waitUntil` permanece protegendo a escrita quando ela acontece.

### Módulo 2: Endpoint de conversão por LP (`functions/api/conversion.js`)

**Descrição:** Duas mudanças cirúrgicas no read path para higienizar o histórico já poluído, sem tocar em dado nenhum: um filtro de paths que não são páginas do site (aplicado em JS, sobre o path já normalizado) e uma substring extra na lista de bots usada nas cláusulas `NOT LIKE` do SQL.

**Componentes:**
- Filtro de path não-página: predicado aplicado **após** `normalizePath(row.landing_url)` e **antes** de acumular no `byPath` / montar `rows` — o path excluído simplesmente não entra no resultado (nem em `visitors`, nem em `leads`, nem como linha). Duas regras em **OU**: (1) algum segmento do path contém ponto (na prática: extensão de arquivo no último segmento, como `.php`/`.env`, ou diretório oculto como `.git` em `/.git/HEAD`); (2) o path começa com `/wp-`.
- `BOT_UA_SUBSTRINGS`: ganha a entrada `'scan'`, com comentário pt-BR registrando que é uma adição **ALÉM** da lista replicada do `detectBot` de `functions/tracker.js` (que não pode ser alterado), motivada pelos UAs `TLM-Audit-Scanner/1.0` e `pathscan/1.0` vistos em produção — `'scan'` cobre ambos por ser substring de `scanner` e de `pathscan`.

**Comportamentos:**
- Path com **ponto em algum segmento** é excluído das rows: `/wp-admin/setup-config.php` (ponto no último segmento — extensão `.php`), `/.env` e `/admin.php` (idem), `/.git/HEAD` (ponto no segmento `.git`, embora o último segmento `HEAD` não tenha ponto). Nota de decisão: o escopo enunciou a regra como "último segmento contém ponto" citando `/.git/HEAD` entre os exemplos; como o ponto desse exemplo está no primeiro segmento, a spec fixa o predicado como "ponto em **qualquer** segmento" — é o menor predicado que cobre todos os exemplos citados, e nenhuma página legítima do site (Astro, URLs limpas) tem ponto no path.
- Path que **começa com `/wp-`** é excluído: cobre `/wp-admin/` (que, normalizado pelo `normalizePath`, vira `/wp-admin` — sem ponto em segmento nenhum, por isso precisa da regra própria) e todo o ecossistema WordPress (`/wp-login.php`, `/wp-content/...`), que este site não tem.
- A raiz `'/'` **nunca** é excluída: não tem ponto em segmento nenhum e não começa com `/wp-`.
- O bucket `'(sem página)'` (landing_url nula/vazia/malformada) **continua existindo** nas rows: o predicado de exclusão só se aplica a paths reais (strings começando com `/` devolvidas pelo `normalizePath`); o rótulo `'(sem página)'` passa direto para o resultado como hoje.
- Paths legítimos do site (`/`, `/lives-semanais-v1`, `/consultoria-gratuita-atacado`, `/obrigado`, etc.) não casam com nenhuma das regras e aparecem normalmente.
- A exclusão é por linha do resultado, **não** por sessão no banco: nenhuma escrita, nenhum DELETE — sessões de scanner do histórico continuam no D1, apenas não aparecem na tabela do dashboard.
- Com `'scan'` na `BOT_UA_SUBSTRINGS`, sessões com UA contendo `scan` (case-insensitive, semântica do `LIKE` do SQLite para ASCII) saem do denominador e, por consequência, do numerador — `TLM-Audit-Scanner/1.0` e `pathscan/1.0` deixam de contar como visitantes em **qualquer** LP, inclusive nas legítimas que eles às vezes atingem.
- A geração das cláusulas SQL (`AND s.user_agent NOT LIKE '%scan%'`) continua vindo da lista estática do módulo — nenhum input de request entra na string; sem risco de injeção, como já documentado no comentário existente.
- Ordenação, formato de resposta (`{ days, funnel, rows }`), autenticação por `DASH_KEY`, filtro `&funnel=` e período `days`/`from`/`to` permanecem idênticos.
- O comentário de cabeçalho da lista ("Replicado de detectBot()... manter em sincronia manualmente") permanece válido para as entradas replicadas; a entrada `'scan'` fica visivelmente separada/anotada como adição local para não confundir uma futura ressincronização com o tracker.
