# 136: Sync GHL → D1 (/api/sync/ghl-email)

**Tipo:** Implementação
**Página:** Backend (`functions/api/sync/ghl-email.js`)

## Descrição

Criar o endpoint de sync protegido por `x-sync-secret` (padrão dos outros syncs) que lista as campanhas enviadas do GHL (API v3, `Version: v3`) e, pra cada uma, puxa o stats e faz upsert em `email_campaign_stats`. Usa `TOKEN_GHL`/`LOCAL_ID`; confere `res.ok`; uma campanha que falha não derruba o sync.
