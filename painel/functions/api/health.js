// GET /api/health — verificação de vida do painel.
// Responde 200 sempre; `db` indica se o binding D1 está acessível.
export async function onRequestGet(context) {
  const { env } = context;

  let db = false;
  try {
    if (env.DB) {
      await env.DB.prepare('SELECT 1').first();
      db = true;
    }
  } catch (_) {
    db = false;
  }

  return new Response(JSON.stringify({ ok: true, db }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
