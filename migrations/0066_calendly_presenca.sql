-- Presença das consultorias do Calendly marcada à mão no dash (pedido dela em
-- 26/10). O coletor da VPS não toca nestas colunas.
--   presenca:            NULL (aguardando) | 'realizada' | 'faltou' | 'sem_info'
--   crm_situacao:        resultado do comentário no ClickUp (ok:<card> | sem_card | erro: …)
--   conversao_realizada: resultado do envio "reunião realizada" ao Meta/GA4
ALTER TABLE calendly_consultorias ADD COLUMN presenca TEXT;
ALTER TABLE calendly_consultorias ADD COLUMN presenca_em INTEGER;
ALTER TABLE calendly_consultorias ADD COLUMN crm_situacao TEXT;
ALTER TABLE calendly_consultorias ADD COLUMN conversao_realizada TEXT;
