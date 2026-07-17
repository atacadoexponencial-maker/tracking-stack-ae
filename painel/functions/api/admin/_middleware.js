// Protege todas as rotas /api/admin/* exceto o login.
import { sessaoValida, json } from './_auth.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const path = new URL(request.url).pathname;
  if (path === '/api/admin/login') return next();
  if (!(await sessaoValida(request, env))) return json({ error: 'unauthorized' }, 401);
  return next();
}
