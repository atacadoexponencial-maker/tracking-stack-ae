# 92: Registro e status do sync

**Tipo:** Implementação
**Página:** Admin — Status

## Descrição

Registrar cada execução do sync em sync_log (fonte, cliente, resultado, linhas) e derivar
o status por conexão (ok / sem dados há 24h / erro) exibido no admin. Falha em uma fonte
não interrompe as demais.

## Resultado

- [x] Implementado em `painel/functions/api/sync/_core.js` (núcleo por fonte, isolamento de erro, sync_log) + `run.js` (cron externo, x-sync-secret — mesmo padrão do tracking) + `api/admin/sync.js` (botão "Sincronizar agora" e backfill)
- [x] Upsert idempotente; janela padrão 3 dias; campos validados contra o Windsor (facebook, google_ads, googleanalytics4)
- [x] Verificado em produção: sync sem secret 401; sync UP Semijoias ok nas 5 fontes; backfill jan–jul/2026 (~26k linhas, 0 erros); amostra do funil bate 1:1 com a API do Windsor (14/07: 1.491 sessões/11 pedidos)
