// POST /api/admin/login { senha } → Set-Cookie de sessão (7 dias).
import { criarToken, senhaConfere, json } from './_auth.js';

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch {}
  if (!(await senhaConfere(env, body.senha))) return json({ error: 'invalid' }, 401);

  const token = await criarToken(env);
  return json({ ok: true }, 200, {
    'Set-Cookie': `painel_admin=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 86400}`,
  });
}
