# S4-04: Taxas de passagem dos leads novos com o Calendly

**Tipo:** Implementação
**Página:** Visão geral — taxas de passagem
**Spec:** `spec-visao-geral-reuniao-semanal.md`

## Descrição

Logo abaixo dos números, a Visão geral mostra Lead → MQL, MQL → RA e RA → RR sobre os leads
novos, cada uma com "X de Y". RA → RR passa a contar também as consultorias do Calendly com
presença marcada no dash. Sem base para a conta, a taxa mostra "—".

## Pronto quando

Na Visão geral da semana passada, as três taxas aparecem com as contas por extenso, e RA →
RR inclui as reuniões do Calendly marcadas como Realizada ou Faltou.

## Critérios de aceite

- **CA-S4-08** (automática) — Três taxas de passagem dos leads novos. Dado no período 40 leads novos, 12 MQLs novos, 6 desses MQLs com reunião agendada, e 5 reuniões que já deveriam ter acontecido, das quais 3 realizadas, quando a Visão geral abre, então aparecem Lead → MQL 30% ("12 de 40"), MQL → RA 50% ("6 de 12") e RA → RR 60% ("3 de 5"), nesta ordem.
- **CA-S4-09** (automática) — RA → RR conta as reuniões do Calendly. Dado no período uma reunião da agenda própria Realizada, uma consultoria do Calendly Realizada e uma do Calendly Faltou, quando a Visão geral calcula RA → RR, então a taxa é 67% ("2 de 3").
- **CA-S4-10** (automática) — Taxa sem base mostra traço. Dado um período sem nenhum lead novo, quando a Visão geral abre, então Lead → MQL mostra "—" em vez de 0%.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S4-03 | Reunião realizada conta pela data da reunião (não pela data em que agendou), e o Calendly só entra a partir de 19/10/2026, quando a presença passou a ser marcada no dash. | confirmada | Conta na data em que a reunião foi realizada (usuária, 26/10/2026) |

## Perguntas em aberto

Nenhuma.
