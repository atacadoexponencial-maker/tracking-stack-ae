-- Metas mensais por funil (spec-metas-funil.md, issue 333).
--
-- Uma linha por salvamento: o histórico é a própria tabela. A meta vigente
-- num mês M é a linha de maior (mes_inicio, id) com mes_inicio <= M. Salvar
-- de novo no mesmo mês cria outra linha com o mesmo mes_inicio, que passa a
-- valer para o mês inteiro; meses anteriores continuam lendo a linha deles.
-- NULL em um indicador = sem meta naquele indicador.

CREATE TABLE IF NOT EXISTS metas_funil (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    funil_id                INTEGER NOT NULL REFERENCES funis_relatorio(id),
    -- 'YYYY-MM' no calendário de Brasília: o mês em que a meta foi salva.
    mes_inicio              TEXT NOT NULL CHECK (mes_inicio GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
    cpl_max_centavos        INTEGER CHECK (cpl_max_centavos IS NULL OR cpl_max_centavos >= 0),
    leads_novos             INTEGER CHECK (leads_novos IS NULL OR leads_novos >= 0),
    mqls                    INTEGER CHECK (mqls IS NULL OR mqls >= 0),
    custo_mql_max_centavos  INTEGER CHECK (custo_mql_max_centavos IS NULL OR custo_mql_max_centavos >= 0),
    alterada_em             INTEGER NOT NULL,   -- unix seconds
    alterada_por            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metas_funil_vigencia ON metas_funil(funil_id, mes_inicio DESC, id DESC);

-- Histórico imutável: nada é reescrito nem apagado; mudar a meta é salvar de novo.
CREATE TRIGGER IF NOT EXISTS metas_funil_sem_update
BEFORE UPDATE ON metas_funil
BEGIN
    SELECT RAISE(ABORT, 'metas_funil é histórico: salve uma linha nova em vez de alterar');
END;

CREATE TRIGGER IF NOT EXISTS metas_funil_sem_delete
BEFORE DELETE ON metas_funil
BEGIN
    SELECT RAISE(ABORT, 'metas_funil é histórico: não se apaga meta');
END;
