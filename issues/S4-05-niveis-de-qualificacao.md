# S4-05: Níveis de qualificação da Sessão Estratégica

**Tipo:** Implementação
**Página:** Visão geral — níveis de qualificação
**Spec:** `spec-visao-geral-reuniao-semanal.md`

## Descrição

Bloco na Visão geral que separa os leads novos da Sessão Estratégica em Abaixo de R$ 20 mil,
Acima de R$ 20 mil e Não informado (quantidade e %), com a mesma leitura de faturamento do
MQL. Workshop e outros funis ficam de fora; com o filtro em outro funil, o bloco some.

## Pronto quando

Na Visão geral da semana passada, o bloco mostra as três faixas dos leads novos de SE e a
soma bate com o total de leads novos de SE.

## Critérios de aceite

- **CA-S4-11** (automática) — Leads novos de SE separados por faixa de faturamento. Dado no período 5 leads novos de SE (2 com "até R$ 20 mil", 2 com "R$ 50 mil" e 1 sem faturamento) e 3 leads novos do workshop, quando a Visão geral abre, então o bloco mostra Abaixo de R$ 20 mil 2 (40%), Acima de R$ 20 mil 2 (40%), Não informado 1 (20%), e os leads do workshop não entram.
- **CA-S4-12** (automática) — Faixa usa a mesma leitura de faturamento do MQL. Dado cards com faturamento escrito de formas diferentes ("menos de 20 mil", "20k", "R$ 35.000", "entre 50 e 100 mil"), quando o bloco classifica as faixas, então cada card cai na mesma faixa que a régua do MQL usa hoje (abaixo para os dois primeiros, acima para os dois últimos).
- **CA-S4-13** (automática) — Bloco some com filtro de funil que não é SE. Dado o filtro do topo no funil workshop, quando a Visão geral abre, então o bloco de níveis de qualificação não aparece.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S4-04 | Níveis de qualificação mostram três faixas, incluindo "Não informado", para a soma bater com o total de leads novos de SE. | confirmada | Usuária, 26/10/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S4-02 | Níveis de qualificação valem para quais leads? | respondida | Só leads de Sessão Estratégica; workshop não informa faturamento (usuária, 26/10/2026) |
