-- Campanhas agendadas (spec-email-proprio.md, módulos 5 e 6; issue 383).
-- Só adição: prévia e produção dividem o mesmo D1.
-- Aplicar no remoto com `wrangler d1 execute tracking-ae-db --remote --file`
-- (NUNCA `d1 migrations apply --remote`).
-- Situações novas em email_campanhas.situacao: agendada | cancelada.

ALTER TABLE email_campanhas ADD COLUMN agendada_para INTEGER;   -- horário do envio (unix)
ALTER TABLE email_campanhas ADD COLUMN cancelada_em INTEGER;
CREATE INDEX IF NOT EXISTS idx_email_campanhas_agenda ON email_campanhas(situacao, agendada_para);
