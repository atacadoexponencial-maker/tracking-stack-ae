-- Issue 126: re-tentativa de envios ao ClickUp.
-- lead_json guarda o payload completo (lead + utms) enquanto o envio não
-- confirma — é o que permite re-tentar até sumiço silencioso (worker morto).
ALTER TABLE lead_dispatch ADD COLUMN lead_json TEXT;
ALTER TABLE lead_dispatch ADD COLUMN tentativas INTEGER NOT NULL DEFAULT 0;
