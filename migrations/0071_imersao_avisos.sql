-- Imersão Planejamento Atacado 2027 (spec-popup-checkout-imersao.md, série S10).
--
-- imersao_avisos: registro de cada aviso de webhook recebido da Zouti com a
-- assinatura certa, para conferir depois o que chegou e o que o site fez com
-- ele. As vendas em si continuam em imersao_vendas (migration 0070).
--
-- Aplicar no remoto com `wrangler d1 execute tracking-ae-db --remote --file=...`
-- (nunca `migrations apply --remote` neste projeto).
CREATE TABLE IF NOT EXISTS imersao_avisos (
  entrega_id TEXT PRIMARY KEY,
  evento_id TEXT,
  tipo TEXT,
  objeto_id TEXT,
  resultado TEXT NOT NULL CHECK (resultado IN ('gravado', 'ignorado')),
  motivo TEXT,
  vendas INTEGER NOT NULL DEFAULT 0,
  recebido_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_imersao_avisos_recebido ON imersao_avisos (recebido_em);
