-- Throttle dos alertas de WhatsApp da camada A (falhas críticas do /tracker).
--
-- Motivo: ao estender o canal de alerta (Evolution API) para Meta CAPI e
-- forwards de CRM, uma plataforma fora do ar dispararia um alerta POR EVENTO
-- e viraria spam no WhatsApp da usuária. Esta tabela guarda o timestamp do
-- último envio por tipo de alerta; o /tracker só envia se o último foi há
-- mais de 1 hora. FAIL-OPEN: se o D1 estiver indisponível, o alerta sai
-- mesmo assim (melhor duplicado que silêncio).
CREATE TABLE IF NOT EXISTS alert_throttle (
  alert_type TEXT PRIMARY KEY,
  last_sent INTEGER NOT NULL
);
