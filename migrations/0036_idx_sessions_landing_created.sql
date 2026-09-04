-- Incidente 2026-09-04: a aba "Conversão por LP" lia 1,68 MILHÃO de linhas por
-- abertura (medido com `wrangler d1 insights`), quase a cota diária inteira do
-- plano gratuito do D1 (5 M) numa única chamada.
--
-- O plano de execução já usava os índices certos — o custo eram três
-- TEMP B-TREE (um GROUP BY landing_url e dois COUNT(DISTINCT)) sobre as ~37 mil
-- sessões da janela, a ~15 leituras por linha em cada um.
--
-- Os dois COUNT(DISTINCT) saíram na reescrita de conversion.js (EXISTS
-- correlacionado). Este índice mata o terceiro: com landing_url na frente, o
-- SQLite percorre as sessões já agrupadas por LP e o GROUP BY sai de graça.
-- created_at como segunda coluna mantém o recorte por período dentro de cada LP.
--
-- ANALYZE não é opcional (lição do incidente de 2026-09-01): sem estatísticas
-- atualizadas o otimizador ignora o índice novo e continua no plano antigo.
CREATE INDEX IF NOT EXISTS idx_sessions_lp_created ON sessions(landing_url, created_at);
ANALYZE;
