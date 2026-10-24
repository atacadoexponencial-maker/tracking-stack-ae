-- Agenda própria: "até quantos dias à frente" conta em dias corridos ou úteis.
--
-- 'corridos' = hoje + N dias (como sempre foi). 'uteis' = até o N-ésimo dia de
-- segunda a sexta depois de hoje; feriado conta como útil. A conta mora em
-- fimDaJanela (functions/api/_agenda-regras.js).

ALTER TABLE agenda_tipos ADD COLUMN janela_contagem TEXT NOT NULL DEFAULT 'corridos';
