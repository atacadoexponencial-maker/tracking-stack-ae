-- Reenvio garantido ao Meta e monitoramento da saúde do envio
-- Spec: spec-capi-reenvio-monitoramento.md · Issues 268–288 (16/09/2026)
--
-- De 30/07 a 15/09/2026 o Meta recusou 100% das conversões e ninguém soube:
-- cada conversão ia uma única vez e a recusa ficava só guardada no event_log.
-- Aqui cada conversão do site (menos PageView) e cada venda ganha uma situação
-- — aceita, pendente ou falhou — e as pendentes são reenviadas pela rotina
-- /api/sync/meta-reenvio. EntrouGrupo continua na fila própria
-- (whatsapp_group_conversions), que o monitoramento só lê.
--
-- Aplicar no remoto com `wrangler d1 execute --file`, nunca com
-- `migrations apply` (ver memória: 0021/0022/0025 quebram ao reaplicar).

CREATE TABLE IF NOT EXISTS meta_envios (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  origem                TEXT    NOT NULL CHECK (origem IN ('site', 'venda')),
  event_id              TEXT    NOT NULL,
  event_name            TEXT    NOT NULL,
  -- Horário ORIGINAL do evento (o mesmo do payload). É ele que conta para a
  -- janela de 7 dias do Meta e para o período da aba.
  event_time            INTEGER NOT NULL,
  -- Página (event_source_url) no site, nome do produto na venda.
  referencia            TEXT,
  situacao              TEXT    NOT NULL CHECK (situacao IN ('aceita', 'pendente', 'falhou')),
  -- Categoria do último erro: credencial | evento | passageira | expirou | esgotou.
  -- Fica preenchida também em conversão aceita por reenvio (história do que houve).
  categoria             TEXT,
  motivo                TEXT,
  tentativas            INTEGER NOT NULL DEFAULT 0,
  aceita_por_reenvio    INTEGER NOT NULL DEFAULT 0,
  -- JSON exatamente como foi montado na 1ª tentativa. Apagado quando aceita:
  -- só serve para reenviar, e o event_log/purchase_log já guardam a cópia.
  payload               TEXT,
  ultimo_status         INTEGER,
  ultima_resposta       TEXT,
  proxima_tentativa_em  INTEGER,
  -- Trava de uma rodada sobre a linha: outra rodada simultânea não pega a
  -- mesma conversão enquanto este instante não passar.
  em_envio_ate          INTEGER,
  criado_em             INTEGER NOT NULL,
  ultima_tentativa_em   INTEGER,
  aceita_em             INTEGER,
  falhou_em             INTEGER,
  UNIQUE (origem, event_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_envios_fila     ON meta_envios (situacao, proxima_tentativa_em);
CREATE INDEX IF NOT EXISTS idx_meta_envios_sit_ev   ON meta_envios (situacao, event_time);
CREATE INDEX IF NOT EXISTS idx_meta_envios_ev       ON meta_envios (event_time);
CREATE INDEX IF NOT EXISTS idx_meta_envios_aceita   ON meta_envios (aceita_em);
CREATE INDEX IF NOT EXISTS idx_meta_envios_tentativa ON meta_envios (ultima_tentativa_em);

-- Resumo de cada rodada que teve trabalho (rodada vazia não grava nada).
CREATE TABLE IF NOT EXISTS meta_reenvio_rodadas (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  iniciada_em          INTEGER NOT NULL,
  aceitas              INTEGER NOT NULL DEFAULT 0,
  pendentes            INTEGER NOT NULL DEFAULT 0,
  falhas               INTEGER NOT NULL DEFAULT 0,
  expiradas            INTEGER NOT NULL DEFAULT 0,
  abortou_credencial   INTEGER NOT NULL DEFAULT 0,
  duracao_ms           INTEGER
);
CREATE INDEX IF NOT EXISTS idx_meta_rodadas_inicio ON meta_reenvio_rodadas (iniciada_em);

-- Estado de cada condição de alerta, para não repetir aviso e para saber
-- quando mandar a recuperação.
CREATE TABLE IF NOT EXISTS meta_alertas_estado (
  condicao         TEXT PRIMARY KEY,
  ativa            INTEGER NOT NULL DEFAULT 0,
  desde            INTEGER,
  ultimo_aviso_em  INTEGER
);

-- Histórico de mensagens. `entregue = 0` é reentregue na verificação seguinte.
CREATE TABLE IF NOT EXISTS meta_alertas_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo         TEXT    NOT NULL CHECK (tipo IN ('alerta', 'lembrete', 'recuperacao', 'teste')),
  condicoes    TEXT,
  mensagem     TEXT    NOT NULL,
  criado_em    INTEGER NOT NULL,
  entregue     INTEGER NOT NULL DEFAULT 0,
  tentativas   INTEGER NOT NULL DEFAULT 0,
  erro         TEXT
);
CREATE INDEX IF NOT EXISTS idx_meta_alertas_log_criado ON meta_alertas_log (criado_em);
CREATE INDEX IF NOT EXISTS idx_meta_alertas_log_entregue ON meta_alertas_log (entregue, criado_em);
