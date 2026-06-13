# 13: Portar e otimizar assets de marca e prova social

**Tipo:** Implementação
**Página:** Identidade Visual e Assets (transversal)

## Descrição

Trazer logos, ícones, foto do especialista e imagens de prova social, otimizados (formato e dimensão corretos) para não prejudicar a performance.

## Pesquisa interna / referência

- Assets em `/tmp/ae-lp/public/`:
  - `brand/`: `felipe.webp` (94KB, já otimizado), `logo.png`, `sem-fundo-branco.png`, `sem-fundo-preto.png`, `icone-sem-fundo-branco.png`, `icone-sem-fundo-preto.png` (logos/ícones com transparência, 21–35KB).
  - `proof/`: `proof-1.jpg`..`proof-9.jpg/png` (prova social). **`proof-2.png` está pesado: 360KB** — principal alvo de otimização.
- Estratégia: imagens exibidas dentro das páginas vão para `src/assets/` e usam o componente `astro:assets` (`<Image>`), que otimiza no build (converte para WebP/AVIF, gera dimensões responsivas e aplica `loading="lazy"` por padrão). Logos referenciados como markup também passam pelo `<Image>`. Fontes e o dashboard ficam em `public/` (não passam por otimização).

## Cenários

### Happy Path
- As imagens são exibidas já otimizadas pelo build (formato moderno, tamanho adequado ao container), com lazy-load fora da primeira dobra. A foto do especialista e os prints de prova carregam rápido.

### Edge Cases
- Logos com transparência: manter canal alpha (WebP com alpha) — não achatar fundo.
- Imagem da primeira dobra (ex.: logo do header ou hero): marcar como `eager`/prioritária para não atrasar o LCP.

### Cenário de Erro
- Se o build de uma imagem falhar, o build do site falha de forma visível (melhor do que servir imagem quebrada em produção).

## Arquivos

- **Criar:** `src/assets/brand/` — `felipe.webp`, `logo.png`, `sem-fundo-branco.png`, `sem-fundo-preto.png`, `icone-sem-fundo-branco.png`, `icone-sem-fundo-preto.png` (cópias da referência).
- **Criar:** `src/assets/proof/` — `proof-1`..`proof-9` (cópias da referência; otimização de `proof-2` resolvida no build pelo `astro:assets`).
- (Os componentes que consomem esses assets — Hero, Carrossel, Sobre o Felipe — são criados nas issues de página.)

## Dependências Externas

- `sharp` (0.35.x) — backend de otimização do `astro:assets` (já incluído no setup, issue 00).

## Checklist

- [ ] Copiar `brand/` para `src/assets/brand/`.
- [ ] Copiar `proof/` para `src/assets/proof/`.
- [ ] Confirmar que o `astro:assets` está apto a processar PNG/JPG/WebP (sharp instalado).
- [ ] Validar no build que `proof-2` sai significativamente mais leve (PNG 360KB → WebP).
- [ ] Confirmar que logos com transparência mantêm o fundo transparente.
