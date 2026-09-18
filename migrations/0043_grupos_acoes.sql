-- Agenda de ações de grupo: mandar mensagem e renomear com hora marcada.
-- Spec: docs/superpowers/specs/2026-09-17-gestao-grupos-whatsapp-design.md
--
-- É uma fila de AÇÕES, não de mensagens: renomear e enviar são a mesma coisa
-- com hora marcada, e tipo novo (trancar, revogar link) entra sem tabela nova.

CREATE TABLE IF NOT EXISTS whatsapp_group_actions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  group_jid      TEXT    NOT NULL,
  tipo           TEXT    NOT NULL,   -- 'mensagem' | 'renomear'
  payload        TEXT    NOT NULL,   -- JSON: {texto} | {titulo, aplicar_no_par}
  agendada_para  INTEGER NOT NULL,   -- unix segundos UTC
  status         TEXT    NOT NULL DEFAULT 'agendada',
                                     -- agendada|executando|concluida|falhou|cancelada
  tentativas     INTEGER NOT NULL DEFAULT 0,
  erro           TEXT,
  resultado      TEXT,               -- resumo legível do que foi feito
  criada_em      INTEGER NOT NULL,
  executada_em   INTEGER
);

-- Única consulta quente: o cron varrendo vencidas. Sem o índice, cada passada
-- lê a tabela inteira — o tipo de varredura que já estourou o limite de
-- leitura do D1 duas vezes neste projeto.
CREATE INDEX IF NOT EXISTS idx_group_actions_fila
  ON whatsapp_group_actions (status, agendada_para);

-- O par da Comunidade (grupo pai), para renomear os dois de uma vez.
-- Nulo até ser conferido contra a Evolution; nulo significa "não sei", e
-- renomear o par é recusado em vez de adivinhado.
ALTER TABLE whatsapp_groups_tracked ADD COLUMN parent_jid TEXT;
