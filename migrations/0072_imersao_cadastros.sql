-- Cadastros da janela antes do checkout da Imersão (spec-popup-checkout-imersao.md,
-- série S10, issue S10-05).
--
-- Cópia do que vai para a planilha, sem o nome (SUP-S10-27), só para a aba
-- Imersão 2027 contar quantas pessoas se cadastraram e quantas compraram.
-- Uma linha por envio; a mesma pessoa (mesmo e-mail ou telefone) é contada
-- uma vez só na leitura (functions/api/_imersao.js, contarCadastros).
CREATE TABLE IF NOT EXISTS imersao_cadastros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  criado_em INTEGER NOT NULL,
  email TEXT,
  telefone TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT
);
