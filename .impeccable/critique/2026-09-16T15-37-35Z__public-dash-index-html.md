---
target: dash de tracking
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\marce\\OneDrive\\tracking-avancado\\public\\dash\\index.html"
target_fingerprint: "sha256:aaf55ed4b1c0144b651e65185f3faa0fb95047d3644a5e7267ba6b7d1e86e8d0"
target_path: "C:\\Users\\marce\\OneDrive\\tracking-avancado\\public\\dash\\index.html"
timestamp: 2026-09-16T15-37-35Z
slug: public-dash-index-html
---
Method: dual-agent (A: revisão de design · B: detector). Navegador indisponível (extensão do Chrome desconectada); ambas pelo código.

## Nota de saúde do design: 20/40 (Aceitável)
1 Status 2 · 2 Linguagem 2 · 3 Controle 2 · 4 Consistência 2 · 5 Prevenção de erro 1 · 6 Reconhecimento 3 · 7 Eficiência 1 · 8 Estética 2 · 9 Recuperação 2 · 10 Ajuda 3

## Veredito de especificidade
Fiel às cores da marca, genérico na composição. O "editorial premium" não aparece: hierarquia plana, bege só dentro dos gráficos. Detector: 20 achados, 1 drift real (selo "form Meta" em cores de tema claro, L766), o resto são tamanhos fora da escala ou exceções já documentadas no DESIGN.md.

## Problemas prioritários
- [P1] Sem estado de carregamento: render() (L1896) deixa dados do período anterior na tela; erro genérico se acumula via insertAdjacentHTML. → harden
- [P1] "apagar" em Links grava sem confirmação; encerrar A/B via prompt() de texto livre (L1704); todos os botões brancos primários. → harden, polish
- [P1] 15 itens de navegação sem grupo; subtítulo "comparado ao período anterior" e filtros visíveis em abas que não os usam; filtro não vai para a URL. → layout
- [P2] Hierarquia editorial ausente; âmbar permanente, ✕ coral em massa, emojis, delta de investimento em coral. Selo "form Meta" #e7f0ff/#1a56db (L766). → typeset, quieter
- [P2] Gráficos SVG viewBox 900 com rótulos de 10px ilegíveis no celular; tooltip só pointermove; sem role/aria-label. → adapt

## Personas
Alex: sem atalhos, filtro não sobrevive ao recarregar, ordenação se perde, sem exportar.
Sam: sem anel de foco; linhas clicáveis e cabeçalhos ordenáveis sem teclado nem aria-sort; modal sem role=dialog/foco preso; nada anunciado (1 único aria- no arquivo); campos só com placeholder.

## Menores
font-weight 500 sem arquivo carregado (L83, L90); estilos inline fora dos tokens; A/B sem .num; tamanhos quase duplicados (1.02/0.85/0.83/0.82rem); tela da chave técnica demais.
