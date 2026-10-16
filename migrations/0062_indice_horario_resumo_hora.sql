-- Revisão de desperdício de 2026-10-16.
--
-- avaliarFontes (functions/api/_horario-registro.js) lê os resumos das últimas
-- 24 h com `WHERE hora >= ?`. A chave primária é (fonte, hora), que não serve
-- para filtrar só por hora: o D1 varria a tabela inteira (30 dias de retenção,
-- ~1.400 linhas) a cada checagem de saúde, umas 80 vezes por dia. Era a
-- consulta que mais lia linhas no D1 (`d1 insights`, 7 dias: 710 mil).
-- Com o índice, cada leitura pega só as ~24 h pedidas.

CREATE INDEX IF NOT EXISTS idx_integracao_horario_resumo_hora ON integracao_horario_resumo(hora);

ANALYZE integracao_horario_resumo;
