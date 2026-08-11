-- Eventos crus da Greenn, a plataforma de checkout onde roda um produto
-- SEPARADO do restante do tracking. Alimentado por /api/webhooks/greenn.
--
-- Esta tabela é deliberadamente isolada: não se relaciona com purchase_log
-- nem com event_log, e nenhuma aba atual do dash a lê. A visão dela no
-- dashboard é um ciclo à parte, por decisão da usuária em 2026-08-10.
CREATE TABLE IF NOT EXISTS greenn_webhook_event (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    event          TEXT NOT NULL,    -- saleUpdated | contractUpdated | checkoutAbandoned
    entity_type    TEXT,             -- sale | contract | lead
    entity_id      INTEGER,          -- sale.id | contract.id | lead.id
    current_status TEXT NOT NULL,    -- paid, refused, ...; '' em checkoutAbandoned
    product_id     INTEGER,
    amount         REAL,             -- valor da venda em reais; NULL no abandono
    entity_updated TEXT,             -- updated_at da entidade, ISO 8601 da Greenn
    received_at    INTEGER NOT NULL, -- unix seconds, relógio nosso
    raw_json       TEXT NOT NULL     -- payload íntegro, fonte da verdade
);

-- A Greenn não garante entrega única e a própria doc avisa que `oldStatus`
-- pode vir igual ao `currentStatus`. Esta é a chave natural do fato: a mesma
-- entidade, no mesmo status, com o mesmo updated_at é o mesmo evento.
-- Combinada com INSERT OR IGNORE, torna a reentrega inofensiva.
--
-- current_status é NOT NULL (com '' no abandono) de propósito: no SQLite, NULL
-- nunca é igual a NULL num índice único, e um NULL aqui desativaria a dedup
-- justamente para o evento mais repetido.
CREATE UNIQUE INDEX IF NOT EXISTS idx_greenn_dedup
    ON greenn_webhook_event(event, entity_id, current_status, entity_updated);

CREATE INDEX IF NOT EXISTS idx_greenn_recebido
    ON greenn_webhook_event(received_at);
