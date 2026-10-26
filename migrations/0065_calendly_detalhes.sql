-- Detalhes das consultorias do Calendly para a lista de agendamentos do dash
-- (pedido dela em 26/10: ver nome, WhatsApp e link do Meet, não só o e-mail).
-- Preenchidos pelo coletor da VPS; linhas antigas ficam NULL até a próxima coleta.
ALTER TABLE calendly_consultorias ADD COLUMN nome TEXT;
ALTER TABLE calendly_consultorias ADD COLUMN telefone TEXT;
ALTER TABLE calendly_consultorias ADD COLUMN fim INTEGER;
ALTER TABLE calendly_consultorias ADD COLUMN meet_link TEXT;
