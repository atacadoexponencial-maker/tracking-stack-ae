-- Registra leads cuja sincronização com o ClickUp falhou (após 1 retry).
--
-- Motivo: ao tirar o ClickUp do n8n e criar a task DIRETO na API de dentro do
-- /tracker, perdemos a fila/retentativa que o n8n dava "de graça". Como a
-- usuária não pode perder leads, toda falha de ESCRITA no ClickUp (criar task
-- ou comentar) grava aqui o payload completo do lead, para consulta e replay
-- manual. É um desvio intencional do "no retry / no alerting" documentado em
-- docs/architecture.md — restrito ao caminho do ClickUp.
--
-- Ver: docs/superpowers/specs/2026-07-02-clickup-direto-remover-n8n-design.md
CREATE TABLE IF NOT EXISTS clickup_sync_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  phone TEXT,
  email TEXT,
  lead_json TEXT NOT NULL,
  error TEXT,
  resolved INTEGER NOT NULL DEFAULT 0
);
