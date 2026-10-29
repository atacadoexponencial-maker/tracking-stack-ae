# S5-06: Conta de trás pra frente

**Tipo:** Implementação
**Página:** Árvore
**Spec:** `spec-arvore-metricas.md`

## Descrição

A partir da meta de vendas do período, calcular quanto cada etapa do tronco e o investimento precisam entregar e mostrar, ao lado, o que está entregando, com a diferença e o maior gargalo destacado.

## Pronto quando

A usuária abre a árvore de um funil com meta e vê "precisa · tem · faltam" em cada etapa e no investimento, com a etapa mais longe do necessário destacada.

## Critérios de aceite

- **CA-S5-27** (automática) — O necessário é calculado de trás pra frente a partir da meta. Dado meta de 6 vendas, RR → Compra 30%, Agendou→Compareceu 50%, MQL→Agendou 50%, Lead→MQL 50% e CPL R$ 25, quando a árvore é montada, então precisa de 20 RR, 40 agendamentos, 80 MQLs, 160 leads e R$ 4.000 de investimento.
- **CA-S5-28** (automática) — Cada etapa mostra o necessário, o realizado e a diferença. Dado que a etapa MQL precisa de 80 e a coorte tem 60, quando a árvore é montada, então a etapa MQL mostra "precisa 80 · tem 60 · faltam 20".
- **CA-S5-29** (automática) — A etapa mais longe do necessário fica destacada. Dado etapas com realizado/necessário de 90%, 75% e 50%, quando a árvore é montada, então só a etapa de 50% aparece destacada como gargalo.
- **CA-S5-30** (automática) — Taxa sem dado interrompe a conta naquele nível. Dado a taxa Agendou→Compareceu "sem dado", quando a árvore é montada, então o necessário aparece até RR e, dali para baixo, "sem base para calcular".

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S5-05 | Na conta de trás pra frente, as taxas do tronco são as da coorte do período; com coorte jovem (aviso do CA-S5-09) elas tendem a sair baixas | invalidada | Com as taxas da própria coorte, tem ÷ precisa sai igual em todas as etapas e não há gargalo. O plano usa as taxas históricas dos 6 meses fechados do 🎯 CON (Lead→MQL, MQL→RA, RA→RR, RR→Compra); o "tem" segue a coorte (Marcelle, 29/10/2026) |
| SUP-S5-11 | O CPL do plano (para o investimento necessário) é o histórico dos mesmos 6 meses do 🎯 CON: soma de #INVESTIMENTO ÷ soma de #LEADS | aberta | — |

## Perguntas em aberto

Nenhuma.
