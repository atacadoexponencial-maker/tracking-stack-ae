-- Ficha dos arquivos agendados (aba Disparos).
-- Spec: docs/superpowers/specs/2026-09-18-disparos-midia-design.md
--
-- Os BYTES ficam no KV; aqui fica só o que precisa ser consultado, filtrado e
-- expurgado. O D1 limita 1 MB por valor — um vídeo de 16 MB teria que ser
-- picado e remontado — e este projeto já estourou o limite de leitura dele
-- duas vezes.

CREATE TABLE IF NOT EXISTS whatsapp_group_media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chave      TEXT NOT NULL UNIQUE,  -- 32 hex: é a URL pública e a chave no KV
  nome       TEXT NOT NULL,         -- nome original COM extensão (vira fileName)
  mimetype   TEXT NOT NULL,
  mediatype  TEXT NOT NULL,         -- image | video | audio | document
  tamanho    INTEGER NOT NULL,
  criada_em  INTEGER NOT NULL,
  apagada_em INTEGER
);

-- Consulta do expurgo: o que ainda não foi apagado e já é velho.
CREATE INDEX IF NOT EXISTS idx_group_media_expurgo
  ON whatsapp_group_media (apagada_em, criada_em);
