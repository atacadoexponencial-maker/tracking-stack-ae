# 57: Middleware não grava sessão quando a resposta é 404

**Tipo:** Implementação
**Página:** Módulo: Middleware de tracking (`functions/_middleware.js`)

## Descrição

Condicionar o UPSERT em `sessions` ao status da resposta servida: se a página respondida pelo `next()` for **404**, o bloco do `context.waitUntil(...)` não grava nada no D1. Scanners de vulnerabilidade que varrem paths inexistentes (`/wp-admin/setup-config.php`, `/.env`, `/.git/HEAD`, etc.) tomam 404 em massa e deixam de virar linhas lixo em `sessions` — independente do User-Agent que usem.

## Comportamentos

- Requisição de página cuja resposta do `next()` tem `status === 404` **não** executa o UPSERT em `sessions` — nenhuma linha criada nem atualizada no D1.
- Somente 404 é excluído. `500` (ou qualquer outro status de erro) **continua gravando sessão** normalmente: visitante real com erro transitório ainda deve ter atribuição quando voltar.
- Respostas 200/3xx/etc. seguem exatamente o fluxo atual: UPSERT com todos os campos (fbclid, gclid, msclkid, fbc, fbp, IP, UA, referrer, landing_url, UTMs, funnel, timestamps) e semântica first-touch do `ON CONFLICT` inalterada.
- Cookies (`_krob_sid`, `_krob_eid`, `_fbp`, `_fbc` quando houver) continuam sendo setados **inclusive na resposta 404** — só a escrita no D1 é suprimida; headers, status e body da resposta não mudam em nada.
- Visitante real que cai numa página 404 também não gera sessão — aceitável e desejado: página inexistente não é landing page de campanha; se ele navegar para uma página real em seguida, a sessão é criada ali (mesmo `_krob_sid`, já setado pelo cookie).
- Sessão existente cujo dono revisita e toma 404 **não é atualizada** (nem `updated_at`, nem merge de UTMs daquele hit).
- O filtro `isPageRequest` (extensões estáticas, `/tracker`, `/api/`, `/dash`, etc.) permanece como está; a nova guarda atua **depois** dele, apenas sobre requisições que já gravariam sessão.
- O `try/catch` com `console.error('Middleware D1 error: ...')` dentro do `waitUntil` permanece protegendo a escrita quando ela acontece.
- Comentário pt-BR junto à guarda explicando o porquê: scanners de vulnerabilidade tomam 404 em massa e não devem virar sessão.

## Dependências

- Nenhuma. Independente da issue 58 — podem ser feitas em qualquer ordem.

## Plano de implementação

### Fluxo real hoje (confirmado em `functions/_middleware.js`)

A ordem atual já é a ideal para esta mudança — **nenhum rearranjo é necessário**:

1. **Linhas 8–20:** filtro `isPageRequest` (extensões estáticas, `/tracker`, `/analytics`, `/scripts/`, `/webhook/`, `/checkout-session`, `/api/`, `/dash`). Se não for página, `return next()` direto — esses paths seguem fora, como hoje.
2. **Linhas 26–83:** extração de fbclid/gclid/msclkid, UTMs, `funnel`, cookies, geração de `sessionId`/`externalId`/`fbc`/`fbp`, metadata (IP/UA/referrer).
3. **Linha 86:** `const response = await next();` — a resposta (e portanto `response.status`) é obtida **antes** de qualquer agendamento de escrita.
4. **Linhas 88–105:** monta `newHeaders` com os `Set-Cookie` e cria `newResponse` preservando `status`/`statusText`/`body`.
5. **Linhas 107–133:** `context.waitUntil((async () => { try { if (env.DB) { UPSERT em sessions } } catch { console.error('Middleware D1 error: ...') } })())` — agendado **depois** do `next()`, com `response` já em escopo.
6. **Linha 135:** `return newResponse;`

Como o `waitUntil` é agendado depois do `next()`, `response.status` está disponível no ponto exato da decisão. Não capturar status de outra forma, não mover o `next()`.

### Mudança exata (mínima)

Envolver **apenas a chamada `context.waitUntil(...)`** (linhas 107–133) num `if`:

```js
  // --- D1 UPSERT (background, non-blocking) ---
  // Não gravar sessão quando a página respondida é 404: scanners de
  // vulnerabilidade varrem paths inexistentes (/wp-admin, /.env, /.git/HEAD...)
  // e tomam 404 em massa — não devem virar linhas lixo em `sessions`.
  // Somente 404 é excluído; 500 e afins continuam gravando (visitante real
  // com erro transitório ainda merece atribuição). Cookies já foram setados
  // acima, então o mesmo _krob_sid cria a sessão se ele navegar p/ página real.
  if (response.status !== 404) {
    context.waitUntil(
      (async () => { /* ...bloco atual inalterado, só reindentado... */ })()
    );
  }
```

- O corpo do IIFE (try/catch, `if (env.DB)`, SQL do UPSERT, `.bind(...)`) fica **byte a byte igual**, apenas reindentado um nível.
- Nada muda em `newResponse`, cookies, `isPageRequest` ou nas funções auxiliares.
- Preferir envolver o próprio `waitUntil` (em vez de um `if` dentro do IIFE): mais barato (nem agenda a task) e deixa a guarda visível no nível do fluxo.

### Decisão sobre 3xx

Redirects **gravam sessão** (comportamento atual mantido — a guarda é `!== 404`, não `< 400` nem `=== 200`). Justificativa: um 308 de trailing slash (ex.: `/lives-semanais-v1` → `/lives-semanais-v1/`) é o primeiro hit real do visitante e carrega a query string com fbclid/UTMs — perder esse hit poderia perder atribuição se o follow-up não repetir os params. Nota: `/dash` → `/dash/` nem chega aqui (excluído pelo `isPageRequest`). O UPSERT duplo (308 + 200 seguinte) é inofensivo: mesmo `session_id`, `ON CONFLICT` first-touch resolve.

## Cenários

### Happy Path

1. Visitante real requisita `GET /lives-semanais-v1?fbclid=X` → `next()` responde 200 → UPSERT acontece exatamente como hoje, com todos os campos de atribuição e `ON CONFLICT` first-touch intacto.
2. Scanner requisita `GET /wp-admin/setup-config.php` → passa pelo `isPageRequest` (sem extensão bloqueada, sem prefixo excluído) → `next()` responde 404 → guarda impede o UPSERT → **nenhuma** linha nova em `sessions`; a resposta 404 sai com status/headers/body intactos **e** os `Set-Cookie` normais (`_krob_sid`, `_krob_eid`, `_fbp`, `_fbc` se houver).

### Edge Cases

- **Visitante real digita URL errada (404):** sem sessão naquele hit — aceitável e documentado: página inexistente não é landing page de campanha. Ao navegar para página real em seguida, a sessão é criada lá com o **mesmo** `_krob_sid` (cookie já setado na resposta 404).
- **Redirect 308/3xx em página real (ex.: trailing slash):** grava sessão — fluxo atual inalterado (ver "Decisão sobre 3xx" acima).
- **`/dash` → `/dash/` (308):** nem entra no fluxo — `/dash` é excluído pelo `isPageRequest` antes de tudo, como hoje.
- **Paths excluídos do middleware** (`/api/*`, `/webhook/*`, `/tracker`, `/analytics`, `/scripts/*`, `/checkout-session`, `/dash*`, assets por extensão): seguem com `return next()` imediato, sem cookies e sem UPSERT — nenhuma mudança.
- **Resposta 500:** sessão **é** gravada (só 404 é excluído); visitante real com erro transitório mantém atribuição.
- **Dono de sessão existente revisita e toma 404:** nenhum UPDATE (nem `updated_at`, nem merge de UTMs daquele hit).

### Cenário de Erro

- **D1 falha durante um UPSERT que acontece (status ≠ 404):** capturado pelo `try/catch` existente dentro do `waitUntil`, logado como `Middleware D1 error: ...` — comportamento atual preservado, resposta ao visitante não é afetada.

## Arquivos

- **Modificar:** `functions/_middleware.js` — único arquivo tocado. Mudança única e mínima: `if (response.status !== 404) { ... }` envolvendo a chamada `context.waitUntil(...)` (linhas 107–133), com comentário pt-BR explicando o porquê; corpo do IIFE inalterado (só reindentado). `response` já está em escopo (obtido na linha 86, antes do agendamento) — não reordenar nada.
- **Não tocar:** `functions/tracker.js`, `functions/api/conversion.js`, `migrations/`, dashboard, funções auxiliares do próprio middleware (`parseCookies`, `getRawParam`, `extractFbcPayload`, `computeSubDomainIndex`).

## Checklist

- [x] Guarda `if (response.status !== 404)` em volta do `context.waitUntil(...)` (não dentro do IIFE), com comentário pt-BR explicando: scanners tomam 404 em massa e não devem virar sessão
- [x] Corpo do UPSERT (SQL, `.bind(...)`, `if (env.DB)`, `try/catch` com `Middleware D1 error:`) permanece byte a byte igual, apenas reindentado
- [x] `isPageRequest` e o restante do fluxo (extração de params, cookies, `newResponse`) intocados
- [x] Nenhum outro arquivo modificado (`git status` mostra só `functions/_middleware.js`)
- [x] Teste local — subir com `npx wrangler pages dev` (na raiz do repo) e, com o servidor de pé:
  - [x] `curl -si "http://localhost:8788/lives-semanais-v1?fbclid=TESTE404" | grep -i "set-cookie\|HTTP/"` → 200 com `Set-Cookie: _krob_sid=...` etc.
  - [x] `npx wrangler d1 execute tracking-ae-db --local --command "SELECT session_id, landing_url FROM sessions ORDER BY created_at DESC LIMIT 5"` → sessão da página real criada
  - [x] `curl -si "http://localhost:8788/wp-admin/setup-config.php" | grep -i "set-cookie\|HTTP/"` → 404 **com** os mesmos `Set-Cookie`
  - [x] Repetir o SELECT → **nenhuma** linha nova para `/wp-admin/setup-config.php` (contagem de `sessions` igual à anterior)
  - [x] `curl -si "http://localhost:8788/.env"` e `http://localhost:8788/nao-existe` → 404 sem linha nova (obs.: `/.env` não casa com a regex de extensões — `env` não está na lista — então passa pelo `isPageRequest` e depende da guarda)
- [ ] (Opcional, produção) após deploy: conferir no D1 remoto que hits 404 de scanner param de gerar linhas novas em `sessions`
