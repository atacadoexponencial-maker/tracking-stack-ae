# 63: Redirects 301 para páginas legadas da era Lovable

**Tipo:** Implementação
**Página:** Infra: redirects do Cloudflare Pages (`public/_redirects`)

## Descrição

Criar `public/_redirects` com redirects **301 server-side** (recurso nativo do Cloudflare Pages) para três URLs da era Lovable que ainda recebem tráfego real e que passaram a responder **404** desde que o site ganhou página 404 de verdade (issue 59):

- `/obrigado` → `/obrigada` — recebe o redirect de confirmação do Calendly e tráfego com UTMs de anúncio.
- `/obrigado-workshop` → `/video-workshop-instagram`
- `/ae-video-workshop` → `/video-workshop-instagram`

O Astro copia `public/` para a raiz do `dist/` no build, então o arquivo chega ao deploy como `dist/_redirects` — exatamente onde o Pages o procura. O Pages preserva a query string no redirect, então UTMs/fbclid não se perdem no caminho.

## Cenários

### Happy Path

1. Visitante confirma agendamento no Calendly e cai em `GET /obrigado` → Pages responde **301** com `Location: /obrigada` → visitante vê a página de obrigada atual.
2. Tráfego de anúncio antigo chega em `/obrigado-workshop` ou `/ae-video-workshop` → **301** com `Location: /video-workshop-instagram`.
3. Os destinos existem: `/obrigada` e `/video-workshop-instagram` respondem **200**.

### Edge Cases

- **Query string/UTMs preservadas:** `GET /obrigado?utm_source=teste` → `Location: /obrigada?utm_source=teste` (comportamento do Pages: a query acompanha o redirect).
- **Barra final:** `GET /obrigado/` **não** casa com a regra — o matching do `_redirects` é exato e o Pages só normaliza trailing slash de assets que existem; a resposta é 404 (verificado no `wrangler pages dev`, que usa o mesmo asset server da produção; a doc do Pages confirma que barra final exige regra explícita). Aceito: o redirect do Calendly e os anúncios usam a URL sem barra; adicionar regras extras violaria o escopo de "exatamente 3 regras".
- **Sessão continua sendo gravada:** o middleware roda no hit de `/obrigado` e a resposta é 301 (≠ 404), então a guarda da issue 57 **não** bloqueia o UPSERT — a sessão é criada com `landing_url` contendo `/obrigado` + UTMs, preservando a atribuição do primeiro toque.
- **Paths inexistentes seguem 404:** as regras são exatas; qualquer outro path fora do site continua caindo na página 404 (e sem sessão, pela guarda da issue 57).

## Arquivos

- **Criar:** `public/_redirects` — único arquivo de código novo; 3 regras 301 com comentários pt-BR explicando origem/motivo.
- **Não tocar:** `functions/_middleware.js`, `src/pages/*`, `astro.config.mjs`, demais arquivos.

## Checklist

- [x] `public/_redirects` criado com exatamente as 3 regras 301 e comentários pt-BR
- [x] `npx astro build` conclui sem erro e `dist/_redirects` existe (Astro copia `public/` para a raiz do `dist/`)
- [x] Nenhum outro arquivo de código modificado (`git status` mostra só `public/_redirects` e esta issue)
- [x] Teste local — subir `npx wrangler pages dev dist --port 8794` e, com o servidor de pé:
  - [x] `curl -si "http://localhost:8794/obrigado"` → **301** com `Location: /obrigada`
  - [x] `curl -si "http://localhost:8794/obrigado?utm_source=teste"` → `Location` preserva a query (`?utm_source=teste`)
  - [x] `curl -si "http://localhost:8794/obrigado/"` (barra final) → **404** (matching exato do `_redirects`; comportamento documentado e aceito — ver Edge Cases)
  - [x] `curl -si "http://localhost:8794/obrigado-workshop"` e `/ae-video-workshop` → `Location: /video-workshop-instagram`
  - [x] `curl -sL` nos três paths termina em **200** (destinos `/obrigada` e `/video-workshop-instagram` existem)
  - [x] Path aleatório inexistente continua **404**
  - [x] (Bônus) visita a `/obrigado?fbclid=TESTE63` **cria** sessão no D1 local com `landing_url` contendo `/obrigado` (301 ≠ 404, guarda da issue 57 não bloqueia); linha de teste removida ao final
  - [x] Derrubar o servidor ao final
- [ ] (Opcional, produção) após deploy: `curl -sI https://<domínio>/obrigado` → 301 para `/obrigada` e conferir que o tráfego do Calendly volta a cair na página de obrigada
