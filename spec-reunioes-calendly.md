# Spec: Reuniões do Calendly nos cards de reunião do dash

> série: S2
> estado: aprovada em 19/10/2026

## Visão Geral

Hoje os cards de reunião do dash só enxergam a agenda própria, que está desligada.
Por isso "Reuniões agendadas", "Custo por reunião agendada" e a taxa MQL → RA mostram
0 ou "—", embora as consultorias aconteçam pelo Calendly (40 em duas semanas, na sonda
de 19/10/2026).

A mudança faz o dash **ler** as consultorias agendadas no Calendly e contá-las nesses
cards, sem escrever nada no CRM nem no Calendly. Ficam de fora as reuniões que a equipe
marcou em nome do lead. Quando a agenda própria for ligada, as duas fontes se somam
sem contar a mesma pessoa duas vezes.

É para quem acompanha o funil de vendas na Visão geral: ver quantas consultorias os
anúncios geraram e quanto custou cada uma.

## Páginas / Módulos

### Coleta diária das consultorias do Calendly

**Descrição:** uma vez por dia, o sistema busca no Calendly as consultorias agendadas e
guarda uma cópia, para o dash ler sem consultar o Calendly a cada abertura.

**Comportamentos:**
- Buscar as consultorias: lê no Calendly os agendamentos do tipo "Consultoria
  Individual" e guarda, de cada convidado, o e-mail, quando agendou, quando é a reunião,
  se está ativa ou cancelada e se foi marcada pela equipe.
- Atualizar o que mudou: um agendamento que já estava guardado e foi cancelado ou
  remarcado no Calendly tem a situação atualizada na coleta seguinte.
- Carga do histórico: na primeira coleta, traz as consultorias desde o início do
  histórico combinado (SUP-S2-03).
- Falha sem estrago: se o Calendly não responder, a cópia guardada continua como estava
  e a falha fica registrada.

**Critérios de aceite:**

#### CA-S2-01 — A coleta guarda as consultorias do Calendly · prova: automática

- **Dado** um Calendly com consultorias "Consultoria Individual" e um agendamento de outro tipo (ex.: workshop)
- **Quando** a coleta roda
- **Então** a cópia guardada tem uma linha por convidado das consultorias, com e-mail, quando agendou, quando é a reunião, situação e se foi marcada pela equipe; o agendamento do workshop não entra

#### CA-S2-02 — Rodar a coleta de novo não duplica · prova: automática

- **Dado** uma coleta já feita
- **Quando** a coleta roda outra vez com os mesmos agendamentos
- **Então** a cópia guardada continua com o mesmo número de linhas

#### CA-S2-03 — Cancelamento no Calendly chega à cópia · prova: automática

- **Dado** uma consultoria guardada como ativa
- **Quando** ela é cancelada no Calendly e a coleta roda
- **Então** a cópia guardada passa a mostrá-la como cancelada

#### CA-S2-04 — Calendly fora do ar não apaga o que já existe · prova: automática

- **Dado** uma cópia guardada com consultorias
- **Quando** a coleta roda e o Calendly responde com erro
- **Então** a cópia guardada continua igual e a falha fica registrada no log da coleta

#### CA-S2-05 — A coleta roda sozinha todo dia · prova: manual

- **Dado** a coleta agendada na VPS
- **Quando** passa um dia
- **Então** a cópia guardada traz as consultorias agendadas no dia anterior (conferido contra o Calendly)

### Cards de reunião e taxa MQL → RA (Visão geral)

**Descrição:** os cards que já existem passam a contar as consultorias do Calendly
junto com as da agenda própria.

**Componentes:**
- Card "Reuniões agendadas" (total e no painel por funil): quantas consultorias foram
  agendadas no período, pela data em que a pessoa agendou.
- Card "Custo por reunião agendada" (total e por funil): investimento do funil ÷
  reuniões agendadas.
- Card "MQL → RA" (Taxas de passagem, total e por funil): reuniões agendadas ÷ MQLs.

**Comportamentos:**
- Contar a consultoria do Calendly: entra no período pela data em que a pessoa agendou.
- Ignorar a marcada pela equipe: consultoria que a equipe agendou em nome do lead não
  conta.
- Ignorar a cancelada: consultoria cancelada não conta, inclusive a que foi cancelada
  por remarcação (a remarcação conta uma vez só).
- Achar o funil: a consultoria vai para o funil do lead com o mesmo e-mail; sem lead
  com esse e-mail, vai para a SE.
- Somar com a agenda própria sem duplicar: a mesma pessoa (mesmo e-mail) agendada no
  Calendly e na agenda própria dentro do período conta uma reunião.
- Mostrar o período anterior: o carimbo de %, a diferença e o balão de comparação usam
  a mesma conta no período anterior.

**Critérios de aceite:**

#### CA-S2-06 — Consultorias do Calendly aparecem em Reuniões agendadas · prova: automática

- **Dado** 3 consultorias do Calendly agendadas pelos próprios leads dentro do período e nenhuma na agenda própria
- **Quando** a Visão geral pede os números de reunião do período
- **Então** "Reuniões agendadas" mostra 3

#### CA-S2-07 — Reunião marcada pela equipe não conta · prova: automática

- **Dado** 2 consultorias agendadas pelos leads e 1 agendada pela equipe em nome de um lead, todas no período
- **Quando** a Visão geral pede os números de reunião
- **Então** "Reuniões agendadas" mostra 2

#### CA-S2-08 — Reunião cancelada não conta, remarcada conta uma vez · prova: automática

- **Dado** no período uma consultoria cancelada e uma remarcada (a original cancelada e a nova ativa)
- **Quando** a Visão geral pede os números de reunião
- **Então** "Reuniões agendadas" mostra 1

#### CA-S2-09 — Entra no período pela data em que agendou · prova: automática

- **Dado** uma consultoria agendada em 11/10 para acontecer em 14/10
- **Quando** a Visão geral mostra 12/10 a 18/10
- **Então** ela não conta nesse período, e conta no período que inclui 11/10

#### CA-S2-10 — A reunião vai para o funil do lead com o mesmo e-mail · prova: automática

- **Dado** uma consultoria cujo e-mail é de um lead do funil workshop
- **Quando** o painel por funil mostra as reuniões
- **Então** ela conta em "Reuniões agendadas" do funil workshop, e não na SE

#### CA-S2-11 — Reunião sem lead conhecido conta na SE · prova: automática

- **Dado** uma consultoria cujo e-mail não é de nenhum lead
- **Quando** o painel por funil mostra as reuniões
- **Então** ela conta em "Reuniões agendadas" da SE

#### CA-S2-12 — E-mail com maiúscula ou espaço casa igual · prova: automática

- **Dado** um lead "ana@gmail.com" no funil workshop e uma consultoria agendada como " Ana@Gmail.com"
- **Quando** o painel por funil mostra as reuniões
- **Então** a consultoria conta no funil workshop

#### CA-S2-13 — Mesma pessoa no Calendly e na agenda própria conta uma vez · prova: automática

- **Dado** a mesma pessoa (mesmo e-mail) com uma consultoria no Calendly e uma reunião comercial na agenda própria, ambas agendadas no período, e outra pessoa só na agenda própria
- **Quando** a Visão geral pede os números de reunião
- **Então** "Reuniões agendadas" mostra 2

#### CA-S2-14 — Custo por reunião agendada usa as consultorias do Calendly · prova: automática

- **Dado** R$ 1.500 investidos na SE e 10 consultorias do Calendly no funil SE no período
- **Quando** a Visão geral mostra o custo
- **Então** "Custo por reunião agendada" da SE mostra R$ 150,00

#### CA-S2-15 — MQL → RA usa as consultorias do Calendly · prova: automática

- **Dado** 11 MQLs da SE e 5 consultorias do Calendly no funil SE no período
- **Quando** as Taxas de passagem são mostradas
- **Então** "MQL → RA" da SE mostra 45,5% e a nota diz "5 reuniões de 11 MQLs"

#### CA-S2-16 — Comparação com o período anterior usa a mesma conta · prova: automática

- **Dado** 4 consultorias no período e 2 no período anterior
- **Quando** a Visão geral mostra "Reuniões agendadas"
- **Então** o carimbo mostra ▲ 100%, a diferença +2 e o balão mostra 4 agora e 2 no anterior

#### CA-S2-17 — Os números batem com o Calendly no ar · prova: manual

- **Dado** o dash no ar com a coleta rodando
- **Quando** ela abre a Visão geral em "Últimos 7 dias"
- **Então** "Reuniões agendadas" bate com a contagem feita à mão no Calendly (consultorias agendadas pelos leads no período, sem as canceladas e sem as marcadas pela equipe)

#### CA-S2-18 — Sem cópia do Calendly, os cards continuam funcionando · prova: automática

- **Dado** a cópia do Calendly vazia ou ilegível
- **Quando** a Visão geral pede os números de reunião
- **Então** os cards mostram só o que vem da agenda própria, sem erro na tela

## Fora de escopo

- Escrever qualquer coisa no CRM (ClickUp) ou no Calendly.
- "Reuniões realizadas", "Custo por reunião realizada", RA → RR e no-show: o Calendly não
  sabe se a reunião aconteceu (ninguém marca falta lá). Esses cards seguem na agenda
  própria.
- Distinguir a equipe agendando pelo link público como se fosse o lead: o Calendly não
  separa esse caso.
- Outros tipos de evento do Calendly além de "Consultoria Individual" (workshops, etc.).
- O funil da agenda própria (Convite → Agendou) e a aba Agenda.
- Relatório de marketing, Metas e Argo: continuam como estão.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S2-01 | "Marcada pela equipe" = o Calendly registra quem agendou em nome do convidado; sem esse registro, foi o próprio lead. | confirmada | Usuária, 19/10/2026. Testado na API em 19/10: 2 de 40 convidados têm o registro, ambos agendados pela conta Atacado Exponencial (anfitriã da consultoria) com "agendar em nome"; os outros 38 não têm |
| SUP-S2-02 | A coleta diária roda de madrugada (ex.: 05h, Brasília) e traz até o fim do dia anterior; o dia de hoje fica sem as reuniões do próprio dia até a próxima coleta. | confirmada | Usuária, 19/10/2026 |
| SUP-S2-03 | A carga inicial traz as consultorias desde 01/09/2026, o bastante para comparar os períodos usados no dash. | confirmada | Usuária, 19/10/2026 |
| SUP-S2-04 | Quando o e-mail é de um lead em mais de um funil, vale o funil do lead mais recente antes do agendamento (se não houver anterior, o mais recente). | confirmada | Usuária, 19/10/2026 |
| SUP-S2-05 | Só o tipo de evento "Consultoria Individual" é reunião comercial; se o nome mudar no Calendly, a coleta precisa ser ajustada. | confirmada | Usuária, 19/10/2026 |
| SUP-S2-06 | A coleta diária olha consultorias com início entre 45 dias atrás e 120 dias à frente: agendamento feito ontem para mais de 120 dias à frente, ou cancelamento de reunião de mais de 45 dias atrás, não seria visto. | confirmada | Usuária, 19/10/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S2-01 | A taxa MQL → RA também passa a contar as reuniões do Calendly? | respondida | Sim, usa as mesmas do card Reuniões agendadas (usuária, 19/10/2026) |
| PER-S2-02 | Reunião do Calendly sem lead com o mesmo e-mail: onde entra? | respondida | Conta como SE (usuária, 19/10/2026) |
| PER-S2-03 | Com que frequência buscar as reuniões no Calendly? | respondida | Uma vez por dia (usuária, 19/10/2026) |
| PER-S2-04 | Quando a agenda própria for ligada, como as fontes convivem? | respondida | Soma as duas, a mesma pessoa no período conta uma vez (usuária, 19/10/2026) |
