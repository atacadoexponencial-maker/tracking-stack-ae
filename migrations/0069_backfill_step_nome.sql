-- Série S6 (spec-etapas-com-nome.md): carga única dos nomes no histórico.
--
-- Até 05/11/2026 20h32 BRT (commit 93078bd, timestamp 1793921561) a ordem de
-- cada formulário era fixa desde o início da coleta (31/08), então a posição
-- diz qual pergunta era:
--
-- Chat (funis sessao-estrategica e diagnostico)
--   antes do corte: 1 nome, 2 whatsapp, 3 email, 4 instagram, 5 faturamento, 6 desafio
--   depois:         1 nome, 2 whatsapp, 3 email, 4 instagram, 5 faturamento, 6 cargo, 7 desafio
-- Cartão (aplicacao-mentoria, trafego-atacado, iscas-manychat)
--   1 contato, 2 perfil (sem mudança)
--
-- Só toca linha SEM nome: rodar duas vezes não muda nada, e as linhas gravadas
-- já com nome pelo código novo ficam como estão. Rodar DEPOIS do deploy da
-- S6-01, para cobrir também o intervalo entre o corte e o deploy.
--
-- ⚠️ `wrangler d1 execute --remote --file`, NUNCA `migrations apply --remote`.

UPDATE event_log
   SET step_nome = CASE
     WHEN step = 1 THEN 'nome'
     WHEN step = 2 THEN 'whatsapp'
     WHEN step = 3 THEN 'email'
     WHEN step = 4 THEN 'instagram'
     WHEN step = 5 THEN 'faturamento'
     WHEN step = 6 AND timestamp < 1793921561 THEN 'desafio'
     WHEN step = 6 THEN 'cargo'
     WHEN step = 7 AND timestamp >= 1793921561 THEN 'desafio'
   END
 WHERE event_name = 'FormStep'
   AND step_nome IS NULL
   AND funnel IN ('sessao-estrategica', 'diagnostico');

UPDATE event_log
   SET step_nome = CASE step WHEN 1 THEN 'contato' WHEN 2 THEN 'perfil' END
 WHERE event_name = 'FormStep'
   AND step_nome IS NULL
   AND funnel IN ('aplicacao-mentoria', 'trafego-atacado', 'iscas-manychat');
