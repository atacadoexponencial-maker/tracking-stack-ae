# 121: ponte webhook clickup

**Tipo:** Implementação
**Página:** ponte tracking↔ClickUp

## Descrição

/webhook/clickup: valida X-Signature (secret em config_kv), grava crm_status_log; /api/crm-setup registra o webhook via API (idempotente, endpoint parametrizável).

## Arquivos

functions/webhook/clickup.js, functions/api/crm-setup.js

## Status

- [x] Implementado e commitado (d4c4048); validado no preview o que não depende de secret de produção
