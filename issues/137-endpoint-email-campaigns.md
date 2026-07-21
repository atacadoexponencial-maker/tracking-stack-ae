# 137: Endpoint de leitura /api/email-campaigns

**Tipo:** Implementação
**Página:** Backend (`functions/api/email-campaigns.js`)

## Descrição

Criar o endpoint de leitura protegido por `?key=`=`DASH_KEY` que lê só do D1 (`email_campaign_stats`), filtra por `sent_at` no período (`from`/`to`, default 30 dias) e devolve array ordenado por `sent_at` desc com as contagens + taxas calculadas (abertura=opened/delivered, etc.; delivered=0 → taxa nula).
