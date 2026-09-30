# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Marcelle Mesquita, dona da agência Sete Ads, opera sozinha o marketing da Atacado Exponencial (mentoria para marcas atacadistas do Felipe Santos). Abre o dash todo dia de manhã, no notebook, para decidir investimento em tráfego, cobrar a equipe comercial e conferir se as integrações estão de pé. Ocasionalmente mostra a tela para o cliente (Felipe) e para a equipe: ela quer que o painel impressione. (Inferido do repositório e do histórico de trabalho; não confirmado nesta sessão.)

## Product Purpose

Dash interno de tracking e marketing da Atacado Exponencial: mostra leads, conversão por landing page, CPL por funil e canal, receita e ROAS, campanhas do Meta Ads, e-mail, workshops, grupos de WhatsApp, Instagram, além de operação (disparos, links, bloqueios, testes A/B) e diagnóstico (jornada do lead, eventos, saúde das integrações, Argo). Sucesso é ela decidir em minutos, sem abrir outra ferramenta, e confiar no número.

## Positioning

Tracking server-side próprio (Cloudflare Pages + D1) que cruza o site, o CRM (ClickUp), o Meta, o GA4, o Greenn e o WhatsApp num único painel, com atribuição por UTM persistida de ponta a ponta. Um Looker ou o gerenciador do Meta não enxergam esse cruzamento.

## Operating Context

- Aba única em `public/dash/index.html` (HTML, CSS e JS sem framework), protegida por chave de acesso.
- Sidebar com quatro grupos: Resultados, Operação, Diagnóstico, Marketing (19 abas).
- Filtro global de funil e de período (Hoje, Ontem, 7/14/30 dias, mês, personalizado) no topo.
- A Visão geral abre com uma manchete em frase, três números-herói (Leads, Conversão geral, CPL), metas do mês, quatro KPIs (Novos visitantes, Investimento Meta, Receita, ROAS), gráfico de leads por dia e tabela de conversão por LP.
- Muitas tabelas densas com números comparáveis; deltas contra o período anterior.
- Alertas de integração chegam pelo Slack; o dash mostra saúde.

## Capabilities and Constraints

- Sem framework de front; tudo em um arquivo com SVG próprio para gráficos.
- Fonte Satoshi (400 e 700) já hospedada em `/fonts`.
- Logo horizontal branco em `public/dash/logo-atacado-exponencial.png`.
- Mesmos tokens do painel de clientes (`painel/src/styles/dash.css`) e do site (`src/styles/global.css`).
- Lógica de negócio fica no backend (`functions/`); o dash só exibe.
- Redesign visual decidido em 30/09/2026: a usuária escolheu a direção "Etiqueta" (fundo claro, etiquetas de preço, barra lateral carvão e bege) entre três mockups. Implementação segue o fluxo spec → break → plan → execute.

## Brand Commitments

- Nome: Atacado Exponencial. Subtítulo do painel: "Tracking interno".
- Textos sem travessão. Português do Brasil.
- Identidade compartilhada com o site (carvão, bege assinatura, Satoshi). Fundo escuro era regra até agora; a usuária liberou explorar claro nesta rodada.

## Evidence on Hand

- Dados reais no ar (D1 e Neon); os mockups de decisão usam números fictícios e são marcados como exemplo.
- Não há depoimentos, benchmarks ou métricas de mercado para citar; nada disso deve ser inventado no dash.

## Product Principles

- O número decide: hierarquia serve a leitura rápida de KPIs e deltas.
- Cor com motivo: cor semântica só para estado (alta, queda, alerta, informação).
- Densidade a serviço: tabelas cheias são normais, mas a Visão geral responde "como estamos" em um olhar.
- Consistência entre abas: mesmo vocabulário de componentes em todas as 19 seções.
- Nunca só cor: alta e queda levam sinal além da cor.
