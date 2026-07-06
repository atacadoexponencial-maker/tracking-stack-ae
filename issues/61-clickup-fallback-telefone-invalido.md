# 61: Fallback na criação da task quando o ClickUp rejeita o telefone (400)

**Tipo:** Implementação
**Página:** backend ClickUp (`sendToClickUp`)

## Descrição

Bug de produção: no ramo de criação (lead inédito), `sendToClickUp` envia todos os
custom fields de uma vez. Quando o lead digita um telefone fora do padrão BR (caso
real: "+595 992 746080" com código do Paraguai → `toClickUpPhone` gera
"+55595992746080"), o campo phone do ClickUp rejeita e a API responde 400 — e a
task INTEIRA não é criada (lead caiu em `clickup_sync_failures` com
"ClickUp write 400"). Um campo torto não pode derrubar o lead todo.

Fix: se a criação falhar com 400 E o payload incluía o campo whatsapp, tentar UMA
vez sem o campo whatsapp, incluindo no body da task uma `description` com o
telefone cru para o comercial validar (ex.: "WhatsApp (não validado pelo ClickUp):
+595 992 746080"). Se a segunda tentativa também falhar, cai no catch existente
(log em `clickup_sync_failures` + alerta), como hoje.

## Cenários

### Happy Path
1. Telefone válido, API ok → fluxo atual intacto: 1 POST de criação com todos os
   custom fields, sem `description`.

### Edge Cases
- Telefone inválido (ClickUp responde 400) → segunda tentativa sem o campo
  whatsapp e com `description` contendo o telefone cru (`leadData.telefone`);
  task criada, lead não se perde.
- 400 por outra causa (payload sem whatsapp, ou 400 persiste sem o campo) →
  segunda tentativa (quando aplicável) também falha → catch atual: log em
  `clickup_sync_failures` + alerta WhatsApp.
- 429/5xx/erro de rede → retry transitório atual do `clickupWrite` continua
  valendo (o fallback só olha status 400).
- Ramo de task existente (dedup) → sem mudança nenhuma.

## Arquivos

- **Modificar:** `functions/tracker.js` — `clickupWrite` passa a anexar o `status`
  HTTP no `Error` lançado (hoje só vai na message); no ramo de criação do
  `sendToClickUp`, capturar erro com `status === 400` quando `custom_fields`
  inclui `CU_FIELD.whatsapp` e repetir UMA vez sem esse campo, com `description`
  com o telefone cru.

## Checklist

- [x] `clickupWrite` expõe `status` estruturado no erro (sem mudar retry/message)
- [x] Fallback no create: 400 + whatsapp presente → repete sem whatsapp + description com telefone cru
- [x] Segunda falha propaga pro catch existente (log D1 + alerta)
- [x] Caminho feliz e ramo de task existente inalterados
- [x] Verificação one-off com fetch stubado (2 POSTs no inválido, 1 no válido, failure log no 400 duplo) + `node --check`
