# Spec: Árvore de métricas

> série: S5
> estado: aprovada em 29/10/2026

## Visão Geral

Aba nova no dash, **Árvore**, que mostra em números como cada funil chega (ou não)
à venda. A venda fica no topo e cada nível abaixo é uma conta de multiplicar: quando
a meta não bate, a árvore mostra qual galho travou, do criativo até a reunião.

É para a dona do marketing e para a reunião semanal. Hoje os números existem
espalhados (Visão geral, Meta Ads, micro-conversões, ClickUp, card de fechamento
🎯 CON), mas nenhuma tela liga um ao outro nem diz "para bater a meta de vendas,
quantos leads e quanto investimento faltam".

Desenho da árvore:

```
Vendas            = Reuniões realizadas × %RR→Compra (histórico do 🎯 CON)
Reuniões realiz.  = Leads × %Lead→MQL × %MQL→Agendou × %Agendou→Compareceu
Leads             = Investimento ÷ CPL
CPL               = CPC ÷ %Conversão da página
CPC               = CPM ÷ (1000 × CTR)
CTR               → hook rate, hold rate, CTR do link
%Conversão página → connect rate, clique no CTA, formulário concluído ÷ iniciado
```

Funis da primeira versão: **SE**, **AQUISIÇÃO** e **WO PAGO** (LIVE fica fora).

## Páginas / Módulos

### 1. Aba Árvore: entrada, período e funil

**Descrição:** aba nova no menu do dash, com o mesmo filtro de datas das outras abas
e um seletor de funil.

**Componentes:**
- Item "Árvore" no menu do dash.
- Seletor de funil: SE, AQUISIÇÃO, WO PAGO.
- Filtro de datas do dash (o mesmo das outras abas).

**Comportamentos:**
- Abrir a aba: mostra a árvore do primeiro funil (SE) no período do filtro.
- Trocar o funil: a árvore inteira é refeita para o funil escolhido.
- Trocar o período: a árvore inteira é refeita para o novo período.

**Critérios de aceite:**

#### CA-S5-01 — A aba Árvore aparece no menu e abre no funil SE · prova: automática

- **Dado** que a pessoa está logada no dash
- **Quando** clica em "Árvore" no menu
- **Então** a tela mostra a árvore do funil SE para o período do filtro de datas

#### CA-S5-02 — Trocar o funil refaz a árvore · prova: automática

- **Dado** a aba Árvore aberta no funil SE
- **Quando** a pessoa escolhe WO PAGO no seletor
- **Então** todos os números da árvore passam a ser do WO PAGO, e o tronco mostra as etapas do WO PAGO (módulo 2)

#### CA-S5-03 — A árvore segue o filtro de datas · prova: automática

- **Dado** a aba Árvore aberta
- **Quando** a pessoa muda o filtro de datas
- **Então** todos os números da árvore passam a ser do novo período

### 2. Tronco: do lead à reunião realizada (por coorte)

**Descrição:** o tronco mostra, para os leads que **entraram no período**, até onde
cada um chegou **até hoje**. Cada etapa mostra o volume e a taxa de passagem em
relação à etapa anterior.

Etapas por funil:

| Funil | Etapas |
|---|---|
| SE | Lead → MQL → Agendou → Compareceu → SQL |
| AQUISIÇÃO | Lead → MQL → Agendou → Compareceu → SQL |
| WO PAGO | Comprou o workshop → Entrou no grupo → Agendou → Compareceu → SQL |

Definições (as mesmas que o dash já usa): Lead = card criado no CRM no funil;
MQL = campo 🥇 MQL; SQL = campo emoji 🏆 SQL; Agendou e Compareceu = agenda própria
e Calendly com presença registrada; Comprou o workshop = compra paga na Greenn.

**Componentes:**
- Uma faixa por etapa, com o volume e a taxa de passagem da etapa anterior.
- Aviso de coorte jovem quando o período termina há menos de 14 dias.

**Comportamentos:**
- Ver o volume de cada etapa para os leads do período.
- Ver a taxa de passagem entre cada par de etapas.
- Ver que a coorte ainda está amadurecendo quando o período é recente.

**Critérios de aceite:**

#### CA-S5-04 — Cada etapa conta só os leads que entraram no período · prova: automática

- **Dado** 10 leads SE criados no período e 3 criados antes dele, todos com reunião realizada dentro do período
- **Quando** a árvore do SE é montada
- **Então** a etapa Lead mostra 10 e a etapa Compareceu conta no máximo esses 10 (os 3 antigos ficam fora)

#### CA-S5-05 — A etapa conta o que o lead já atingiu até hoje · prova: automática

- **Dado** um lead criado no período cuja reunião aconteceu depois do fim do período
- **Quando** a árvore do período é montada
- **Então** esse lead conta em Agendou e em Compareceu

#### CA-S5-06 — A taxa de passagem é etapa ÷ etapa anterior · prova: automática

- **Dado** 40 leads, 20 MQLs, 10 agendados e 6 comparecimentos na coorte
- **Quando** a árvore é montada
- **Então** as taxas mostradas são Lead→MQL 50%, MQL→Agendou 50%, Agendou→Compareceu 60%

#### CA-S5-07 — Etapa anterior zerada não mostra taxa · prova: automática

- **Dado** uma coorte sem nenhum agendamento
- **Quando** a árvore é montada
- **Então** a taxa Agendou→Compareceu aparece como "sem dado", nunca 0% nem erro

#### CA-S5-08 — O tronco do WO PAGO começa na compra do workshop · prova: automática

- **Dado** o funil WO PAGO selecionado
- **Quando** a árvore é montada
- **Então** a primeira etapa é "Comprou o workshop" (compras pagas na Greenn no período) e a segunda é "Entrou no grupo"

#### CA-S5-09 — Período recente avisa que a coorte não amadureceu · prova: automática

- **Dado** um período que termina há menos de 14 dias
- **Quando** a árvore é montada
- **Então** aparece o aviso de que parte dos leads ainda pode avançar nas etapas

### 3. Topo: vendas, ticket e o elo RR → Compra (🎯 CON)

**Descrição:** a venda não é medida lead a lead (o "contrato assinado" do ClickUp é
marcado em lote e sem valor). O topo usa os cards de fechamento mensal do CRM
(🧠 % MARKETING = CONSOLIDADO): FUNIL SE, FUNIL AQUISIÇÃO e FUNIL WO.

**Componentes:**
- Meta de vendas do funil (campo #META do card CON do mês).
- Taxa histórica RR → Compra: soma de #COMPRAS ÷ soma de #RR dos **últimos 6 meses fechados** do funil.
- Ticket médio histórico: soma de #ARRECADADO ÷ soma de #COMPRAS dos mesmos 6 meses.
- Vendas e arrecadado do mês corrente consolidados até agora (#COMPRAS e #ARRECADADO do card do mês).
- Vendas esperadas: reuniões realizadas da coorte × taxa histórica RR → Compra.

**Comportamentos:**
- Ver a meta de vendas do funil.
- Ver as vendas esperadas pela árvore ao lado da meta.
- Ver as vendas e o arrecadado consolidados no CON.
- Ver de quais meses saiu a taxa histórica.

**Critérios de aceite:**

#### CA-S5-10 — A meta de vendas vem do #META do card CON do mês · prova: automática

- **Dado** o card "FUNIL SE" de outubro/2026 com #META = 6
- **Quando** a árvore do SE é montada para outubro inteiro
- **Então** o topo mostra meta de 6 vendas

#### CA-S5-11 — Período menor que o mês usa a meta proporcional aos dias · prova: automática

- **Dado** #META = 6 em outubro (31 dias) e o filtro de 01/10 a 15/10
- **Quando** a árvore é montada
- **Então** a meta do período é 6 × 15 ÷ 31 = 2,9 vendas

#### CA-S5-12 — Período que cruza meses soma as metas proporcionais de cada mês · prova: automática

- **Dado** #META = 6 em setembro e 9 em outubro, filtro de 16/09 a 15/10
- **Quando** a árvore é montada
- **Então** a meta do período é 6 × 15 ÷ 30 + 9 × 15 ÷ 31

#### CA-S5-13 — Mês sem #META aparece como "sem meta" · prova: automática

- **Dado** um mês cujo card CON não tem #META preenchido (ou não existe)
- **Quando** a árvore é montada para esse mês
- **Então** o topo mostra "sem meta" e a conta de trás pra frente (módulo 6) não aparece, sem erro

#### CA-S5-14 — A taxa RR → Compra usa os últimos 6 meses fechados · prova: automática

- **Dado** os cards CON do SE de abril a setembro/2026 com, somados, 60 RR e 18 compras, e o mês corrente outubro
- **Quando** a árvore é montada
- **Então** a taxa RR → Compra é 30% e a tela diz "abr–set/2026"

#### CA-S5-15 — Ticket médio histórico é arrecadado ÷ compras dos 6 meses · prova: automática

- **Dado** os mesmos 6 meses com R$ 180.000 arrecadados e 18 compras
- **Quando** a árvore é montada
- **Então** o ticket médio mostrado é R$ 10.000

#### CA-S5-16 — Menos de 6 meses de histórico usa os que existem e avisa · prova: automática

- **Dado** só 2 meses fechados com card CON no funil
- **Quando** a árvore é montada
- **Então** a taxa e o ticket usam esses 2 meses e a tela avisa "base de 2 meses"

#### CA-S5-17 — Vendas esperadas = reuniões realizadas × taxa histórica · prova: automática

- **Dado** 10 comparecimentos na coorte e taxa histórica RR → Compra de 30%
- **Quando** a árvore é montada
- **Então** o topo mostra 3 vendas esperadas, marcadas como estimativa

#### CA-S5-18 — Os números da árvore batem com os do card CON · prova: manual

- **Dado** o mês de setembro/2026 inteiro no filtro
- **Quando** a dona compara a árvore do SE com o card "FUNIL SE" de setembro no ClickUp
- **Então** meta, compras e arrecadado são os mesmos, e as diferenças de Leads/MQL/RA/RR são explicadas pela coorte

#### CA-S5-36 — Dois cards CON do mesmo funil e mês somam · prova: automática

- **Dado** dois cards "FUNIL AQUISIÇÃO" de outubro/2026, um com 3 compras e #META 4, outro com 2 compras e #META 1
- **Quando** a árvore do AQUISIÇÃO é montada para outubro
- **Então** o topo usa 5 compras e meta de 5 vendas (a soma dos dois cards)

### 4. Galho do anúncio: investimento até o clique

**Descrição:** abre o CPL nos números do anúncio, somando as campanhas do funil no
período.

**Componentes:**
- Investimento, impressões, CPM.
- Hook rate (visualizações de 3 s ÷ impressões), hold rate (visualizações até o fim ÷ visualizações de 3 s).
- CTR do link (cliques no link ÷ impressões), CPC (investimento ÷ cliques no link).
- Leads e CPL (investimento ÷ leads do tronco).
- Custo por MQL (investimento ÷ MQLs do tronco).

**Comportamentos:**
- Ver cada número do anúncio para o funil e o período.
- Ver que o funil não tem mídia paga (AQUISIÇÃO).

**Critérios de aceite:**

#### CA-S5-19 — CPM, CTR do link e CPC são calculados das campanhas do funil · prova: automática

- **Dado** campanhas do SE com R$ 1.000 investidos, 50.000 impressões e 500 cliques no link no período
- **Quando** a árvore é montada
- **Então** CPM = R$ 20,00, CTR do link = 1,0% e CPC = R$ 2,00

#### CA-S5-20 — Hook e hold rate aparecem para os anúncios em vídeo · prova: automática

- **Dado** anúncios do funil com 50.000 impressões, 10.000 visualizações de 3 s e 2.000 visualizações até o fim
- **Quando** a árvore é montada
- **Então** hook rate = 20% e hold rate = 20%

#### CA-S5-21 — Sem vídeo, hook e hold mostram "sem vídeo" · prova: automática

- **Dado** um funil cujos anúncios no período são só imagem
- **Quando** a árvore é montada
- **Então** hook rate e hold rate mostram "sem vídeo", nunca 0%

#### CA-S5-22 — CPL e custo por MQL usam os leads e MQLs do tronco · prova: automática

- **Dado** R$ 1.000 investidos, 40 leads e 20 MQLs na coorte
- **Quando** a árvore é montada
- **Então** CPL = R$ 25,00 e custo por MQL = R$ 50,00

#### CA-S5-23 — Funil sem mídia paga não mostra o galho do anúncio · prova: automática

- **Dado** o funil AQUISIÇÃO selecionado
- **Quando** a árvore é montada
- **Então** no lugar do galho do anúncio aparece "funil sem mídia paga"

### 5. Galho da página: do clique ao lead

**Descrição:** abre a conversão da página nas perdas entre o clique no anúncio e o
lead, nas páginas do funil.

**Componentes:**
- Connect rate: visitas às páginas do funil vindas do anúncio ÷ cliques no link.
- Clique no CTA ÷ visitas.
- Formulário concluído ÷ formulário iniciado.
- Conversão da página: leads ÷ visitas.

**Comportamentos:**
- Ver cada taxa da página para o funil e o período.

**Critérios de aceite:**

#### CA-S5-24 — Connect rate compara visitas do anúncio com cliques no link · prova: automática

- **Dado** 500 cliques no link nas campanhas do funil e 350 visitas às páginas do funil vindas dessas campanhas
- **Quando** a árvore é montada
- **Então** connect rate = 70%

#### CA-S5-25 — Clique no CTA, formulário e conversão vêm das micro-conversões · prova: automática

- **Dado** 350 visitas, 140 cliques no CTA, 60 formulários iniciados, 40 concluídos e 40 leads
- **Quando** a árvore é montada
- **Então** CTA = 40%, formulário = 67%, conversão da página = 11,4%

#### CA-S5-26 — Funil sem página própria mostra "sem página" · prova: automática

- **Dado** um funil cujas entradas não passam por página do site no período
- **Quando** a árvore é montada
- **Então** o galho da página mostra "sem página", sem erro

### 6. Conta de trás pra frente

**Descrição:** a partir da meta de vendas do período, mostra quanto cada nível
precisa entregar, ao lado do que está entregando. As taxas do plano são as
**históricas dos últimos 6 meses fechados** do 🎯 CON; o que está entregando ("tem")
é a coorte do período. Assim o gargalo é a etapa em que a coorte converte abaixo do
histórico.

```
RR necessárias      = meta de vendas ÷ %RR→Compra      (todas as taxas: histórico 6 meses do 🎯 CON)
Agendamentos        = RR necessárias ÷ %Agendou→Compareceu
MQLs                = agendamentos ÷ %MQL→Agendou
Leads               = MQLs ÷ %Lead→MQL
Investimento        = leads × CPL
```

**Componentes:**
- Ao lado de cada etapa do tronco e do investimento: "precisa" e "tem", com a diferença.
- Indicação de qual etapa está mais longe do necessário.

**Comportamentos:**
- Ver quanto cada etapa precisa para bater a meta.
- Ver a diferença entre o necessário e o realizado.
- Ver qual etapa é o maior gargalo.

**Critérios de aceite:**

#### CA-S5-27 — O necessário é calculado de trás pra frente a partir da meta · prova: automática

- **Dado** meta de 6 vendas, RR → Compra 30%, Agendou→Compareceu 50%, MQL→Agendou 50%, Lead→MQL 50% e CPL R$ 25
- **Quando** a árvore é montada
- **Então** precisa de 20 RR, 40 agendamentos, 80 MQLs, 160 leads e R$ 4.000 de investimento

#### CA-S5-28 — Cada etapa mostra o necessário, o realizado e a diferença · prova: automática

- **Dado** que a etapa MQL precisa de 80 e a coorte tem 60
- **Quando** a árvore é montada
- **Então** a etapa MQL mostra "precisa 80 · tem 60 · faltam 20"

#### CA-S5-29 — A etapa mais longe do necessário fica destacada · prova: automática

- **Dado** etapas com realizado/necessário de 90%, 75% e 50%
- **Quando** a árvore é montada
- **Então** só a etapa de 50% aparece destacada como gargalo

#### CA-S5-30 — Taxa sem dado interrompe a conta naquele nível · prova: automática

- **Dado** a taxa Agendou→Compareceu "sem dado"
- **Quando** a árvore é montada
- **Então** o necessário aparece até RR e, dali para baixo, "sem base para calcular"

### 7. Abrir um galho por anúncio

**Descrição:** clicando no galho do anúncio ou da página, a pessoa vê os mesmos
números quebrados por campanha e por anúncio, para achar qual puxa o funil para
baixo.

**Componentes:**
- Lista por campanha, com os anúncios dentro: investimento, CPM, hook, hold, CTR do link, CPC, connect rate, leads, CPL, MQLs, custo por MQL.

**Comportamentos:**
- Abrir a lista por campanha/anúncio.
- Ordenar a lista por qualquer coluna.
- Fechar a lista e voltar à árvore.

**Critérios de aceite:**

#### CA-S5-31 — Clicar no galho do anúncio abre a lista por campanha e anúncio · prova: automática

- **Dado** a árvore do SE com 2 campanhas e 5 anúncios no período
- **Quando** a pessoa clica no galho do anúncio
- **Então** aparece a lista com as 2 campanhas e os 5 anúncios, cada um com seus números

#### CA-S5-32 — A soma da lista bate com o número da árvore · prova: automática

- **Dado** a lista aberta
- **Quando** se somam investimento, impressões, cliques no link e leads dos anúncios
- **Então** os totais são iguais aos do galho na árvore

#### CA-S5-33 — A lista ordena por coluna · prova: automática

- **Dado** a lista aberta
- **Quando** a pessoa clica no título "CPL"
- **Então** os anúncios ficam do menor para o maior CPL, e um novo clique inverte

#### CA-S5-34 — Lead sem anúncio identificado aparece numa linha própria · prova: automática

- **Dado** leads do funil sem UTM de anúncio
- **Quando** a lista é aberta
- **Então** eles aparecem na linha "sem anúncio identificado", para a soma continuar batendo

### 8. Visual da aba

#### CA-S5-35 — A dona aprova o desenho da árvore no ar · prova: manual

- **Dado** a aba publicada
- **Quando** a dona abre a árvore do SE no período da última semana
- **Então** ela aprova a leitura (ordem dos níveis, onde ficam "precisa/tem", destaques) no próprio dash

## Fora de escopo

- Funil LIVE.
- Venda lead a lead (estágio "contrato assinado" ou "contrato" do ClickUp); o topo usa só os cards 🎯 CON.
- Escrever qualquer coisa no ClickUp (inclusive no card CON).
- Cadastro de meta de vendas no dash.
- Mexer nas Metas por funil que já existem (CPL, leads, MQL, custo por MQL).
- Google Ads.
- Atribuição multi-toque; vale a atribuição que o dash já usa.
- Alertas (Slack, e-mail).

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S5-01 | O card CON de cada funil é achado pelo 🔻 Funil + 📅 Mês + 🗓️ Ano com 🧠 % MARKETING = CONSOLIDADO; SE = opção SESSÃO ESTRATÉGICA e nome "FUNIL SE", AQUISIÇÃO = "FUNIL AQUISIÇÃO", WO PAGO = "FUNIL WO" | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-02 | Se houver dois cards CON do mesmo funil no mesmo mês (a lista CON tem dois cards "FUNIL AQUISIÇÃO" recentes), vale o atualizado por último | invalidada | Os números dos cards duplicados SOMAM (Marcelle, 29/10/2026); ver CA-S5-36 |
| SUP-S5-03 | "Mês fechado" = mês anterior ao corrente; o mês corrente nunca entra na taxa histórica | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-04 | SQL aparece no tronco como informação (Compareceu → SQL), mas a venda esperada sai de RR × %RR→Compra, não do SQL | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-05 | Na conta de trás pra frente, as taxas do tronco são as da coorte do período; com coorte jovem (aviso do CA-S5-09) elas tendem a sair baixas | invalidada | Com as taxas da própria coorte, tem ÷ precisa sai igual em todas as etapas e não há gargalo. O plano usa as taxas históricas dos 6 meses fechados do 🎯 CON (Lead→MQL, MQL→RA, RA→RR, RR→Compra); o "tem" segue a coorte (Marcelle, 29/10/2026) |
| SUP-S5-11 | O CPL do plano (para o investimento necessário) é o histórico dos mesmos 6 meses do 🎯 CON: soma de #INVESTIMENTO ÷ soma de #LEADS | aberta | — |
| SUP-S5-06 | Hook rate, hold rate e cliques no link passam a ser coletados do Meta por anúncio (hoje o dash guarda só investimento, impressões e cliques totais por campanha) | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-07 | As campanhas de cada funil são as que o dash já atribui ao funil (regra automática + classificação manual da aba Meta Ads; WO PAGO pelo trecho "workshop-pago") | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-08 | As páginas de cada funil são as do mapeamento de páginas por funil que o dash já usa nas micro-conversões | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-09 | Ler os cards CON uma vez por dia basta (são preenchidos à mão, não em tempo real) | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-10 | O aviso de coorte jovem usa 14 dias | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S5-01 | De onde sai a meta de vendas? | respondida | #META do card 🎯 CON do mês; sem cadastro novo no dash (Marcelle, 29/10/2026) |
| PER-S5-02 | Como contar a venda, dado que "contrato assinado" é marcado em lote e sem valor? | respondida | Tronco medido para no SQL; venda vem dos cards 🎯 CON (Marcelle, 29/10/2026) |
| PER-S5-03 | Quais funis entram? | respondida | SE, AQUISIÇÃO e WO PAGO; LIVE saiu (Marcelle, 29/10/2026) |
| PER-S5-04 | Taxas por coorte ou pelo mesmo período? | respondida | Por coorte (Marcelle, 29/10/2026) |
| PER-S5-05 | Até onde abre a parte de anúncio e página? | respondida | Número do funil na árvore + lista por campanha/anúncio ao clicar (Marcelle, 29/10/2026) |
| PER-S5-06 | Qual período a aba mostra? | respondida | O filtro de datas do dash; meta proporcional aos dias (Marcelle, 29/10/2026) |
| PER-S5-07 | Qual elo liga o tronco às vendas? | respondida | RR → Compra (Marcelle, 29/10/2026) |
| PER-S5-08 | Quantos meses de histórico? | respondida | Últimos 6 meses fechados (Marcelle, 29/10/2026) |
