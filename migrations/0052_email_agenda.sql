-- E-mails da agenda (spec-email-proprio.md, módulo 3; issue 379).
-- Só adição: prévia e produção dividem o mesmo D1.
-- Aplicar no remoto com `wrangler d1 execute tracking-ae-db --remote --file`
-- (NUNCA `d1 migrations apply --remote`).

-- Configuração por tipo de reunião: um e-mail por linha. Lembrete tem a
-- antecedência em minutos; os outros eventos usam 0.
CREATE TABLE IF NOT EXISTS agenda_emails (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_id        INTEGER NOT NULL REFERENCES agenda_tipos(id),
    evento         TEXT NOT NULL CHECK (evento IN ('confirmacao', 'lembrete', 'remarcacao', 'cancelamento')),
    antes_min      INTEGER NOT NULL DEFAULT 0,
    modelo_id      INTEGER NOT NULL REFERENCES email_modelos(id),
    ligado         INTEGER NOT NULL DEFAULT 1,
    criado_em      INTEGER NOT NULL,
    atualizado_em  INTEGER NOT NULL,
    UNIQUE (tipo_id, evento, antes_min)
);

-- Cada e-mail programado de cada reunião. A situação de entrega (entregue,
-- aberto, voltou) mora em email_envios, ligada por envio_id.
--   situacao: pendente | enviando | enviado | pulado | falhou
CREATE TABLE IF NOT EXISTS agenda_emails_fila (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    reuniao_id       TEXT NOT NULL REFERENCES agenda_reunioes(id),
    agenda_email_id  INTEGER NOT NULL,          -- sem FK: lembrete tirado some da configuração, o histórico fica
    evento           TEXT NOT NULL,
    antes_min        INTEGER NOT NULL DEFAULT 0,
    inicio_ref       INTEGER NOT NULL,          -- horário da reunião para o qual foi programado
    enviar_em        INTEGER NOT NULL,
    situacao         TEXT NOT NULL DEFAULT 'pendente',
    motivo           TEXT,
    tentativas       INTEGER NOT NULL DEFAULT 0,
    envio_id         INTEGER,
    criado_em        INTEGER NOT NULL,
    atualizado_em    INTEGER NOT NULL,
    UNIQUE (reuniao_id, agenda_email_id, inicio_ref)
);
CREATE INDEX IF NOT EXISTS idx_agenda_emails_fila_pendentes ON agenda_emails_fila(situacao, enviar_em);
CREATE INDEX IF NOT EXISTS idx_agenda_emails_fila_reuniao ON agenda_emails_fila(reuniao_id);

-- Modelos da agenda (textos do protótipo aprovado, issue 373).
INSERT OR IGNORE INTO email_modelos (nome, canal, assunto, previa, corpo, arquivado, criado_em, atualizado_em) VALUES
    ('Confirmação de reunião', 'transacional',
     'Sua reunião está confirmada, {{primeiro_nome}}',
     '{{data_reuniao}} às {{hora_reuniao}}, pelo Google Meet.',
     'Oi, {{primeiro_nome}}!

Sua **{{tipo_reuniao}}** está confirmada para {{data_reuniao}} às {{hora_reuniao}} (horário de Brasília).

[[Entrar na reunião | {{link_reuniao}}]]

Se precisar mudar o horário, é só [remarcar por aqui]({{link_remarcar}}).

Até lá,
Equipe Atacado Exponencial',
     0, strftime('%s', 'now'), strftime('%s', 'now')),
    ('Lembrete 24h antes', 'transacional',
     'Amanhã: sua {{tipo_reuniao}}',
     'Amanhã às {{hora_reuniao}}. Guarde o link.',
     'Oi, {{primeiro_nome}}!

Passando para lembrar: sua reunião é **amanhã, às {{hora_reuniao}}** (horário de Brasília).

[[Entrar na reunião | {{link_reuniao}}]]

Se não puder, [remarque por aqui]({{link_remarcar}}).

Equipe Atacado Exponencial',
     0, strftime('%s', 'now'), strftime('%s', 'now')),
    ('Lembrete 1h antes', 'transacional',
     'Começa em 1 hora',
     'Às {{hora_reuniao}}, no link de sempre.',
     'Oi, {{primeiro_nome}}! Sua reunião começa às **{{hora_reuniao}}** (horário de Brasília).

[[Entrar na reunião | {{link_reuniao}}]]',
     0, strftime('%s', 'now'), strftime('%s', 'now')),
    ('Reunião remarcada', 'transacional',
     'Novo horário: {{data_reuniao}} às {{hora_reuniao}}',
     'Sua reunião mudou de horário.',
     'Oi, {{primeiro_nome}}!

Sua reunião mudou para **{{data_reuniao}} às {{hora_reuniao}}** (horário de Brasília).

[[Entrar na reunião | {{link_reuniao}}]]

Equipe Atacado Exponencial',
     0, strftime('%s', 'now'), strftime('%s', 'now')),
    ('Reunião cancelada', 'transacional',
     'Sua reunião foi cancelada',
     'Quer marcar outro horário?',
     'Oi, {{primeiro_nome}}.

Sua {{tipo_reuniao}} de {{data_reuniao}} às {{hora_reuniao}} foi cancelada.

Equipe Atacado Exponencial',
     0, strftime('%s', 'now'), strftime('%s', 'now'));
