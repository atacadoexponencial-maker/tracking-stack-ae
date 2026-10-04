-- Campanha com o e-mail escrito nela (spec-editor-email.md, módulo 8; issue 398).
-- `corpo` = documento de blocos; também guarda o conteúdo congelado no disparo
-- de campanha com modelo, para os lotes e o relatório usarem o e-mail que saiu.
-- `assunto` já existe (0055). Só adição: prévia e produção dividem o D1.
-- Aplicar com:
--   npx wrangler d1 execute tracking-ae-db --remote --file migrations/0061_email_campanhas_conteudo.sql
ALTER TABLE email_campanhas ADD COLUMN previa TEXT;
ALTER TABLE email_campanhas ADD COLUMN corpo TEXT;
