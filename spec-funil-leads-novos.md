# Spec: Funil da Visão geral só com leads novos e Detalhe das reuniões pela data da reunião

> série: S9
> estado: aprovada em 12/11/2026

## Visão Geral

Em 11/11/2026 a Visão geral mostrou, na Sessão Estratégica, 0 MQL e 1 reunião agendada.
A reunião era de um lead antigo (card de 28/01/2026) que voltou pelo anúncio e agendou.
O funil misturava duas réguas: MQL conta só card novo do período, Reunião agendada
contava qualquer pessoa que agendou no período.

A mudança separa as duas perguntas que a reunião semanal faz:

1. **Funil (em cima):** dos leads novos do período, quantos viraram MQL, quantos
   agendaram reunião e quantas dessas reuniões aconteceram. Lead antigo não entra.
2. **Detalhe das reuniões (embaixo):** o que aconteceu na agenda no período, com leads
   novos e antigos juntos: quantas reuniões havia, quantas ocorreram, comparecimento e
   no-show.

Para o funil nasce uma métrica com nome próprio, **RC (Reunião criada)**, no lugar de
"Reunião agendada".

Esta spec substitui a régua de reunião do funil definida na série S4
(docs/specs-arquivadas/spec-visao-geral-reuniao-semanal.md) e a régua "reuniões criadas
no período" da série S7 (docs/specs-arquivadas/spec-detalhe-reunioes.md).

## Páginas / Módulos

### Funil da Visão geral

**Descrição:** o funil do topo da Visão geral passa a acompanhar só os leads novos do
período, do card novo até a reunião realizada.

**Componentes:**
- Faixas do funil: Leads novos, MQL, SQL, RC, RC realizada, cada uma com número,
  variação contra o período anterior e custo.
- Quadros de taxa abaixo do funil: Lead → MQL, MQL → RC, RC → RR.
- Tabela "Por funil": as mesmas colunas, uma linha por funil.

**Comportamentos:**
- Ver quantos leads novos do período agendaram reunião (RC).
- Ver quantas dessas reuniões já foram realizadas (RC realizada).
- Ver a observação quando parte das RC é de lead que não é MQL.
- Ver as taxas MQL → RC e RC → RR e os custos por RC e por RC realizada.
- Filtrar por funil e ver o mesmo funil só daquele funil.
- Comparar cada número com o período anterior.

**Critérios de aceite:**

#### CA-S9-01 — O funil mostra RC e RC realizada no lugar de Reunião agendada e realizada · prova: automática

- **Dado** a Visão geral aberta
- **Quando** a tela termina de carregar
- **Então** as faixas são, nesta ordem, Leads novos, MQL, SQL, RC e RC realizada; a faixa
  RC traz a legenda "reunião criada por lead novo"; e não existe faixa "Reunião agendada"

#### CA-S9-02 — Lead antigo que agenda não entra no funil · prova: automática

- **Dado** um período com 1 lead novo que agendou reunião e 1 lead com card criado antes
  do período que também agendou no período
- **Quando** a Visão geral abre
- **Então** RC mostra 1

#### CA-S9-03 — Lead novo que não é MQL e agenda conta na RC, com observação · prova: automática

- **Dado** um período com 3 leads novos que agendaram, sendo 2 MQL e 1 não MQL
- **Quando** a Visão geral abre
- **Então** RC mostra 3 e a faixa traz a observação "1 de lead não MQL"

#### CA-S9-04 — Sem lead não MQL, a observação não aparece · prova: automática

- **Dado** um período em que todas as RC são de MQL
- **Quando** a Visão geral abre
- **Então** a faixa RC não mostra observação de lead não MQL

#### CA-S9-05 — Lead novo que agenda depois do fim do período conta na RC do período em que chegou · prova: automática

- **Dado** um lead com card criado no último dia do período que agenda a reunião dois
  dias depois do fim do período
- **Quando** a Visão geral abre naquele período
- **Então** RC mostra 1

#### CA-S9-06 — Reunião cancelada não conta como RC · prova: automática

- **Dado** um lead novo cuja única reunião foi cancelada
- **Quando** a Visão geral abre
- **Então** RC mostra 0

#### CA-S9-07 — RC realizada conta só as reuniões dos leads novos · prova: automática

- **Dado** um período com 2 leads novos com reunião (1 realizada, 1 com falta) e 1 lead
  antigo com reunião realizada no período
- **Quando** a Visão geral abre
- **Então** RC realizada mostra 1

#### CA-S9-08 — Taxas MQL → RC e RC → RR · prova: automática

- **Dado** um período com 12 MQLs novos, 6 desses MQLs com reunião, 1 lead novo não MQL
  com reunião, e das 7 RC: 3 realizadas, 2 faltas e 2 ainda por acontecer
- **Quando** a Visão geral abre
- **Então** aparecem MQL → RC 50% ("6 de 12") e RC → RR 60% ("3 de 5"), e o quadro RC → RR
  avisa que 2 ainda vão acontecer

#### CA-S9-09 — Custo por RC e por RC realizada · prova: automática

- **Dado** um período com R$ 300 investidos nos funis que agendam reunião, 5 RC e 3 RC
  realizadas
- **Quando** a Visão geral abre
- **Então** a faixa RC mostra custo de R$ 60,00 e a faixa RC realizada, R$ 100,00

#### CA-S9-10 — Filtro de funil vale para RC e RC realizada · prova: automática

- **Dado** um período com 4 RC na Sessão Estratégica e 1 RC no workshop
- **Quando** a pessoa filtra pelo funil workshop
- **Então** RC mostra 1; e sem filtro, a tabela "Por funil" mostra 4 na linha da Sessão
  Estratégica e 1 na linha do workshop, nas colunas RC, RC realizada, Custo por RC,
  Custo por RR, MQL → RC e RC → RR

#### CA-S9-11 — CRM fora do ar não derruba a tela · prova: automática

- **Dado** o CRM sem responder
- **Quando** a Visão geral abre
- **Então** as faixas MQL, SQL, RC e RC realizada mostram "sem dados do CRM", e Leads
  novos, investimento, leads e CPL aparecem com os números

#### CA-S9-12 — Números do funil comparados com o período anterior · prova: automática

- **Dado** 4 RC no período e 2 no período anterior
- **Quando** a Visão geral abre
- **Então** a faixa RC mostra 4 com a variação de 100% para cima, pela mesma régua nos
  dois períodos

#### CA-S9-13 — O caso real de 11/11 fecha · prova: manual

- **Dado** a Visão geral no ar, no período de 09/11 a 15/11/2026
- **Quando** a Marcelle abre a tela sem filtro e depois filtrada por Sessão Estratégica e
  por Aquisição
- **Então** o lead antigo que agendou em 11/11 (Lucas) não aparece em nenhuma faixa do
  funil, e a lead nova do ManyChat (Amanda Michella) conta como 1 MQL e 1 RC em Aquisição

### Detalhe das reuniões

**Descrição:** a seção passa a responder "o que aconteceu na agenda neste período",
olhando as reuniões pela data em que acontecem, de leads novos e antigos juntos.

**Componentes:**
- Quadros: Na agenda, Realizadas, Faltaram, Canceladas, A acontecer, Sem presença
  marcada, Comparecimento, No-show, e Agendadas no período.
- Listas de nomes em drop: Ainda vão acontecer, Faltaram, Cancelaram, Sem presença
  marcada, Reagendamentos.
- Título da seção: "Detalhe das reuniões", com a legenda "reuniões que caem no período,
  de leads novos e antigos".

**Comportamentos:**
- Ver quantas reuniões caem no período e o que aconteceu com cada uma.
- Ver o percentual de comparecimento e de no-show.
- Ver quantas reuniões foram agendadas no período e quantas são de lead novo e de lead
  antigo.
- Abrir cada lista para ver os nomes.
- Filtrar por funil.
- Comparar os quadros com o período anterior.

**Critérios de aceite:**

#### CA-S9-14 — A seção conta as reuniões pela data em que acontecem · prova: automática

- **Dado** uma reunião agendada no período anterior para um dia do período, e outra
  agendada no período para um dia depois do fim do período
- **Quando** a Visão geral abre
- **Então** "Na agenda" mostra 1 (a que cai no período), e a outra não entra nos quadros
  de situação nem nas listas

#### CA-S9-15 — Leads novos e antigos entram juntos · prova: automática

- **Dado** no período 1 reunião realizada de lead novo e 1 reunião realizada de lead
  antigo
- **Quando** a Visão geral abre
- **Então** "Na agenda" mostra 2 e "Realizadas" mostra 2

#### CA-S9-16 — Os quadros de situação fecham com o total da agenda · prova: automática

- **Dado** no período 6 reuniões: 2 realizadas, 1 falta, 1 cancelada, 1 ainda por
  acontecer e 1 que passou sem presença marcada
- **Quando** a Visão geral abre
- **Então** aparecem Na agenda 6, Realizadas 2, Faltaram 1, Canceladas 1, A acontecer 1 e
  Sem presença marcada 1

#### CA-S9-17 — Comparecimento e no-show · prova: automática

- **Dado** no período 3 reuniões realizadas e 1 falta
- **Quando** a Visão geral abre
- **Então** Comparecimento mostra 75% ("3 de 4") e No-show mostra 25% ("1 de 4")

#### CA-S9-18 — Sem presença marcada, comparecimento e no-show não viram 0% · prova: automática

- **Dado** um período em que nenhuma reunião tem presença ou falta marcada
- **Quando** a Visão geral abre
- **Então** Comparecimento e No-show mostram "—" com o aviso "sem presença marcada"

#### CA-S9-19 — Agendadas no período separa lead novo de lead antigo · prova: automática

- **Dado** 3 reuniões agendadas no período, 2 por leads com card criado no período e 1
  por lead com card anterior
- **Quando** a Visão geral abre e o CRM responde
- **Então** o quadro "Agendadas no período" mostra 3, com a nota "2 de lead novo · 1 de
  lead antigo"

#### CA-S9-20 — Agendadas no período aparece mesmo sem o CRM · prova: automática

- **Dado** 3 reuniões agendadas no período e o CRM sem responder
- **Quando** a Visão geral abre
- **Então** o quadro "Agendadas no período" mostra 3, com a nota "sem dados do CRM" no
  lugar da separação

#### CA-S9-21 — As listas trazem os nomes das reuniões que caem no período · prova: automática

- **Dado** no período uma reunião futura, uma falta, uma cancelada, uma sem presença e
  uma remarcada
- **Quando** a pessoa abre cada lista
- **Então** cada nome aparece na lista da sua situação, com funil e horário, e a
  remarcada aparece também em Reagendamentos

#### CA-S9-22 — Filtro de funil restringe quadros e listas · prova: automática

- **Dado** no período 2 reuniões da Sessão Estratégica e 1 de Aquisição
- **Quando** a pessoa filtra por Aquisição
- **Então** "Na agenda" mostra 1 e as listas só trazem a reunião de Aquisição

#### CA-S9-23 — Quadros comparados com o período anterior · prova: automática

- **Dado** 4 reuniões na agenda do período e 2 na do período anterior
- **Quando** a Visão geral abre
- **Então** "Na agenda" mostra 4, com o valor anterior 2 e variação de 100%

#### CA-S9-24 — Período sem reunião avisa em vez de sumir · prova: automática

- **Dado** um período sem nenhuma reunião na agenda e nenhuma agendada
- **Quando** a Visão geral abre
- **Então** a seção aparece com o aviso "Nenhuma reunião no período."

#### CA-S9-25 — A Marcelle aprova as duas visões no ar · prova: manual

- **Dado** a mudança no ar
- **Quando** a Marcelle abre a Visão geral na semana corrente e na anterior
- **Então** ela confirma que o funil responde "dos leads novos, quantos agendaram e
  fizeram reunião" e que o Detalhe responde "o que aconteceu na agenda na semana"

## Fora de escopo

- Aba Detalhado: o quadro "Reuniões agendadas", o custo por reunião e o painel por funil
  seguem contando todas as reuniões agendadas no período.
- Aba Agendamentos, Metas, Árvore de métricas e relatório do Argo: sem mudança.
- Gravar no card antigo do CRM o faturamento que o lead informou ao voltar.
- Campo para o time escrever observação à mão.
- Marcar presença de reuniões antigas do Calendly.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S9-01 | RC conta todo lead novo que agendou, MQL ou não, de qualquer funil; a taxa MQL → RC olha só os MQLs. | confirmada | Marcelle, 12/11/2026 |
| SUP-S9-02 | Lead novo = card criado no CRM dentro do período, a mesma régua do MQL e do SQL. | confirmada | Marcelle, 12/11/2026 |
| SUP-S9-03 | Lead novo que agenda depois do fim do período conta na RC do período em que chegou; por isso a RC de uma semana já fechada pode subir depois. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-04 | A observação da RC é automática ("N de lead não MQL"); não há campo para escrever à mão. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-05 | "Agendou" na RC segue a regra de hoje do MQL → RA: reunião comercial da agenda própria que não é de teste nem cancelada (inclui a marcada pelo time), ou consultoria ativa do Calendly agendada pelo próprio lead. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-06 | Lead novo com mais de uma reunião conta uma vez; vale a situação mais avançada: realizada, depois a acontecer, depois sem presença, depois faltou. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-07 | O funil da RC é o funil do card no CRM (o mesmo do MQL): lead do ManyChat com opção Sessão Estratégica conta em Aquisição. No Detalhe, o funil da reunião continua sendo o do lead pelo e-mail, como hoje. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-08 | Card novo com opção de funil não cadastrada no relatório ("sem funil") fica fora da RC, como já fica fora do MQL e do SQL. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-09 | No total sem filtro, o custo por RC e por RC realizada usa o investimento dos funis que agendam reunião, como o custo por reunião de hoje. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-10 | No Detalhe, a reunião remarcada conta na data nova; a cancelada conta em Canceladas na data em que aconteceria. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-11 | No Detalhe, entram as mesmas reuniões de hoje (agenda própria comercial sem teste e consultorias do Calendly agendadas pelo lead); só muda a data usada, de quando agendou para quando acontece. Calendly de antes de 19/10 sem presença segue em "Fora do registro". | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-12 | Na quebra de "Agendadas no período", lead novo é o e-mail de um card criado no mesmo período; os demais são lead antigo, inclusive reunião sem card. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-13 | Semana já fechada pode levar até 1 hora para mostrar no funil uma presença recém-marcada (a leitura do CRM fica guardada por 1 hora); o Detalhe mostra na hora. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S9-01 | Lead não MQL que agenda entra na RC? | respondida | Sim, se for lead novo, junto com os demais e com observação (Marcelle, 12/11/2026) |
| PER-S9-02 | O nome da métrica nova é RC (Reunião criada)? | respondida | Sim, sugestão da própria Marcelle (12/11/2026) |
