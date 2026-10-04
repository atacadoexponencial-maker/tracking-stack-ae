-- Tipo de reunião de teste (crítica de UX de 04/10): some das listas da agenda
-- e da Agenda › E-mails, e não entra nos números. A página pública dele continua
-- funcionando. Aplicar com:
--   npx wrangler d1 execute tracking-ae-db --remote --file migrations/0059_agenda_tipos_teste.sql
ALTER TABLE agenda_tipos ADD COLUMN teste INTEGER NOT NULL DEFAULT 0;
