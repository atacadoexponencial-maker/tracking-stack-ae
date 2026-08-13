-- Ponte Greenn → ClickUp: guarda o id da task criada para cada venda paga.
--
-- NULL significa "ainda não virou card" — ou porque o evento não é uma venda
-- paga (reembolso, abandono), ou porque a ponte falhou. Como o raw_json íntegro
-- já está guardado desde a 0032, nenhuma venda se perde: o que não foi pontado
-- é encontrável e recuperável a qualquer momento com
--
--   SELECT id, entity_id FROM greenn_webhook_event
--   WHERE event = 'saleUpdated' AND current_status = 'paid'
--     AND clickup_task_id IS NULL;
--
-- Não há retry automático de propósito (ver spec 2026-08-13): o dado sustenta a
-- recuperação quando ela for necessária.
ALTER TABLE greenn_webhook_event ADD COLUMN clickup_task_id TEXT;

CREATE INDEX IF NOT EXISTS idx_greenn_sem_card
    ON greenn_webhook_event(current_status, clickup_task_id);
