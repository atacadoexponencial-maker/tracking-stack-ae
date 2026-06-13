# 10: Protótipo da base visual e layout

**Tipo:** Protótipo
**Página:** Identidade Visual e Assets (transversal)

## Descrição

Estabelecer a base visual compartilhada: tokens de cor, escala tipográfica, espaçamentos e o layout base (cabeçalho/rodapé) reutilizado pelas páginas. Depende da issue 00 (setup Astro) e da issue 12 (fonte).

## Pesquisa interna / referência

- Tokens extraídos de `/tmp/ae-lp/src/index.css` (tema da Lovable):
  - `--background: 0 0% 12%` (#1e1e1e, fundo escuro padrão) · `--foreground: 0 0% 100%` (branco)
  - `--secondary / --muted / --accent / --border: 345 3% 22%` (#393536, cinza quente)
  - `--muted-foreground: 0 0% 65%` (texto secundário) · `--primary: branco`
  - `--destructive: 0 84% 60%` (erros de validação)
  - Seções claras usam bege `#f5f0eb` com texto `#1e1e1e` (visto no hero SSR original).
- Fonte: `Satoshi` (corpo Regular, títulos Bold), fallback `system-ui, -apple-system, 'Segoe UI', sans-serif`.
- O cabeçalho/rodapé se repetem entre páginas → componentizar uma vez (princípio de reuso do `references/architecture.md`).

## Cenários

### Happy Path
- Todas as páginas envolvem seu conteúdo no layout base, exibindo cabeçalho (logo) e rodapé consistentes e herdando os tokens de cor/tipografia.

### Edge Cases
- Páginas com fundo claro (bege) x escuro: os tokens permitem alternar a cor de seção sem quebrar contraste de texto.
- Páginas sem cabeçalho/rodapé (ex.: etapas da calculadora) podem usar uma variação enxuta do layout.

### Cenário de Erro
- Sem cenário de erro de runtime (camada visual estática).

## Arquivos

- **Criar:** `src/styles/global.css` — variáveis de tema (cores em HSL, raios, espaçamentos), reset, e classes utilitárias base. (O `@font-face` da Satoshi entra aqui na issue 12.)
- **Criar:** `src/layouts/BaseLayout.astro` — HTML base (`<head>` com meta/SEO/preload de fonte, slot de conteúdo), importa `global.css`, renderiza `Header` e `Footer`.
- **Criar:** `src/components/Header.astro` — cabeçalho com logo da marca.
- **Criar:** `src/components/Footer.astro` — rodapé com links institucionais (inclui link para `/privacy-policy`).

## Dependências Externas

- Nenhuma além do Astro (issue 00).

## Checklist

- [x] Criar `src/styles/global.css` com os tokens de cor (HSL), tipografia e reset.
- [x] Definir a escala tipográfica (títulos Bold, corpo Regular) baseada na Satoshi.
- [x] Criar `BaseLayout.astro` com `<head>` (SEO, preload da fonte) e slot.
- [x] Criar `Header.astro` com o logo.
- [x] Criar `Footer.astro` com links institucionais e link para a política de privacidade.
- [x] Validar que uma página de teste herda o tema (fundo, cores, fonte) corretamente.
