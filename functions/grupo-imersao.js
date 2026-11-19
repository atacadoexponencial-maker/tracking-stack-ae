// Redireciona /grupo-imersao para o grupo de WhatsApp de quem COMPROU a
// Imersão Planejamento Atacado 2027 (302 server-side).
//
// Mesmo motivo de /grupo-workshop: o botão de URL dos templates do WhatsApp
// (API oficial) NÃO aceita link direto de grupo (chat.whatsapp.com). Este
// endereço do próprio domínio serve para a página de obrigado
// (/obrigado-imersao-planejamento-atacado), para o e-mail e para os templates.
//
// O destino vem de env.GRUPO_IMERSAO_URL. Trocar o grupo é mudar a env var e
// fazer um deploy novo, sem tocar em código.
//
// Vive em functions/ (e não em src/pages/) porque as Pages Functions têm
// prioridade sobre os assets estáticos do Astro.
export async function onRequestGet(context) {
  const { env } = context;
  // Sem a env var, manda para a home em vez de mostrar erro.
  const target = (env.GRUPO_IMERSAO_URL || '').trim() || '/';
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'no-store',
    },
  });
}
