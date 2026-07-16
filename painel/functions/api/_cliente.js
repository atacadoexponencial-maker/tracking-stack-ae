// Resolver compartilhado do link secreto: slug → cliente ativo.
// Toda API de dados do dashboard DEVE passar por aqui — slug inválido ou
// revogado nunca chega a uma query de métricas.

export async function resolverCliente(env, slug) {
  if (!slug || !/^[a-z0-9-]{8,64}$/.test(slug)) return null;
  const row = await env.DB.prepare(
    'SELECT id, nome, slug, meta_account_id, gads_customer_id, ga4_property_id FROM clientes WHERE slug = ? AND ativo = 1'
  ).bind(slug).first();
  return row || null;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function naoEncontrado() {
  return json({ error: 'not_found' }, 404);
}
