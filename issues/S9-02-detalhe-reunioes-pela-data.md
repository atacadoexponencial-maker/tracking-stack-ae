# S9-02: Detalhe das reuniões pela data da reunião, com leads novos e antigos

**Tipo:** Implementação
**Página:** Visão geral do dash, seção Detalhe das reuniões
**Spec:** `spec-funil-leads-novos.md`

## Descrição

A seção Detalhe das reuniões passa a contar as reuniões que caem no período (pela data
em que acontecem), de leads novos e antigos juntos, com Comparecimento e No-show, e ganha
o quadro "Agendadas no período" separado em lead novo e lead antigo.

## Pronto quando

A Visão geral no ar mostra, no Detalhe das reuniões, quantas reuniões havia na agenda do
período, o que aconteceu com cada uma, o percentual de comparecimento e de no-show, e
quantas foram agendadas no período por lead novo e por lead antigo; as listas trazem os
nomes das reuniões do período.

## Critérios de aceite

- **CA-S9-14** (automática) — A seção conta as reuniões pela data em que acontecem. Dado uma reunião agendada no período anterior para um dia do período, e outra agendada no período para um dia depois do fim do período, quando a Visão geral abre, então "Na agenda" mostra 1 (a que cai no período), e a outra não entra nos quadros de situação nem nas listas.
- **CA-S9-15** (automática) — Leads novos e antigos entram juntos. Dado no período 1 reunião realizada de lead novo e 1 reunião realizada de lead antigo, quando a Visão geral abre, então "Na agenda" mostra 2 e "Realizadas" mostra 2.
- **CA-S9-16** (automática) — Os quadros de situação fecham com o total da agenda. Dado no período 6 reuniões: 2 realizadas, 1 falta, 1 cancelada, 1 ainda por acontecer e 1 que passou sem presença marcada, quando a Visão geral abre, então aparecem Na agenda 6, Realizadas 2, Faltaram 1, Canceladas 1, A acontecer 1 e Sem presença marcada 1.
- **CA-S9-17** (automática) — Comparecimento e no-show. Dado no período 3 reuniões realizadas e 1 falta, quando a Visão geral abre, então Comparecimento mostra 75% ("3 de 4") e No-show mostra 25% ("1 de 4").
- **CA-S9-18** (automática) — Sem presença marcada, comparecimento e no-show não viram 0%. Dado um período em que nenhuma reunião tem presença ou falta marcada, quando a Visão geral abre, então Comparecimento e No-show mostram "—" com o aviso "sem presença marcada".
- **CA-S9-19** (automática) — Agendadas no período separa lead novo de lead antigo. Dado 3 reuniões agendadas no período, 2 por leads com card criado no período e 1 por lead com card anterior, quando a Visão geral abre e o CRM responde, então o quadro "Agendadas no período" mostra 3, com a nota "2 de lead novo · 1 de lead antigo".
- **CA-S9-20** (automática) — Agendadas no período aparece mesmo sem o CRM. Dado 3 reuniões agendadas no período e o CRM sem responder, quando a Visão geral abre, então o quadro "Agendadas no período" mostra 3, com a nota "sem dados do CRM" no lugar da separação.
- **CA-S9-21** (automática) — As listas trazem os nomes das reuniões que caem no período. Dado no período uma reunião futura, uma falta, uma cancelada, uma sem presença e uma remarcada, quando a pessoa abre cada lista, então cada nome aparece na lista da sua situação, com funil e horário, e a remarcada aparece também em Reagendamentos.
- **CA-S9-22** (automática) — Filtro de funil restringe quadros e listas. Dado no período 2 reuniões da Sessão Estratégica e 1 de Aquisição, quando a pessoa filtra por Aquisição, então "Na agenda" mostra 1 e as listas só trazem a reunião de Aquisição.
- **CA-S9-23** (automática) — Quadros comparados com o período anterior. Dado 4 reuniões na agenda do período e 2 na do período anterior, quando a Visão geral abre, então "Na agenda" mostra 4, com o valor anterior 2 e variação de 100%.
- **CA-S9-24** (automática) — Período sem reunião avisa em vez de sumir. Dado um período sem nenhuma reunião na agenda e nenhuma agendada, quando a Visão geral abre, então a seção aparece com o aviso "Nenhuma reunião no período."
- **CA-S9-25** (manual) — A Marcelle aprova as duas visões no ar. Dado a mudança no ar, quando a Marcelle abre a Visão geral na semana corrente e na anterior, então ela confirma que o funil responde "dos leads novos, quantos agendaram e fizeram reunião" e que o Detalhe responde "o que aconteceu na agenda na semana".

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S9-02 | Lead novo = card criado no CRM dentro do período, a mesma régua do MQL e do SQL. | confirmada | Marcelle, 12/11/2026 |
| SUP-S9-07 | O funil da RC é o funil do card no CRM (o mesmo do MQL): lead do ManyChat com opção Sessão Estratégica conta em Aquisição. No Detalhe, o funil da reunião continua sendo o do lead pelo e-mail, como hoje. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-10 | No Detalhe, a reunião remarcada conta na data nova; a cancelada conta em Canceladas na data em que aconteceria. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-11 | No Detalhe, entram as mesmas reuniões de hoje (agenda própria comercial sem teste e consultorias do Calendly agendadas pelo lead); só muda a data usada, de quando agendou para quando acontece. Calendly de antes de 19/10 sem presença segue em "Fora do registro". | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-12 | Na quebra de "Agendadas no período", lead novo é o e-mail de um card criado no mesmo período; os demais são lead antigo, inclusive reunião sem card. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-13 | Semana já fechada pode levar até 1 hora para mostrar no funil uma presença recém-marcada (a leitura do CRM fica guardada por 1 hora); o Detalhe mostra na hora. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |

## Perguntas em aberto

Nenhuma.

## Cenários

### Happy Path
1. A Visão geral abre e pede `/api/agenda/coorte` e `/api/agenda/detalhe` para o período (e o anterior).
2. O servidor seleciona as reuniões cujo horário cai no período (agenda própria comercial sem teste e consultorias do Calendly agendadas pelo lead), com a situação de cada uma vista de agora, e calcula comparecimento e no-show.
3. A mesma resposta traz quantas reuniões foram agendadas no período (pela data em que agendou).
4. Quando `/api/agenda/taxas` responde (leitura do CRM), o quadro "Agendadas no período" ganha a nota "X de lead novo · Y de lead antigo".
5. As listas mostram os nomes das reuniões do período, por situação.

### Edge Cases
- Reunião agendada antes do período que cai nele: entra nos quadros e nas listas, e não em "Agendadas no período".
- Reunião agendada no período para depois dele: só em "Agendadas no período".
- Remarcada: conta na data nova; cancelada: em Canceladas, na data em que aconteceria.
- Calendly de antes de 19/10 sem presença: quadro "Fora do registro", fora do comparecimento e do no-show.
- Reunião sem card no CRM: lead antigo na separação.
- Período sem reunião na agenda, mas com reunião agendada: a seção mostra os quadros (Na agenda 0).

### Cenário de Erro
- CRM fora do ar ou ainda lendo: "Agendadas no período" mostra o total com a nota "sem dados do CRM" ou "lendo o CRM…".
- `/api/agenda/coorte` falhou: "Não foi possível carregar as reuniões agora."
- `/api/agenda/detalhe` falhou: quadros aparecem e as listas avisam "Não foi possível carregar os nomes agora."

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S9-14 | automática | `tests/detalhe-reunioes.test.js` | reunião que cai no período conta em "Na agenda"; a agendada no período para depois não entra em situação nem em lista |
| CA-S9-15 | automática | `tests/detalhe-reunioes.test.js` | realizada de lead novo e de lead antigo: Na agenda 2, Realizadas 2 |
| CA-S9-16 | automática | `tests/detalhe-reunioes.test.js` | 6 reuniões: 2, 1, 1, 1, 1 nos quadros de situação e 6 em Na agenda |
| CA-S9-17 | automática | `tests/detalhe-reunioes.test.js` | 3 realizadas e 1 falta: Comparecimento 75% "3 de 4", No-show 25% "1 de 4" |
| CA-S9-18 | automática | `tests/detalhe-reunioes.test.js` | sem presença marcada: os dois quadros com "—" e "sem presença marcada" |
| CA-S9-19 | automática | `tests/detalhe-reunioes.test.js` | 3 agendadas, 2 com card do período: "2 de lead novo · 1 de lead antigo" (banco real + CRM simulado) |
| CA-S9-20 | automática | `tests/detalhe-reunioes.test.js` | CRM sem responder: 3 com a nota "sem dados do CRM" |
| CA-S9-21 | automática | `tests/detalhe-reunioes.test.js` | cada nome na lista da sua situação, com funil e horário; remarcada também em Reagendamentos |
| CA-S9-22 | automática | `tests/detalhe-reunioes.test.js` | filtro Aquisição: Na agenda 1 e só a reunião de Aquisição nas listas |
| CA-S9-23 | automática | `tests/detalhe-reunioes.test.js` | Na agenda 4, anterior 2, variação 100% |
| CA-S9-24 | automática | `tests/detalhe-reunioes.test.js` | período vazio: "Nenhuma reunião no período." |
| CA-S9-25 | manual | roteiro abaixo | a Marcelle confirma as duas visões no ar |

### Roteiro manual — CA-S9-25
1. Abra o dash na Visão geral na semana corrente e depois na semana anterior.
2. No funil, confira que RC e RC realizada falam só dos leads novos da semana.
3. No Detalhe das reuniões, confira que os quadros mostram as reuniões que caíram na semana (novos e antigos), com comparecimento, no-show e "Agendadas no período" separado em lead novo e antigo.
4. Abra as listas e confira os nomes contra a agenda.

## Arquivos

- **Modificar:** `functions/api/_reunioes-agendadas.js` — a seleção da coorte aceita a data da reunião no lugar da data do agendamento; comparecimento ao lado do no-show.
- **Modificar:** `functions/api/agenda/coorte.js` — responde pela data da reunião e traz quantas foram agendadas no período.
- **Modificar:** `functions/api/agenda/detalhe.js` — listas pela data da reunião.
- **Modificar:** `functions/api/agenda/taxas.js` — quantas das agendadas no período são de lead novo (e-mail de card criado no período), no total e por funil.
- **Modificar:** `public/dash/detalhe-reunioes.js` — quadros novos (Na agenda, Comparecimento, Agendadas no período), título e avisos.
- **Modificar:** `public/dash/index.html` — redesenha o Detalhe quando o CRM responde e troca a marca de versão do script.
- **Modificar:** `tests/detalhe-reunioes.test.js` — testes dos critérios CA-S9-14 a 24 e ajuste dos testes da S7 que conferiam a régua antiga.

## Checklist

- [x] Seleção das reuniões pela data da reunião, reutilizando `reunioesDaCoorte`
- [x] Comparecimento calculado no servidor junto do no-show
- [x] `/api/agenda/coorte` com a contagem das agendadas no período
- [x] `/api/agenda/detalhe` pela data da reunião
- [x] `/api/agenda/taxas` com as agendadas de lead novo
- [x] Quadros, título e avisos novos na tela
- [x] Redesenho do Detalhe quando o CRM responde e marca de versão
- [x] Testes CA-S9-14 a 24 e ajuste dos testes antigos
