# S7-03: Listas de nomes das reuniões (em drop) na Visão geral

**Tipo:** Implementação
**Página:** Visão geral
**Spec:** `spec-detalhe-reunioes.md`

## Descrição

Ligar as cinco listas da seção aos dados reais, fechadas em drop com a quantidade no
título: Ainda vão acontecer, Faltaram, Cancelaram, Sem presença marcada e Reagendamentos
(com quantas vezes e as trocas de horário), sempre das reuniões criadas no período do
filtro e só para quem tem a chave do dash.

## Pronto quando

Na Visão geral no ar, a usuária abre cada lista e vê os nomes de quem agendou no período,
batendo com a agenda de 02–08/11.

## Critérios de aceite

- **CA-S7-04** (automática) — Lista de quem ainda vai fazer mostra todas as futuras do período. Dado reuniões criadas no período com reunião em 09/11, 10/11 e 16/11, e uma criada antes do período com reunião em 10/11, quando a lista "Ainda vão acontecer" é montada, então aparecem as três criadas no período, em ordem da mais próxima, com nome, funil, dia e hora; a criada antes do período não aparece.
- **CA-S7-05** (automática) — Reunião remarcada para o futuro conta como a acontecer. Dado uma reunião criada no período e remarcada para um horário que ainda não passou, quando a seção é montada, então ela entra em "a acontecer", aparece na lista "Ainda vão acontecer" no horário novo, com a marca de remarcada.
- **CA-S7-06** (automática) — Listas de faltaram e cancelaram com os nomes. Dado uma reunião com falta marcada e uma cancelada, ambas criadas no período, quando a seção é montada, então a primeira aparece em "Faltaram" e a segunda em "Cancelaram", cada uma com nome, funil, dia e hora em que estava marcada.
- **CA-S7-07** (automática) — Reunião que passou sem presença fica em lista própria. Dado uma reunião criada no período cujo horário já passou e que não foi marcada como realizada nem falta, quando a seção é montada, então ela aparece em "Sem presença marcada" e não entra no no-show nem em "a acontecer".
- **CA-S7-08** (automática) — Reagendamentos com o histórico das trocas. Dado uma reunião criada no período remarcada duas vezes (de 06/11 15h para 10/11 15h, e de 10/11 15h para 12/11 17h) e depois realizada, quando a lista "Reagendamentos" é montada, então a reunião aparece uma vez, com "2 remarcações", as duas trocas na ordem e a situação atual "realizada"; ela também conta como realizada nos números.
- **CA-S7-10** (automática) — Só a equipe com a chave do dash vê os nomes. Dado um pedido dos dados da seção sem a chave do dash ou com chave errada, quando o pedido chega, então é recusado e nenhum nome ou e-mail é devolvido.
- **CA-S7-11** (automática) — Período ou lista vazios avisam em vez de sumir. Dado um período sem nenhuma reunião criada, e outro em que ninguém faltou, quando a seção é montada, então no primeiro a seção diz que não houve reunião criada no período; no segundo a lista "Faltaram" diz que ninguém faltou.
- **CA-S7-13** (automática) — Listas começam fechadas e abrem com um clique. Dado a seção montada com 8 a acontecer e 1 falta, quando a Visão geral abre, então as listas aparecem fechadas, só com o título e a quantidade ("Ainda vão acontecer (8)", "Faltaram (1)"); ao clicar em "Faltaram" só essa lista abre, e um novo clique a fecha.
- **CA-S7-12** (manual) — A seção no ar bate com a agenda de 02–08/11. Dado o dash no ar com o filtro em 02/11/2026 a 08/11/2026, quando a usuária abre a Visão geral, então vê a seção com os números e os nomes batendo com a agenda (Izabell realizada, Patricia faltou, Daniel Aguiar cancelou, e as 8 a acontecer, menos as que já passaram até o dia da conferência), e aprova o visual.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S7-03 | Reuniões que vieram do Calendly (antes da agenda própria) entram nos números e listas com o e-mail quando não houver nome; no reagendamento aparecem só como "remarcada", sem os horários das trocas (o Calendly não guarda o histórico) | confirmada | usuária, 09/11/2026 |
| SUP-S7-04 | Cada linha das listas mostra nome, funil, dia e hora; sem telefone, e-mail ou link do ClickUp | confirmada | usuária, 09/11/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S7-02 | Contagens e listas partem das reuniões criadas no período ou das que acontecem no período? | respondida | Criadas no período, como o card da coorte (usuária, 09/11/2026) |
| PER-S7-03 | "Quem ainda vai fazer essa semana" mostra quem? | respondida | Só os leads que agendaram no período, independente da data da reunião (usuária, 09/11/2026) |
| PER-S7-04 | O que fazer com reunião que passou sem presença marcada? | respondida | Lista própria, fora do no-show (usuária, 09/11/2026) |
