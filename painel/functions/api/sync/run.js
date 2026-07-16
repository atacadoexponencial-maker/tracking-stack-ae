// POST /api/sync/run — disparado por cron externo (mesmo padrão do
// /api/sync/meta-ads do tracking: header x-sync-secret = env.SYNC_SECRET).
// Body opcional: { date_from, date_to, cliente_id } — sem body, últimos 3 dias.
import { sincronizarTudo } from './_core.js';

export async function onRequestPost({ request, env }) {
  const secret = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || secret !== env.SYNC_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  let body = {};
  try { body = await request.json(); } catch {}

  const resultado = await sincronizarTudo(env, {
    de: body.date_from, ate: body.date_to,
    clienteId: body.cliente_id ? Number(body.cliente_id) : undefined,
  });
  return new Response(JSON.stringify({ ok: true, ...resultado }), { headers: { 'Content-Type': 'application/json' } });
}
