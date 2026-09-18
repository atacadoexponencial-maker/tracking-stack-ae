-- Cópia local da lista de grupos do WhatsApp, para a tela de "quais monitorar".
--
-- Existe por uma medida, não por preferência: `fetchAllGroups` na Evolution
-- leva ~46 segundos para 123 grupos (medido em produção em 18/09/2026).
-- Consultar ao vivo faria a aba travar quase um minuto a cada abertura, e
-- ficaria perto demais do teto de tempo da plataforma.
--
-- Aqui fica só o que a tela precisa para listar e buscar. Quem manda sobre o
-- que é monitorado continua sendo `whatsapp_groups_tracked` — esta tabela é
-- catálogo, não decisão.

CREATE TABLE IF NOT EXISTS whatsapp_groups_catalogo (
  group_jid     TEXT PRIMARY KEY,
  subject       TEXT,
  size          INTEGER NOT NULL DEFAULT 0,
  tipo          TEXT NOT NULL,          -- comunidade | avisos | comum
  linked_parent TEXT,
  busca         TEXT NOT NULL,          -- nome sem acento e sem caixa, pronto para filtrar
  atualizado_em INTEGER NOT NULL
);

-- A tela ordena por tamanho (os grupos da operação têm centenas de membros e
-- sobem sozinhos, antes de qualquer busca).
CREATE INDEX IF NOT EXISTS idx_groups_catalogo_size
  ON whatsapp_groups_catalogo (size DESC);
