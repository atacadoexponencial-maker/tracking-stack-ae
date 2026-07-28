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
- `/tracker` falha ou responde sem `redirect` → mensagem de erro na própria
  página e botão volta ao estado normal (mesmo padrão do `LeadFormModal`).
- Slug fora do catálogo → 404 do Astro (a rota nem é gerada).

## Arquivos

- **Criar:** `src/data/materiais.js` — array `MATERIAIS` com `slug`, `titulo`,
  `subtitulo` e `destino` (URL do Drive). Primeira entrada: `icp` →
  `https://drive.google.com/file/d/1vxZUBN71vJF7SUbuN7GtkV6TQYL03rMz/view`.
  Exportar também um helper `materialPorSlug(slug)` — o `functions/tracker.js`
  vai consumi-lo na issue 147.
- **Criar:** `src/pages/materiais/[slug].astro` — `getStaticPaths()` a partir de
  `MATERIAIS`; usa `BaseLayout.astro`; formulário com estilo herdado de
  `LeadFormModal.astro`.

## Restrições

- O `destino` **não** pode ser renderizado no HTML nem usado pelo frontend: quem
  resolve o link é o backend (regra de lógica no backend). A página conhece
  apenas o próprio `slug`.
- Não alterar nenhuma LP existente.

## Checklist

- [ ] `src/data/materiais.js` com a entrada do ICP e `materialPorSlug`
- [ ] `src/pages/materiais/[slug].astro` com `getStaticPaths()`
- [ ] Form de 3 campos (nome, email, WhatsApp) com validação nativa
- [ ] Submit envia `funnel: 'iscas-manychat'` e `material: <slug>`
- [ ] Redirect usa apenas o `redirect` devolvido pelo backend
- [ ] Estado de erro visível se o `/tracker` falhar
- [ ] `npm run build` gera `/materiais/icp` sem o link do Drive no HTML
