# Spec: Visão geral para a reunião semanal

> série: S4
> estado: aprovada em 26/10/2026

## Visão Geral

A Visão geral do dash virou um painel com informação demais para ser apresentado
na reunião semanal do time. Esta mudança deixa a Visão geral só com os números que
ela apresenta na reunião, na ordem do funil comercial:

Leads → Leads novos → CPL → CPL lead novo → MQLs novos → SQL → Reunião agendada →
Reunião realizada → taxas de passagem → níveis de qualificação (Sessão Estratégica)
→ leads por funil (com entradas nos grupos no workshop).

Tudo o que sai da Visão geral continua disponível numa aba nova, **Detalhado**, igual
à Visão geral de hoje. Nada é apagado.

Para quem é: a usuária (dona do dash), que apresenta a tela, e o time na reunião.

O que é novo de verdade (não existe hoje no dash):
- o número de **SQL**, lido do campo "🏆 SQL" do card no CRM (o de emoji ✅);
- o número de **Reunião realizada** num quadro próprio, somando agenda própria e as
  consultorias do Calendly com presença marcada;
- os **níveis de qualificação** dos leads novos da Sessão Estratégica por faixa de
  faturamento;
- as **entradas nos grupos** do workshop na tabela de leads por funil;
- a coluna **Leads novos** na tabela de leads por funil.

## Páginas / Módulos

### 1. Visão geral — números do período

**Descrição:** primeira linha da tela, um quadro por número, cada um comparado com o
período anterior de mesmo tamanho (como os quadros de hoje).

**Componentes:**
- Quadro **Leads**: leads do período (mesma conta da Visão geral de hoje).
- Quadro **Leads novos**: leads cujo card no CRM nasceu no período (mesma conta de hoje).
- Quadro **CPL**: investimento ÷ leads (mesma conta de hoje).
- Quadro **CPL lead novo**: investimento ÷ leads novos (mesma conta de hoje).
- Quadro **MQLs**: dos leads novos do período, quantos são MQL (card não desqualificado e
  faturamento mensal acima de R$ 20 mil; mesma régua das taxas de hoje).
- Quadro **SQL**: dos leads novos do período, quantos têm o campo "🏆 SQL" (emoji ✅)
  preenchido no card do CRM.
- Quadro **Reunião agendada**: reuniões agendadas no período (mesma conta do quadro de hoje:
  agenda própria + Calendly, pela data em que o lead agendou).
- Quadro **Reunião realizada**: reuniões com presença "Realizada" cuja data cai no período,
  da agenda própria e do Calendly.
- Nota abaixo dos quadros de MQL e SQL: lidos do estado atual do card no CRM, no momento da
  consulta.

**Comportamentos:**
- Abrir a Visão geral: mostra a manchete em frase (como hoje), os oito quadros nesta ordem e
  nada além das seções desta spec.
- Trocar o período no topo: todos os quadros recalculam para o novo período e o anterior.
- Escolher um funil no filtro do topo: os quadros mostram só aquele funil.
- CRM fora do ar ou lento: os quadros de MQL e SQL mostram "sem dados do CRM" e os demais
  aparecem normalmente.

**Critérios de aceite:**

#### CA-S4-01 — A Visão geral mostra a manchete, o funil da reunião e a lateral · prova: automática

- **Dado** o dash aberto na Visão geral
- **Quando** a tela termina de carregar
- **Então** abaixo da manchete aparece o funil Leads novos → MQL → SQL → Reunião agendada →
  Reunião realizada, nesta ordem, com a lateral Investimento em ads, Leads e CPL, e não
  aparecem conversão geral, visitantes, receita, ROAS, gráfico diário, LPs, metas nem funil
  da agenda (ajuste de 26/10; antes eram oito quadros em linha)

#### CA-S4-02 — SQL conta os leads novos com o campo de SQL preenchido no CRM · prova: automática

- **Dado** três leads novos no período, dois com o campo "🏆 SQL" (emoji ✅) preenchido e um
  sem, e um lead antigo (card de antes do período) com o campo preenchido
- **Quando** a Visão geral calcula o período
- **Então** o quadro SQL mostra 2

#### CA-S4-03 — MQLs conta só os leads novos · prova: automática

- **Dado** no período um lead novo com faturamento de R$ 50 mil, um lead novo com R$ 10 mil
  e um lead antigo que voltou com R$ 80 mil
- **Quando** a Visão geral calcula o período
- **Então** o quadro MQLs mostra 1

#### CA-S4-04 — Reunião realizada soma agenda própria e Calendly · prova: automática

- **Dado** no período uma reunião da agenda própria com presença Realizada, uma com Faltou,
  uma consultoria do Calendly marcada como Realizada no dash e uma do Calendly sem presença
- **Quando** a Visão geral calcula o período
- **Então** o quadro Reunião realizada mostra 2

#### CA-S4-05 — Números comparados com o período anterior · prova: automática

- **Dado** 10 leads no período escolhido e 8 no período anterior de mesmo tamanho
- **Quando** a Visão geral abre
- **Então** o quadro Leads mostra 10 e a variação de +25% em relação ao período anterior, e
  os outros sete quadros mostram a comparação do mesmo jeito

#### CA-S4-06 — Filtro de funil vale para todos os quadros · prova: automática

- **Dado** leads, MQLs, SQLs e reuniões em dois funis diferentes no período
- **Quando** a usuária escolhe um dos funis no filtro do topo
- **Então** cada quadro mostra só os números daquele funil

#### CA-S4-07 — CRM fora do ar não derruba a tela · prova: automática

- **Dado** o CRM sem responder
- **Quando** a Visão geral abre
- **Então** os quadros MQLs e SQL mostram "sem dados do CRM", e Leads, Leads novos, CPL, CPL
  lead novo, Reunião agendada e Reunião realizada aparecem com os números

### 2. Visão geral — taxas de passagem

**Descrição:** linha logo abaixo dos números, com as três taxas do funil comercial
calculadas sobre os leads novos.

**Componentes:**
- **Lead → MQL**: MQLs novos ÷ leads novos.
- **MQL → RA**: dos MQLs novos, quantos têm reunião agendada (mesma régua de coorte de
  hoje, que nunca passa de 100%).
- **RA → RR**: reuniões realizadas ÷ reuniões que já deveriam ter acontecido no período
  (realizadas + faltas + sem presença), contando agenda própria **e** Calendly.
- Cada taxa mostra o número de cima e o de baixo da conta (ex.: "12 de 40").

**Comportamentos:**
- Abrir a Visão geral: mostra as três taxas, nesta ordem.
- Trocar período ou funil: as taxas recalculam.
- Sem base para a conta (ex.: nenhum lead novo): a taxa mostra "—" e não 0%.

**Critérios de aceite:**

#### CA-S4-08 — Três taxas de passagem dos leads novos · prova: automática

- **Dado** no período 40 leads novos, 12 MQLs novos, 6 desses MQLs com reunião agendada, e
  5 reuniões que já deveriam ter acontecido, das quais 3 realizadas
- **Quando** a Visão geral abre
- **Então** aparecem Lead → MQL 30% ("12 de 40"), MQL → RA 50% ("6 de 12") e RA → RR 60%
  ("3 de 5"), nesta ordem

#### CA-S4-09 — RA → RR conta as reuniões do Calendly · prova: automática

- **Dado** no período uma reunião da agenda própria Realizada, uma consultoria do Calendly
  Realizada e uma do Calendly Faltou
- **Quando** a Visão geral calcula RA → RR
- **Então** a taxa é 67% ("2 de 3")

#### CA-S4-10 — Taxa sem base mostra traço · prova: automática

- **Dado** um período sem nenhum lead novo
- **Quando** a Visão geral abre
- **Então** Lead → MQL mostra "—" em vez de 0%

### 3. Visão geral — níveis de qualificação (Sessão Estratégica)

**Descrição:** bloco que separa os leads novos do funil Sessão Estratégica pela faixa de
faturamento informada no CRM. Workshop fica de fora porque não pede faturamento.

**Componentes:**
- Linha **Abaixo de R$ 20 mil**: quantidade e % dos leads novos de SE.
- Linha **Acima de R$ 20 mil**: quantidade e %.
- Linha **Não informado**: leads novos de SE sem faturamento legível no card.
- Título deixa claro que é só Sessão Estratégica.

**Comportamentos:**
- Abrir a Visão geral: mostra as três faixas e o total de leads novos de SE.
- Filtro de funil em outro funil que não SE: o bloco some (ou avisa que só vale para SE).
- Trocar o período: as faixas recalculam.

**Critérios de aceite:**

#### CA-S4-11 — Leads novos de SE separados por faixa de faturamento · prova: automática

- **Dado** no período 5 leads novos de SE (2 com "até R$ 20 mil", 2 com "R$ 50 mil" e 1 sem
  faturamento) e 3 leads novos do workshop
- **Quando** a Visão geral abre
- **Então** o bloco mostra Abaixo de R$ 20 mil 2 (40%), Acima de R$ 20 mil 2 (40%), Não
  informado 1 (20%), e os leads do workshop não entram

#### CA-S4-12 — Faixa usa a mesma leitura de faturamento do MQL · prova: automática

- **Dado** cards com faturamento escrito de formas diferentes ("menos de 20 mil", "20k",
  "R$ 35.000", "entre 50 e 100 mil")
- **Quando** o bloco classifica as faixas
- **Então** cada card cai na mesma faixa que a régua do MQL usa hoje (abaixo para os dois
  primeiros, acima para os dois últimos)

#### CA-S4-13 — Bloco some com filtro de funil que não é SE · prova: automática

- **Dado** o filtro do topo no funil workshop
- **Quando** a Visão geral abre
- **Então** o bloco de níveis de qualificação não aparece

### 4. Visão geral — leads por funil

**Descrição:** tabela com uma linha por funil, comparada ao período anterior. No funil
workshop, mostra também quantas pessoas entraram nos grupos de WhatsApp.

**Componentes:**
- Coluna **Funil**.
- Coluna **Leads**, com a variação contra o período anterior (como hoje).
- Coluna **Leads novos**, com a variação contra o período anterior.
- Coluna **Entraram nos grupos**: preenchida só na linha do workshop; vazia nos outros.

**Comportamentos:**
- Abrir a Visão geral: mostra a tabela ordenada do funil com mais leads para o com menos.
- Trocar o período: a tabela recalcula.
- Escolher um funil no filtro: a tabela mostra só a linha dele.

**Critérios de aceite:**

#### CA-S4-14 — Tabela por funil com leads e leads novos · prova: automática

- **Dado** no período 10 leads de SE (4 novos) e 6 do workshop (6 novos)
- **Quando** a Visão geral abre
- **Então** a tabela mostra SE com 10 leads e 4 novos, e workshop com 6 leads e 6 novos,
  nesta ordem, cada número com a variação contra o período anterior

#### CA-S4-15 — Workshop mostra quem entrou nos grupos · prova: automática

- **Dado** 7 entradas nos grupos do workshop registradas no período e entradas em outros
  grupos que não são do workshop
- **Quando** a Visão geral abre
- **Então** a linha do workshop mostra 7 em "Entraram nos grupos" e as outras linhas ficam
  vazias nessa coluna

### 5. Aba Detalhado

**Descrição:** aba nova no menu com tudo o que a Visão geral mostra hoje, sem mudança.

**Componentes:**
- Item **Detalhado** no menu, logo depois de Visão geral.
- Conteúdo idêntico à Visão geral de antes desta mudança (quadros, manchete, metas, painel
  por funil, taxas, funil da agenda, investimento, receita, ROAS, gráfico diário, leads por
  funil, LPs).

**Comportamentos:**
- Clicar em Detalhado: abre a tela com o conteúdo de antes.
- Período e filtro de funil do topo valem para ela como valiam para a Visão geral.
- Atalhos que hoje levam para a Visão geral (ex.: régua de metas) continuam funcionando,
  apontando para onde o bloco ficou.

**Critérios de aceite:**

#### CA-S4-16 — Aba Detalhado mostra a Visão geral antiga · prova: manual

- **Dado** o dash no ar depois da mudança
- **Quando** a usuária clica em Detalhado
- **Então** vê os mesmos blocos e os mesmos números que a Visão geral mostrava antes,
  para o mesmo período e funil

#### CA-S4-17 — Visão geral nova aprovada para a reunião · prova: manual

- **Dado** o dash no ar com a semana anterior selecionada
- **Quando** a usuária abre a Visão geral
- **Então** ela confirma que a tela serve para apresentar na reunião semanal e que os
  números batem com o que ela espera

## Fora de escopo

- Mudar as réguas de Leads, Leads novos, CPL, CPL lead novo, MQL e Reunião agendada: valem as
  de hoje.
- Gravar SQL, MQL ou presença no CRM: a tela só lê.
- Ler a presença das reuniões do Calendly automaticamente: continua à mão no dash.
- Níveis de qualificação para workshop ou outros funis.
- Mudar a aba Grupos ou a forma de registrar entradas nos grupos.
- Exportar a Visão geral (PDF, imagem) para a reunião.
- Metas para os números novos (SQL, reunião realizada).

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S4-01 | SQL é o campo checkbox "🏆 SQL" da lista de leads do ClickUp. Existe também um campo emoji com o mesmo nome, que fica de fora. | invalidada | Vale o campo emoji "🏆 SQL" (id b68130e0-204c-417f-b554-3b9f3782b941), não o checkbox (usuária, 26/10/2026) |
| SUP-S4-02 | SQL conta só leads novos do período (como MQL), lido do estado atual do card no momento da consulta. | confirmada | Usuária, 26/10/2026 |
| SUP-S4-03 | Reunião realizada conta pela data da reunião (não pela data em que agendou), e o Calendly só entra a partir de 19/10/2026, quando a presença passou a ser marcada no dash. | confirmada | Conta na data em que a reunião foi realizada (usuária, 26/10/2026) |
| SUP-S4-04 | Níveis de qualificação mostram três faixas, incluindo "Não informado", para a soma bater com o total de leads novos de SE. | confirmada | Usuária, 26/10/2026 |
| SUP-S4-05 | "Entraram nos grupos" do workshop é a contagem de entradas nos grupos monitorados do workshop na aba Grupos, no período. | confirmada | Usuária, 26/10/2026 |
| SUP-S4-06 | Todos os números continuam comparados com o período anterior de mesmo tamanho, como hoje. | confirmada | Usuária, 26/10/2026 |
| SUP-S4-07 | A manchete em frase ("X leads nos últimos 7 dias…") sai da Visão geral e vai para a aba Detalhado. | invalidada | A manchete fica na Visão geral (usuária, 26/10/2026); a aba Detalhado também a tem, por ser cópia da tela antiga |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S4-01 | O que conta como SQL? | respondida | Checkbox no CRM ClickUp (usuária, 26/10/2026) |
| PER-S4-02 | Níveis de qualificação valem para quais leads? | respondida | Só leads de Sessão Estratégica; workshop não informa faturamento (usuária, 26/10/2026) |
| PER-S4-03 | Para onde vão os blocos que saem da Visão geral? | respondida | Nova aba "Detalhado" (usuária, 26/10/2026) |
| PER-S4-04 | Quais colunas na tabela de leads por funil? | respondida | Leads e leads novos, mais entradas nos grupos no workshop (usuária, 26/10/2026) |

## Ajustes de 26/10/2026 (depois da entrega, pedidos da usuária)

Decididos no chat depois de ela ver a tela no ar; delimitados, sem issue nova.

- **MQL só dos funis com formulário completo (SE + Aquisição):** o quadro de MQL, o custo por
  MQL (investimento da SE + Aquisição ÷ MQLs), as taxas Lead → MQL e MQL → RA e os níveis de
  qualificação usam só Sessão Estratégica e Aquisição, que pedem faturamento (o workshop não
  tem MQL e diluía a taxa). RA → RR continua com todas as reuniões. Com o filtro em outro
  funil, MQL e as duas taxas mostram "—" com "só Sessão Estratégica e Aquisição". O backend diz
  quais são os funis de MQL (`mql_funis`) e devolve a soma deles (`mql`, `qualificacao`).
- **Formato em funil:** os oito quadros viraram um funil vertical (Leads novos → MQL → SQL →
  Reunião agendada → Reunião realizada): o nome da etapa à esquerda, o número e a variação
  DENTRO da faixa (pedido dela: valores no funil, nomes ao lado), o custo da etapa à direita e
  as taxas de passagem entre as faixas (Lead → MQL entre Leads novos e MQL, MQL → RA entre SQL
  e Reunião agendada, RA → RR entre agendada e realizada). Faixas com afunilamento fixo, não
  proporcional.
- **Lateral:** Investimento em ads (novo), Leads e CPL de todos os canais, com comparativo.
- **Níveis de qualificação:** embaixo do funil, na largura toda.
- **Custos por etapa:** CPL lead novo, custo por MQL (investimento da SE + Aquisição ÷ MQLs), por SQL
  (investimento ÷ SQLs), por reunião agendada e por reunião realizada (os mesmos da aba
  Detalhado), cada um com a variação (subir é ruim).
- **Comparativo nas faixas de faturamento:** cada faixa e o total com a variação e o número da
  semana anterior.
- **Por funil = funil completo:** a tabela traz, por funil, Investimento, Leads, Leads novos,
  CPL, CPL lead novo, MQL (só SE), SQL, reuniões, os quatro custos, as três taxas (nos funis
  que agendam reunião) e as entradas nos grupos (workshop), com a variação embaixo de cada
  número.

Provas: testes "ajuste 26/10" em `tests/visao-reuniao.test.js`; a aprovação no ar segue no
critério CA-S4-17.
