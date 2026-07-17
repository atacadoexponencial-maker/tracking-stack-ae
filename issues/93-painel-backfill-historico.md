# 93: Backfill histórico

**Tipo:** Implementação
**Página:** —

## Descrição

Rotina manual (endpoint admin) que importa o histórico retroativo de todas as fontes de
um cliente recém-cadastrado (mínimo 6 meses, respeitando o que o Windsor entregar).

## Resultado

- [x] Implementado em `painel/functions/api/sync/_core.js` (núcleo por fonte, isolamento de erro, sync_log) + `run.js` (cron externo, x-sync-secret — mesmo padrão do tracking) + `api/admin/sync.js` (botão "Sincronizar agora" e backfill)
- [x] Upsert idempotente; janela padrão 3 dias; campos validados contra o Windsor (facebook, google_ads, googleanalytics4)
- [x] Verificado em produção: sync sem secret 401; sync UP Semijoias ok nas 5 fontes; backfill jan–jul/2026 (~26k linhas, 0 erros); amostra do funil bate 1:1 com a API do Windsor (14/07: 1.491 sessões/11 pedidos)
