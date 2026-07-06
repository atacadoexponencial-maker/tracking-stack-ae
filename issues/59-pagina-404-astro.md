# 59: Página 404 no Astro (o Pages passa a responder 404 de verdade)

**Tipo:** Implementação
**Página:** 404 — Página não encontrada (`src/pages/404.astro`)

## Descrição

Criar `src/pages/404.astro` para que o build estático do Astro gere `dist/404.html`. Hoje o build **não tem** `404.html`, então o Cloudflare Pages usa o fallback SPA e responde paths inexistentes com o `index.html` e **status 200** — o que torna inerte a guarda da issue 57 (`functions/_middleware.js` só suprime o UPSERT em `sessions` quando `response.status === 404`). Com o `dist/404.html` presente, o Pages passa a responder 404 de verdade em paths inexistentes, a guarda da issue 57 funciona e scanners deixam de virar sessões-lixo no D1.

A página em si é mínima e com visual consistente com o site (BaseLayout, textos pt-BR): título "Página não encontrada", uma frase curta e um link de volta para a home ("Voltar para o início"). Nada além disso — sem busca, sem lista de páginas.

## Cenários

### Happy Path

1. `npx astro build` gera `dist/404.html` (junto das demais páginas, sem alterar nenhuma).
2. Scanner requisita `GET /wp-admin/foo.php` → Pages serve o `404.html` com **status 404** → a guarda da issue 57 impede o UPSERT → nenhuma linha nova em `sessions`.
3. Visitante real digita URL errada → vê a página "Página não encontrada" no visual do site e clica em "Voltar para o início" (`/`).

### Edge Cases

- **Páginas reais continuam 200:** `/`, `/lives-semanais-v1`, etc. respondem 200 com o conteúdo normal — a página 404 não intercepta nada que exista.
- **Cookies na resposta 404:** o middleware continua setando `_krob_sid` etc. inclusive no 404 (comportamento da issue 57 preservado) — só a escrita no D1 é suprimida.
- **Rota `/404`:** o Astro também serve a página no path literal `/404` — inofensivo.

## Arquivos

- **Criar:** `src/pages/404.astro` — único arquivo de código novo. Usa o `BaseLayout` existente (mesmo padrão de import das outras páginas em `src/pages/`), título "Página não encontrada", frase curta e `<a class="btn-cta" href="/">Voltar para o início</a>`.
- **Não tocar:** `functions/_middleware.js` (guarda da issue 57 já pronta), `src/layouts/BaseLayout.astro`, `src/styles/global.css`, demais páginas, config do Astro.

## Checklist

- [x] `src/pages/404.astro` criado usando `BaseLayout`, textos pt-BR ("Página não encontrada", frase curta, link "Voltar para o início" para `/`)
- [x] `npx astro build` conclui sem erro e gera `dist/404.html`
- [x] Nenhum outro arquivo de código modificado (`git status` mostra só `src/pages/404.astro` e esta issue)
- [x] Teste local — subir `npx wrangler pages dev dist --port 8793` e, com o servidor de pé:
  - [x] `curl -si "http://localhost:8793/wp-admin/foo.php"` → **HTTP 404** com o HTML da página nova ("Página não encontrada")
  - [x] `curl -si "http://localhost:8793/"` → **HTTP 200** com a home normal
  - [x] Requisitar path inexistente com marcador único (ex.: `/nao-existe-teste-59?fbclid=TESTE59`) e conferir no D1 local (`npx wrangler d1 execute tracking-ae-db --local ...`) que **nenhuma** sessão nova foi criada para esse path (guarda da issue 57 + 404 real)
  - [x] Limpar do D1 local eventuais linhas de teste criadas durante a verificação
  - [x] Derrubar o servidor ao final
- [ ] (Opcional, produção) após deploy: conferir que paths inexistentes respondem 404 no domínio e que sessões-lixo de scanner param de aparecer no D1 remoto
