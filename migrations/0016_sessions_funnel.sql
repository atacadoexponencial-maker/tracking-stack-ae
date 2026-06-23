-- Adiciona a coluna `funnel` à tabela sessions.
-- Identificador do funil capturado do parâmetro de URL `&funnel=` pelo
-- middleware (ex.: 'manychat', 'live-semanal'). Diferente das UTMs (origem,
-- campanha, criativo), o funil diz QUAL oferta/jornada o lead entrou — e como
-- pode compartilhar página com outros funis (ex.: home), precisa de marcador
-- próprio. Persistido na sessão (first-touch) e usado pelo dashboard para
-- segmentar os leads por funil.
ALTER TABLE sessions ADD COLUMN funnel TEXT DEFAULT '';
