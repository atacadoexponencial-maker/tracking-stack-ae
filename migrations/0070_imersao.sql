-- Imersão Planejamento Atacado 2027 (spec-imersao-2027.md, série S8).
--
-- imersao_vendas: compras do lançamento (ingresso, order bump e Mentoria). Vem
-- da Zouti; a ligação é uma issue futura, fora da S8. Enquanto a tabela não
-- tiver nenhum ingresso pago, a tela mostra dados de exemplo.
CREATE TABLE IF NOT EXISTS imersao_vendas (
  id TEXT PRIMARY KEY,
  produto TEXT NOT NULL CHECK (produto IN ('ingresso', 'bump', 'mentoria')),
  valor_centavos INTEGER NOT NULL DEFAULT 0,
  pago_em INTEGER NOT NULL,
  email TEXT,
  telefone TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  situacao TEXT NOT NULL DEFAULT 'paga' CHECK (situacao IN ('paga', 'cancelada', 'reembolsada')),
  criado_em INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_imersao_vendas_produto ON imersao_vendas (produto, situacao);

-- imersao_metas: metas internas editáveis na tela (uma linha por campo).
-- campo: verba_ingresso | pct_trafego | meta_bump | meta_mentoria | horario_oferta
CREATE TABLE IF NOT EXISTS imersao_metas (
  campo TEXT PRIMARY KEY,
  valor TEXT,
  alterada_em INTEGER NOT NULL
);
