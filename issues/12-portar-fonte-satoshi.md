# 12: Portar a fonte Satoshi e tokens visuais

**Tipo:** Implementação
**Página:** Identidade Visual e Assets (transversal)

## Descrição

Disponibilizar a fonte Satoshi (Regular e Bold) e os tokens de cor/tipografia para que todas as páginas exibam a identidade da marca de forma consistente.

## Pesquisa interna / referência

- Arquivos da fonte em `/tmp/ae-lp/public/fonts/`: `Satoshi-Regular.woff2` (~27KB) e `Satoshi-Bold.woff2` (~27KB). Apenas 2 pesos, leves.
- `@font-face` original em `/tmp/ae-lp/src/index.css` aponta para `/fonts/Satoshi-*.woff2` com `font-display` — manter o mesmo caminho público.
- Os tokens de cor são definidos na issue 10 (`global.css`); aqui entra a parte tipográfica (`@font-face` + variável de família).

## Cenários

### Happy Path
- As páginas renderizam textos na fonte Satoshi; títulos em Bold (700), corpo em Regular (400). A fonte carrega de forma não-bloqueante (`font-display: swap`) e o arquivo da primeira dobra é pré-carregado.

### Edge Cases
- Se a fonte ainda não carregou, o fallback `system-ui` mantém o texto legível sem deslocamento brusco de layout.

### Cenário de Erro
- Se algum `.woff2` faltar, o navegador usa o fallback automaticamente; nenhum erro fatal.

## Arquivos

- **Criar:** `public/fonts/Satoshi-Regular.woff2` — cópia do arquivo de referência.
- **Criar:** `public/fonts/Satoshi-Bold.woff2` — cópia do arquivo de referência.
- **Modificar:** `src/styles/global.css` — adicionar `@font-face` (Regular 400 e Bold 700, `font-display: swap`) e a variável de família tipográfica com fallback.
- **Modificar:** `src/layouts/BaseLayout.astro` — adicionar `<link rel="preload" as="font" type="font/woff2" crossorigin>` para o peso usado na primeira dobra.

## Dependências Externas

- Nenhuma.

## Checklist

- [ ] Copiar os dois `.woff2` para `public/fonts/`.
- [ ] Adicionar os dois `@font-face` em `global.css` com `font-display: swap`.
- [ ] Definir a variável de família tipográfica com fallback `system-ui`.
- [ ] Pré-carregar a fonte da primeira dobra no `BaseLayout.astro`.
- [ ] Validar que os textos renderizam em Satoshi e que não há "flash" de fonte quebrando o layout.
