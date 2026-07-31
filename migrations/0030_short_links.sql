-- Link redirecionador /links (spec 2026-07-31). Um endereço fixo do domínio para
-- usar nos disparos do grupo, cujo destino é trocável pelo dash e pode ser
-- agendado. Nenhuma tabela existente é alterada aqui.

-- Um destino por linha. O agendamento vive nestas colunas e é resolvido na
-- LEITURA, a cada clique — o Cloudflare Pages não tem cron, e assim a virada da
-- janela não depende de nada rodando na hora certa.
CREATE TABLE IF NOT EXISTS short_links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT NOT NULL,     -- rótulo da usuária, ex.: "Disparo Live 05/08"
    target_url  TEXT NOT NULL,     -- só http/https; validado em /api/links
    -- Janela de validade (unix seconds). Os DOIS nulos = este é o destino
    -- PADRÃO, que atende sempre que nenhuma janela estiver valendo. Nunca só um
    -- dos dois: a API recusa datas pela metade.
    starts_at   INTEGER,
    ends_at     INTEGER,
    criado_em   INTEGER NOT NULL,
    -- Apagar é MARCAÇÃO, não remoção. Os cliques já recebidos apontam para esta
    -- linha; removê-la de verdade faria o histórico perder rótulo e URL, ou seja,
    -- mentiria sobre disparos que realmente aconteceram.
    apagado_em  INTEGER
);

-- Sustenta a escolha do destino a cada clique: filtra os apagados e ordena pelo
-- início da janela (o desempate de janelas sobrepostas é `starts_at DESC`).
CREATE INDEX IF NOT EXISTS idx_short_links_ativo
    ON short_links(apagado_em, starts_at);

-- Um registro por clique — e não um contador na linha do destino. Um contador
-- responde "quantos", nunca "quando", e num disparo de grupo a curva por hora é
-- justamente o sinal útil. O volume é baixo (centenas por disparo).
CREATE TABLE IF NOT EXISTS short_link_clicks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Qual destino serviu. NULL quando NENHUM estava cadastrado: o clique ainda
    -- é gravado, porque perdê-lo esconderia exatamente o caso que precisa de
    -- conserto (link circulando sem destino configurado).
    link_id      INTEGER,
    occurred_at  INTEGER NOT NULL,  -- unix seconds
    -- 'YYYY-MM-DD' em -03:00, calculado UMA vez na escrita (mesmo padrão de
    -- whatsapp_group_events): a agregação por dia não depende do fuso de quem lê.
    day_local    TEXT NOT NULL,
    utm_source   TEXT,
    utm_medium   TEXT,
    utm_campaign TEXT,
    utm_content  TEXT,
    user_agent   TEXT,
    ip           TEXT
);

-- Agregação de cliques por destino (tabela do dash).
CREATE INDEX IF NOT EXISTS idx_slc_link
    ON short_link_clicks(link_id);
-- Curva por dia.
CREATE INDEX IF NOT EXISTS idx_slc_dia
    ON short_link_clicks(day_local);
