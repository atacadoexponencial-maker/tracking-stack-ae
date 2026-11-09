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
| SUP-S7-07 | Reuniões da Aplicação Mentoria contam como Sessão Estratégica (regra única de funil da S3: Mentoria é porta da SE); o filtro de funil separa SE dos outros funis (ex.: workshop), não SE de Mentoria | confirmada | usuária, 09/11/2026 |
| SUP-S7-08 | Remarcação feita direto na agenda do Google (o histórico não guarda o horário antigo) aparece como "movida direto na agenda do Google em dd/mm"; as demais mostram "de → para". No Calendly, a reunião ativa é marcada como remarcada quando o mesmo e-mail tem uma consulta cancelada por remarcação | confirmada | usuária, 09/11/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S7-02 | Contagens e listas partem das reuniões criadas no período ou das que acontecem no período? | respondida | Criadas no período, como o card da coorte (usuária, 09/11/2026) |
| PER-S7-03 | "Quem ainda vai fazer essa semana" mostra quem? | respondida | Só os leads que agendaram no período, independente da data da reunião (usuária, 09/11/2026) |
| PER-S7-04 | O que fazer com reunião que passou sem presença marcada? | respondida | Lista própria, fora do no-show (usuária, 09/11/2026) |

## Cenários

### Happy Path
1. A usuária abre a Visão geral (sem `proto=1`) com o filtro em 02/11 a 08/11.
2. O dash pede `/api/agenda/detalhe` (período e funil do filtro, com a chave do dash). O servidor monta as listas das reuniões criadas no período, com a mesma seleção e o mesmo status da coorte, e devolve só o que a tela mostra: nome (ou e-mail, no Calendly sem nome), funil, horário da reunião, se foi remarcada e, nos reagendamentos, as trocas e a situação atual.
3. Embaixo dos números, as cinco listas aparecem fechadas com a quantidade: "Ainda vão acontecer (8)", "Faltaram (1)", "Cancelaram (1)", "Sem presença marcada (0)", "Reagendamentos (n)".
4. Clicar em "Faltaram" abre só essa lista (Patricia · Sessão Estratégica · sex 06/11 · 16h); clicar de novo fecha.
5. "Ainda vão acontecer" vem da mais próxima para a mais distante; remarcadas levam a marca "remarcada".
6. "Reagendamentos" mostra cada pessoa uma vez, com "n remarcações", as trocas em ordem ("qui., 29/10, 15:00 → ter., 03/11, 14:00") e "agora: realizada / faltou / a acontecer…".

### Edge Cases
- Lista sem ninguém: abre com o aviso da lista ("Ninguém faltou.", "Ninguém cancelou.", "Ninguém remarcou.", "Ninguém com reunião pela frente.", "Nenhuma reunião aguardando presença.").
- Período sem reunião criada: a seção diz "Nenhuma reunião criada no período." e não mostra as listas.
- Remarcação pelo Google: a troca aparece como "movida direto na agenda do Google em 05/11" (SUP-S7-08).
- Calendly sem nome: aparece o e-mail (SUP-S7-03). Calendly remarcado: marca "remarcada", sem as trocas.
- Fora do registro (Calendly antigo): não entra em nenhuma lista (SUP-S7-06).
- Filtro de funil: o servidor só devolve as reuniões daquele funil.

### Cenário de Erro
- Sem chave ou chave errada: 401 sem nenhum nome.
- `/api/agenda/detalhe` falha: os números continuam; no lugar das listas, "Não foi possível carregar os nomes agora."

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S7-04 | automática | `tests/detalhe-reunioes.test.js` | A lista "Ainda vão acontecer" traz as três criadas no período (09/11, 10/11, 16/11), em ordem, com nome, funil, dia e hora; a criada antes do período não aparece |
| CA-S7-05 | automática | `tests/detalhe-reunioes.test.js` | Reunião remarcada para o futuro conta em "a acontecer" e aparece na lista no horário novo, com a marca "remarcada" |
| CA-S7-06 | automática | `tests/detalhe-reunioes.test.js` | A falta aparece em "Faltaram" e a cancelada em "Cancelaram", com nome, funil, dia e hora |
| CA-S7-07 | automática | `tests/detalhe-reunioes.test.js` | Reunião passada sem presença aparece em "Sem presença marcada" e não em "Ainda vão acontecer"; o no-show não muda |
| CA-S7-08 | automática | `tests/detalhe-reunioes.test.js` | Reunião remarcada duas vezes e realizada aparece uma vez em "Reagendamentos", com "2 remarcações", as duas trocas em ordem e "agora: realizada"; conta como realizada |
| CA-S7-10 | automática | `tests/detalhe-reunioes.test.js` | Pedido sem chave ou com chave errada recebe 401 e a resposta não tem nome nem e-mail |
| CA-S7-11 | automática | `tests/detalhe-reunioes.test.js` | Período vazio mostra "Nenhuma reunião criada no período."; sem faltas, a lista "Faltaram" diz "Ninguém faltou." |
| CA-S7-13 | automática | `tests/detalhe-reunioes.test.js` | As cinco listas vêm fechadas (sem `open`), cada uma num drop próprio com título e quantidade ("Ainda vão acontecer (8)", "Faltaram (1)") |
| CA-S7-12 | manual | roteiro abaixo | Números e nomes no ar batem com a agenda de 02–08/11 e o visual é aprovado |

### Roteiro manual — CA-S7-12
1. Abrir o dash no ar, Visão geral, filtro "Personalizado" de 02/11/2026 a 08/11/2026, funil "Todos".
2. Conferir os números: 11 criadas, 1 realizada, 1 faltou, 1 cancelada; as demais divididas entre "a acontecer" e "sem presença marcada" conforme o dia da conferência.
3. Abrir "Faltaram": Patricia. Abrir "Cancelaram": Daniel Aguiar. "Ainda vão acontecer": quem ainda não teve a reunião (Aksa, Yago, Caio, Hugo, Miqueias, Erica…).
4. Abrir e fechar cada lista: só a clicada abre.
5. Ver no celular: nada sai da tela.
6. Aprovar o visual.

## Banco de Dados

Nenhuma mudança: lê `agenda_reunioes`, `agenda_historico` (ação `remarcou`) e `calendly_consultorias`.

## Arquivos

- **Modificar:** `functions/api/_reunioes-agendadas.js` — `reunioesDaCoorte(DB, de, ate, agora)` devolve cada reunião da coorte com id, nome, e-mail, início, funil e status (a mesma seleção de hoje); `coorteDasAgendadas` passa a usá-la e continua devolvendo só `{ funil, status }`. Nova `listasDaCoorte(DB, de, ate, agora, funil)` monta as cinco listas (ordem pela reunião, remarcadas, trocas do `agenda_historico`, Calendly remarcado pelo mesmo e-mail com consulta cancelada por remarcação).
- **Criar:** `functions/api/agenda/detalhe.js` — `GET /api/agenda/detalhe?key=&from=&to=&funil=`: confere a chave do dash e devolve `{ listas }` sem e-mail quando há nome e sem telefone.
- **Modificar:** `public/dash/detalhe-reunioes.js` — `desenhar` recebe também as listas e desenha os cinco drops com os avisos de lista vazia; formata o horário (unix) em Brasília.
- **Modificar:** `public/dash/index.html` — `R.visao` busca `/api/agenda/detalhe` junto da coorte (com `.catch(() => null)`) e passa para `desenhar`; versão do script `?v=2026-11-09c`.
- **Modificar:** `tests/detalhe-reunioes.test.js` — testes dos critérios desta issue (sem mexer nos da S7-02).

## Dependências Externas

Nenhuma.

## Checklist

- [x] `reunioesDaCoorte` + `listasDaCoorte` em `_reunioes-agendadas.js`, sem mudar a saída de `coorteDasAgendadas`
- [x] Endpoint `functions/api/agenda/detalhe.js` com a chave do dash e filtro de funil
- [x] Cinco drops em `detalhe-reunioes.js`, com avisos de lista vazia e erro
- [x] `R.visao` busca e desenha as listas; versão do script atualizada
- [x] Testes dos critérios passando junto com `tests/visao-reuniao.test.js`

## Testes manuais

| Critério | Conferido por | Dia |
|---|---|---|
| CA-S7-12 | Marcelle | 09/11/2026 |
