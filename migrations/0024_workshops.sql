-- Presença nos Workshops (feature: cruzamento Meet x Calendly no dashboard).
-- Alimentado por /api/sync/workshops (coletor Python na VPS via POST), lido por
-- /api/workshops. Mesmo padrão de ad_spend/email_campaign_stats: o dash lê daqui,
-- nunca toca Meet/Calendly no caminho da requisição.

-- Um registro por sessão de workshop detectada (conferenceRecord do Meet).
CREATE TABLE IF NOT EXISTS workshops (
    id                 TEXT PRIMARY KEY,   -- = meet_record_name (estável)
    title              TEXT,               -- título do evento Calendly casado
    started_at         TEXT,               -- ISO 8601 UTC, início do conferenceRecord
    ended_at           TEXT,               -- ISO 8601 UTC, fim
    calendly_event_uri TEXT,               -- URI do evento Calendly casado (nullable)
    meet_record_name   TEXT,               -- conferenceRecords/<id>
    synced_at          INTEGER NOT NULL     -- unix da última sincronização
);
CREATE INDEX IF NOT EXISTS idx_workshops_started_at ON workshops(started_at);

-- Inscritos vindos do Calendly (nome + email por evento).
CREATE TABLE IF NOT EXISTS workshop_registrants (
    workshop_id   TEXT NOT NULL,
    name          TEXT,
    email         TEXT NOT NULL,
    registered_at TEXT,                    -- ISO 8601 UTC (created_at do invitee)
    PRIMARY KEY (workshop_id, email)
);

-- Participantes vindos do Meet + resultado do casamento.
CREATE TABLE IF NOT EXISTS workshop_participants (
    workshop_id      TEXT NOT NULL,
    google_user_id   TEXT NOT NULL,        -- "users/<id>", estável entre workshops
    display_name     TEXT,
    total_minutes    INTEGER DEFAULT 0,    -- soma das participantSessions
    first_join       TEXT,                 -- ISO 8601 UTC
    last_leave       TEXT,                 -- ISO 8601 UTC
    registrant_email TEXT,                 -- NULL = "Sem inscrição"
    PRIMARY KEY (workshop_id, google_user_id)
);

-- Mapa de identidade acumulado (semeia a ponte futura com o CRM).
CREATE TABLE IF NOT EXISTS meet_identity_map (
    google_user_id TEXT PRIMARY KEY,
    email          TEXT,
    display_name   TEXT,
    first_seen     TEXT,
    last_seen      TEXT
);
