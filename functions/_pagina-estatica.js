// Devolve uma página estática do Astro num endereço com parte variável
// (/agendar/<tipo>, /reuniao/<token>). O site é 100% estático, então a página
// é uma só e lê a parte variável do próprio endereço no navegador.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
export async function servirPagina(context, caminho) {
  const { request, env } = context;
  let url = new URL(caminho, request.url);
  // O Pages pode responder /pagina com redirecionamento para /pagina/ (e
  // vice-versa); segue no máximo dois saltos para devolver o HTML direto.
  for (let i = 0; i < 3; i++) {
    const r = await env.ASSETS.fetch(new Request(url, { headers: request.headers }));
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      url = new URL(r.headers.get('location'), url);
      continue;
    }
    const h = new Headers(r.headers);
    h.set('Cache-Control', 'no-store');
    h.set('X-Robots-Tag', 'noindex');
    return new Response(r.body, { status: r.status, headers: h });
  }
  return new Response('Not found', { status: 404 });
}
