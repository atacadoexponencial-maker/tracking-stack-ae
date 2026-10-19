-- Consultorias do Calendly (spec-reunioes-calendly.md, issue S2-01).
--
-- Cópia das "Consultoria Individual" agendadas no Calendly, uma linha por
-- convidado, gravada uma vez por dia pelo coletor da VPS
-- (scripts/calendly-sync → POST /api/sync/calendly). Enquanto a agenda própria
-- está desligada, é daqui que saem as reuniões agendadas do dash (S2-02).
--
-- invitee_uri é a chave: rodar a coleta de novo atualiza em vez de duplicar.
-- O coletor nunca apaga linha; cancelamento chega como situacao = 'cancelada'.

CREATE TABLE IF NOT EXISTS calendly_consultorias (
  invitee_uri TEXT PRIMARY KEY,
  event_uri TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',               -- minúsculas, sem espaço nas pontas
  agendou_em INTEGER NOT NULL,                  -- unix: quando a pessoa agendou
  inicio INTEGER,                               -- unix: quando é a reunião
  situacao TEXT NOT NULL,                       -- 'ativa' | 'cancelada'
  marcada_pela_equipe INTEGER NOT NULL DEFAULT 0, -- 1 = a equipe agendou em nome do convidado
  remarcada INTEGER NOT NULL DEFAULT 0,         -- 1 = cancelada por remarcação
  atualizado_em INTEGER NOT NULL                -- unix: última coleta que tocou a linha
);

-- Os cards contam pela data em que a pessoa agendou.
CREATE INDEX IF NOT EXISTS idx_calendly_consultorias_agendou ON calendly_consultorias(agendou_em);
