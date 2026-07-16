// GET /api/painel/cliente?slug=<slug>
// Primeira chamada do dashboard: valida o link secreto e informa nome do
// cliente + quais fontes ele tem conectadas (seções sem fonte somem da UI).
import { resolverCliente, json, naoEncontrado } from '../_cliente.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const slug = new URL(request.url).searchParams.get('slug');

  const cliente = await resolverCliente(env, slug);
  if (!cliente) return naoEncontrado();

  return json({
    nome: cliente.nome,
    fontes: {
      meta: Boolean(cliente.meta_account_id),
      google: Boolean(cliente.gads_customer_id),
      ga4: Boolean(cliente.ga4_property_id),
    },
  });
}
