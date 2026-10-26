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

## Cenários

### Happy Path
1. A Visão geral mostra a tabela "Leads por funil": uma linha por funil, do que tem mais leads para o que tem menos, com Leads e Leads novos (cada um com o carimbo contra o período anterior) e "Entraram nos grupos".
2. Na linha do workshop, "Entraram nos grupos" traz as entradas nos grupos monitorados com rótulo "Workshops" no período (mesma contagem da aba Grupos); nas outras linhas, a coluna fica vazia.
3. A usuária abre a semana anterior e confirma que a tela inteira serve para a reunião.

### Edge Cases
- Funil novo (sem leads no período anterior): carimbo "novo".
- `/api/cpl` falhou: Leads novos e grupos ficam "—"/vazios; Leads continua.
- Filtro do topo num funil: só a linha dele.

### Cenário de Erro
- Tabela de grupos indisponível: a coluna fica vazia, o resto do `/api/cpl` segue.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S4-14 | automática | `tests/visao-reuniao.test.js` | SE com 10 leads e 4 novos, workshop com 6 e 6, nessa ordem, com carimbo |
| CA-S4-15 | automática | `tests/visao-reuniao.test.js` | 7 entradas nos grupos do workshop (e entradas em outros grupos) viram 7 só na linha do workshop |
| CA-S4-17 | manual | roteiro abaixo | a usuária aprova a Visão geral para a reunião |

### Roteiro manual — CA-S4-17
1. Abra o dash no ar, Visão geral, "Últimos 7 dias", "Todos os funis".
2. Confira manchete, oito quadros, taxas de passagem, níveis de qualificação e leads por funil (com os grupos no workshop).
3. Compare com o que você espera da semana (ClickUp, aba Agenda, aba Grupos).
4. Diga se a tela serve para apresentar na reunião semanal.

## Banco de Dados

Sem mudança. Lê `whatsapp_group_events` e `whatsapp_groups_tracked`.

## Arquivos

- **Modificar:** `functions/api/cpl.js` — `entradas_grupos` `{ workshop: n }`: entradas ('entrou') nos grupos monitorados com rótulo "Workshops", por dia de Brasília do período (mesma conta da aba Grupos); erro vira `{}`.
- **Modificar:** `public/dash/visao-reuniao.js` — `montarNumeros` devolve `por_funil` (leads e anterior de `/api/leads`, leads novos e anterior e grupos de `/api/cpl`), ordenado por leads.
- **Modificar:** `public/dash/index.html` — `&v=s4` nas chamadas do `/api/cpl` da Visão geral, para resposta antiga guardada no cache de período fechado (sem `entradas_grupos`) não servir.
- **Modificar:** `tests/visao-reuniao.test.js` — testes CA-S4-14 e 15.

## Dependências Externas

Nenhuma.

## Checklist

- [x] `entradas_grupos` no `/api/cpl`
- [x] `por_funil` em `montarNumeros`
- [x] Testes CA-S4-14 e 15
- [x] Deploy e conferência no ar

## Testes manuais

| Critério | Conferido por | Dia |
|---|---|---|
| CA-S4-17 | Marcelle | 26/10/2026 |
