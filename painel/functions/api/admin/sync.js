// POST /api/admin/sync — "Sincronizar agora" do admin (sessão via middleware).
// Body opcional: { cliente_id, date_from, date_to } — também usado no backfill
// (issue 93), chamado mês a mês.
import { json } from './_auth.js';
import { sincronizarTudo } from '../sync/_core.js';

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch {}
  const resultado = await sincronizarTudo(env, {
    de: body.date_from, ate: body.date_to,
    clienteId: body.cliente_id ? Number(body.cliente_id) : undefined,
  });
  return json({ ok: true, ...resultado });
}
