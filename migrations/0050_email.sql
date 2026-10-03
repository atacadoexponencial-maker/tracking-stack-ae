-- E-mail próprio pelo Postmark (spec-email-proprio.md, módulos 1 e 8; issue 377).
-- Só adição: prévia e produção dividem o mesmo D1.
-- Aplicar no remoto com `wrangler d1 execute tracking-ae-db --remote --file`
-- (NUNCA `d1 migrations apply --remote`).

-- Configuração do envio: uma linha por campo.
CREATE TABLE IF NOT EXISTS email_config (
    chave          TEXT PRIMARY KEY,
    valor          TEXT,
    atualizado_em  INTEGER NOT NULL
);

INSERT OR IGNORE INTO email_config (chave, valor, atualizado_em) VALUES
    ('remetente_transacional_nome',  'Atacado Exponencial',                   strftime('%s', 'now')),
    ('remetente_transacional_email', 'notify@envio.atacadoexponencial.com',   strftime('%s', 'now')),
    ('remetente_marketing_nome',     'Felipe Santos | Atacado Exponencial',   strftime('%s', 'now')),
    ('remetente_marketing_email',    'felipe@news.atacadoexponencial.com',    strftime('%s', 'now')),
    ('resposta_transacional',        '',                                      strftime('%s', 'now')),
    ('resposta_marketing',           '',                                      strftime('%s', 'now')),
    ('rodape',                       '',                                      strftime('%s', 'now')),
    ('marketing_liberado',           '1',                                     strftime('%s', 'now'));

-- Cada e-mail mandado pelo dash.
CREATE TABLE IF NOT EXISTS email_envios (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id       TEXT UNIQUE,            -- ID do Postmark; nulo quando o envio falhou
    canal            TEXT NOT NULL,          -- transacional | marketing
    origem           TEXT NOT NULL,          -- teste | agenda | campanha | fluxo
    ref_id           TEXT,
    destinatario     TEXT NOT NULL,
    assunto          TEXT,
    situacao         TEXT NOT NULL,          -- enviado | falhou | entregue | aberto | clicado | voltou | voltou_temporario | spam | descadastrou
    erro             TEXT,
    enviado_em       INTEGER,
    entregue_em      INTEGER,
    aberto_em        INTEGER,
    clicado_em       INTEGER,
    voltou_em        INTEGER,
    spam_em          INTEGER,
    descadastrou_em  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_email_envios_origem ON email_envios(origem, enviado_em);
CREATE INDEX IF NOT EXISTS idx_email_envios_destinatario ON email_envios(destinatario);

-- Cada aviso recebido do Postmark. `chave` = tipo|MessageID|data|link (repetido é ignorado).
CREATE TABLE IF NOT EXISTS email_eventos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    chave         TEXT NOT NULL UNIQUE,
    message_id    TEXT,
    envio_id      INTEGER,
    tipo          TEXT NOT NULL,             -- entregue | aberto | clicado | voltou | voltou_temporario | spam | descadastrou
    stream        TEXT,                      -- outbound | broadcast
    ocorrido_em   INTEGER,
    recebido_em   INTEGER NOT NULL,
    detalhe_json  TEXT                       -- só link clicado, tipo de devolução, motivo de supressão
);
CREATE INDEX IF NOT EXISTS idx_email_eventos_message ON email_eventos(message_id);
CREATE INDEX IF NOT EXISTS idx_email_eventos_envio ON email_eventos(envio_id);
