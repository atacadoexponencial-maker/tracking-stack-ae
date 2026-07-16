-- Issue 107 (check-up de dados): ga4_funil vira a tabela de TOTAIS DIÁRIOS do
-- GA4 (sem quebra de dimensão). KPIs de cartão leem daqui — evita o overcount
-- de métricas únicas (usuários) causado pela soma através de canal/origem.
ALTER TABLE ga4_funil ADD COLUMN usuarios INTEGER DEFAULT 0;
ALTER TABLE ga4_funil ADD COLUMN novos_usuarios INTEGER DEFAULT 0;
ALTER TABLE ga4_funil ADD COLUMN sessoes_engajadas INTEGER DEFAULT 0;
ALTER TABLE ga4_funil ADD COLUMN receita_cents INTEGER DEFAULT 0;
