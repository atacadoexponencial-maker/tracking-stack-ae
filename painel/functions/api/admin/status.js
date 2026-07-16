// GET /api/admin/status — saúde das conexões por cliente × fonte:
// 🟢 ok · 🟡 sem dados novos há mais de 24h · 🔴 erro no último sync.
// (issues 85/92 — derivado de sync_log + última data com dados.)
import { json } from './_auth.js';

const FONTES = ['meta', 'google', 'ga4'];
const CAMPO_CONTA = { meta: 'meta_account_id', google: 'gads_customer_id', ga4: 'ga4_property_id' };

export async function onRequestGet({ env }) {
  const { results: clientes } = await env.DB.prepare(
    'SELECT id, nome, meta_account_id, gads_customer_id, ga4_property_id, ativo FROM clientes ORDER BY nome'
  ).all();

  const { results: ults } = await env.DB.prepare(
    `SELECT cliente_id, fonte, status, erro, executado_em, linhas FROM sync_log s
     WHERE id = (SELECT MAX(id) FROM sync_log WHERE cliente_id = s.cliente_id AND fonte = s.fonte)`
  ).all();
  const ultimo = {};
  for (const u of ults) ultimo[`${u.cliente_id}:${u.fonte}`] = u;

  const { results: datasAds } = await env.DB.prepare(
    'SELECT cliente_id, fonte, MAX(data) AS ultima FROM ads_diario GROUP BY cliente_id, fonte'
  ).all();
  const { results: datasGa4 } = await env.DB.prepare(
    "SELECT cliente_id, 'ga4' AS fonte, MAX(data) AS ultima FROM ga4_diario GROUP BY cliente_id"
  ).all();
  const ultimaData = {};
  for (const d of [...datasAds, ...datasGa4]) ultimaData[`${d.cliente_id}:${d.fonte}`] = d.ultima;

  const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const linhas = [];
  for (const c of clientes) {
    for (const f of FONTES) {
      if (!c[CAMPO_CONTA[f]]) continue; // fonte não conectada: não aparece
      const log = ultimo[`${c.id}:${f}`];
      const dado = ultimaData[`${c.id}:${f}`] || null;
      let status = 'amarelo';
      if (log && log.status === 'error') status = 'vermelho';
      else if (dado && dado >= ontem) status = 'verde';
      linhas.push({
        cliente: c.nome, cliente_id: c.id, ativo: c.ativo, fonte: f, status,
        ultima_data: dado, ultimo_sync: log ? log.executado_em : null,
        erro: log && log.status === 'error' ? log.erro : null,
      });
    }
  }
  return json({ status: linhas });
}
