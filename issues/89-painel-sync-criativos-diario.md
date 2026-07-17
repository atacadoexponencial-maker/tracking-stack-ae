# 89: Sync — criativos Meta Ads

**Tipo:** Implementação
**Página:** —

## Descrição

Puxar do Windsor o resumo diário por criativo (Meta Ads) e gravar em criativos_diario
com upsert dos últimos 3 dias.

## Resultado

- [x] Implementado em `painel/functions/api/sync/_core.js` (núcleo por fonte, isolamento de erro, sync_log) + `run.js` (cron externo, x-sync-secret — mesmo padrão do tracking) + `api/admin/sync.js` (botão "Sincronizar agora" e backfill)
- [x] Upsert idempotente; janela padrão 3 dias; campos validados contra o Windsor (facebook, google_ads, googleanalytics4)
- [x] Verificado em produção: sync sem secret 401; sync UP Semijoias ok nas 5 fontes; backfill jan–jul/2026 (~26k linhas, 0 erros); amostra do funil bate 1:1 com a API do Windsor (14/07: 1.491 sessões/11 pedidos)
