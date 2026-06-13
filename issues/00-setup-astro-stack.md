# 00: Setup do Astro integrado ao stack de tracking

**Tipo:** Protótipo (fundação técnica)
**Página:** Infraestrutura (transversal)

## Descrição

Integrar o Astro ao repositório `tracking-stack-ae` para que o site (buildado em `dist/`) e as Cloudflare Pages Functions de tracking (`functions/`) convivam no mesmo projeto/domínio Pages. É o pré-requisito de todas as páginas.

## Pesquisa interna (o que reaproveitar)

- `functions/_middleware.js` — **reaproveitar como está.** Já intercepta só requisições de página HTML e pula assets (`.js/.css/.woff2/.webp/...`), `/tracker`, `/scripts/`, `/webhook/`, `/api/`, `/checkout-session`, `/dash`. Vai aplicar os cookies first-party em todas as páginas Astro automaticamente, sem alteração.
- `functions/` inteiro (tracker.js, api/*, webhook/*, scripts/[[path]].js) — **mantém na raiz.** O Cloudflare Pages detecta `functions/` na raiz independentemente do framework; as rotas de função têm prioridade sobre os assets estáticos do Astro.
- `dash/index.html` — dashboard; mover para `public/dash/index.html` para continuar servido em `/dash` (o middleware já pula `/dash`).
- `migrations/`, `wrangler.toml` (gitignored) — mantêm; servem para `wrangler d1 migrations apply` e dev local.
- `.gitignore` — já ignora `node_modules/`, `wrangler.toml`, `.wrangler/`; falta `dist/`.

## Cenários

### Happy Path
1. O projeto ganha `package.json` + `astro.config.mjs` e a estrutura `src/` + `public/`.
2. `npm run build` gera o site estático em `dist/`.
3. No projeto Cloudflare Pages, o build command passa a ser `npm run build` e o diretório de saída `dist`.
4. Um push na `main` dispara o build automático; o Pages serve as páginas de `dist/` e roda as `functions/` para `/tracker`, `/api/*`, `/webhook/*`, `/scripts/*`, `/dash`.
5. Acessando a URL de teste (`tracking-ae.pages.dev`), a home Astro carrega e os cookies first-party (`_krob_sid`, `_fbp`) são setados pelo middleware.

### Edge Cases
- Colisão de rota entre uma página Astro e uma função: evitada porque as funções vivem em caminhos reservados (`/tracker`, `/api`, `/webhook`, `/scripts`, `/checkout-session`, `/dash`) que não são usados como páginas do site.
- O middleware não deve setar cookie em assets: já garantido pela regra de extensão de arquivo dele.

### Cenário de Erro
- Se `npm run build` falhar no Pages, o deploy não publica e a versão anterior permanece no ar (comportamento padrão do Pages). O erro aparece no log de build do projeto.

## Arquivos

- **Criar:** `package.json` — dependências (`astro`) e scripts (`dev`, `build`, `preview`).
- **Criar:** `astro.config.mjs` — config do Astro (output estático, `trailingSlash`, integração de sitemap opcional).
- **Criar:** `tsconfig.json` — config TypeScript padrão do Astro.
- **Criar:** `src/pages/index.astro` — placeholder mínimo para o primeiro build válido (substituído pela issue 01).
- **Modificar:** `.gitignore` — adicionar `dist/`.
- **Mover:** `dash/index.html` → `public/dash/index.html` — manter o dashboard acessível em `/dash`.
- **Remover:** `examples/` — páginas de exemplo não usadas em produção.
- **Config externa (não-arquivo):** atualizar o build do projeto Pages `tracking-ae` via API — `build_command = "npm run build"`, `destination_dir = "dist"` (hoje ambos vazios).

## Dependências Externas

- `astro` (6.4.6) — framework do site estático.
- `sharp` (0.35.x) — otimização de imagens no build, usada pelo `astro:assets` (issue 13). Instalado como dependência do build.

## Checklist

- [x] Criar `package.json` com `astro` e scripts.
- [x] Criar `astro.config.mjs` (output estático, trailingSlash consistente).
- [x] Criar `tsconfig.json`.
- [x] Criar `src/pages/index.astro` placeholder.
- [x] Adicionar `dist/` ao `.gitignore`.
- [x] Mover `dash/index.html` para `public/dash/index.html` e remover `dash/`.
- [x] Remover `examples/`.
- [x] Atualizar o build_config do projeto Pages via API (`npm run build` / `dist`).
- [x] Validar local com `npm run build` (gera `dist/` sem erro).
- [x] Validar no deploy de teste: home carrega, `/dash` abre, `/api/leads` responde 401 sem chave, cookies first-party são setados.
