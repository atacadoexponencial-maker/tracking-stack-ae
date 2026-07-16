// Helpers das APIs de consulta do dashboard (issues 94–100).
// Toda a matemática (deltas, taxas, ROAS, projeções) vive aqui no backend;
// o front só formata e exibe.
export { resolverCliente, json, naoEncontrado } from '../_cliente.js';

// Período pedido + período anterior de mesma duração (para os deltas ▲▼).
export function periodos(request) {
  const p = new URL(request.url).searchParams;
  const re = /^\d{4}-\d{2}-\d{2}$/;
  let de = p.get('de'), ate = p.get('ate');
  if (!re.test(de) || !re.test(ate) || de > ate) return null;
  const dias = Math.round((Date.parse(ate) - Date.parse(de)) / 864e5) + 1;
  const antAte = new Date(Date.parse(de) - 864e5).toISOString().slice(0, 10);
  const antDe = new Date(Date.parse(antAte) - (dias - 1) * 864e5).toISOString().slice(0, 10);
  return { de, ate, antDe, antAte, dias };
}

export function delta(atual, anterior) {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

export const div = (a, b) => (b ? a / b : null);

// Totais GA4 do intervalo (ga4_diario agregado).
export async function totaisGa4(db, clienteId, de, ate) {
  return db.prepare(
    `SELECT COALESCE(SUM(sessoes),0) sessoes, COALESCE(SUM(usuarios),0) usuarios,
            COALESCE(SUM(novos_usuarios),0) novos, COALESCE(SUM(sessoes_engajadas),0) engajadas,
            COALESCE(SUM(pedidos),0) pedidos, COALESCE(SUM(receita_cents),0) receita_cents
     FROM ga4_diario WHERE cliente_id = ? AND data BETWEEN ? AND ?`
  ).bind(clienteId, de, ate).first();
}

// Totais de ads do intervalo, opcionalmente por fonte.
export async function totaisAds(db, clienteId, de, ate, fonte = null) {
  let q = `SELECT COALESCE(SUM(gasto_cents),0) gasto_cents, COALESCE(SUM(impressoes),0) impressoes,
                  COALESCE(SUM(cliques),0) cliques, COALESCE(SUM(conversoes),0) conversoes,
                  COALESCE(SUM(receita_cents),0) receita_cents
           FROM ads_diario WHERE cliente_id = ? AND data BETWEEN ? AND ?`;
  const binds = [clienteId, de, ate];
  if (fonte) { q += ' AND fonte = ?'; binds.push(fonte); }
  return db.prepare(q).bind(...binds).first();
}

// Última data com dados sincronizados (o "atualizado até DD/MM" do topo).
export async function atualizadoAte(db, clienteId) {
  const r = await db.prepare(
    `SELECT MAX(ultima) m FROM (
       SELECT MAX(data) ultima FROM ga4_diario WHERE cliente_id = ?1
       UNION ALL SELECT MAX(data) FROM ads_diario WHERE cliente_id = ?1
     )`
  ).bind(clienteId).first();
  return r ? r.m : null;
}

export const kpi = (rotulo, valor, tipo, delta_pct = null, invertido = false) =>
  ({ rotulo, valor, tipo, delta_pct, invertido });
