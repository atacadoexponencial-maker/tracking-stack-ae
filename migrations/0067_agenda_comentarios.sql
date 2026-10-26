-- Comentários da equipe em cada reunião (pedido do comercial em 26/10).
--
-- Vários por reunião, só acrescenta: não edita nem apaga. Cada um vai como
-- comentário novo no card do lead no ClickUp; crm_situacao guarda o resultado
-- (ok:<card> | sem_card | sem_credencial | erro: …; NULL = tipo não comercial).
--
-- reuniao_id é o id da agenda própria (agenda_reunioes.id) OU o invitee_uri do
-- Calendly (calendly_consultorias.invitee_uri), por isso sem REFERENCES.
-- Só adição: prévia e produção dividem o mesmo D1. Aplicar com:
--   npx wrangler d1 execute tracking-ae-db --remote --file migrations/0067_agenda_comentarios.sql
CREATE TABLE IF NOT EXISTS agenda_comentarios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    reuniao_id    TEXT NOT NULL,
    texto         TEXT NOT NULL,
    crm_situacao  TEXT,
    criado_em     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agenda_coment_reuniao ON agenda_comentarios(reuniao_id, criado_em);
