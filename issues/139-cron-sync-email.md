# 139: Cron da VPS + doc do sync de email

**Tipo:** Implementação
**Página:** Ops / docs (`docs/ghl-email-sync.md`)

## Descrição

Documentar em `docs/ghl-email-sync.md` o comando de cron da VPS que chama `/api/sync/ghl-email` com o header `x-sync-secret` na cadência de 6/6h (espelhando `docs/ad-spend-sync.md`). A usuária adiciona o cron na VPS.
