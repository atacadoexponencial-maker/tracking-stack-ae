// Redireciona /grupo-da-live para o grupo de WhatsApp da live (302 server-side).
//
// Existe porque o botão de URL dos templates do WhatsApp (API oficial) NÃO aceita
// link direto de grupo (chat.whatsapp.com). A solução é apontar o botão para esta
// página do próprio domínio, que faz o redirect para o link real do grupo.
//
// O destino vem de env.LEAD_REDIRECT_LIVE — a MESMA env var usada no redirect
// pós-formulário da LP da live. Trocar o grupo no futuro é só mudar a env var,
// sem novo deploy e sem duplicar o link no código.
export async function onRequestGet(context) {
  const { env } = context;
  const target = (env.LEAD_REDIRECT_LIVE || '').trim() || '/';
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      // O destino é dirigido por env var e pode mudar; não deixar cachear.
      'Cache-Control': 'no-store',
    },
  });
}
