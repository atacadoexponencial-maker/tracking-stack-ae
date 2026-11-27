-- Inícios de checkout atribuídos aos anúncios, por campanha e dia (issue S14-01).
-- Vêm do Meta (evento de pixel "InitiateCheckout" que o checkout da Zouti envia
-- direto ao Meta), pela mesma coleta diária que grava o gasto. Linhas antigas
-- ficam com 0 até a coleta passar de novo pelo dia delas.
ALTER TABLE ad_spend ADD COLUMN initiate_checkouts INTEGER NOT NULL DEFAULT 0;
