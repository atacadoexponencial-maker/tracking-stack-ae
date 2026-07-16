-- Schema inicial do painel de clientes (issue 86).
-- Resumos diários alimentados pelo sync do Windsor; dashboard só lê daqui.
-- Valores monetários em cents (INTEGER) para evitar deriva de float —
-- mesmo padrão da tabela ad_spend do tracking.

CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,          -- link secreto: /c/<slug>
    meta_account_id TEXT,               -- conta Meta Ads (sem 'act_')
    gads_customer_id TEXT,              -- conta Google Ads (com ou sem hífens)
    ga4_property_id TEXT,               -- propriedade GA4
    ativo INTEGER NOT NULL DEFAULT 1,   -- 0 = link revogado
    criado_em INTEGER NOT NULL          -- unix seconds
);

CREATE TABLE IF NOT EXISTS metas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    mes TEXT NOT NULL,                  -- 'YYYY-MM'
    meta_faturamento_cents INTEGER NOT NULL DEFAULT 0,
    meta_investimento_cents INTEGER NOT NULL DEFAULT 0,
    taxa_projetada REAL,                -- % projetada, ex.: 1.2
    UNIQUE(cliente_id, mes)
);

-- Resumo diário por campanha (Meta Ads e Google Ads).
CREATE TABLE IF NOT EXISTS ads_diario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    fonte TEXT NOT NULL,                -- 'meta' | 'google'
    data TEXT NOT NULL,                 -- 'YYYY-MM-DD'
    campanha_id TEXT NOT NULL,
    campanha TEXT,
    gasto_cents INTEGER NOT NULL DEFAULT 0,
    impressoes INTEGER DEFAULT 0,
    cliques INTEGER DEFAULT 0,
    conversoes REAL DEFAULT 0,
    receita_cents INTEGER DEFAULT 0,
    UNIQUE(cliente_id, fonte, data, campanha_id)
);
CREATE INDEX IF NOT EXISTS idx_ads_diario_cliente_data ON ads_diario(cliente_id, data);

-- Resumo diário por criativo/anúncio (Meta Ads).
CREATE TABLE IF NOT EXISTS criativos_diario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    ad_id TEXT NOT NULL,
    ad_nome TEXT,
    thumbnail_url TEXT,
    gasto_cents INTEGER DEFAULT 0,
    alcance INTEGER DEFAULT 0,
    frequencia REAL DEFAULT 0,
    impressoes INTEGER DEFAULT 0,
    cliques INTEGER DEFAULT 0,
    pedidos INTEGER DEFAULT 0,          -- actions_purchase
    receita_cents INTEGER DEFAULT 0,    -- action_values_purchase
    UNIQUE(cliente_id, data, ad_id)
);
CREATE INDEX IF NOT EXISTS idx_criativos_cliente_data ON criativos_diario(cliente_id, data);

-- Resumo diário GA4 por canal + origem/mídia.
CREATE TABLE IF NOT EXISTS ga4_diario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    canal TEXT NOT NULL DEFAULT '',     -- session_default_channel_group
    origem TEXT NOT NULL DEFAULT '',    -- source
    midia TEXT NOT NULL DEFAULT '',     -- medium
    sessoes INTEGER DEFAULT 0,
    usuarios INTEGER DEFAULT 0,
    novos_usuarios INTEGER DEFAULT 0,
    sessoes_engajadas INTEGER DEFAULT 0,
    pedidos INTEGER DEFAULT 0,          -- transactions
    receita_cents INTEGER DEFAULT 0,    -- totalrevenue
    UNIQUE(cliente_id, data, canal, origem, midia)
);
CREATE INDEX IF NOT EXISTS idx_ga4_diario_cliente_data ON ga4_diario(cliente_id, data);

-- Etapas do funil por dia (GA4).
CREATE TABLE IF NOT EXISTS ga4_funil (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    sessoes INTEGER DEFAULT 0,
    carrinho INTEGER DEFAULT 0,         -- add_to_carts
    checkout INTEGER DEFAULT 0,         -- checkouts
    pedidos INTEGER DEFAULT 0,          -- transactions
    UNIQUE(cliente_id, data)
);

-- Receita por produto por dia (GA4).
CREATE TABLE IF NOT EXISTS ga4_produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    produto TEXT NOT NULL,              -- item_name
    receita_cents INTEGER DEFAULT 0,    -- item_revenue
    pedidos INTEGER DEFAULT 0,          -- items_purchased
    UNIQUE(cliente_id, data, produto)
);
CREATE INDEX IF NOT EXISTS idx_ga4_produtos_cliente_data ON ga4_produtos(cliente_id, data);

-- Registro de execuções do sync (mesmo espírito do sync_log do tracking).
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,                 -- NULL = execução geral
    fonte TEXT NOT NULL,                -- 'meta' | 'google' | 'ga4' | 'criativos' | 'funil' | 'produtos'
    status TEXT NOT NULL,               -- 'ok' | 'error'
    linhas INTEGER DEFAULT 0,
    erro TEXT,
    duracao_ms INTEGER,
    executado_em INTEGER NOT NULL       -- unix seconds
);
CREATE INDEX IF NOT EXISTS idx_sync_log_run ON sync_log(fonte, executado_em DESC);
