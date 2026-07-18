-- Config simples do painel (heartbeat do backup externo, etc.).
CREATE TABLE IF NOT EXISTS config_kv (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
);
