# 49: Fiar `sendToClickUp` no fan-out do `/tracker` (substituir n8n)

**Tipo:** Implementação
**Página:** ClickUp direto — remover n8n (transversal)

## Descrição

No fan-out de leads do `functions/tracker.js`, substituir o destino `LEAD_WEBHOOK_URL` (n8n → ClickUp) por `sendToClickUp` em `context.waitUntil`, disparando para todos os funis exceto `workshop`. Ler as envs novas. Supabase, barramento WhatsApp e o ramo workshop seguem intactos.

## Cenários

### Happy Path
1. No bloco `if ((body.event_name || '').toLowerCase() === 'lead')`:
   - `workshop` → continua com `LEAD_WEBHOOK_URL_WORKSHOP` (n8n), como hoje.
   - qualquer outro funil → `context.waitUntil(sendToClickUp({ leadData, sessionData, fbc, externalId, env }))` **no lugar** do destino `{ url: primaryUrl }`.
2. Os destinos `LEAD_WEBHOOK_URL_CRM` (Supabase) e `LEAD_WEBHOOK_URL_WHATSAPP` (barramento) permanecem no `crmDestinations` sem mudança.

### Edge Cases
- `CLICKUP_API_TOKEN` ou `CLICKUP_LIST_ID` ausentes → `sendToClickUp` retorna cedo (skip), sem quebrar o `/tracker` (mesmo padrão do `sendToMeta`/`sendToGA4`).
- Funil workshop → NÃO chama `sendToClickUp` (fica no n8n nesta etapa).

### Cenário de Erro
- Coberto pelas issues 44–47 (dentro de `sendToClickUp`). O `/tracker` nunca falha por causa do ClickUp (tudo em `waitUntil`).

## Arquivos

- **Modificar:** `functions/tracker.js` — ajustar a montagem de `crmDestinations`/roteamento: remover o `{ url: primaryUrl }` para não-workshop e disparar `sendToClickUp`; manter `primaryUrl` só para workshop.

## Configuração (secrets no Cloudflare — não no front)

- `CLICKUP_API_TOKEN`, `CLICKUP_LIST_ID` (=`205126080`)
- `EVOLUTION_API_URL`, `EVOLUTION_APIKEY_ALERTA`, `EVOLUTION_NUMERO_ALERTA`, `EVOLUTION_APIKEY_NOTIF`, `EVOLUTION_NUMERO_NOTIF`

## Checklist

- [x] Rotear: workshop → n8n (`LEAD_WEBHOOK_URL_WORKSHOP`); demais → `sendToClickUp`
- [x] Remover `{ url: primaryUrl }` do fan-out para não-workshop (era o n8n→ClickUp)
- [x] Manter Supabase (`LEAD_WEBHOOK_URL_CRM`) e barramento (`LEAD_WEBHOOK_URL_WHATSAPP`) intactos
- [x] `sendToClickUp` faz skip se faltar `CLICKUP_API_TOKEN`/`CLICKUP_LIST_ID`
- [ ] Documentar as envs novas (setar no Cloudflare preview+prod antes do deploy) *(deploy — pendente)*
- [ ] Pós-validação: remover `LEAD_WEBHOOK_URL` + desligar o workflow n8n do ClickUp *(pós-deploy — pendente)*
