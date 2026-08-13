// Redireciona /grupo-workshop para o grupo de WhatsApp de quem COMPROU o
// Workshop Black Exponencial (302 server-side).
//
// Existe pelo mesmo motivo de /grupo-da-live: o botão de URL dos templates do
// WhatsApp (API oficial) NÃO aceita link direto de grupo (chat.whatsapp.com).
// A solução é apontar o botão para esta página do próprio domínio, que faz o
// redirect para o link real do grupo.
//
// É um grupo DIFERENTE do "📦 Workshop | Atacado Exponencial" já monitorado na
// aba Grupos: aquele é dos inscritos, este é só de quem pagou.
//
// O destino vem de env.GRUPO_WORKSHOP_URL. Nome próprio, e não a família
// LEAD_REDIRECT_*: aquelas são destinos de pós-formulário, e aqui não há
// formulário nenhum — quem chega já comprou. Trocar o grupo na próxima turma é
// mudar a env var e rebuildar, sem tocar em código.
//
// Vive em functions/ (e não em src/pages/) porque as Pages Functions têm
// prioridade sobre os assets estáticos do Astro — mesmo padrão de
// grupo-da-live.js e links.js.
export async function onRequestGet(context) {
  const { env } = context;
  // Sem a env var, manda para a home em vez de mostrar erro: um link de disparo
  // que abre uma página quebrada é pior do que um que abre o site.
  const target = (env.GRUPO_WORKSHOP_URL || '').trim() || '/';
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      // O destino é dirigido por env var e pode mudar a cada turma; não cachear.
      'Cache-Control': 'no-store',
    },
  });
}
