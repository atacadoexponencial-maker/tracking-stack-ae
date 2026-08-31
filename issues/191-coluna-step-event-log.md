# 191: Coluna `step` na `event_log`

**Tipo:** Implementação
**Página:** banco (D1)
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`

## Descrição

Criar a migration `0034_event_log_step.sql` com `ALTER TABLE event_log ADD COLUMN step INTEGER`, para o evento `FormStep` guardar o número da etapa concluída. Fica `NULL` em todo evento que não seja `FormStep`, inclusive no histórico anterior.

## Por que assim

Neste projeto o `wrangler d1 migrations apply --remote` está quebrado (0021/0022/0025 estouram ao reaplicar): em produção a coluna vai por `wrangler d1 execute --remote --command`. O arquivo de migration existe para o banco local e para o histórico do schema. Precisa estar aplicada ANTES do deploy do código que grava o `step`.
