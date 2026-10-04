-- Fluxos automáticos de e-mail (spec-email-proprio.md, módulo 9; issue 385).
-- Só adição: prévia e produção dividem o mesmo D1.
-- Aplicar no remoto com `wrangler d1 execute tracking-ae-db --remote --file`
-- (NUNCA `d1 migrations apply --remote`).

--   situacao: rascunho  (a 386 acrescenta ativo e pausado)
CREATE TABLE IF NOT EXISTS email_fluxos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT NOT NULL,
    situacao        TEXT NOT NULL DEFAULT 'rascunho',
    arquivado       INTEGER NOT NULL DEFAULT 0,
    rascunho_json   TEXT NOT NULL,                -- quadro em edição: { nos, arestas, notas }
    versao          INTEGER NOT NULL DEFAULT 1,   -- sobe a cada salvamento (conflito entre abas)
    publicado_json  TEXT,                         -- versão no ar (386)
    criado_em       INTEGER NOT NULL,
    atualizado_em   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_fluxos_lista ON email_fluxos(arquivado, atualizado_em);
