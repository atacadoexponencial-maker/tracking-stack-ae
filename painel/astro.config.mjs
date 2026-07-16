import { defineConfig } from 'astro/config';

// Painel de clientes — mesmo arranjo do site da raiz: site estático servido
// pelo Cloudflare Pages, lado a lado com as Pages Functions em `functions/`
// (APIs de consulta, sync do Windsor, admin). O Astro NÃO gerencia essas
// rotas — elas têm prioridade sobre os assets estáticos.
export default defineConfig({
  output: 'static',
  build: { format: 'directory' },
  trailingSlash: 'ignore',
});
