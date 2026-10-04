-- Biblioteca de imagens dos e-mails (spec-editor-email.md, módulo 4; issue 392).
-- Os bytes ficam no KV EMAIL_IMAGENS (chave = `chave`); aqui fica a ficha.
-- Apagar só marca `apagada_em`: os bytes ficam, porque e-mails já enviados
-- apontam para o endereço público. Só adição: prévia e produção dividem o D1.
-- Aplicar com:
--   npx wrangler d1 execute tracking-ae-db --remote --file migrations/0060_email_imagens.sql
CREATE TABLE IF NOT EXISTS email_imagens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    chave       TEXT NOT NULL UNIQUE,
    nome        TEXT NOT NULL,
    extensao    TEXT NOT NULL,
    mimetype    TEXT NOT NULL,
    largura     INTEGER NOT NULL,
    altura      INTEGER NOT NULL,
    tamanho     INTEGER NOT NULL,
    criada_em   INTEGER NOT NULL,
    apagada_em  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_email_imagens_ativas ON email_imagens(apagada_em, criada_em);
