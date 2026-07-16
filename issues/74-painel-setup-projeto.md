# 74: Setup do projeto do painel

**Tipo:** Implementação
**Página:** —

## Descrição

Criar a fundação do painel na subpasta `painel/` deste repo: app Astro próprio com
output estático + Pages Functions (mesmo arranjo do site), banco D1 próprio (separado
do tracking), e segundo projeto Cloudflare Pages — deploy inicial funcionando sem
afetar o build do site.

## Pesquisa interna (o que será reutilizado)

- **Arranjo do app**: mesmo padrão da raiz — Astro `output: 'static'` +
  `build.format: 'directory'` + pasta `functions/` com Pages Functions
  (ver `astro.config.mjs` e `wrangler.toml` da raiz).
- **Padrão de sync**: `functions/api/sync/meta-ads.js` — endpoint POST gateado por
  header `x-sync-secret` (env `SYNC_SECRET`), grava em tabela + registra em `sync_log`,
  disparado por cron externo (docs/ad-spend-sync.md). As issues 88–92 do painel
  espelharão esse padrão.
- **Migrações**: SQL numerado em `migrations/` aplicado via wrangler d1 —
  o painel terá `painel/migrations/` próprio.
- **Wrangler**: autenticado (conta atacadoexponencial@gmail.com), v4.111.0.

## Cenários

### Happy Path
1. `painel/` contém app Astro independente com `package.json` próprio.
2. `npm install && npm run build` dentro de `painel/` gera `painel/dist/`.
3. Banco D1 `painel-clientes-db` criado; binding `DB` no `painel/wrangler.toml`.
4. Projeto Pages `painel-atacadoexponencial` criado; deploy publica a página
   placeholder e `/api/health` responde `{ ok: true, db: true }` consultando o D1.
5. Build do site da raiz permanece intocado (nenhum arquivo fora de `painel/`
   é alterado, exceto esta issue).

### Edge Cases
- `node_modules`/`dist` do painel não podem ser commitados → `.gitignore` da raiz
  já cobre por padrão? Conferir; se não, adicionar `painel/node_modules` e `painel/dist`.
- O projeto Pages da raiz não deve tentar buildar `painel/` (a raiz builda com
  `astro build` do root — painel/ não interfere pois tem package.json próprio e
  não é importado).

### Cenário de Erro
- Se o D1 não estiver vinculado, `/api/health` responde `{ ok: true, db: false }`
  (deploy não quebra; o problema fica visível).

## Banco de Dados

- Banco novo: `painel-clientes-db` (D1) — vazio nesta issue; schema vem na issue 86.

## Arquivos

- **Criar:** `painel/package.json` — app Astro independente (scripts dev/build/preview)
- **Criar:** `painel/astro.config.mjs` — output estático, format directory (padrão da raiz)
- **Criar:** `painel/wrangler.toml` — `pages_build_output_dir = "dist"` + binding D1 `DB` → `painel-clientes-db`
- **Criar:** `painel/src/pages/index.astro` — placeholder ("Painel — em construção")
- **Criar:** `painel/functions/api/health.js` — GET que testa o binding D1
- **Criar:** `painel/.gitignore` — node_modules, dist, .astro, .wrangler
- **Modificar:** `issues/74-painel-setup-projeto.md` — esta issue (plano + checklist)

## Dependências Externas

- `astro` — mesmo framework do site (sem adapter; Functions ficam fora do Astro)

## Checklist

- [x] Criar estrutura `painel/` (package.json, astro.config.mjs, .gitignore)
- [x] Placeholder `src/pages/index.astro` + `functions/api/health.js`
- [x] `npm install && npm run build` dentro de `painel/` funcionando (1 página, 7.4s)
- [x] Criar D1 `painel-clientes-db` via wrangler (`b0d86f2d-f961-40de-bc24-50f42c3ca460`) e registrar no `painel/wrangler.toml`
- [x] Criar projeto Pages `painel-atacadoexponencial` e fazer o primeiro deploy
- [x] `/api/health` respondendo `{"ok":true,"db":true}` em https://painel-atacadoexponencial.pages.dev
- [x] Confirmado: nada fora de `painel/` + esta issue foi tocado (git status conferido)
