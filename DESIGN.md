---
name: Atacado Exponencial
description: Identidade visual do dash de tracking (mundo "Etiqueta", papel claro) e das superfícies que seguem no mundo escuro (site e painel de clientes).
colors:
  papel: "#f3f1ec"
  papel-escuro: "#ebe8e1"
  etiqueta: "#fbfaf7"
  tinta: "#161513"
  tinta-2: "#4f4b45"
  apagado: "#8b857c"
  fio: "#d9d3c9"
  fio-forte: "#161513"
  carvao: "#1e1e1e"
  bege: "#f5f0eb"
  taupe: "#b8ada1"
  alta: "#2f9a5d"
  queda: "#d24a3f"
  informacao: "#2f6db3"
  alerta: "#b7791f"
typography:
  titulo-aba:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  manchete:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 400
    lineHeight: 1.3
  valor-heroi:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "min(2.9rem, 15cqw)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  valor:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "min(2.2rem, 13cqw)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  titulo-bloco:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  tabela:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.86rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  rotulo:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.66rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.14em"
    textTransform: "uppercase"
rounded:
  canto: "2px"
  pilula: "999px"
spacing:
  xs: "0.3rem"
  sm: "0.6rem"
  md: "1rem"
  lg: "1.6rem"
  bloco: "1.8rem"
components:
  button-primary:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.canto}"
    padding: "0.45rem 0.9rem"
  button-secondary:
    backgroundColor: "{colors.etiqueta}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.canto}"
    padding: "0.45rem 0.9rem"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.queda}"
    rounded: "{rounded.canto}"
    padding: "0.45rem 0.9rem"
  etiqueta:
    backgroundColor: "{colors.etiqueta}"
    textColor: "{colors.tinta}"
    rounded: "2px 2px 3px 3px"
    padding: "2rem 1.1rem 1rem"
  carimbo:
    backgroundColor: "transparent"
    textColor: "currentColor"
    rounded: "{rounded.canto}"
    padding: "0.15rem 0.45rem"
  input:
    backgroundColor: "{colors.etiqueta}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.canto}"
    padding: "0.45rem 0.7rem"
  nav-item-active:
    backgroundColor: "{colors.bege}"
    textColor: "{colors.carvao}"
    rounded: "3px"
    padding: "0.42rem 0.55rem"
  tab-pill:
    backgroundColor: "transparent"
    textColor: "{colors.apagado}"
    rounded: "{rounded.pilula}"
    padding: "0.3rem 0.75rem"
  tab-pill-active:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.pilula}"
    padding: "0.3rem 0.75rem"
---

# Design System: Atacado Exponencial

## Overview

**Creative North Star: "O Catálogo de Atacado"**

O dash de tracking (`public/dash/index.html`) é lido como um catálogo de atacado, não como um dashboard SaaS. Papel claro levemente quente como fundo, tinta preta, fios finos entre linhas e um fio forte de 2px acima de cada bloco. Cada número vive numa **etiqueta pendurada** (cartão branco quente com furo e ilhós no topo, sombra curta). A tabela é uma **grade de tamanhos** (cabeçalho em caixa alta espaçada, linhas separadas por fio). O delta contra o período anterior é um **carimbo** (moldura fina, inclinado 2 graus, verde para alta, coral para queda, cinza tracejado e reto para neutro). A barra lateral fica **carvão com texto bege**: a assinatura da marca dentro do papel.

Este documento foi reescrito em 30/09/2026 a partir do que está no ar depois do redesign (spec em `docs/specs-arquivadas/spec-redesign-dash-etiqueta.md`; contrato de direção em `.impeccable/surfaces/public-dash-index-html.md`). Vale para o **dash**. O site (`src/styles/global.css`) e o painel de clientes (`painel/src/styles/dash.css`) **continuam no mundo escuro** (carvão, grafite, bege) até nova decisão; a seção "Superfícies escuras" no fim registra o que ainda vale para eles.

**Key Characteristics:**
- Papel claro como fundo do dash; nada de tema escuro dentro dele
- Satoshi em dois pesos (400 e 700), números com algarismos tabulares e tracking negativo nos valores grandes
- O número em primeiro plano: etiqueta, manchete e régua carregam a leitura; a interface recua
- Cor semântica só para estado (alta, queda, informação, alerta), sempre com sinal além da cor
- Sem cantos grandes, sem gradiente, sem vidro, sem sombra além da sombra curta da etiqueta

## Colors

Paleta quase monocromática e quente. O papel e a tinta fazem o trabalho; as cores semânticas só falam quando há algo a dizer.

### Neutral
- **Papel** (`papel`): fundo de página do dash e do véu do gráfico.
- **Papel Escuro** (`papel-escuro`): fundo do aviso `explica`, do hover do botão secundário e de superfícies rebaixadas (trilho de chave, pré).
- **Etiqueta** (`etiqueta`): fundo de etiqueta, campo de formulário, modal, tooltip, balão de prévia, cartões de dia e de formato.
- **Tinta** (`tinta`): texto principal, valores, linha do gráfico, barra de proporção, botão primário, pílula ativa, foco de teclado, fio forte.
- **Tinta 2** (`tinta-2`): a manchete (os números dentro dela voltam à tinta) e o texto do aviso `explica`.
- **Apagado** (`apagado`): rótulos "REF." em caixa alta, cabeçalhos de tabela, subtítulos, notas, estado vazio, "—" sem dado.
- **Fio** (`fio`): divisória de linha de tabela, contorno de etiqueta, grade do gráfico, rodapé tracejado da etiqueta, esqueleto de carga.
- **Fio Forte** (`fio-forte`): fio de 2px sob o topo da aba e acima de cada bloco; fio sob o cabeçalho da tabela; dia de hoje na semana; líder por formato.

### Marca (barra lateral e tela de acesso)
- **Carvão** (`carvao`): fundo da barra lateral e da faixa do logo na tela de acesso. Texto do item de navegação ativo.
- **Bege** (`bege`): texto e item ativo da barra lateral, foco de teclado dentro dela, seleção de texto.
- **Taupe** (`taupe`): rótulos de grupo da navegação e "TRACKING INTERNO".

### Semantic
- **Alta** (`alta`): carimbo de alta, "ok", selo `ar`, "dentro" da meta.
- **Queda** (`queda`): carimbo de queda, falha, botão de perigo, marca da projeção na régua, maior queda do funil, segunda série do gráfico, "fora" da meta.
- **Informação** (`informacao`): selo de informação (texto em tom escuro `#234f82` para contraste), marca de publicação no gráfico.
- **Alerta** (`alerta`): aviso acionável (`.aviso.alerta`, com texto em `#8a5a12`), selo `pago`/`parcial`, "perto" da meta, "reconectando".

### Named Rules
**The Cor Com Motivo Rule.** Cor semântica só aparece para comunicar estado. Se remover a cor não muda o significado, a cor não devia estar lá.

**The Nunca Só Cor Rule.** Alta e queda levam ▲ ▼ além da cor; "ok" e "falha" levam palavra; o dia de hoje leva a palavra "HOJE".

**The Papel Rule.** O dash é papel claro. Nenhuma superfície dentro dele ganha fundo escuro além da barra lateral e da faixa do logo, que são a marca. (Substitui a regra "Noite Sempre" do sistema anterior.)

## Typography

Satoshi 400 e 700, hospedada em `public/fonts/`, com `font-display: swap`. Corpo em 14px.

### Hierarchy
- **Título da aba** (1.6rem/700, tracking -0.01em) com subtítulo apagado de 0.82rem (período, comparação, "· atualizando…").
- **Manchete** (1.45rem/400 em tinta-2, números em tinta/700, `text-wrap: balance`, máximo 40ch).
- **Valor de etiqueta** (2.2rem/700) e **valor herói** (2.9rem/700), ambos limitados pela largura da etiqueta via `cqw` para nunca quebrar um "R$ 23.620,00" em duas linhas.
- **Título de bloco** (0.95rem/700) com complemento apagado (0.76rem) alinhado à direita.
- **Rótulo** (0.66rem/700, caixa alta, espaçamento 0.14em): "REF." da etiqueta, cabeçalho de tabela, rótulo de campo, grupo da navegação (0.12em).
- **Tabela** (0.86rem, tabular).
- **Nota / mini** (0.72rem apagado).

### Named Rules
**The Número Alinhado Rule.** Todo número comparável usa `font-variant-numeric: tabular-nums` e alinha à direita em tabela (`.num`).

**The Nome em Negrito Rule.** A primeira coluna de uma tabela leva negrito quando é o nome do item (LP, funil, produto), nunca quando é data ou hora.

## Layout

- Grade de duas colunas: barra lateral de 224px fixa (sticky, 100vh, rola por dentro) e conteúdo com `max-width: 1440px` e padding `1.6rem 2rem 3rem`.
- Topo da aba: título à esquerda, filtros à direita, `align-items: flex-end`, fio forte de 2px embaixo e 1.6rem até o conteúdo.
- Blocos separados por 1.8rem; o primeiro bloco da aba não repete o fio (o fio do topo já o separa).
- `.duas` = 3fr/2fr com 2rem de vão (gráfico + tabela); `.duas-colunas` = 1fr/1fr.
- Grade de etiquetas: `repeat(auto-fit, minmax(200px, 1fr))`, vão 0.9rem.
- Abaixo de 900px: a barra lateral vira faixa horizontal rolável no alto (rótulos de grupo somem, grupos separados por fio vertical bege translúcido), colunas viram uma, tabelas rolam dentro de `.tabela-wrap`, o `body` tem `overflow-x: hidden`.

## Elevation & Depth

Quase plano. A única sombra do sistema é a da etiqueta: `0 1px 0 rgba(22,21,19,0.06), 0 6px 14px -10px rgba(22,21,19,0.25)`; no hover ela alonga para `0 12px 22px -12px rgba(22,21,19,0.35)` e a etiqueta sobe 2px. Tooltip e balão de prévia usam a mesma sombra curta. Modal: véu de tinta a 40% e caixa em etiqueta com fio forte no topo. Tudo o mais se separa por fio, não por tom.

### Named Rules
**The Fio, Não Caixa Rule.** Um bloco de conteúdo não tem fundo nem borda; tem um título com fio forte em cima. Caixa só para o que é objeto (etiqueta, campo, modal, cartão de dia).

## Shapes

Canto de 2px em tudo (etiqueta: 2px em cima e 3px embaixo). Pílula (999px) só para chips de filtro, pílulas de vista e selos em linha. Chave liga/desliga com trilho arredondado. Sem gradiente, exceto o degradê da área do gráfico (tinta a 16% até zero) e a régua de marcas a cada 10%.

## Components

### Buttons
- **Primário** (`.btn`): tinta com texto papel, negrito, 1px de contorno na tinta.
- **Secundário** (`.btn.sec`): etiqueta com contorno tinta, peso normal; hover em papel escuro.
- **Perigo** (`.btn.perigo`): transparente com contorno e texto coral; passa sempre por confirmação na linha.
- **Desabilitado**: papel escuro, texto apagado, contorno fio.
- Todos com a mesma altura dos campos (padding 0.45rem, fonte 0.86rem, line-height 1.3).

### Chips e pílulas
- **Chip de filtro aplicado** (`.chip`): tinta com texto papel.
- **Pílula de vista** (`.tipo-pill`, `.abas button`): contorno fio, texto apagado; ativa = tinta com texto papel; hover escurece o contorno.
- **Selo em linha** (`.selo`): pílula com contorno fio e texto azul escuro; variantes `ar` (alta), `pago` e `parcial` (alerta).

### Etiqueta (signature)
`.etiqueta`: cartão em etiqueta, contorno fio, furo e ilhós centralizados no topo (`::before`, 9px, contorno de 2px na tinta, miolo em papel), `.ref` em rótulo apagado, `.valor` grande, `.rodape` com fio tracejado, carimbo à esquerda e `.nota` à direita. `.heroi` = valor maior. Sem dado: "—" apagado em peso normal e a nota do motivo. Variante de placar do Argo (`.argo-cartao`) é um botão com o mesmo desenho; `aria-pressed` marca o contorno na tinta.

### Carimbo (signature)
`.carimbo`: moldura de 1.5px em `currentColor`, 0.7rem negrito espaçado, inclinado -2°. `.alta` verde, `.queda` coral, `.alerta` âmbar, `.neutro` apagado, reto e tracejado. Zero vira "=". Usado no delta das etiquetas, em "vs. anterior" das tabelas, no estado do WhatsApp e na situação das metas.

### Bloco de conteúdo
`.bloco`: sem caixa; `h2` de 0.95rem com fio forte de 2px em cima, `small` apagado à direita.

### Tabela-grade
`th` em rótulo apagado com fio forte embaixo; `td` com fio fino; hover em tinta a 3%; `.num` à direita; `th.ordenavel` mostra ↑ ↓ e `aria-sort`; `tr.clicavel` com foco visível. Barra de proporção em célula: `.proporcao` (6px de altura, tinta, largura proporcional ao maior).

### Régua de metas
`.metas` entre dois fios; `.meta h3` (nome + "feito de meta"), `.regua` de 14px com marcas a cada 10%, preenchido na tinta até o feito, traço coral de 2px na projeção, legenda apagada embaixo (percentual, projeção, CPL). No detalhe (aba Leads) o indicador `.meta-ind` leva a mesma régua e a situação em carimbo.

### Inputs / Fields
`select`, `input` e `textarea`: fundo etiqueta, contorno na tinta, canto 2px, fonte 0.86rem. Select com seta própria desenhada (dois gradientes), sem a do navegador. `.campo > span` é rótulo apagado. Chave liga/desliga (`.argo-chave`): trilho papel com contorno fio, ligada na tinta (ou coral quando é a parada geral). Seletor segmentado (`.argo-seg`): rádios reais, escolhido em etiqueta com contorno na tinta; "executar" escolhido é tinta com texto papel.

### Navigation
Barra lateral carvão: logo branco de 160px, "TRACKING INTERNO" em taupe, quatro grupos (Resultados, Operação, Diagnóstico, Marketing) com rótulo taupe em caixa alta e fio translúcido entre grupos. Item em bege a 72%, hover bege sobre 6%, ativo bege sólido com texto carvão em negrito, foco bege.

### Tela de acesso
Papel; etiqueta centralizada de 360px com faixa carvão no alto (logo + "TRACKING INTERNO"), campo de chave, botão primário, erro em coral.

### Avisos e estados
- `.aviso`: apagado, sem caixa (estado vazio, ensinando o que apareceria).
- `.aviso.explica`: papel escuro com texto tinta-2 (explicação permanente).
- `.aviso.alerta`: fio âmbar de 1px à esquerda, texto âmbar escuro (pede ação).
- `.aviso.falha` / `.erro-carga`: texto coral; a aba que falhou inteira mantém topo e barra lateral e mostra o erro com "Tentar de novo" sobre um fio coral de 2px.
- **Esqueleto** (`.esq`): blocos em fio piscando devagar (2.2s) no lugar de manchete, etiquetas, régua, gráfico e tabela enquanto a resposta não chega; nunca os números do período anterior. Vem de `data-esqueleto` no contêiner e é escrito por `render()`.
- Confirmação na própria linha (`pedirConfirmacao`): pergunta + botões perigo/secundário no lugar do botão; nunca `confirm()`, `prompt()` ou `alert()` do navegador.

### Line Chart (signature)
SVG na largura do contêiner: linha na tinta (2.5px), área em degradê da tinta a 16% até zero, grade em fio, rótulos apagados de 11px, ponto com halo no último valor e **o valor escrito acima dele**, cursor tracejado e tooltip em etiqueta pequena. Segunda série em coral sem área, com legenda. Barras (Instagram) na tinta, variante apagada e negativa em coral.

### Modal
Véu de tinta a 40%; caixa em etiqueta com fio forte no topo, cabeçalho preso, botão fechar apagado, corpo rolável; `pre` em papel com fio.

## Motion

Só o que a spec permite: etiqueta sobe 2px no hover (180ms), linha de tabela escurece (150ms), navegação e botões trocam de cor (150ms), esqueleto pisca, contagem dos números-herói em 0,7s. Com `prefers-reduced-motion: reduce` **nada** anima nem transiciona (`transition: none; animation: none` em tudo, e a contagem é pulada).

## Superfícies escuras (site e painel de clientes)

O site e o painel de clientes não mudaram e continuam no mundo escuro do sistema anterior: fundo carvão `#1e1e1e`, grafite `#242424` para cards, grafite alto `#2a2a2a` para a camada acima, cinza quente `#393536` para contornos, branco para texto, cinza texto `#a6a6a6` para notas, bege `#f5f0eb` como voz da marca e cor das séries, e as mesmas cores semânticas (`#5dc986`, `#f37f7f`, `#7fb5f3`, `#e0b34c`). Cantos de 0.5rem/0.75rem e profundidade tonal sem sombra. Quando um deles for migrado, este documento absorve a mudança; até lá, nenhuma regra do papel se aplica a eles.

## Do's and Don'ts

### Do:
- Mostrar cada número numa etiqueta, com rótulo em caixa alta apagada e o motivo na nota quando não há dado
- Separar blocos com o fio forte no título, não com caixa
- Alinhar números à direita com algarismos tabulares
- Dar sinal (▲ ▼, palavra) a tudo que também tem cor
- Mostrar esqueleto ao carregar e o erro no lugar do conteúdo quando a aba falha
- Confirmar ações destrutivas na própria linha

### Don't:
- Fundo escuro, gradiente, vidro ou sombra longa dentro do dash
- Canto maior que 3px fora de pílula e chave
- Cor semântica como decoração (o bege não é acento no papel; é a barra lateral)
- Números do período anterior visíveis enquanto o novo carrega
- `confirm()`, `prompt()` ou `alert()` do navegador
- Copiar o mundo do papel para o site ou para o painel sem decisão registrada
