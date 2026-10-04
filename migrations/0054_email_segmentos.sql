-- Segmentos de contatos (spec-email-proprio.md, módulo 5; issue 381).
-- Só adição: prévia e produção dividem o mesmo D1.
-- Aplicar no remoto com `wrangler d1 execute tracking-ae-db --remote --file`
-- (NUNCA `d1 migrations apply --remote`).

-- A regra é guardada, não a lista: quem está no segmento é recalculado a cada
-- leitura e na hora do disparo.
CREATE TABLE IF NOT EXISTS email_segmentos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nome           TEXT NOT NULL UNIQUE,
    regras_json    TEXT NOT NULL DEFAULT '[]',   -- [{ campo, op, valor }], combinadas com "e"
    criado_em      INTEGER NOT NULL,
    atualizado_em  INTEGER NOT NULL
);
