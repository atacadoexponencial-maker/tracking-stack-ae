// Núcleo do sync Windsor → D1 (issues 88–92).
// Cada fonte roda isolada por cliente: falha em uma não interrompe as outras;
// toda execução registra uma linha em sync_log. Upsert idempotente — o cron
// re-puxa os últimos dias para capturar ajustes retroativos de atribuição.

const cents = (v) => Math.round(Number(v || 0) * 100);
const int = (v) => Math.round(Number(v || 0));

async function windsor(env, connector, fields, contas, de, ate) {
  const url = `https://connectors.windsor.ai/${connector}` +
    `?api_key=${encodeURIComponent(env.WINDSOR_API_KEY)}` +
    `&date_from=${de}&date_to=${ate}` +
    `&fields=${fields.join(',')}` +
    `&select_accounts=${encodeURIComponent(contas)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Windsor ${connector} HTTP ${r.status}: ${(await r.text()).slice(0, 180)}`);
  const corpo = await r.json();
  if (!Array.isArray(corpo.data)) throw new Error(`Windsor ${connector}: resposta sem data[]`);
  return corpo.data;
}

async function upsert(db, sql, linhas, bind) {
  if (!linhas.length) return 0;
  const stmt = db.prepare(sql);
  // D1 aceita até ~100 statements por batch com folga; fatia por segurança.
  for (let i = 0; i < linhas.length; i += 50) {
    await db.batch(linhas.slice(i, i + 50).map((l) => stmt.bind(...bind(l))));
  }
  return linhas.length;
}

async function registrar(db, clienteId, fonte, status, linhas, erro, inicioMs) {
  await db.prepare(
    `INSERT INTO sync_log (cliente_id, fonte, status, linhas, erro, duracao_ms, executado_em)
     VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now'))`
  ).bind(clienteId, fonte, status, linhas, erro, Date.now() - inicioMs).run();
}

// Executa uma fonte para um cliente, com registro e isolamento de erro.
async function rodarFonte(env, cliente, fonte, fn) {
  const inicio = Date.now();
  try {
    const linhas = await fn();
    await registrar(env.DB, cliente.id, fonte, 'ok', linhas, null, inicio);
    return { fonte, ok: true, linhas };
  } catch (e) {
    await registrar(env.DB, cliente.id, fonte, 'error', 0, String(e.message || e).slice(0, 400), inicio);
    return { fonte, ok: false, erro: String(e.message || e) };
  }
}

const SQL_ADS = `INSERT INTO ads_diario (cliente_id, fonte, data, campanha_id, campanha, gasto_cents, impressoes, cliques, conversoes, receita_cents)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(cliente_id, fonte, data, campanha_id) DO UPDATE SET
    campanha = excluded.campanha, gasto_cents = excluded.gasto_cents, impressoes = excluded.impressoes,
    cliques = excluded.cliques, conversoes = excluded.conversoes, receita_cents = excluded.receita_cents`;

export async function sincronizarCliente(env, cliente, de, ate) {
  const resultados = [];

  if (cliente.meta_account_id) {
    resultados.push(await rodarFonte(env, cliente, 'meta', async () => {
      const dados = await windsor(env, 'facebook',
        ['date', 'campaign_id', 'campaign', 'spend', 'impressions', 'clicks', 'actions_purchase', 'action_values_purchase'],
        cliente.meta_account_id, de, ate);
      const linhas = dados.filter((d) => d.campaign_id);
      return upsert(env.DB, SQL_ADS, linhas, (d) => [
        cliente.id, 'meta', d.date, String(d.campaign_id), d.campaign || '',
        cents(d.spend), int(d.impressions), int(d.clicks), Number(d.actions_purchase || 0), cents(d.action_values_purchase),
      ]);
    }));

    resultados.push(await rodarFonte(env, cliente, 'criativos', async () => {
      const dados = await windsor(env, 'facebook',
        ['date', 'ad_id', 'ad_name', 'thumbnail_url', 'spend', 'reach', 'frequency', 'impressions', 'clicks', 'actions_purchase', 'action_values_purchase'],
        cliente.meta_account_id, de, ate);
      const linhas = dados.filter((d) => d.ad_id);
      return upsert(env.DB,
        `INSERT INTO criativos_diario (cliente_id, data, ad_id, ad_nome, thumbnail_url, gasto_cents, alcance, frequencia, impressoes, cliques, pedidos, receita_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(cliente_id, data, ad_id) DO UPDATE SET
           ad_nome = excluded.ad_nome, thumbnail_url = excluded.thumbnail_url, gasto_cents = excluded.gasto_cents,
           alcance = excluded.alcance, frequencia = excluded.frequencia, impressoes = excluded.impressoes,
           cliques = excluded.cliques, pedidos = excluded.pedidos, receita_cents = excluded.receita_cents`,
        linhas, (d) => [
          cliente.id, d.date, String(d.ad_id), d.ad_name || '', d.thumbnail_url || '',
          cents(d.spend), int(d.reach), Number(d.frequency || 0), int(d.impressions), int(d.clicks),
          int(d.actions_purchase), cents(d.action_values_purchase),
        ]);
    }));
  }

  if (cliente.gads_customer_id) {
    resultados.push(await rodarFonte(env, cliente, 'google', async () => {
      const dados = await windsor(env, 'google_ads',
        ['date', 'campaign_id', 'campaign', 'spend', 'impressions', 'clicks', 'conversions', 'conversion_value'],
        cliente.gads_customer_id, de, ate);
      const linhas = dados.filter((d) => d.campaign_id);
      return upsert(env.DB, SQL_ADS, linhas, (d) => [
        cliente.id, 'google', d.date, String(d.campaign_id), d.campaign || '',
        cents(d.spend), int(d.impressions), int(d.clicks), Number(d.conversions || 0), cents(d.conversion_value),
      ]);
    }));
  }

  if (cliente.ga4_property_id) {
    resultados.push(await rodarFonte(env, cliente, 'ga4', async () => {
      const dados = await windsor(env, 'googleanalytics4',
        ['date', 'session_default_channel_group', 'source', 'medium', 'sessions', 'totalusers', 'newusers', 'engaged_sessions', 'transactions', 'totalrevenue'],
        cliente.ga4_property_id, de, ate);
      return upsert(env.DB,
        `INSERT INTO ga4_diario (cliente_id, data, canal, origem, midia, sessoes, usuarios, novos_usuarios, sessoes_engajadas, pedidos, receita_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(cliente_id, data, canal, origem, midia) DO UPDATE SET
           sessoes = excluded.sessoes, usuarios = excluded.usuarios, novos_usuarios = excluded.novos_usuarios,
           sessoes_engajadas = excluded.sessoes_engajadas, pedidos = excluded.pedidos, receita_cents = excluded.receita_cents`,
        dados, (d) => [
          cliente.id, d.date, d.session_default_channel_group || '', d.source || '', d.medium || '',
          int(d.sessions), int(d.totalusers), int(d.newusers), int(d.engaged_sessions), int(d.transactions), cents(d.totalrevenue),
        ]);
    }));

    resultados.push(await rodarFonte(env, cliente, 'funil', async () => {
      const dados = await windsor(env, 'googleanalytics4',
        ['date', 'sessions', 'add_to_carts', 'checkouts', 'transactions', 'totalusers', 'newusers', 'engaged_sessions', 'totalrevenue'],
        cliente.ga4_property_id, de, ate);
      return upsert(env.DB,
        `INSERT INTO ga4_funil (cliente_id, data, sessoes, carrinho, checkout, pedidos, usuarios, novos_usuarios, sessoes_engajadas, receita_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(cliente_id, data) DO UPDATE SET
           sessoes = excluded.sessoes, carrinho = excluded.carrinho, checkout = excluded.checkout, pedidos = excluded.pedidos,
           usuarios = excluded.usuarios, novos_usuarios = excluded.novos_usuarios,
           sessoes_engajadas = excluded.sessoes_engajadas, receita_cents = excluded.receita_cents`,
        dados, (d) => [
          cliente.id, d.date, int(d.sessions), int(d.add_to_carts), int(d.checkouts), int(d.transactions),
          int(d.totalusers), int(d.newusers), int(d.engaged_sessions), cents(d.totalrevenue),
        ]);
    }));

    resultados.push(await rodarFonte(env, cliente, 'produtos', async () => {
      const dados = await windsor(env, 'googleanalytics4',
        ['date', 'item_name', 'item_revenue', 'items_purchased'],
        cliente.ga4_property_id, de, ate);
      const linhas = dados.filter((d) => d.item_name);
      return upsert(env.DB,
        `INSERT INTO ga4_produtos (cliente_id, data, produto, receita_cents, pedidos)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(cliente_id, data, produto) DO UPDATE SET
           receita_cents = excluded.receita_cents, pedidos = excluded.pedidos`,
        linhas, (d) => [cliente.id, d.date, d.item_name, cents(d.item_revenue), int(d.items_purchased)]);
    }));
  }

  return resultados;
}

// Janela padrão do cron: últimos 3 dias (ajustes retroativos de atribuição).
export function janelaPadrao() {
  const ate = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const de = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  return { de, ate };
}

export async function sincronizarTudo(env, { de, ate, clienteId } = {}) {
  if (!de || !ate) ({ de, ate } = janelaPadrao());
  let q = 'SELECT id, nome, meta_account_id, gads_customer_id, ga4_property_id FROM clientes WHERE ativo = 1';
  const binds = [];
  if (clienteId) { q += ' AND id = ?'; binds.push(clienteId); }
  const { results: clientes } = await env.DB.prepare(q).bind(...binds).all();

  const saida = [];
  for (const c of clientes) {
    saida.push({ cliente: c.nome, resultados: await sincronizarCliente(env, c, de, ate) });
  }
  return { de, ate, clientes: saida };
}
