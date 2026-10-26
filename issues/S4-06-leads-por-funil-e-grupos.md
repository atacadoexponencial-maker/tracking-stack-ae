# S4-06: Leads por funil com leads novos e entradas nos grupos do workshop

**Tipo:** Implementação
**Página:** Visão geral — leads por funil
**Spec:** `spec-visao-geral-reuniao-semanal.md`

## Descrição

A tabela de leads por funil ganha a coluna Leads novos (com variação contra o período
anterior) e a coluna "Entraram nos grupos", preenchida só na linha do workshop com as
entradas nos grupos do workshop registradas na aba Grupos. É a última entrega da tela: com
ela, a usuária aprova a Visão geral nova para a reunião.

## Pronto quando

Na Visão geral da semana passada, a tabela mostra leads e leads novos por funil e, no
workshop, as entradas nos grupos batendo com a aba Grupos; a usuária confirma que a tela
inteira serve para a reunião.

## Critérios de aceite

- **CA-S4-14** (automática) — Tabela por funil com leads e leads novos. Dado no período 10 leads de SE (4 novos) e 6 do workshop (6 novos), quando a Visão geral abre, então a tabela mostra SE com 10 leads e 4 novos, e workshop com 6 leads e 6 novos, nesta ordem, cada número com a variação contra o período anterior.
- **CA-S4-15** (automática) — Workshop mostra quem entrou nos grupos. Dado 7 entradas nos grupos do workshop registradas no período e entradas em outros grupos que não são do workshop, quando a Visão geral abre, então a linha do workshop mostra 7 em "Entraram nos grupos" e as outras linhas ficam vazias nessa coluna.
- **CA-S4-17** (manual) — Visão geral nova aprovada para a reunião. Dado o dash no ar com a semana anterior selecionada, quando a usuária abre a Visão geral, então ela confirma que a tela serve para apresentar na reunião semanal e que os números batem com o que ela espera.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S4-05 | "Entraram nos grupos" do workshop é a contagem de entradas nos grupos monitorados do workshop na aba Grupos, no período. | confirmada | Usuária, 26/10/2026 |
| SUP-S4-06 | Todos os números continuam comparados com o período anterior de mesmo tamanho, como hoje. | confirmada | Usuária, 26/10/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S4-04 | Quais colunas na tabela de leads por funil? | respondida | Leads e leads novos, mais entradas nos grupos no workshop (usuária, 26/10/2026) |
