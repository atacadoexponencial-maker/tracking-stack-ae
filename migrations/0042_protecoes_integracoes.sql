-- Proteções nas integrações: credenciais, horário suspeito e telefone no padrão
-- Spec: spec-protecoes-integracoes.md (16/09/2026)
--
-- Aplicar no remoto com `wrangler d1 execute --file`, nunca `migrations apply`.

-- 1. Credenciais: só nome, situação, motivos e horários. NUNCA o valor, trecho,
--    tamanho ou hash (princípio "segredo nunca aparece").
CREATE TABLE IF NOT EXISTS credenciais_estado (
  nome                    TEXT PRIMARY KEY,
  integracao              TEXT NOT NULL,
  situacao                TEXT NOT NULL CHECK (situacao IN ('ok', 'problema', 'nao_confirmado', 'nao_se_aplica')),
  motivos                 TEXT,
  nota                    TEXT,
  desde                   INTEGER NOT NULL,
  checado_em              INTEGER NOT NULL,
  nao_confirmado_seguidas INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS credenciais_rodadas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  iniciada_em INTEGER NOT NULL,
  origem      TEXT NOT NULL CHECK (origem IN ('automatica', 'manual')),
  total       INTEGER NOT NULL DEFAULT 0,
  problemas   INTEGER NOT NULL DEFAULT 0,
  terminada_em INTEGER
);
CREATE INDEX IF NOT EXISTS idx_credenciais_rodadas_inicio ON credenciais_rodadas (iniciada_em);

-- 2. Horário das integrações: resumo compacto por fonte e hora (não um registro
--    por evento normal). `hist` e `horas` são JSON pequenos.
CREATE TABLE IF NOT EXISTS integracao_horario_resumo (
  fonte       TEXT    NOT NULL,
  hora        INTEGER NOT NULL,          -- início da hora (unix, UTC)
  eventos     INTEGER NOT NULL DEFAULT 0,
  sem_horario INTEGER NOT NULL DEFAULT 0,
  suspeitos   INTEGER NOT NULL DEFAULT 0,
  hist        TEXT,                      -- contagem por faixa de |desvio| em minutos
  horas       TEXT,                      -- contagem de eventos deslocados ~N horas inteiras
  PRIMARY KEY (fonte, hora)
);

-- Amostra dos suspeitos: sem dado pessoal, só identificador do evento.
CREATE TABLE IF NOT EXISTS integracao_horario_suspeitos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fonte       TEXT    NOT NULL,
  informado   INTEGER NOT NULL,
  chegada     INTEGER NOT NULL,
  desvio_min  INTEGER NOT NULL,
  ref         TEXT
);
CREATE INDEX IF NOT EXISTS idx_horario_suspeitos_fonte ON integracao_horario_suspeitos (fonte, id);

-- 3. Telefone: original preservado e situação consultável no lead.
ALTER TABLE lead_dispatch ADD COLUMN telefone_original TEXT;
ALTER TABLE lead_dispatch ADD COLUMN telefone_situacao TEXT;

-- 4. Alerta: itens já avisados por condição (credenciais e fontes), para
--    avisar só o item NOVO quando ele entra numa condição que já estava ativa.
ALTER TABLE meta_alertas_estado ADD COLUMN itens TEXT;
