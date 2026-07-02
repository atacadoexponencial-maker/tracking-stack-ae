# 46: `sendToClickUp` — task existente (status + comentário)

**Tipo:** Implementação
**Página:** ClickUp direto — remover n8n (transversal)

## Descrição

Quando o dedup (issue 44) achar task existente, mudar o status para `LEADS DE ENTRADA` e adicionar um comentário "Lead Voltou ao CRM" com os dados novos, no formato do fluxo n8n atual.

## Cenários

### Happy Path
1. `PUT /api/v2/task/{taskId}` body `{ status: "LEADS DE ENTRADA" }`.
2. `POST /api/v2/task/{taskId}/comment` body `{ comment_text }` onde `comment_text`:
   ```
   Lead Voltou ao CRM:

   Novos Dados:
   Nome: {nome}
   Telefone: {phoneE164}
   E-mail: {email}
   Instagram: {instagram}
   Faturamento: {faturamento}

   {utm_source} - {utm_medium} - {utm_content}
   ```
3. Retorna sinal de "existente" (para a issue 48 notificar "Voltou ao CRM").

### Edge Cases
- Status `LEADS DE ENTRADA` inexistente na lista → o PUT falha; tratar via issue 47 (não pode travar o comentário). O comentário é o dado que não pode se perder.
- Campos vazios no comentário → deixar a linha mesmo assim (fiel ao n8n) ou omitir; manter simples e fiel ao formato atual.

### Cenário de Erro
- Falha no comentário (escrita principal) → issue 47 (retry + log em `clickup_sync_failures` + alerta).

## Arquivos

- **Modificar:** `functions/tracker.js` — no `sendToClickUp`, ramo "achou": `updateClickUpStatus(taskId, env)` + `commentClickUpTask(taskId, text, env)`.

## Dependências Externas

- ClickUp API v2 — `PUT /task/{id}` (status) e `POST /task/{id}/comment` (`comment_text`).

## Checklist

- [x] `updateClickUpStatus(taskId, env)` → PUT status `LEADS DE ENTRADA`
- [x] `commentClickUpTask(taskId, text, env)` → POST comentário
- [x] Montar o texto do comentário no formato acima
- [x] Tratar o comentário como a escrita "principal" que não pode se perder (feed p/ issue 47)
