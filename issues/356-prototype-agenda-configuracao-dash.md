# 356: Protótipo das telas de configuração da Agenda (dash)

**Tipo:** Protótipo
**Página:** Dash (`public/dash/index.html`), seção nova **Agenda**: Agendas conectadas, Grades de disponibilidade e Tipos de reunião (spec `spec-agenda-propria.md`, módulos 1, 2 e 3)

## Descrição

Desenhar dentro do dash, no estilo "Etiqueta", as três telas de configuração da
agenda própria: lista de agendas com papel e saúde, lista e editor de grades,
lista de tipos (abre só com os ativos) e o formulário do tipo com todos os
campos da spec, inclusive "é reunião comercial" e funil.

## Pronto quando

Na prévia, a usuária navega pelas três telas (com estados de vazio, erro de
conexão da agenda e tipo pausado), no computador e no celular, e aprova o
desenho.


## Implementação (02/10/2026)

Branch `agenda-propria`, commit único com 356–363. Protótipo pulado como etapa separada (pedido de 02/10: "quero tudo pronto"): as telas foram construídas direto ligadas ao backend, como na 336, e ela confere no link de prévia. Arquivo `public/dash/agenda.js`, vistas Agendas conectadas, Grades e Tipos.

Testes: `tests/agenda-regras.test.js` e `tests/agenda-fluxo.test.js` (SQLite real + Google simulado). Falta: conferência da usuária na prévia; nada vai para a `main` sem o ok dela.
