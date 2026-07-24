# 141: `sendToClickUp` aceita tag opcional

**Tipo:** Implementação
**Página:** functions/tracker.js (backend)

## Descrição

Estender `sendToClickUp` para receber uma tag opcional e aplicá-la na task — na criação (campo `tags` do create) e via API de tags quando a task já existe (dedup/comentado). Sem tag, o comportamento atual permanece idêntico. Usado pelos leads do Meta com a tag `formulario-meta`. Referência: spec, "Componente 2 — Endpoint", passo 2.

## Cenários

### Happy Path
- **Lead inédito:** `sendToClickUp` cria a task já com `tags: [tag]` no body do POST — a tag aparece no card.
- **Lead que já existe (dedup):** além de comentar e mudar status, aplica a tag via `POST /task/{id}/tag/{tag}`.
- **Sem tag (chamada do `/tracker` do site):** nada muda — `tag` default `null`, nenhum `tags` no body, nenhuma chamada extra.

### Edge Cases
- Tag inexistente no Space: o ClickUp cria a tag ao aplicá-la (tanto no `tags` do create quanto no endpoint de tag). Best-effort.
- Fallback do 400 (create sem o campo whatsapp): o `tags` deve seguir junto nas DUAS tentativas de criação.

### Cenário de Erro
Falha ao aplicar a tag NUNCA trava o lead: envolvida em try/catch com `console.error`, seguindo o padrão best-effort do resto de `sendToClickUp` (o card/comentário e o `lead_dispatch` já garantem que nada se perde).

## Arquivos

- **Modificar:** `functions/tracker.js` — (1) adicionar `tag = null` à assinatura de `sendToClickUp`; (2) incluir `tags: [tag]` no body de `createTask` (ambas as tentativas) quando houver tag; (3) helper `addClickUpTag(taskId, tag, env)` best-effort para a task existente; (4) chamar o helper no ramo `if (existing)`. Reusa `clickupFetch`/`clickupWrite` já existentes.

## Checklist

- [x] `tag = null` na assinatura de `sendToClickUp`
- [x] Helper `addClickUpTag(taskId, tag, env)` (best-effort, try/catch)
- [x] `tags: [tag]` no body das duas tentativas de `createTask` (com e sem whatsapp)
- [x] Aplicar a tag no ramo `if (existing)` após o comentário
- [x] Chamada sem `tag` (fluxo do site) permanece byte-idêntica no comportamento
