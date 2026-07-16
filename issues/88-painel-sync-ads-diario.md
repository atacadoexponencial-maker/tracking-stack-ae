# 88: Sync — resumo diário de ads (Meta + Google)

**Tipo:** Implementação
**Página:** —

## Descrição

Cron que puxa do endpoint JSON do Windsor o resumo diário por campanha (Meta Ads e
Google Ads) de cada cliente cadastrado e grava em ads_diario com upsert dos últimos 3 dias.
