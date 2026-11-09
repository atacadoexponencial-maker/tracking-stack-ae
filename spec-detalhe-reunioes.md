# Spec: Detalhamento das reuniões na Visão geral

> série: S7
> estado: aprovada em 09/11/2026

## Visão Geral

Uma seção nova na Visão geral do dash, abaixo do funil, que abre as reuniões
de quem agendou no período do filtro: quantas foram criadas, realizadas,
faltaram, canceladas, ainda vão acontecer e passaram sem presença marcada, o
no-show do período, e os nomes por trás de cada número.

É para a reunião semanal: hoje o card da coorte mostra o total e o "ainda vão
acontecer", mas falta e cancelamento ficam escondidos (em 02–08/11 eram 11
criadas, 1 realizada e 8 a acontecer, e não dava para ver na tela que as
outras duas eram 1 falta e 1 cancelamento), e não há como saber quem é quem
sem abrir a aba Agenda.

**Base de tudo na seção:** as reuniões criadas (agendadas) entre as datas do
filtro, aconteçam quando acontecerem. É a mesma base do card da coorte que já
existe, com as mesmas regras de quem entra (só reuniões comerciais, sem teste;
Calendly só o que não está na agenda própria e não foi marcado pela equipe).

## Páginas / Módulos

### Seção "Detalhe das reuniões" na Visão geral

**Descrição:** bloco com os números das reuniões criadas no período e as
listas de nomes por situação.

**Componentes:**
- Linha de números: criadas, realizadas, faltaram, canceladas, a acontecer,
  sem presença marcada, no-show (%), cada um com a variação em relação ao
  período anterior de mesmo tamanho.
- Lista "Ainda vão acontecer": nome, funil, dia e hora da reunião, em ordem
  da reunião mais próxima para a mais distante; quem já remarcou aparece com
  a marca de remarcada.
- Lista "Faltaram": nome, funil, dia e hora em que a reunião estava marcada.
- Lista "Cancelaram": nome, funil, dia e hora em que a reunião estava marcada.
- Lista "Sem presença marcada": nome, funil, dia e hora; reuniões que já
  passaram e ninguém marcou se foi realizada ou falta.
- Lista "Reagendamentos": nome, funil, quantas vezes remarcou, de qual
  horário para qual (cada troca) e a situação atual da reunião.

**Comportamentos:**
- Ver os números do período: a seção mostra as contagens das reuniões
  criadas entre as datas do filtro.
- Ver o no-show: faltou ÷ (realizada + faltou). Cancelada, a acontecer e sem
  presença marcada ficam fora da conta.
- Comparar com o período anterior: cada número mostra o valor do período
  anterior de mesmo tamanho (com a mesma base: reuniões criadas naquele
  período) e a variação, do mesmo jeito que os demais números da Visão geral.
  As listas não são comparadas.
- Ver quem ainda vai fazer: lista as reuniões criadas no período que ainda
  vão acontecer, em qualquer data futura (inclusive as remarcadas).
- Ver quem faltou.
- Ver quem cancelou.
- Ver quem passou sem presença marcada.
- Ver os reagendamentos: quem, dentre as reuniões criadas no período,
  remarcou pelo menos uma vez, com o histórico das trocas.
- Trocar o período do filtro: números e listas passam a refletir as reuniões
  criadas no novo período.
- Trocar o funil do filtro: números e listas mostram só aquele funil.
- Período sem reuniões: a seção diz que não houve reunião criada no período.
- Lista vazia: a lista daquela situação diz que não há ninguém (ex.: "ninguém
  faltou"), em vez de sumir.
- Abrir e fechar cada lista: as listas começam fechadas, mostrando só o
  título e quantas pessoas tem (ex.: "Faltaram (1)"); um clique abre a lista
  e outro fecha. Cada lista abre e fecha sozinha, sem mexer nas outras.

**Critérios de aceite:**

#### CA-S7-01 — Os números da seção fecham com o total de criadas · prova: automática

- **Dado** as reuniões criadas em 02–08/11 (1 realizada, 1 faltou, 1 cancelada, 8 marcadas ou remarcadas com horário futuro)
- **Quando** a seção é montada para esse período
- **Então** mostra 11 criadas, 1 realizada, 1 faltou, 1 cancelada, 8 a acontecer, 0 sem presença marcada, e realizadas + faltaram + canceladas + a acontecer + sem presença marcada = criadas

#### CA-S7-02 — No-show é faltou sobre realizada mais faltou · prova: automática

- **Dado** um período com 1 realizada, 1 faltou, 1 cancelada, 8 a acontecer e 2 sem presença marcada
- **Quando** a seção calcula o no-show
- **Então** mostra 50% (1 ÷ 2); cancelada, a acontecer e sem presença marcada não entram na conta

#### CA-S7-03 — Sem nenhuma presença marcada o no-show não vira 0% · prova: automática

- **Dado** um período em que nenhuma reunião foi realizada nem teve falta marcada
- **Quando** a seção calcula o no-show
- **Então** o no-show aparece como "—" (sem base), não como 0%

#### CA-S7-04 — Lista de quem ainda vai fazer mostra todas as futuras do período · prova: automática

- **Dado** reuniões criadas no período com reunião em 09/11, 10/11 e 16/11, e uma criada antes do período com reunião em 10/11
- **Quando** a lista "Ainda vão acontecer" é montada
- **Então** aparecem as três criadas no período, em ordem da mais próxima, com nome, funil, dia e hora; a criada antes do período não aparece

#### CA-S7-05 — Reunião remarcada para o futuro conta como a acontecer · prova: automática

- **Dado** uma reunião criada no período e remarcada para um horário que ainda não passou
- **Quando** a seção é montada
- **Então** ela entra em "a acontecer", aparece na lista "Ainda vão acontecer" no horário novo, com a marca de remarcada

#### CA-S7-06 — Listas de faltaram e cancelaram com os nomes · prova: automática

- **Dado** uma reunião com falta marcada e uma cancelada, ambas criadas no período
- **Quando** a seção é montada
- **Então** a primeira aparece em "Faltaram" e a segunda em "Cancelaram", cada uma com nome, funil, dia e hora em que estava marcada

#### CA-S7-07 — Reunião que passou sem presença fica em lista própria · prova: automática

- **Dado** uma reunião criada no período cujo horário já passou e que não foi marcada como realizada nem falta
- **Quando** a seção é montada
- **Então** ela aparece em "Sem presença marcada" e não entra no no-show nem em "a acontecer"

#### CA-S7-08 — Reagendamentos com o histórico das trocas · prova: automática

- **Dado** uma reunião criada no período remarcada duas vezes (de 06/11 15h para 10/11 15h, e de 10/11 15h para 12/11 17h) e depois realizada
- **Quando** a lista "Reagendamentos" é montada
- **Então** a reunião aparece uma vez, com "2 remarcações", as duas trocas na ordem e a situação atual "realizada"; ela também conta como realizada nos números

#### CA-S7-09 — Filtro de funil restringe números e listas · prova: automática

- **Dado** reuniões criadas no período nos funis Sessão Estratégica e Aplicação Mentoria
- **Quando** o filtro está em Sessão Estratégica
- **Então** números e listas mostram só as de Sessão Estratégica

#### CA-S7-10 — Só a equipe com a chave do dash vê os nomes · prova: automática

- **Dado** um pedido dos dados da seção sem a chave do dash ou com chave errada
- **Quando** o pedido chega
- **Então** é recusado e nenhum nome ou e-mail é devolvido

#### CA-S7-11 — Período ou lista vazios avisam em vez de sumir · prova: automática

- **Dado** um período sem nenhuma reunião criada, e outro em que ninguém faltou
- **Quando** a seção é montada
- **Então** no primeiro a seção diz que não houve reunião criada no período; no segundo a lista "Faltaram" diz que ninguém faltou

#### CA-S7-13 — Listas começam fechadas e abrem com um clique · prova: automática

- **Dado** a seção montada com 8 a acontecer e 1 falta
- **Quando** a Visão geral abre
- **Então** as listas aparecem fechadas, só com o título e a quantidade ("Ainda vão acontecer (8)", "Faltaram (1)"); ao clicar em "Faltaram" só essa lista abre, e um novo clique a fecha

#### CA-S7-14 — Números comparados com o período anterior · prova: automática

- **Dado** o período 02–08/11 com 11 criadas e no-show de 50%, e o período anterior (26/10–01/11) com 8 criadas e no-show de 25%
- **Quando** a seção é montada para 02–08/11
- **Então** cada número mostra o valor anterior e a variação (criadas 11 contra 8; no-show 50% contra 25%), contando no período anterior só as reuniões criadas nele

#### CA-S7-12 — A seção no ar bate com a agenda de 02–08/11 · prova: manual

- **Dado** o dash no ar com o filtro em 02/11/2026 a 08/11/2026
- **Quando** a usuária abre a Visão geral
- **Então** vê a seção com os números e os nomes batendo com a agenda (Izabell realizada, Patricia faltou, Daniel Aguiar cancelou, e as 8 a acontecer, menos as que já passaram até o dia da conferência), e aprova o visual

## Fora de escopo

- Não muda o funil da Visão geral nem o card da coorte que já existem; a taxa
  RA → RR do funil continua com a conta atual.
- Não marca presença, não remarca nem cancela pela seção: é só análise (isso
  segue na aba Agenda).
- Não lista as realizadas por nome (só o número).
- Não traz reuniões criadas fora do período, mesmo que aconteçam dentro dele.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S7-01 | A seção segue o filtro de funil da Visão geral, além do de datas | confirmada | usuária, 09/11/2026 |
| SUP-S7-02 | Os números da seção não trazem comparação com o período anterior | invalidada | Compara com o período anterior (CA-S7-14) (usuária, 09/11/2026) |
| SUP-S7-03 | Reuniões que vieram do Calendly (antes da agenda própria) entram nos números e listas com o e-mail quando não houver nome; no reagendamento aparecem só como "remarcada", sem os horários das trocas (o Calendly não guarda o histórico) | confirmada | usuária, 09/11/2026 |
| SUP-S7-04 | Cada linha das listas mostra nome, funil, dia e hora; sem telefone, e-mail ou link do ClickUp | confirmada | usuária, 09/11/2026 |
| SUP-S7-05 | A seção fica abaixo do funil e da tabela por funil, no fim da Visão geral | confirmada | usuária, 09/11/2026 |
| SUP-S7-06 | Consultorias antigas do Calendly (antes de 19/10) que passaram sem presença ("fora do registro") aparecem num número próprio "Fora do registro" só quando o período tiver alguma; ficam fora do no-show e das listas, e a soma continua batendo com as criadas | confirmada | usuária, 09/11/2026 |
| SUP-S7-07 | Reuniões da Aplicação Mentoria contam como Sessão Estratégica (regra única de funil da S3: Mentoria é porta da SE); o filtro de funil separa SE dos outros funis (ex.: workshop), não SE de Mentoria | confirmada | usuária, 09/11/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S7-01 | Como calcular o no-show? | respondida | Faltou ÷ (realizada + faltou); cancelada fica fora (usuária, 09/11/2026) |
| PER-S7-02 | Contagens e listas partem das reuniões criadas no período ou das que acontecem no período? | respondida | Criadas no período, como o card da coorte (usuária, 09/11/2026) |
| PER-S7-03 | "Quem ainda vai fazer essa semana" mostra quem? | respondida | Só os leads que agendaram no período, independente da data da reunião (usuária, 09/11/2026) |
| PER-S7-04 | O que fazer com reunião que passou sem presença marcada? | respondida | Lista própria, fora do no-show (usuária, 09/11/2026) |
