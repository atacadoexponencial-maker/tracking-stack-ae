-- Override manual do mapeamento campanha → funil (spec 2026-07-28).
--
-- Guarda SÓ o que a pessoa corrigiu na mão. O mapeamento automático é
-- recalculado a cada consulta por resolverFunilAuto() — gravá-lo aqui criaria
-- duas verdades que divergem quando a regra mudar.
CREATE TABLE IF NOT EXISTS campaign_funnel_map (
    campaign_id TEXT PRIMARY KEY,
    campaign_name TEXT,               -- nome no momento da correção, para leitura humana
    funnel TEXT NOT NULL,             -- slug do funil, ou 'aquisicao' para impulsionamento
    atualizado_em INTEGER NOT NULL    -- unix seconds
);
