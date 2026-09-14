-- Revisão de 2026-09-13 (precisão dos dados + economia do D1).
--
-- 1. idx_event_log_session_id: existia SÓ no D1 remoto (criado à mão no
--    incidente de 2026-09-01, sem migration). A Conversão por LP depende
--    inteiramente dele (três EXISTS correlacionados por sessão); um preview,
--    um banco local ou uma restauração de backup voltavam ao cenário de
--    22,7 M de linhas lidas por abertura sem que nada no repositório avisasse.
--    Aqui só fica versionado — IF NOT EXISTS não recria o que já existe.
--
-- 2. idx_event_log_event_id: três JOINs usam event_log.event_id sem índice
--    (crm-funnel, sync de conversões de grupo, sync de leads do Meta) e o
--    tracker passa a consultar por event_id antes de gravar um Lead (dedup).
--    NÃO é UNIQUE de propósito: o banco já tem 2 event_id duplicados de antes.
--
-- 3. idx_event_log_lead_email + idx_sessions_external_id: a Jornada do lead
--    (clique numa linha de lead ou link vindo do card do ClickUp) varria
--    event_log 2× e sessions 1× por consulta.
--
-- 4. idx_wge_action_received: o sync EntrouGrupo filtra por (action,
--    received_at) e faz MAX(received_at); não havia índice para nenhum dos dois.
--
-- 5. idx_wgc_occurred: a aba Grupos passa a filtrar occurred_at por intervalo
--    em vez de substr(), e agora tem índice para isso.
--
-- 6. idx_greenn_entidade: o webhook da Greenn passa a perguntar "esta venda já
--    teve um paid antes?" antes de rodar as pontes ClickUp/ManyChat de novo.
--
-- 7. crm_status_log.hist_id / hist_date: o ClickUp retenta entregas e não
--    garante ordem; gravar o id e a data do history_item permite ignorar a
--    reentrega (UNIQUE) e ordenar pelo instante real da mudança de estágio.
--    Linhas antigas ficam NULL (NULL não colide em UNIQUE no SQLite).
--
-- ANALYZE não é opcional (lição de 2026-09-01): sem estatísticas novas o
-- otimizador ignora índice recém-criado.
--
-- Aplicar em produção com `wrangler d1 execute tracking-ae-db --remote --file`
-- (o `migrations apply --remote` quebra neste projeto desde a 0021).

CREATE INDEX IF NOT EXISTS idx_event_log_session_id ON event_log(session_id);
CREATE INDEX IF NOT EXISTS idx_event_log_event_id ON event_log(event_id);
CREATE INDEX IF NOT EXISTS idx_event_log_lead_email ON event_log(event_name, raw_email);
CREATE INDEX IF NOT EXISTS idx_sessions_external_id ON sessions(external_id);
CREATE INDEX IF NOT EXISTS idx_wge_action_received ON whatsapp_group_events(action, received_at);
CREATE INDEX IF NOT EXISTS idx_wgc_occurred ON whatsapp_group_conversions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_greenn_entidade ON greenn_webhook_event(entity_type, entity_id);

ALTER TABLE crm_status_log ADD COLUMN hist_id TEXT;
ALTER TABLE crm_status_log ADD COLUMN hist_date INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_status_hist ON crm_status_log(hist_id);

ANALYZE;
