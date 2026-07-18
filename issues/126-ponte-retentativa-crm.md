# 126: Re-tentativa de envios ao ClickUp (dispatch-first)

**Tipo:** Implementação
**Página:** ponte tracking↔ClickUp

## Descrição

Caso Nicolau (17/07): lead sumiu em silêncio a caminho do ClickUp — sem card e sem log.
Solução dispatch-first: o tracker grava `pendente` com o payload completo ANTES de
tentar; o desfecho atualiza a linha (criado/comentado/falha, sucesso descarta o
payload). Varredor `/api/sync/crm-retry` (x-sync-secret) re-tenta pendente/falha com
>15 min, máx. 5 tentativas, 10 por execução — se o card já existia, o dedup vira
comentário (sem duplicar).

## Arquivos

- migrations/0021_lead_dispatch_retry.sql (lead_json, tentativas)
- functions/tracker.js (criarDispatchPendente/atualizarDispatch; sendToClickUp exportado)
- functions/api/sync/crm-retry.js (novo)
- cron VPS: 35 */6 * * * POST /api/sync/crm-retry
