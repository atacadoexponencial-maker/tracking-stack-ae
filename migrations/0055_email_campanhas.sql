-- Campanhas de marketing (spec-email-proprio.md, módulo 6; issue 382).
-- Só adição: prévia e produção dividem o mesmo D1.
-- Aplicar no remoto com `wrangler d1 execute tracking-ae-db --remote --file`
-- (NUNCA `d1 migrations apply --remote`).

--   situacao: rascunho | enviando | enviada | falhou  (a 383 acrescenta agendada e cancelada)
CREATE TABLE IF NOT EXISTS email_campanhas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT NOT NULL,
    modelo_id       INTEGER,
    segmentos_json  TEXT NOT NULL DEFAULT '[]',
    situacao        TEXT NOT NULL DEFAULT 'rascunho',
    motivo          TEXT,                       -- por que falhou
    assunto         TEXT,                       -- assunto que saiu (guardado no disparo)
    total           INTEGER NOT NULL DEFAULT 0,
    enviados        INTEGER NOT NULL DEFAULT 0,
    falhas          INTEGER NOT NULL DEFAULT 0,
    disparada_em    INTEGER,
    concluida_em    INTEGER,
    criado_em       INTEGER NOT NULL,
    atualizado_em   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_campanhas_situacao ON email_campanhas(situacao);

-- Um destinatário por e-mail em cada campanha (quem está em dois segmentos
-- recebe uma vez). A situação de entrega fica em email_envios (envio_id).
--   situacao: pendente | enviando | enviado | falhou | nao_confirmado | nao_enviado
CREATE TABLE IF NOT EXISTS email_campanha_destinatarios (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    campanha_id    INTEGER NOT NULL REFERENCES email_campanhas(id),
    contato_id     INTEGER,
    email          TEXT NOT NULL,
    situacao       TEXT NOT NULL DEFAULT 'pendente',
    lote           TEXT,                        -- reserva do lote em andamento
    envio_id       INTEGER,
    motivo         TEXT,
    atualizado_em  INTEGER NOT NULL,
    UNIQUE (campanha_id, email)
);
CREATE INDEX IF NOT EXISTS idx_email_camp_dest_situacao ON email_campanha_destinatarios(campanha_id, situacao);
CREATE INDEX IF NOT EXISTS idx_email_camp_dest_lote ON email_campanha_destinatarios(lote);
