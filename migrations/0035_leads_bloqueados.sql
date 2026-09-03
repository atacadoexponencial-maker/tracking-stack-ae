-- Leads barrados na entrada do /tracker pelas regras de functions/_lead-bloqueio.js.
--
-- Por que uma tabela nova, e não só uma coluna no event_log: para DEVOLVER um
-- lead barrado por engano é preciso ter o lead inteiro. O event_log guarda
-- apenas `raw_email` e o funil — nome, telefone, Instagram e faturamento se
-- perdem, e um botão "restaurar" que não sabe o telefone não devolve nada ao
-- comercial. O payload vai em JSON porque é exatamente a forma que
-- sendToClickUp/sendToGHL/sendToCRM já esperam receber.
--
-- Restaurar NÃO apaga a linha: carimba `restaurado_em`. O histórico do que foi
-- barrado é a única maneira de perceber que uma regra ficou larga demais.
--
-- O bloqueio segue gravado no event_log também (com is_junk = 1), como sempre
-- foi para teste interno. As duas escritas têm papéis diferentes: o event_log
-- mantém a contagem de eventos honesta, esta tabela guarda o que é preciso
-- para desfazer.

CREATE TABLE IF NOT EXISTS leads_bloqueados (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     TEXT,
    session_id   TEXT,
    email        TEXT,
    nome         TEXT,
    telefone     TEXT,
    funnel       TEXT,
    motivo       TEXT NOT NULL,
    lead_json    TEXT NOT NULL,
    session_json TEXT,
    user_agent   TEXT,
    ip_address   TEXT,
    criado_em    INTEGER NOT NULL,
    -- NULL enquanto bloqueado; unixepoch da devolução depois disso.
    restaurado_em INTEGER,
    -- Resultado do reenvio (ClickUp/GHL/CRM), para a tela dizer se a devolução
    -- deu certo em vez de só afirmar que tentou.
    restaurado_resultado TEXT
);

-- A aba Bloqueios lista da mais recente para a mais antiga; é a única leitura.
CREATE INDEX IF NOT EXISTS idx_leads_bloqueados_criado ON leads_bloqueados(criado_em);
