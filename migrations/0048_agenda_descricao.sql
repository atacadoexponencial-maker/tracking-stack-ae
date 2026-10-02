-- Texto sobre o evento, mostrado ao lado do calendário na página de
-- agendamento (pedido de 02/10: layout em painel, como o Calendly).
-- Só adição: a prévia e a produção dividem o mesmo D1.
ALTER TABLE agenda_tipos ADD COLUMN descricao TEXT;
