# S4-03: Visão geral com os oito números da reunião

**Tipo:** Implementação
**Página:** Visão geral — números do período
**Spec:** `spec-visao-geral-reuniao-semanal.md`

## Descrição

A Visão geral passa a mostrar só a manchete e os quadros Leads, Leads novos, CPL, CPL lead
novo, MQLs (só novos), SQL (campo "🏆 SQL" do card), Reunião agendada e Reunião realizada
(agenda própria + Calendly, pela data em que a reunião aconteceu), comparados com o período
anterior e respeitando o filtro de funil. Os blocos que saem da tela continuam na aba
Detalhado (S4-02).

## Pronto quando

Na Visão geral em "Últimos 7 dias", aparecem os oito quadros na ordem da spec, com SQL e
Reunião realizada batendo com o CRM e com a aba Agenda, e o CRM fora do ar só esvazia MQLs e
SQL.

## Critérios de aceite

- **CA-S4-01** (automática) — A Visão geral mostra só os oito números da reunião, nesta ordem. Dado o dash aberto na Visão geral, quando a tela termina de carregar, então abaixo da manchete, a primeira linha tem exatamente os quadros Leads, Leads novos, CPL, CPL lead novo, MQLs, SQL, Reunião agendada e Reunião realizada, nesta ordem, e não aparecem conversão geral, visitantes, investimento, receita, ROAS, gráfico diário, LPs, metas, painel por funil nem funil da agenda.
- **CA-S4-02** (automática) — SQL conta os leads novos com o campo de SQL preenchido no CRM. Dado três leads novos no período, dois com o campo "🏆 SQL" (emoji ✅) preenchido e um sem, e um lead antigo (card de antes do período) com o campo preenchido, quando a Visão geral calcula o período, então o quadro SQL mostra 2.
- **CA-S4-03** (automática) — MQLs conta só os leads novos. Dado no período um lead novo com faturamento de R$ 50 mil, um lead novo com R$ 10 mil e um lead antigo que voltou com R$ 80 mil, quando a Visão geral calcula o período, então o quadro MQLs mostra 1.
- **CA-S4-04** (automática) — Reunião realizada soma agenda própria e Calendly. Dado no período uma reunião da agenda própria com presença Realizada, uma com Faltou, uma consultoria do Calendly marcada como Realizada no dash e uma do Calendly sem presença, quando a Visão geral calcula o período, então o quadro Reunião realizada mostra 2.
- **CA-S4-05** (automática) — Números comparados com o período anterior. Dado 10 leads no período escolhido e 8 no período anterior de mesmo tamanho, quando a Visão geral abre, então o quadro Leads mostra 10 e a variação de +25% em relação ao período anterior, e os outros sete quadros mostram a comparação do mesmo jeito.
- **CA-S4-06** (automática) — Filtro de funil vale para todos os quadros. Dado leads, MQLs, SQLs e reuniões em dois funis diferentes no período, quando a usuária escolhe um dos funis no filtro do topo, então cada quadro mostra só os números daquele funil.
- **CA-S4-07** (automática) — CRM fora do ar não derruba a tela. Dado o CRM sem responder, quando a Visão geral abre, então os quadros MQLs e SQL mostram "sem dados do CRM", e Leads, Leads novos, CPL, CPL lead novo, Reunião agendada e Reunião realizada aparecem com os números.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S4-01 | SQL é o campo checkbox "🏆 SQL" da lista de leads do ClickUp. Existe também um campo emoji com o mesmo nome, que fica de fora. | invalidada | Vale o campo emoji "🏆 SQL" (id b68130e0-204c-417f-b554-3b9f3782b941), não o checkbox (usuária, 26/10/2026) |
| SUP-S4-02 | SQL conta só leads novos do período (como MQL), lido do estado atual do card no momento da consulta. | confirmada | Usuária, 26/10/2026 |
| SUP-S4-03 | Reunião realizada conta pela data da reunião (não pela data em que agendou), e o Calendly só entra a partir de 19/10/2026, quando a presença passou a ser marcada no dash. | confirmada | Conta na data em que a reunião foi realizada (usuária, 26/10/2026) |
| SUP-S4-06 | Todos os números continuam comparados com o período anterior de mesmo tamanho, como hoje. | confirmada | Usuária, 26/10/2026 |
| SUP-S4-07 | A manchete em frase ("X leads nos últimos 7 dias…") sai da Visão geral e vai para a aba Detalhado. | invalidada | A manchete fica na Visão geral (usuária, 26/10/2026); a aba Detalhado também a tem, por ser cópia da tela antiga |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S4-01 | O que conta como SQL? | respondida | Checkbox no CRM ClickUp (usuária, 26/10/2026); campo confirmado depois: emoji "🏆 SQL" b68130e0-204c-417f-b554-3b9f3782b941 |
