-- Teste A/B de páginas (spec 2026-08-01). Uma mesma URL serve duas versões a
-- metades comparáveis do tráfego. Nenhuma tabela existente é alterada aqui.

-- Um registro por teste. Os alvos (meta_leads_variante, meta_dias) são
-- declarados na CRIAÇÃO, antes de existir qualquer dado — é isso que impede
-- decidir no primeiro dia em que o número parecer bonito.
CREATE TABLE IF NOT EXISTS ab_tests (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    slug                 TEXT NOT NULL UNIQUE,  -- [a-z0-9-], entra no path da variante
    nome                 TEXT NOT NULL,         -- rótulo exibido no painel
    path                 TEXT NOT NULL,         -- path testado, sem barra final (ex.: '/')
    -- rascunho → ativo ⇄ pausado → encerrado. Só 'ativo' reparte tráfego.
    status               TEXT NOT NULL DEFAULT 'rascunho',
    meta_leads_variante  INTEGER NOT NULL DEFAULT 60,
    meta_dias            INTEGER NOT NULL DEFAULT 14,
    -- Preenchido na PRIMEIRA ativação e nunca mais: pausar e retomar não
    -- reinicia a contagem de dias, senão bastaria pausar para adiar o veredito.
    started_at           INTEGER,
    ended_at             INTEGER,
    vencedor             TEXT,                  -- 'a' | 'b' | 'nenhum'
    criado_em            INTEGER NOT NULL,
    atualizado_em        INTEGER NOT NULL
);

-- O middleware busca o teste pelo path a cada carregamento de página (com
-- cache de 60s). Filtra por status junto porque só 'ativo' interessa.
CREATE INDEX IF NOT EXISTS idx_ab_tests_path ON ab_tests(path, status);

-- As duas variantes de cada teste. Tabela separada (e não duas colunas em
-- ab_tests) porque peso e destino são atributos DA VARIANTE — com colunas
-- seria peso_a/peso_b/path_b, e cada regra teria de saber qual sufixo ler.
CREATE TABLE IF NOT EXISTS ab_variants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id    INTEGER NOT NULL,
    chave      TEXT NOT NULL,   -- 'a' | 'b'
    -- Vazio na variante 'a': ela É a página original, servida como sempre.
    -- '/ab/<slug>/b' na variante 'b'.
    page_path  TEXT NOT NULL DEFAULT '',
    peso       INTEGER NOT NULL,  -- soma 100 entre as duas
    UNIQUE (test_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_ab_variants_teste ON ab_variants(test_id);

-- Log de EXPOSIÇÃO: quem foi sorteado, para qual variante, quando. É o
-- denominador do teste.
--
-- Existe uma tabela em vez de uma coluna em `sessions` por dois motivos. O
-- primeiro é que o cookie de 400 dias faz um visitante atravessar vários
-- testes ao longo do tempo, e uma coluna só guardaria o primeiro. O segundo é
-- que decidir a variante só no edge, confiando no cookie, enviesa a amostra —
-- registrar a exposição no servidor é o que torna o denominador confiável.
--
-- Efeito colateral bem-vindo: o denominador deixa de depender de normalizar
-- `sessions.landing_url`, que hoje faz '/se-v1', '/se-v1/' e o domínio com
-- 'www.' aparecerem como três linhas diferentes no relatório de conversão.
CREATE TABLE IF NOT EXISTS ab_assignments (
    session_id   TEXT NOT NULL,
    test_id      INTEGER NOT NULL,
    variante     TEXT NOT NULL,     -- 'a' | 'b'
    assigned_at  INTEGER NOT NULL,  -- unix seconds
    -- Sessão que abriu a variante pelo modo preview. Fica FORA de toda
    -- estatística: conferir a própria página antes de ligar o teste não pode
    -- contar como visitante sorteado.
    is_preview   INTEGER NOT NULL DEFAULT 0,
    -- Garante o first-touch no BANCO, e não só no cookie: quem já foi
    -- exposto não é reatribuído nem que o cookie suma.
    PRIMARY KEY (session_id, test_id)
);

-- Agregação dos resultados por teste (a consulta do painel).
CREATE INDEX IF NOT EXISTS idx_ab_assign_teste ON ab_assignments(test_id, variante);
