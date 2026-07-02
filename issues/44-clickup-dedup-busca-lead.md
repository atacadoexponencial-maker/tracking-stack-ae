# 44: `sendToClickUp` — dedup (busca lead por telefone OU email)

**Tipo:** Implementação
**Página:** ClickUp direto — remover n8n (transversal)

## Descrição

Em `functions/tracker.js`, criar a base da função `sendToClickUp` e a busca de dedup: normaliza o telefone e procura na lista `CLICKUP_LIST_ID` uma task pelo custom field de telefone; se não achar, tenta por email. Retorna a task existente ou `null`.

## Cenários

### Happy Path
1. `phoneE164 = '+' + normalizePhone(telefone, '55')` (reusa a função existente).
2. `GET /api/v2/list/{CLICKUP_LIST_ID}/task?custom_fields=[{"field_id":"754a41c9-2835-48d5-a70e-8b61841e0037","operator":"=","value":"<phoneE164>"}]` com header `Authorization: <CLICKUP_API_TOKEN>`.
3. Se `tasks[0]` existe → retorna essa task.
4. Se vazio e houver email → repete a busca com `field_id:"24f5a3d3-e21e-4e08-b396-8a4ce2133a98"`, `value:<email>`.
5. Retorna a task achada ou `null`.

### Edge Cases
- Telefone vazio → pula a busca por telefone e vai direto pra email.
- Email vazio → se as duas buscas não têm chave, retorna `null` (segue p/ criar).
- Mais de uma task casando → usar a primeira (`tasks[0]`), como o n8n faz.

### Cenário de Erro
- Falha/timeout na busca → tratar como "não achou" e deixar o fluxo seguir para criação (a issue 47 cobre retry/log das ESCRITAS; a busca é read-only e não pode travar o lead). Logar `console.error`.

## Arquivos

- **Modificar:** `functions/tracker.js` — adicionar `async function sendToClickUp({ leadData, sessionData, env })` (esqueleto + normalização + `searchClickUpTask(...)`); ainda sem criar/comentar (issues 45/46).

## Dependências Externas

- ClickUp API v2 — `GET /list/{list_id}/task` com filtro `custom_fields` (JSON array URL-encoded). Auth = token no header `Authorization` (sem "Bearer").

## Checklist

- [x] Adicionar helper `searchClickUpTask(fieldId, value, env)` que monta o GET e retorna `tasks[0] || null`
- [x] `sendToClickUp`: normalizar telefone → `+55…` reusando `normalizePhone`
- [x] Buscar por telefone; se vazio e houver email, buscar por email
- [x] Read-only nunca lança: try/catch → `console.error` e trata como "não achou"
