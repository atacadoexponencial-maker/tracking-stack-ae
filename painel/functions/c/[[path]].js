// Serve o app do dashboard em /c/<slug> sem alterar a URL do navegador
// (o slug fica no path e é lido pelo dash.js). O conteúdo vem do asset
// estático /dash/ buildado pelo Astro.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  url.pathname = '/dash/';

  let res = await env.ASSETS.fetch(new Request(url.toString(), { headers: request.headers }));
  // Pretty URLs podem responder com redirect — segue internamente.
  for (let i = 0; i < 2 && res.status >= 300 && res.status < 400; i++) {
    const loc = new URL(res.headers.get('Location'), url);
    res = await env.ASSETS.fetch(new Request(loc.toString(), { headers: request.headers }));
  }

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
