-- Agenda própria, substituindo o Calendly (spec-agenda-propria.md, issues 356–363).
--
-- Só tabelas NOVAS: nenhuma tabela existente muda. As prévias de branch do
-- Pages usam o mesmo D1 da produção, então esta migration precisa ser segura
-- de aplicar antes do merge (é só aditiva).
--
-- Horários de reunião em unix SEGUNDOS (UTC). Faixas das grades em 'HH:MM' no
-- fuso de Brasília, que é o fuso da equipe.

-- Contas do Workspace (@seteads.com) cujas agendas o sistema enxerga.
CREATE TABLE IF NOT EXISTS agenda_contas (
    email      TEXT PRIMARY KEY,
    criado_em  INTEGER NOT NULL
);

-- Agendas de cada conta, lidas do Google. `conflito` = vem marcada como
-- "bloqueia horário" ao criar um tipo de reunião novo.
CREATE TABLE IF NOT EXISTS agenda_calendarios (
    id                 TEXT PRIMARY KEY,           -- id da agenda no Google
    conta_email        TEXT NOT NULL REFERENCES agenda_contas(email),
    nome               TEXT NOT NULL,
    conflito           INTEGER NOT NULL DEFAULT 0,
    ultima_leitura_ok  INTEGER,                    -- unix
    ultimo_erro        TEXT,
    ultimo_erro_em     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_agenda_cal_conta ON agenda_calendarios(conta_email);

-- Grades de disponibilidade.
--   faixas_json: {"1":[["09:30","12:00"],["13:00","21:00"]], ...} (0 = domingo)
--   datas_json:  {"2026-10-12":[]}  → data bloqueada
--                {"2026-10-13":[["10:00","12:00"]]} → horário diferente na data
CREATE TABLE IF NOT EXISTS agenda_grades (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nome           TEXT NOT NULL,
    faixas_json    TEXT NOT NULL DEFAULT '{}',
    datas_json     TEXT NOT NULL DEFAULT '{}',
    criado_em      INTEGER NOT NULL,
    atualizado_em  INTEGER NOT NULL
);

-- Tipos de reunião 1:1.
CREATE TABLE IF NOT EXISTS agenda_tipos (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    slug                 TEXT NOT NULL UNIQUE,     -- /agendar/<slug>
    nome                 TEXT NOT NULL,
    duracao_min          INTEGER NOT NULL,
    destino_cal          TEXT NOT NULL,            -- agenda onde a reunião é criada
    conflito_cals_json   TEXT NOT NULL DEFAULT '[]',
    grade_id             INTEGER NOT NULL REFERENCES agenda_grades(id),
    folga_antes_min      INTEGER NOT NULL DEFAULT 0,
    folga_depois_min     INTEGER NOT NULL DEFAULT 0,
    antecedencia_min     INTEGER NOT NULL DEFAULT 120,
    janela_dias          INTEGER NOT NULL DEFAULT 30,
    limite_dia           INTEGER,                  -- NULL = sem limite
    intervalo_min        INTEGER NOT NULL DEFAULT 30,
    perguntas_json       TEXT NOT NULL DEFAULT '[]',
    titulo_modelo        TEXT NOT NULL DEFAULT '{nome} e Atacado Exponencial',
    comercial            INTEGER NOT NULL DEFAULT 1,
    funil                TEXT,                     -- só quando comercial
    pagina_pos           TEXT,                     -- vazio = página de confirmação própria
    contato_alternativo  TEXT,                     -- mostrado quando pausado / em cima da hora
    ativo                INTEGER NOT NULL DEFAULT 1,
    criado_em            INTEGER NOT NULL,
    atualizado_em        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agenda_tipos_funil ON agenda_tipos(funil, ativo);

-- Convite: a ponte entre o formulário da LP e a página de agendamento. O
-- /tracker grava os dados do lead aqui e manda só o token na URL, para não
-- expor nome, e-mail e telefone em endereço (que vai para histórico, analytics
-- e referer).
CREATE TABLE IF NOT EXISTS agenda_convites (
    token          TEXT PRIMARY KEY,
    tipo_id        INTEGER NOT NULL REFERENCES agenda_tipos(id),
    lead_event_id  TEXT,
    session_id     TEXT,
    nome           TEXT,
    email          TEXT,
    telefone       TEXT,
    funil          TEXT,
    criado_em      INTEGER NOT NULL,
    expira_em      INTEGER NOT NULL
);

-- Reuniões marcadas.
--   situacao: marcada | remarcada | cancelada | realizada | faltou | sem_info
CREATE TABLE IF NOT EXISTS agenda_reunioes (
    id               TEXT PRIMARY KEY,             -- uuid
    tipo_id          INTEGER NOT NULL REFERENCES agenda_tipos(id),
    inicio           INTEGER NOT NULL,
    fim              INTEGER NOT NULL,
    fuso_lead        TEXT,
    nome             TEXT NOT NULL,
    email            TEXT NOT NULL,
    telefone         TEXT,
    respostas_json   TEXT NOT NULL DEFAULT '[]',
    situacao         TEXT NOT NULL DEFAULT 'marcada',
    presenca_origem  TEXT,                         -- meet | manual
    google_cal_id    TEXT,
    google_event_id  TEXT,
    meet_link        TEXT,
    comercial        INTEGER NOT NULL DEFAULT 1,
    funil            TEXT,
    lead_event_id    TEXT,
    session_id       TEXT,
    convite_token    TEXT,
    token_gestao     TEXT NOT NULL UNIQUE,         -- link do lead para remarcar/cancelar
    motivo_cancel    TEXT,
    crm_situacao     TEXT,                         -- ok | sem_card | erro: ...
    conversao_situacao TEXT,                       -- resultado do Schedule
    is_teste         INTEGER NOT NULL DEFAULT 0,   -- e-mail interno (mesma regra dos leads)
    ip               TEXT,
    criado_em        INTEGER NOT NULL,
    atualizado_em    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agenda_reunioes_inicio ON agenda_reunioes(inicio);
CREATE INDEX IF NOT EXISTS idx_agenda_reunioes_criado ON agenda_reunioes(criado_em);
CREATE INDEX IF NOT EXISTS idx_agenda_reunioes_tipo ON agenda_reunioes(tipo_id, inicio);

-- Histórico de cada reunião (agendou, remarcou, cancelou, presença...).
CREATE TABLE IF NOT EXISTS agenda_historico (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    reuniao_id  TEXT NOT NULL REFERENCES agenda_reunioes(id),
    acao        TEXT NOT NULL,
    detalhe     TEXT,
    por         TEXT NOT NULL,                     -- lead | equipe | sistema | google
    criado_em   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agenda_hist_reuniao ON agenda_historico(reuniao_id);
