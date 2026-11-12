---
target: página inteira da Imersão Planejamento Atacado
total_score: 22
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\marce\\OneDrive\\tracking-avancado\\src\\pages\\imersao-planejamento-atacado.astro"
target_fingerprint: "sha256:8af5850182c0c0102957952ca6aea122fe69802b2cbdb8549cf64b6011ab2fa0"
target_path: "C:\\Users\\marce\\OneDrive\\tracking-avancado\\src\\pages\\imersao-planejamento-atacado.astro"
timestamp: 2026-11-12T21-46-48Z
slug: src-pages-imersao-planejamento-atacado-astro
---
Method: dual-agent (A: revisão de design · B: detector e navegador)

# Crítica da página da Imersão (12/11/2026)

## Nota de saúde do design: 22 de 36 (61%, Aceitável)

| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Visibilidade do status | 3 | Barra de lote boa, mas o aviso de cookies a cobre no primeiro acesso. |
| 2 | Linguagem do mundo real | 3 | Vocabulário do nicho funciona; a barra não diz que mede tempo. |
| 3 | Controle e liberdade | 2 | Depois do preço, cerca de 3.200 px sem botão. |
| 4 | Consistência | 2 | Mesmo botão em três formas; depoimentos centralizados numa página alinhada à esquerda. |
| 5 | Prevenção de erros | 3 | Vendas encerradas: não deixa comprar, mas não oferece saída. |
| 6 | Reconhecer em vez de lembrar | 2 | No último botão não há preço, data nem garantia por perto. |
| 7 | Flexibilidade e eficiência | n/a | Página de venda de visita única. |
| 8 | Estética e minimalismo | 2 | H1 menor que os H2; quase tudo em caixa alta. |
| 9 | Recuperação de erros | 2 | Estado encerrado é beco sem saída. |
| 10 | Ajuda | 3 | FAQ bom; falta a garantia perto da compra. |

## Especificidade

Meio autoral. Foto do quadro, prints de Instagram e barra de lote são deste produto; o resto é esqueleto padrão de página de evento. O produto é um plano numa planilha e a planilha não aparece; as três fotos são do Felipe na mesma sala.

Detector: 42 avisos na varredura do arquivo, todos de desvio em relação ao DESIGN.md do dash (falsos positivos para esta LP). No navegador, 8 itens: reais = texto de 11,52 px em `.ipa-topo__extra` e duas etiquetas acima de título ("Resultados" nos depoimentos, "Garantia"). Os demais são escolha de estilo (botão em caixa alta, entrelinha 1.15 em `.ipa-dobrar__conta`) ou não confirmados (`div.ipa` com clip).

## O que funciona

- Foto do topo (quadro com "Entrada Previsível").
- Bloco dos 26% (`.ipa-dobrar__conta`).
- Sistema de lotes honesto; contraste do texto cinza 8,3:1 no carvão e 6,2:1 no bege.

## Problemas por prioridade

1. [P1] Preço e botão fora da primeira tela do celular. Aviso de cookies cobre de y=684 a 832 o botão (688 a 746) e a linha de preço (764 a 816). Em 390x664 o botão vai de 609 a 667 e o preço fica em 699; em 360x640 botão 599 a 656; em 320x640 começa em 677. Correção: `.ipa-hero__corpo` padding-top de 44svh para clamp(11rem, 30svh, 16rem); `.ipa-hero__foto` e `.ipa-hero__veu` de 64svh para cerca de 50svh; preço antes do botão ou dentro dele. Aviso de cookies é componente compartilhado. Comando: /impeccable layout
2. [P1] Hierarquia tipográfica invertida. Celular: H1 27,2 px, H2 30,4 px, nome do Felipe 41,6 px. Desktop: 49,6 / 54,4 / 88 px. 11 de 12 títulos em caixa alta. Correção: `.ipa-hero__titulo` para clamp(2.1rem, 8.6vw, 4rem); `.ipa-felipe__nome` para clamp(2rem, 5vw, 3.4rem); tirar caixa alta de `.ipa-sinais__titulo` e `.ipa-garantia__titulo`. Comando: /impeccable typeset
3. [P1] Momento da compra sem apoio. `.ipa-oferta__botao` com 295 px quebra "LOTE 01" na segunda linha (79 px de altura). Garantia 1.700 px abaixo do preço. Do botão do preço (y=5668) ao próximo (y=8856) são 3.188 px sem botão; do topo ao segundo botão, 3.713 px. Correção: botão em uma linha; linha de garantia dentro de `.ipa-oferta__cartao`; botão em `.ipa-garantia__texto`; avaliar depoimentos antes do preço (muda a ordem do arquivo de copy). Comando: /impeccable layout
4. [P2] Faixa de marcas. Título `.ipa-marcas__titulo` depois dos cards, à direita, cinza. `.ipa-marca__nicho` (11,2 px) com contraste estimado em 2,6:1 sobre o print. No desktop 1366 a faixa tem 1.432 px com justify-content center: primeiro card em x=-26, sem rolagem. Correção: título antes e em branco; fundo sólido na legenda; corrigir o corte. Comando: /impeccable polish
5. [P2] Vendas encerradas é beco sem saída. Aviso de 83 px não fixo, 4 botões somem, cartão de preço vazio (342 px), fechamento só com a headline. Correção: esconder `.ipa-oferta` e `.ipa-fechamento` e fixar `.ipa-encerrado`. Destino alternativo é decisão da cliente. Comando: /impeccable harden

## Personas

- Jordan: prints antes do título; cards abrem o Instagram em nova aba; barra sem legenda; sem canal de contato.
- Casey: botão e preço cobertos no topo; duas vezes mais de 3.000 px sem botão; sem botão fixo.
- Riley: em 320 px os 4 botões quebram em duas linhas e a pílula de data provavelmente é cortada (emulação); no último lote a linha do topo fica longa.

## Menores

- "Como funciona o dia" usa 619 px para 4 horários; `.ipa-dia__cartao` tem 4,5rem vazios no topo.
- Play azul dos vídeos fora da paleta (vem do player).
- `.ipa-sinais__fecho` e `.ipa-decisoes__frase` passam despercebidas.
- Seção do Felipe repete sala e roupa da foto anterior.
- `.ipa-destaque` desalinhado no celular.
- `.ipa-felipe__papel` no CSS sem uso.

## Perguntas

1. Por que três fotos do Felipe e nenhuma da planilha?
2. Por que o R$ 29 só aparece pequeno no topo e grande lá embaixo?
3. "Como funciona o dia" precisa ser seção, ou cabe numa linha no cartão de preço?
