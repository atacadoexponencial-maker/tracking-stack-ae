-- Adiciona a coluna `origin` à tabela event_log.
--
-- Distingue a ORIGEM do lead sem tirá-lo do funil: leads capturados pelo site
-- (via /tracker) ficam 'site'; leads do formulário nativo do Meta (via
-- /api/sync/meta-leads) gravam 'meta_form'. É a "tag própria" no lado do
-- dashboard — os leads contam JUNTO no funil sessao-estrategica, mas dá para
-- filtrar/distinguir a procedência.
--
-- Mesmo padrão do is_junk (0022): a coluna nasce com DEFAULT cobrindo todas as
-- linhas históricas — nenhum backfill é necessário, pois todo lead pré-existente
-- veio do site. Totalmente aditivo e reversível.
ALTER TABLE event_log ADD COLUMN origin TEXT NOT NULL DEFAULT 'site';
CREATE INDEX IF NOT EXISTS idx_event_log_origin ON event_log(origin);
