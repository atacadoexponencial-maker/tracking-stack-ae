-- Etapas do lead dentro da agenda (spec-conversao-agenda.md, módulo 1).
-- Uma linha por convite e etapa: abrir de novo ou trocar de horário não conta
-- outra vez (PRIMARY KEY). Só tipos comerciais; nunca vai para Meta nem GA4.
-- Também guarda o envio da conversão "reunião realizada" (módulo 3).
-- Só adição: prévia e produção dividem o mesmo D1.
CREATE TABLE IF NOT EXISTS agenda_etapas (
    convite_token  TEXT NOT NULL REFERENCES agenda_convites(token),
    etapa          TEXT NOT NULL CHECK (etapa IN ('abriu', 'escolheu')),
    criado_em      INTEGER NOT NULL,
    PRIMARY KEY (convite_token, etapa)
);

ALTER TABLE agenda_reunioes ADD COLUMN conversao_realizada TEXT;  -- enviada | fora_do_prazo | erro: ...
CREATE INDEX IF NOT EXISTS idx_agenda_convites_criado ON agenda_convites(criado_em);
