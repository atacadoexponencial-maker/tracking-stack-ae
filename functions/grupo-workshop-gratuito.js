// Redireciona /grupo-workshop-gratuito para o grupo de WhatsApp dos workshops
// GRATUITOS (302 server-side). Criada em 29/09/2026.
//
// Mesmo molde de /grupo-workshop (grupo de quem COMPROU o workshop pago) e
// /grupo-da-live: o botão de URL dos templates do WhatsApp (API oficial) não
// aceita link direto de grupo, então aponta para esta página do domínio. É
// também o destino do botão da /obrigado-workshop-gratuito, a página que o
// lead vê depois do formulário da /workshop-gratuito.
//
// O destino vem de env.LEAD_REDIRECT_WORKSHOP, a mesma variável que antes
// mandava o lead direto ao grupo: trocar o grupo continua sendo mudar um lugar
// só.
//
// Vive em functions/ porque as Pages Functions têm prioridade sobre os assets
// estáticos do Astro.
export async function onRequestGet(context) {
  const { env } = context;
  // Sem a env var, a home: link de disparo que abre página quebrada é pior.
  const target = (env.LEAD_REDIRECT_WORKSHOP || '').trim() || '/';
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'no-store',
    },
  });
}
