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
| SUP-S2-07 | Remarcação conta uma vez, no dia em que a pessoa remarcou (o Calendly cancela o agendamento original e cria outro). | confirmada | Usuária, 19/10/2026 |
| SUP-S2-08 | O funil é achado pelo e-mail exato em minúsculas (busca pelo índice); lead que digitou o e-mail com maiúscula no formulário (4 de 1.071) não é achado e a reunião vai para a SE. | confirmada | Usuária, 19/10/2026 |
| SUP-S2-09 | Na agenda própria, o card de reuniões agendadas passa a excluir os tipos de reunião de teste, como a taxa MQL → RA já fazia. | confirmada | Usuária, 19/10/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S2-01 | A taxa MQL → RA também passa a contar as reuniões do Calendly? | respondida | Sim, usa as mesmas do card Reuniões agendadas (usuária, 19/10/2026) |
| PER-S2-02 | Reunião do Calendly sem lead com o mesmo e-mail: onde entra? | respondida | Conta como SE (usuária, 19/10/2026) |
| PER-S2-04 | Quando a agenda própria for ligada, como as fontes convivem? | respondida | Soma as duas, a mesma pessoa no período conta uma vez (usuária, 19/10/2026) |


## Cenários

### Happy Path
1. A Visão geral pede `/api/cpl` (período e anterior) e `/api/agenda/taxas`, como hoje.
2. Os dois endpoints passam a pegar as reuniões agendadas de uma função só, `reunioesAgendadas(DB, de, ate)`:
   - agenda própria: reuniões comerciais, sem teste e sem tipo de teste, criadas no período;
   - Calendly: consultorias `ativa`, não marcadas pela equipe, com `agendou_em` no período;
   - consultoria do Calendly cujo e-mail já está numa reunião da agenda própria do período fica de fora (a pessoa conta uma vez);
   - funil da consultoria: o do lead com o mesmo e-mail (o mais recente até a hora do agendamento; sem nenhum antes, o mais recente); sem lead, `sessao-estrategica`.
3. `/api/cpl` passa essa lista para `custoPorReuniao` (Reuniões agendadas e Custo por reunião agendada, total e por funil).
4. `/api/agenda/taxas` usa a mesma contagem por funil para `agendadas` (MQL → RA); ocorridas, realizadas e faltas seguem da agenda própria.
5. O dash não muda: os cards já mostram `agendadas` e `custo_agendada`, e o carimbo, a diferença e o balão já comparam com o período anterior.

### Edge Cases
- Mesma pessoa com duas consultorias ativas no Calendly no período: contam as duas (a regra de contar uma vez é só entre Calendly e agenda própria).
- Remarcação: conta a consultoria nova (ativa), no dia da remarcação; a original está cancelada.
- Lead em vários funis: vale o lead mais recente até o agendamento.
- Mais de 50 e-mails no período: a busca dos leads vai em lotes de 50 (`IN (?, …)` explícito, que usa o índice `idx_event_log_lead_email`).
- Lead de teste interno ou bloqueado (`is_junk = 1`) não empresta o funil.

### Cenário de Erro
- Tabela do Calendly ausente ou com erro: a função devolve só a agenda própria e registra o erro no log; os cards continuam.
- Agenda própria com erro: segue o comportamento de hoje (`/api/cpl` deixa `reunioes` null e os cards mostram "—").

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S2-06 | automática | `tests/reunioes-calendly.test.js` | `/api/cpl` com 3 consultorias do Calendly no período e agenda vazia devolve `reunioes.total.agendadas` = 3 |
| CA-S2-07 | automática | `tests/reunioes-calendly.test.js` | 2 do lead + 1 marcada pela equipe → `agendadas` = 2 |
| CA-S2-08 | automática | `tests/reunioes-calendly.test.js` | uma cancelada + uma remarcada (original cancelada, nova ativa) → `agendadas` = 1 |
| CA-S2-09 | automática | `tests/reunioes-calendly.test.js` | consultoria agendada em 11/10 para 14/10: 0 no período 12–18/10 e 1 no período 05–11/10 |
| CA-S2-10 | automática | `tests/reunioes-calendly.test.js` | e-mail de lead do workshop → conta em `por_funil.workshop.agendadas`, não na SE |
| CA-S2-11 | automática | `tests/reunioes-calendly.test.js` | e-mail sem lead → conta em `por_funil['sessao-estrategica'].agendadas` |
| CA-S2-12 | automática | `tests/reunioes-calendly.test.js` | lead "ana@gmail.com" no workshop e consultoria " Ana@Gmail.com" (gravada normalizada pela coleta) → conta no workshop |
| CA-S2-13 | automática | `tests/reunioes-calendly.test.js` | mesma pessoa no Calendly e na agenda própria + outra só na agenda → `agendadas` = 2 |
| CA-S2-14 | automática | `tests/reunioes-calendly.test.js` | R$ 1.500 na SE e 10 consultorias na SE → `por_funil['sessao-estrategica'].custo_agendada` = 150 |
| CA-S2-15 | automática | `tests/reunioes-calendly.test.js` | 5 consultorias na SE: a leitura da agenda das taxas devolve `agendadas` 5 na SE, e com 11 MQLs `mql_ra` = 5/11 (45,5%) e os números da nota (5 e 11) |
| CA-S2-16 | automática | `tests/reunioes-calendly.test.js` | 4 consultorias no período e 2 no anterior: `/api/cpl` devolve 4 e 2, e a conta do carimbo (`(4−2)/2`) dá 100% e a diferença +2 |
| CA-S2-17 | manual | roteiro abaixo | o card bate com a contagem no Calendly |
| CA-S2-18 | automática | `tests/reunioes-calendly.test.js` | sem a tabela do Calendly, `/api/cpl` responde 200 e `reunioes.total.agendadas` conta só a agenda própria |

### Roteiro manual — CA-S2-17
1. Abrir o dash no ar, Visão geral, "Últimos 7 dias", sem filtro de funil.
2. Anotar "Reuniões agendadas".
3. No Calendly, em Scheduled Events, contar as "Consultoria Individual" agendadas nos mesmos 7 dias (pela data em que a pessoa agendou), sem as canceladas e sem as que a equipe marcou em nome do lead.
4. Os dois números devem bater (lembrando que as do dia de hoje só entram depois da coleta das 05h).

## Banco de Dados

Sem mudança de esquema. Lê `calendly_consultorias` (S2-01), `agenda_reunioes`, `agenda_tipos` e `event_log`/`sessions` (funil do lead, pelo índice `idx_event_log_lead_email`).

## Arquivos

- **Criar:** `functions/api/_reunioes-agendadas.js` — `reunioesAgendadas(DB, de, ate)`: junta agenda própria e Calendly, tira duplicata entre as fontes, acha o funil pelo e-mail (lotes de 50) e devolve `[{ funil }]`; `funilDaReuniao(...)` puro, para a regra do lead mais recente
- **Modificar:** `functions/api/cpl.js` — a consulta das agendadas troca por `reunioesAgendadas`
- **Modificar:** `functions/api/agenda/taxas.js` — `lerAgenda` usa `reunioesAgendadas` para `agendadas` por funil (e passa a ser exportada para o teste); ocorridas/realizadas/faltas como estão
- **Criar:** `tests/reunioes-calendly.test.js` — os testes da tabela Prova, com SQLite real (migrations 0047, 0059, 0063 e as tabelas mínimas do CPL) chamando `/api/cpl` e `lerAgenda`

Reuso: `custoPorReuniao` e `taxasPorFunil` (`functions/api/_agenda-funil.js`) sem mudança; adaptador `d1` e banco base de `tests/_fluxos-banco.js`; lote de 50 com `IN (?, …)` como em `functions/api/_feedback-marketing-greenn.js`.

## Checklist

- [x] `_reunioes-agendadas.js` com a junção, a duplicata, o funil por e-mail e o erro do Calendly isolado
- [x] `cpl.js` usando a função
- [x] `agenda/taxas.js` usando a função e exportando `lerAgenda`
- [x] Testes CA-S2-06 a CA-S2-16 e CA-S2-18
- [x] Suíte inteira passando
