# 146: Catálogo de materiais + página /materiais/[slug]

**Tipo:** Implementação
**Página:** `/materiais/<slug>` (nova, uma por material)
**Spec:** `docs/superpowers/specs/2026-07-27-paginas-materiais-iscas-design.md`

## Descrição

Criar o catálogo de materiais ricos e a página única que os serve. Uma rota
dinâmica pré-renderizada por entrada do catálogo, com formulário de três campos
(nome, email, WhatsApp) que envia ao `/tracker` e redireciona para o destino que
o backend devolver.

Esta issue entrega a página e o catálogo. O redirect propriamente dito é a issue
147 — até ela existir, o `/tracker` devolve o fallback atual.

## Cenários

### Happy Path
1. A pessoa abre `/materiais/icp` (link vindo do ManyChat).
2. Vê logo, título e subtítulo vindos do catálogo, e o formulário de 3 campos.
3. Preenche e envia → `POST /tracker` com `event_name: 'Lead'` e
   `lead_data: { funnel: 'iscas-manychat', material: 'icp', nome, email, telefone }`.
4. A resposta traz `redirect`; a página executa `window.location.href = redirect`.

### Edge Cases
- Campos vazios ou email inválido → validação nativa do HTML barra o submit.
- Telefone fora do padrão → `telefoneValido` barra e exibe `TELEFONE_ERRO`,
  mesmo comportamento dos demais formulários.
- Slug fora do catálogo → 404 do Astro (a rota nem é gerada no build).

### Cenário de Erro
- `/tracker` indisponível, resposta não-JSON ou sem `redirect` → o `catch` cai no
  destino padrão `/obrigada`, mesmo padrão do `LeadFormModal`. O lead nunca fica
  preso numa tela morta.
- `fbq` ausente (bloqueador) → `try/catch` isolado; o envio ao `/tracker` segue.

## Banco de Dados

Não se aplica. A gravação do lead já é feita pelo `/tracker` (a coluna `material`
é a issue 148).

## Pesquisa — o que reaproveitar

- `src/layouts/BaseLayout.astro` — já carrega GA4, os dois Meta Pixels e o
  espelho de `PageView` no `/tracker`. A página só precisa passar `title` e
  `description`; `showHeader`/`showFooter` ficam `false` (página de captura).
- `src/scripts/lead-validacao.ts` — `telefoneValido`, `TELEFONE_ERRO`,
  `aplicarMascaraTelefone`, `aplicarSugestaoEmail`. Importar, não reescrever.
- `src/components/LeadFormModal.astro` — o bloco de submit (linhas 112–157) é o
  padrão a seguir: `event_id` `'lead-…'`, espelho `fbq('track','Lead')` com o
  mesmo `eventID`, `fetch` com `keepalive: true`, `user_data` `{ em, ph, fn }`,
  redirect vindo da resposta. As classes `.lform__*` são a base do estilo.
- `src/assets/brand/logo.png` — logo via `<Image />` de `astro:assets`, como nas
  demais páginas.
- Precedente de Function importando módulo fora de `functions/`:
  `functions/webhook/_core.js:38` importa `../../config/products.js`. Por isso o
  catálogo é `.js` puro (não `.ts`): o `functions/tracker.js` vai consumi-lo na
  issue 147.

## Arquivos

- **Criar:** `src/data/materiais.js` — `MATERIAIS` (array) e
  `materialPorSlug(slug)`. Primeira entrada:
  `slug: 'icp'`, `titulo: 'Mapeie seu Cliente Ideal (ICP)'`,
  `subtitulo` tirado do próprio PDF, `destino` = link do Drive.
- **Criar:** `src/pages/materiais/[slug].astro` — `getStaticPaths()` sobre
  `MATERIAIS`; markup + estilo do formulário; script de submit.

## Dependências Externas

Nenhuma nova.

## Restrições

- O `destino` **não** pode ser renderizado no HTML nem usado pelo frontend: quem
  resolve o link é o backend (regra de lógica no backend). A página conhece
  apenas o próprio `slug`.
- Não alterar nenhuma LP existente nem o `LeadFormModal`.

## Checklist

- [x] `src/data/materiais.js` com a entrada do ICP e `materialPorSlug`
- [x] `src/pages/materiais/[slug].astro` com `getStaticPaths()`
- [x] Form de 3 campos (nome, email, WhatsApp) com validação nativa
- [x] Máscara de telefone e sugestão de email via `lead-validacao`
- [x] Submit envia `funnel: 'iscas-manychat'` e `material: <slug>`
- [x] Redirect usa apenas o `redirect` devolvido pelo backend
- [x] Estado de erro visível se o `/tracker` falhar
- [x] `npm run build` gera `/materiais/icp` sem o link do Drive no HTML
