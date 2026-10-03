-- Contatos de marketing (spec-email-proprio.md, módulo 4; issue 380).
-- Só adição: prévia e produção dividem o mesmo D1.
-- Aplicar no remoto com `wrangler d1 execute tracking-ae-db --remote --file`
-- (NUNCA `d1 migrations apply --remote`).

-- Um contato por e-mail. Funil e origem são os da primeira entrada.
--   situacao: ativo | invalido | descadastrado | voltou | denunciou
--   situacao_por: lead | equipe | servico | sistema
CREATE TABLE IF NOT EXISTS email_contatos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT NOT NULL UNIQUE,
    nome           TEXT,
    funil          TEXT,
    origem         TEXT,
    situacao       TEXT NOT NULL DEFAULT 'ativo',
    situacao_em    INTEGER,
    situacao_por   TEXT,
    nome_buscado   INTEGER NOT NULL DEFAULT 0,   -- o ClickUp já foi consultado
    entrou_em      INTEGER NOT NULL,
    atualizado_em  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_contatos_situacao ON email_contatos(situacao);
CREATE INDEX IF NOT EXISTS idx_email_contatos_entrou ON email_contatos(entrou_em);

-- Cada formulário que a pessoa preencheu (um Lead do event_log).
CREATE TABLE IF NOT EXISTS email_contatos_entradas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    contato_id  INTEGER NOT NULL REFERENCES email_contatos(id),
    event_id    TEXT NOT NULL UNIQUE,
    funil       TEXT,
    origem      TEXT,
    material    TEXT,
    entrou_em   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_contatos_entradas_contato ON email_contatos_entradas(contato_id);
CREATE INDEX IF NOT EXISTS idx_email_contatos_entradas_funil ON email_contatos_entradas(funil);
