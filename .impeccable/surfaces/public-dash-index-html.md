---
version: 1
slug: "public-dash-index-html"
primary_target: "public/dash/index.html"
related_targets: []
---

# Dash de tracking (`public/dash/index.html`)

Escopo: todas as 19 abas do painel interno. Modo: Operate. Quem usa: Marcelle, todo dia de manhã, para decidir investimento e cobrar a equipe; às vezes mostra ao cliente. Restrições: HTML/CSS/JS sem framework num arquivo só; Satoshi 400/700 já hospedada; lógica no backend.

Decisão de 30/09/2026: a usuária escolheu a direção A "Etiqueta" entre três mockups (A Etiqueta clara, B Terminal escura, C Grade escura). Mockups em https://claude.ai/artifact/D53wRnsubqBz7quVzJDueM. A regra "fundo escuro inegociável" do DESIGN.md cai com essa escolha; o DESIGN.md é reescrito no fim da implementação, a partir do que for construído.

## Direction contract

THESIS: o painel é um catálogo de atacado, não um dashboard SaaS. Cada número é uma etiqueta pendurada; a tabela é uma grade de tamanhos; o delta é um carimbo. Recusa o arranjo padrão de cards escuros iguais com sombra e ícone.

OWN-WORLD: papel claro levemente quente como fundo, tinta preta, fios finos (hairline) e um fio forte de 2px acima de cada bloco. Etiquetas brancas com furo e ilhós no topo, sombra curta. Barra lateral carvão com texto bege (a assinatura da marca dentro do papel), item ativo bege com texto carvão. Satoshi em dois pesos, números tabulares grandes com tracking negativo. Rótulos em caixa alta espaçada como "REF.". Cor semântica só em carimbos de alta/queda e alertas. Sem cantos grandes, sem gradiente, sem vidro.

STORY: ela abre, lê a manchete em uma frase, vê os três números nas etiquetas e sabe como está o mês. Desce para metas (régua), KPIs, gráfico e tabelas. Confia porque o número está em primeiro plano e nada decora.

FIRST VIEWPORT: topo com título e filtros separados por fio forte; manchete em corpo 1.45rem; três etiquetas-herói lado a lado (valor 2.9rem); régua de metas entre fios; quatro etiquetas de KPI; gráfico à esquerda (3/5) e leads por funil à direita (2/5); tabela de conversão por LP. Ação primária (filtros) no topo à direita.

FORM: catálogo/etiqueta de preço de atacado de moda, candidato 6 da lista fundamentada, direção atribuída pelo sorteio; seed 8439bcf2. Desafiante Crouwel (grade) ficou competitivo e doou a disciplina de alinhar tudo a um ritmo fixo de espaçamento; darkroom, one-bit, PC-98, capa e nuvem iridescente declinados.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Em aberto
- Painel de clientes (`painel/`) e site compartilham tokens; decidir se acompanham o papel claro ou ficam escuros.
- Ordem das abas para migrar (sugestão: Visão geral → Leads → resto).
