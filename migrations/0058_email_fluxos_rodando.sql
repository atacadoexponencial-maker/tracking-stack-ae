-- Fluxos: publicar e rodar (spec-email-proprio.md, módulo 9; issue 386).
-- Só adição: prévia e produção dividem o mesmo D1.
-- Aplicar no remoto com `wrangler d1 execute tracking-ae-db --remote --file`
-- (NUNCA `d1 migrations apply --remote`).
-- Situações novas em email_fluxos.situacao: ativo | pausado.

ALTER TABLE email_fluxos ADD COLUMN publicado_em INTEGER;   -- quem disparou antes não entra
ALTER TABLE email_fluxos ADD COLUMN pausado_em INTEGER;     -- para empurrar as esperas ao retomar

-- Tudo o que aconteceu com alguém, lido das tabelas que o dash já grava.
-- `chave` = fonte + id na fonte: a mesma linha nunca entra duas vezes.
CREATE TABLE IF NOT EXISTS email_acontecimentos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    chave       TEXT NOT NULL UNIQUE,
    tipo        TEXT NOT NULL,         -- formulario | aplicacao | material | compra | agendou | cancelou | faltou | compareceu | grupo_entrou | grupo_saiu | crm | site | segmento | campanha
    email       TEXT,                  -- vazio quando não deu para ligar a um e-mail
    dados_json  TEXT NOT NULL DEFAULT '{}',
    quando      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_acont_tipo ON email_acontecimentos(tipo, quando);
CREATE INDEX IF NOT EXISTS idx_email_acont_email ON email_acontecimentos(email, tipo);

-- Até onde a rodada leu cada fonte.
CREATE TABLE IF NOT EXISTS email_fluxo_cursores (
    fonte    TEXT PRIMARY KEY,
    posicao  INTEGER NOT NULL DEFAULT 0
);

-- Quem está em cada segmento usado como gatilho (para descobrir quem entrou).
CREATE TABLE IF NOT EXISTS email_segmento_membros (
    segmento_id  INTEGER NOT NULL,
    contato_id   INTEGER NOT NULL,
    desde        INTEGER NOT NULL,
    PRIMARY KEY (segmento_id, contato_id)
);

-- Cada pessoa em cada fluxo (nunca entra duas vezes).
--   situacao: andando | esperando | concluiu | saiu
CREATE TABLE IF NOT EXISTS email_fluxo_pessoas (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    fluxo_id       INTEGER NOT NULL REFERENCES email_fluxos(id),
    contato_id     INTEGER NOT NULL REFERENCES email_contatos(id),
    no_atual       TEXT,
    situacao       TEXT NOT NULL DEFAULT 'andando',
    espera_ate     INTEGER,
    espera_json    TEXT,                -- condição da espera "até algo acontecer"
    tentativas     INTEGER NOT NULL DEFAULT 0,
    reservado_em   INTEGER,
    motivo_saida   TEXT,
    entrou_em      INTEGER NOT NULL,
    atualizado_em  INTEGER NOT NULL,
    UNIQUE (fluxo_id, contato_id)
);
CREATE INDEX IF NOT EXISTS idx_email_fluxo_pessoas_vez ON email_fluxo_pessoas(fluxo_id, situacao, espera_ate);
CREATE INDEX IF NOT EXISTS idx_email_fluxo_pessoas_contato ON email_fluxo_pessoas(contato_id);

-- O caminho de cada pessoa (números e histórico da 388).
CREATE TABLE IF NOT EXISTS email_fluxo_passos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pessoa_id  INTEGER NOT NULL,
    fluxo_id   INTEGER NOT NULL,
    no_id      TEXT,
    tipo       TEXT NOT NULL,           -- entrou | email | espera | desvio | objetivo | ir_fluxo | fim | saiu
    saida      TEXT,
    envio_id   INTEGER,
    detalhe    TEXT,
    em         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_fluxo_passos_pessoa ON email_fluxo_passos(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_email_fluxo_passos_no ON email_fluxo_passos(fluxo_id, no_id);
