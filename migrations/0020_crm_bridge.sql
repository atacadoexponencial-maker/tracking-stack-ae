-- Ponte tracking ↔ ClickUp (spec 2026-07-17).
-- lead_dispatch: resultado do envio de cada lead ao ClickUp (novo × retorno × falha).
CREATE TABLE IF NOT EXISTS lead_dispatch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT,                     -- event_id do Lead no event_log
    email TEXT,
    phone TEXT,
    funnel TEXT,
    resultado TEXT NOT NULL,           -- 'criado' | 'comentado' | 'falha'
    task_id TEXT,
    task_url TEXT,
    erro TEXT,
    criado_em INTEGER NOT NULL         -- unix seconds
);
CREATE INDEX IF NOT EXISTS idx_lead_dispatch_criado ON lead_dispatch(criado_em);
CREATE INDEX IF NOT EXISTS idx_lead_dispatch_task ON lead_dispatch(task_id);
CREATE INDEX IF NOT EXISTS idx_lead_dispatch_event ON lead_dispatch(event_id);

-- Histórico de estágios vindo do webhook do ClickUp.
CREATE TABLE IF NOT EXISTS crm_status_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL,              -- nome do status no ClickUp (lowercase)
    recebido_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_crm_status_task ON crm_status_log(task_id, recebido_em DESC);

-- Config simples (ex.: secret do webhook do ClickUp, gravado pelo setup).
CREATE TABLE IF NOT EXISTS config_kv (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
);
