import { defineConfig } from 'astro/config';

// Site estático servido pelo Cloudflare Pages, lado a lado com as
// Pages Functions de tracking em `functions/` (middleware de cookies,
// /tracker, /api/*, /webhook/*, /scripts/*). O Astro NÃO gerencia essas
// rotas — elas são servidas pelas Functions, que têm prioridade sobre
// os assets estáticos. Por isso o output é puramente estático (sem adapter).
export default defineConfig({
  output: 'static',
  // Gera /pagina/index.html — combina com as rotas amigáveis do site.
  build: { format: 'directory' },
  // O Cloudflare Pages serve ambos /pagina e /pagina/ — manter consistente.
  trailingSlash: 'ignore',
});
