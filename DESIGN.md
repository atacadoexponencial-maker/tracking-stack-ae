---
name: Atacado Exponencial
description: Identidade visual compartilhada pelo site, pelo dash de tracking e pelo painel de clientes.
colors:
  carvao: "#1e1e1e"
  grafite: "#242424"
  grafite-alto: "#2a2a2a"
  cinza-quente: "#393536"
  branco: "#ffffff"
  cinza-texto: "#a6a6a6"
  bege-assinatura: "#f5f0eb"
  verde-alta: "#5dc986"
  coral-queda: "#f37f7f"
  azul-informacao: "#7fb5f3"
  ambar-alerta: "#e0b34c"
typography:
  display:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.6rem, 3vw, 2.2rem)"
    fontWeight: 700
    lineHeight: 1.15
    fontFeature: "tnum"
  headline:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Satoshi, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.76rem"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  barra: "3px"
  sm: "0.5rem"
  md: "0.75rem"
  pilula: "999px"
spacing:
  xs: "0.3rem"
  sm: "0.7rem"
  md: "1rem"
  lg: "1.4rem"
components:
  button-primary:
    backgroundColor: "{colors.branco}"
    textColor: "{colors.carvao}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.9rem"
  button-secondary:
    backgroundColor: "{colors.grafite-alto}"
    textColor: "{colors.branco}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.9rem"
  card:
    backgroundColor: "{colors.grafite}"
    rounded: "{rounded.md}"
    padding: "1rem 1.1rem"
  kpi:
    backgroundColor: "{colors.grafite}"
    textColor: "{colors.branco}"
    rounded: "{rounded.md}"
    padding: "0.8rem 0.9rem"
  input:
    backgroundColor: "{colors.grafite}"
    textColor: "{colors.branco}"
    rounded: "{rounded.sm}"
    padding: "0.45rem 0.6rem"
  nav-item-active:
    backgroundColor: "{colors.grafite-alto}"
    textColor: "{colors.branco}"
    rounded: "{rounded.sm}"
    padding: "0.55rem 0.6rem"
  tab-pill:
    backgroundColor: "transparent"
    textColor: "{colors.cinza-texto}"
    rounded: "{rounded.pilula}"
    padding: "0.3rem 0.75rem"
  tab-pill-active:
    backgroundColor: "{colors.grafite-alto}"
    textColor: "{colors.branco}"
    rounded: "{rounded.pilula}"
    padding: "0.3rem 0.75rem"
---

# Design System: Atacado Exponencial

## Overview

**Creative North Star: "O Relatório Editorial Noturno"**

A Atacado Exponencial se apresenta como uma publicação de negócios premium lida à noite: fundo carvão, texto branco nítido e um bege quente que funciona como assinatura. O mesmo mundo vale para o site, o dash de tracking (`public/dash/index.html`) e o painel de clientes (`painel/src/styles/dash.css`), que espelham os mesmos tokens de `src/styles/global.css`.

Nas superfícies de operação (dash e painel) o tom é **calmo e confiável**. Quem abre o dash todo dia decide investimento com base nele, então os números vêm em primeiro plano e a interface recua. A cor é escassa de propósito: aparece para dizer que algo subiu, caiu ou pede atenção, nunca para enfeitar. O caráter editorial vem da hierarquia tipográfica, do respiro e do bege, não de efeitos.

A profundidade é tonal, sem sombras: carvão, grafite e grafite alto empilham as camadas, e um contorno cinza quente separa as áreas.

**Key Characteristics:**
- Fundo escuro sempre, inegociável
- Satoshi em dois pesos (400 e 700), números com algarismos tabulares
- Bege `bege-assinatura` como voz da marca e cor das séries de dados
- Cor semântica só para estado (alta, queda, informação, alerta)
- Superfícies planas separadas por tom e contorno, sem sombra

## Colors

Paleta quase monocromática e quente, em que o bege assina e as cores semânticas só falam quando há algo a dizer.

### Primary
- **Bege Assinatura** (`bege-assinatura`): a voz da marca. Nas LPs é o fundo das seções claras. No dash é a cor da série principal dos gráficos (linha, pontos e área a 13% de opacidade).

### Neutral
- **Carvão** (`carvao`): fundo de página em todas as superfícies. Também é o texto sobre o botão primário branco.
- **Grafite** (`grafite`): cards, KPIs, campos de formulário e modais.
- **Grafite Alto** (`grafite-alto`): a camada acima do card, para item de navegação ativo, aba ativa, hover de linha de tabela, tooltip e botão secundário.
- **Cinza Quente** (`cinza-quente`): contornos de card, divisórias de tabela e eixos de gráfico. Tem um toque avermelhado que aquece o cinza.
- **Branco** (`branco`): texto principal, valores de KPI e botão primário.
- **Cinza Texto** (`cinza-texto`): rótulos, cabeçalhos de tabela, subtítulos e estado vazio.

### Tertiary
- **Verde Alta** (`verde-alta`): delta positivo e status "ok".
- **Coral Queda** (`coral-queda`): delta negativo, falha, maior queda do funil e 2ª série de gráfico (saída de gente).
- **Azul Informação** (`azul-informacao`): barras do funil de micro-conversões, a 55% de opacidade.
- **Âmbar Alerta** (`ambar-alerta`): texto de aviso acionável (`.aviso.alerta`).

### Named Rules
**The Cor Com Motivo Rule.** Cor semântica só aparece para comunicar estado. Se remover a cor não muda o significado, a cor não devia estar lá.

**The Nunca Só Cor Rule.** Alta e queda levam sinal ou seta além da cor, para quem não distingue verde de coral.

**The Noite Sempre Rule.** Nenhuma superfície de operação ganha tema claro. O bege entra como acento, nunca como fundo do dash.

## Typography

**Display Font:** Satoshi (com system-ui, -apple-system, Segoe UI)
**Body Font:** Satoshi
**Label/Mono Font:** ui-monospace, Consolas, só em payloads técnicos (`pre`)

**Character:** uma única família geométrica e humanista em dois pesos. A hierarquia vem de tamanho e peso, sem trocar de fonte, o que mantém a sobriedade editorial.

### Hierarchy
- **Display** (700, `clamp(1.6rem, 3vw, 2.2rem)`, 1.15): valor dos KPIs-herói da Visão geral.
- **Headline** (700, 1.25rem): título da aba no topo.
- **Title** (700, 0.95rem): título de card. O complemento em `small` vem em 400, 0.78rem, cinza texto.
- **Body** (400, 15px, 1.45): texto corrido. As tabelas usam 0.84rem.
- **Label** (400, 0.72–0.76rem): rótulo de KPI, cabeçalho de tabela, delta e nota `mini`.

### Named Rules
**The Número Tabular Rule.** Todo número que se compara com outro (KPI, delta, coluna numérica, tooltip) usa `font-variant-numeric: tabular-nums` e alinha à direita em tabela.

## Layout

Grade de aplicativo: barra lateral fixa de 220px com a marca e a navegação, e conteúdo com respiro de 1.4rem × 1.8rem. Os KPIs usam grade automática (mínimo de 185px, e 220px nos heróis), com vão de 0.7–0.8rem. Os cards empilham com 1rem entre si, e comparações lado a lado usam duas colunas iguais.

Abaixo de 980px a barra lateral vira faixa horizontal rolável, e as duas colunas viram uma. Tabelas largas rolam dentro do próprio contêiner e nunca a página.

## Elevation & Depth

O sistema é plano. A profundidade vem da escada tonal carvão → grafite → grafite alto e de um contorno de 1px cinza quente. A única sombra do sistema é o véu preto a 55% atrás do modal, que é recuo de contexto e não elevação.

### Named Rules
**The Plano Por Tom Rule.** Para elevar um elemento, sobe-se um degrau de tom. Não se adiciona sombra.

## Shapes

Cantos suavemente arredondados: 0.75rem em cards, KPIs, modais e tela de acesso, 0.5rem em botões, campos, itens de navegação e tooltip. Pílula completa (999px) para chips e abas de filtro, e 3px para as barras de dado. Contornos sempre com 1px.

## Components

### Buttons
- **Shape:** cantos de 0.5rem.
- **Primary:** fundo branco com texto carvão, peso 700, 0.86rem. É o maior contraste do sistema, reservado para a ação principal.
- **Secondary:** grafite alto com contorno cinza quente e texto branco, peso 400.

### Chips
- **Style:** pílula branca com texto carvão, 0.75rem. Representa um filtro aplicado.
- **Tab pill:** pílula transparente com contorno e texto cinza. Quando ativa, ganha grafite alto, texto branco e peso 700.

### Cards / Containers
- **Corner Style:** 0.75rem.
- **Background:** grafite.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Border:** 1px cinza quente.
- **Internal Padding:** 1rem × 1.1rem.

### Inputs / Fields
- **Style:** fundo grafite, contorno cinza quente, cantos de 0.5rem, 0.86rem.
- **Focus:** hoje depende do padrão do navegador. Falta um anel de foco próprio.

### Navigation
- **Style:** lista vertical na barra lateral, 0.92rem.
- **Default:** texto cinza texto.
- **Hover:** texto branco sobre grafite.
- **Active:** texto branco em 700 sobre grafite alto.
- **Mobile:** vira faixa horizontal rolável.

### KPI Tile (signature)
O bloco de número é a unidade central do dash: rótulo cinza pequeno em cima, valor branco em 700 com algarismos tabulares, e delta colorido embaixo. A variante herói aumenta o valor para display.

### Line Chart (signature)
Gráfico em SVG próprio: linha bege de 2px com área bege a 13%, eixos em cinza quente, rótulos de 10px em cinza texto, cursor tracejado e tooltip em grafite alto. A segunda série usa coral, sem área, com legenda de pontos coloridos.

## Do's and Don'ts

### Do:
- **Do** manter o fundo carvão (`#1e1e1e`) em toda superfície de operação.
- **Do** usar o bege assinatura como cor da série principal de dados.
- **Do** criar hierarquia com tamanho e peso da Satoshi antes de recorrer à cor.
- **Do** alinhar números à direita com algarismos tabulares.
- **Do** separar camadas por tom (grafite → grafite alto) e contorno de 1px cinza quente.

### Don't:
- **Don't** introduzir tema claro nem fundo bege no dash ou no painel.
- **Don't** usar cor semântica (verde, coral, azul, âmbar) como decoração.
- **Don't** adicionar sombras para criar profundidade.
- **Don't** comunicar alta ou queda só pela cor.
