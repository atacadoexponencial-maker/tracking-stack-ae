# S2-02: Cards de reunião e MQL → RA contam o Calendly

**Tipo:** Implementação
**Página:** Cards de reunião e taxa MQL → RA (Visão geral)
**Spec:** `spec-reunioes-calendly.md`

## Descrição

"Reuniões agendadas", "Custo por reunião agendada" e "MQL → RA" (total e por funil)
passam a contar as consultorias guardadas pela coleta do Calendly (S2-01), somadas
às da agenda própria sem duplicar a mesma pessoa, sem as marcadas pela equipe e sem
as canceladas, com o funil achado pelo e-mail do lead.

## Pronto quando

Na Visão geral em "Últimos 7 dias", os cards de reunião agendada e o MQL → RA mostram
as consultorias do Calendly do período (e do anterior, no carimbo e no balão), batendo
com a contagem feita à mão no Calendly.

## Critérios de aceite

- **CA-S2-06** (automática) — Consultorias do Calendly aparecem em Reuniões agendadas. Dado 3 consultorias do Calendly agendadas pelos próprios leads dentro do período e nenhuma na agenda própria, quando a Visão geral pede os números de reunião do período, então "Reuniões agendadas" mostra 3.
- **CA-S2-07** (automática) — Reunião marcada pela equipe não conta. Dado 2 consultorias agendadas pelos leads e 1 agendada pela equipe em nome de um lead, todas no período, quando a Visão geral pede os números de reunião, então "Reuniões agendadas" mostra 2.
- **CA-S2-08** (automática) — Reunião cancelada não conta, remarcada conta uma vez. Dado no período uma consultoria cancelada e uma remarcada (a original cancelada e a nova ativa), quando a Visão geral pede os números de reunião, então "Reuniões agendadas" mostra 1.
- **CA-S2-09** (automática) — Entra no período pela data em que agendou. Dado uma consultoria agendada em 11/10 para acontecer em 14/10, quando a Visão geral mostra 12/10 a 18/10, então ela não conta nesse período, e conta no período que inclui 11/10.
- **CA-S2-10** (automática) — A reunião vai para o funil do lead com o mesmo e-mail. Dado uma consultoria cujo e-mail é de um lead do funil workshop, quando o painel por funil mostra as reuniões, então ela conta em "Reuniões agendadas" do funil workshop, e não na SE.
- **CA-S2-11** (automática) — Reunião sem lead conhecido conta na SE. Dado uma consultoria cujo e-mail não é de nenhum lead, quando o painel por funil mostra as reuniões, então ela conta em "Reuniões agendadas" da SE.
- **CA-S2-12** (automática) — E-mail com maiúscula ou espaço casa igual. Dado um lead "ana@gmail.com" no funil workshop e uma consultoria agendada como " Ana@Gmail.com", quando o painel por funil mostra as reuniões, então a consultoria conta no funil workshop.
- **CA-S2-13** (automática) — Mesma pessoa no Calendly e na agenda própria conta uma vez. Dado a mesma pessoa (mesmo e-mail) com uma consultoria no Calendly e uma reunião comercial na agenda própria, ambas agendadas no período, e outra pessoa só na agenda própria, quando a Visão geral pede os números de reunião, então "Reuniões agendadas" mostra 2.
- **CA-S2-14** (automática) — Custo por reunião agendada usa as consultorias do Calendly. Dado R$ 1.500 investidos na SE e 10 consultorias do Calendly no funil SE no período, quando a Visão geral mostra o custo, então "Custo por reunião agendada" da SE mostra R$ 150,00.
- **CA-S2-15** (automática) — MQL → RA usa as consultorias do Calendly. Dado 11 MQLs da SE e 5 consultorias do Calendly no funil SE no período, quando as Taxas de passagem são mostradas, então "MQL → RA" da SE mostra 45,5% e a nota diz "5 reuniões de 11 MQLs".
- **CA-S2-16** (automática) — Comparação com o período anterior usa a mesma conta. Dado 4 consultorias no período e 2 no período anterior, quando a Visão geral mostra "Reuniões agendadas", então o carimbo mostra ▲ 100%, a diferença +2 e o balão mostra 4 agora e 2 no anterior.
- **CA-S2-17** (manual) — Os números batem com o Calendly no ar. Dado o dash no ar com a coleta rodando, quando ela abre a Visão geral em "Últimos 7 dias", então "Reuniões agendadas" bate com a contagem feita à mão no Calendly (consultorias agendadas pelos leads no período, sem as canceladas e sem as marcadas pela equipe).
- **CA-S2-18** (automática) — Sem cópia do Calendly, os cards continuam funcionando. Dado a cópia do Calendly vazia ou ilegível, quando a Visão geral pede os números de reunião, então os cards mostram só o que vem da agenda própria, sem erro na tela.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S2-01 | "Marcada pela equipe" = o Calendly registra quem agendou em nome do convidado; sem esse registro, foi o próprio lead. | confirmada | Usuária, 19/10/2026. Testado na API em 19/10: 2 de 40 convidados têm o registro, ambos agendados pela conta Atacado Exponencial (anfitriã da consultoria) com "agendar em nome"; os outros 38 não têm |
| SUP-S2-04 | Quando o e-mail é de um lead em mais de um funil, vale o funil do lead mais recente antes do agendamento (se não houver anterior, o mais recente). | confirmada | Usuária, 19/10/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S2-01 | A taxa MQL → RA também passa a contar as reuniões do Calendly? | respondida | Sim, usa as mesmas do card Reuniões agendadas (usuária, 19/10/2026) |
| PER-S2-02 | Reunião do Calendly sem lead com o mesmo e-mail: onde entra? | respondida | Conta como SE (usuária, 19/10/2026) |
| PER-S2-04 | Quando a agenda própria for ligada, como as fontes convivem? | respondida | Soma as duas, a mesma pessoa no período conta uma vez (usuária, 19/10/2026) |
