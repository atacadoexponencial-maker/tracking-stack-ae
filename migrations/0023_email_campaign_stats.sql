-- Cache de estatística por campanha de email do GoHighLevel (feature #3 — aba
-- Email do dash). Alimentado por /api/sync/ghl-email (cron da VPS), lido por
-- /api/email-campaigns. Mesmo padrão do ad_spend do Meta: o dash lê daqui, nunca
-- toca o GHL no caminho da requisição.
CREATE TABLE IF NOT EXISTS email_campaign_stats (
    source_id TEXT PRIMARY KEY,        -- sourceId da campanha (usado no endpoint de stats)
    campaign_id TEXT,                  -- id da campanha
    name TEXT,
    subject TEXT,
    from_email TEXT,
    status TEXT,
    sent_at TEXT,                      -- ISO do updatedAt da campanha enviada (data de envio)
    sent INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    opened INTEGER DEFAULT 0,
    clicked INTEGER DEFAULT 0,
    bounced INTEGER DEFAULT 0,          -- permanentFail + temporaryFail
    unsubscribed INTEGER DEFAULT 0,
    complained INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    synced_at INTEGER NOT NULL          -- unix da última sincronização
);
CREATE INDEX IF NOT EXISTS idx_email_campaign_sent_at ON email_campaign_stats(sent_at);
