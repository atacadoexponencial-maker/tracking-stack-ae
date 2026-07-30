-- Conversão "EntrouGrupo": entrada real no grupo de WhatsApp vira conversão no
-- Meta (spec 2026-07-29). A fonte é whatsapp_group_events (migration 0026), que
-- NÃO muda aqui — a aba Grupos do dash tem que continuar contando tudo, inclusive
-- reentradas. Quem deduplica é a tabela nova, só para efeito de envio ao Meta.

-- Elegibilidade por grupo. Fica em coluna, não em código, pelo mesmo motivo da
-- 0026: quando abrirem a Comunidade do ciclo seguinte, ligar a conversão no JID
-- novo precisa ser um UPDATE, não um deploy.
ALTER TABLE whatsapp_groups_tracked ADD COLUMN send_conversion INTEGER NOT NULL DEFAULT 0;

-- Marco de corte, POR GRUPO (unix seconds). NULL/0 = não envia nada.
-- Sem ele, a primeira execução despejaria o histórico inteiro no Meta de uma vez,
-- com datas antigas, sujando a conversão personalizada logo na estreia.
ALTER TABLE whatsapp_groups_tracked ADD COLUMN conversion_since INTEGER;

-- Uma linha por PESSOA por GRUPO — nunca por evento. É isso que faz a reentrada
-- não gerar segunda conversão.
CREATE TABLE IF NOT EXISTS whatsapp_group_conversions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid    TEXT NOT NULL,
    phone        TEXT NOT NULL,     -- só dígitos, já sem o sufixo do JID
    event_id     TEXT NOT NULL,     -- estável: grupo:<jid>:<phone>
    occurred_at  TEXT NOT NULL,     -- ISO da entrada REAL, não do envio
    status       TEXT NOT NULL,     -- 'pendente' | 'enviada' | 'falha'
    tentativas   INTEGER NOT NULL DEFAULT 0,
    enriquecida  INTEGER NOT NULL DEFAULT 0,  -- casou com lead conhecido?
    erro         TEXT,
    criado_em    INTEGER NOT NULL,
    enviado_em   INTEGER
);

-- A dedup da spec. Restrição de banco e não checagem na aplicação: duas
-- execuções simultâneas do cron não conseguem furar isto.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wgc_pessoa
    ON whatsapp_group_conversions(group_jid, phone);
-- Fila de pendências/retentativa.
CREATE INDEX IF NOT EXISTS idx_wgc_status
    ON whatsapp_group_conversions(status, tentativas);

-- Ativação: só as Lives Semanais mandam conversão. Workshops continua sendo
-- registrado no dash normalmente, sem enviar nada ao Meta.
-- O marco de corte é definido na ativação (UPDATE manual com o unix do momento),
-- e não aqui, para não depender de quando a migration for aplicada.
UPDATE whatsapp_groups_tracked SET send_conversion = 1
 WHERE label = 'Lives Semanais';
