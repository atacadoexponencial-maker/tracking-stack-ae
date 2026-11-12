---
target: página inteira da Imersão Planejamento Atacado
total_score: 21
max_score: 32
na_heuristics: 7,9
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\marce\\OneDrive\\tracking-avancado\\src\\pages\\imersao-planejamento-atacado.astro"
target_fingerprint: "sha256:53012168ce928256a3e57b89868300fb9ca51af24447a202e82d59c3b88ee2f7"
target_path: "C:\\Users\\marce\\OneDrive\\tracking-avancado\\src\\pages\\imersao-planejamento-atacado.astro"
timestamp: 2026-11-12T22-04-23Z
slug: src-pages-imersao-planejamento-atacado-astro
---
Method: dual-agent (A: revisão de design · B: detector e navegador)

# Segunda crítica da página da Imersão (12/11/2026, depois do commit 241dfa6)

## Nota: 21 de 32 (66%, Aceitável). Rodada anterior: 22 de 36 (61%); conjuntos de heurísticas diferentes.

| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Visibilidade do status | 3 | Barra do cartão de preço sem data; parece "vagas vendidas". |
| 2 | Linguagem do mundo real | 3 | Agenda só com horários. |
| 3 | Controle e liberdade | 2 | Vendas encerradas sem saída. |
| 4 | Consistência | 3 | Título das marcas fora do padrão. |
| 5 | Prevenção de erros | 2 | Aviso de cookies cobre o botão em tela curta. |
| 6 | Reconhecer em vez de lembrar | 2 | Preço e prazo somem depois do topo; fechamento não repete. |
| 7 | Flexibilidade e eficiência | n/a | Página de visita única. |
| 8 | Estética e minimalismo | 3 | Decoração na agenda; três fotos quase iguais. |
| 9 | Recuperação de erros | n/a | Sem formulário nem erro possível. |
| 10 | Ajuda | 3 | FAQ fechado esconde que planilha e gravação custam R$ 297 à parte. |

## Melhorou

- Cartão de preço virou ponto forte (preço 60 px, botão em uma linha, garantia 17 px abaixo do botão).
- Em 390x844 o botão (613 a 670) e o preço ficam acima do aviso (757 a 836).
- Detector: saiu o kicker "Garantia" e o texto de 11,52 px. Restam: all-caps nos 5 botões, entrelinha 1.15 em `.ipa-dobrar__conta`, kicker "Resultados" (componente de depoimentos), `div.ipa` com clip (duas `.ipa-marca__legenda` passam da largura no desktop). 42 avisos do CLI são desvio em relação ao DESIGN.md do dash.

## Problemas por prioridade

1. [P0] Aviso de cookies cobre o botão do topo em tela curta. 390x664: aviso y=577 a 656, botão 570 a 627. 360x640: aviso 553 a 632, botão 564 a 621 (100% coberto). Correção: `body:has(.ipa) .aviso-cookies { top: 8px; bottom: auto }` no celular. Comando: /impeccable adapt
2. [P1] Preço fora da primeira tela em tela curta (linha em y=660 a 697 numa tela de 664; 654 a 691 numa de 640) e em 12,5 px. Correção: `.ipa-hero__corpo` padding-top clamp(6rem, 16svh, 12rem); foto e véu max(42svh, 17rem); `[data-preco]` da linha do lote em cerca de 1,1rem. Comando: /impeccable layout
3. [P1] Botões em y=613, 4302, 5568, 7821, 8824 (página de 9.201 px): 3.689 px sem botão entre o topo e o Plano. Fechamento sem preço, prazo nem garantia. Correção: botão após `.ipa-sinais__fecho`; `.ipa-progresso` no fechamento; barra fixa de compra no celular como opção mais forte. Comando: /impeccable layout
4. [P2] H1 33,6 px contra H2 30,4 px no celular (57,6 contra 54,4 no desktop). `.ipa-dobrar__conta` em 23 px. Correção: `.ipa-h2` clamp(1.6rem, 3.4vw, 2.6rem); "26%" como número de destaque sem mudar o texto. Comando: /impeccable typeset
5. [P2] Faixa de marcas: em 1366 o primeiro card começa em x=-26 e não rola (justify-content center a partir de 1200 px); título depois dos prints, à direita, 18,4 px peso 400. Correção: `justify-content: safe center` e título antes da faixa. Comando: /impeccable polish

## Conteúdo (decisão da cliente)

"Tudo preenchido na planilha do Planejamento 2027" na seção do plano contra "planilha vendida à parte por R$ 297" no FAQ.

## Personas

- Jordan: barra parece ingressos vendidos; "lote 01" não diz o preço; agenda sem conteúdo.
- Casey: botão coberto em tela curta; 4,4 telas sem botão; cards abrem o Instagram em nova aba.
- Riley: encerradas com pílula de data parecendo futuro e garantia sem venda; em 320 px botão em duas linhas e pílula 5 px além da borda.

## Menores

- Três fotos do Felipe na mesma sala; seção dele com 843 px no celular.
- `.ipa-dia__cartao` com 72 px de degradê vazio.
- Selo da garantia com 176 px no desktop, sem informação.
- `.ipa-felipe__papel` sem uso no HTML.
