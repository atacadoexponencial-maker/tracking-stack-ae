-- Marca leads internos de teste para que não contem nas métricas do dash.
--
-- Mesmo padrão do is_bot: a linha CONTINUA no event_log (nada é apagado), ela
-- apenas sai das contagens. Totalmente reversível — para trazer um lead de
-- volta basta `UPDATE event_log SET is_junk = 0 WHERE event_id = '...'`.
--
-- Motivo: com o volume ainda baixo, um teste em três distorce a leitura das LPs
-- novas (ex.: trafego-atacado marcava 3 leads em 13–19/07, sendo 1 teste).
ALTER TABLE event_log ADD COLUMN is_junk INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_event_log_is_junk ON event_log(is_junk);

-- Backfill dos 8 testes históricos identificados em 2026-07-20 (varredura do
-- ano todo). Critérios, todos internos e sem risco de pegar lead real:
--   @seteads.com      -> domínio da própria agência
--   @teste.com        -> domínio inexistente usado nos testes manuais
--   zzteste@gmail.com -> teste avulso de 02/07
UPDATE event_log
   SET is_junk = 1
 WHERE event_name = 'Lead'
   AND (
     raw_email LIKE '%@seteads.com'
     OR raw_email LIKE '%@teste.com'
     OR raw_email = 'zzteste@gmail.com'
   );
