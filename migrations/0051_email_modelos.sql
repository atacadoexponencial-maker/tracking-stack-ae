-- Modelos de e-mail (spec-email-proprio.md, módulo 2; issue 378).
-- Só adição: prévia e produção dividem o mesmo D1.
-- Aplicar no remoto com `wrangler d1 execute tracking-ae-db --remote --file`
-- (NUNCA `d1 migrations apply --remote`).

CREATE TABLE IF NOT EXISTS email_modelos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nome           TEXT NOT NULL,             -- nome interno
    canal          TEXT NOT NULL,             -- transacional | marketing
    assunto        TEXT NOT NULL DEFAULT '',
    previa         TEXT NOT NULL DEFAULT '',  -- texto de pré-visualização da caixa de entrada
    corpo          TEXT NOT NULL DEFAULT '',  -- **negrito**, [texto](link), [[Botão | link]]
    arquivado      INTEGER NOT NULL DEFAULT 0,
    criado_em      INTEGER NOT NULL,
    atualizado_em  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_modelos_canal_nome ON email_modelos(canal, nome);
