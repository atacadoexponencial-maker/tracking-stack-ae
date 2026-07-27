-- Entradas e saídas nos grupos de WhatsApp (feature: aba "Grupos" do dash).
-- Alimentado por /api/webhooks/whatsapp-grupo (fan-out do webhook da Evolution
-- que já roda no n8n), lido por /api/grupos. Mesmo padrão de workshops/ad_spend:
-- o dash lê daqui e nunca toca a Evolution no caminho da requisição.

-- Um registro por PESSOA por evento. O evento da Evolution pode trazer vários
-- participantes de uma vez (`participants: []`), e cada um vira uma linha.
CREATE TABLE IF NOT EXISTS whatsapp_group_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid       TEXT NOT NULL,
    participant_jid TEXT NOT NULL,
    action          TEXT NOT NULL,   -- 'entrou' | 'saiu' | 'removido'
    actor_jid       TEXT,            -- quem executou (NULL quando a Evolution não informa)
    occurred_at     TEXT NOT NULL,   -- ISO 8601 UTC
    day_local       TEXT NOT NULL,   -- 'YYYY-MM-DD' em -03:00, calculado na escrita
    received_at     INTEGER NOT NULL,-- unix seconds
    raw_json        TEXT             -- payload truncado, para depuração
);

-- O evento da Evolution não tem ID próprio. Esta é a chave natural: o mesmo
-- participante, com a mesma ação, no mesmo grupo e no mesmo instante é o mesmo
-- fato. Combinada com INSERT OR IGNORE, torna a reentrega do n8n inofensiva.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wge_dedup
    ON whatsapp_group_events(group_jid, participant_jid, action, occurred_at);
CREATE INDEX IF NOT EXISTS idx_wge_dia
    ON whatsapp_group_events(group_jid, day_local);

-- Quais grupos são monitorados. Vive em tabela, não em código, porque a
-- Comunidade da live NÃO é permanente: quando abrirem o ciclo seguinte, o JID
-- muda e passar a acompanhar o novo precisa ser um INSERT, não um deploy.
CREATE TABLE IF NOT EXISTS whatsapp_groups_tracked (
    group_jid  TEXT PRIMARY KEY,
    label      TEXT NOT NULL,       -- 'Lives Semanais' | 'Workshops'
    group_name TEXT,                -- só rótulo humano; o nome do grupo muda toda semana
    enabled    INTEGER NOT NULL DEFAULT 1
);

-- Todo grupo que gerar evento entra aqui, SEM dados de pessoas. O número está em
-- ~119 grupos, a maioria de terceiros: guardar participantes deles não se faz.
-- Serve de rede de segurança — Comunidade nova aparece no dash como "não
-- monitorado" em vez de sumir em silêncio.
CREATE TABLE IF NOT EXISTS whatsapp_groups_seen (
    group_jid     TEXT PRIMARY KEY,
    group_name    TEXT,
    events        INTEGER NOT NULL DEFAULT 0,
    last_event_at TEXT
);

-- Grupos de AVISOS das duas Comunidades (verificado na Evolution em 2026-07-27).
-- Os grupos "pai" (120363397317313470 e 120363429583787754) ficam de fora de
-- propósito: uma entrada na Comunidade gera evento nos dois, e contar ambos
-- dobraria o número.
INSERT OR IGNORE INTO whatsapp_groups_tracked (group_jid, label, group_name, enabled) VALUES
  ('120363380235066572@g.us', 'Workshops',      '📦 Workshop | Atacado Exponencial', 1),
  ('120363427499061913@g.us', 'Lives Semanais', '30/07 às 12h | O jogo da escala no atacado', 1);
