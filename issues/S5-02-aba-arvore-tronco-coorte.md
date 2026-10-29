# S5-02: Aba Árvore com o tronco por coorte

**Tipo:** Implementação
**Página:** Árvore
**Spec:** `spec-arvore-metricas.md`

## Descrição

Ligar a aba Árvore ao menu, ao filtro de datas e ao seletor de funil, com o tronco de cada funil (SE, AQUISIÇÃO, WO PAGO) contado por coorte: leads que entraram no período e até onde chegaram até hoje, com volume e taxa de passagem entre etapas.

## Pronto quando

A usuária abre "Árvore" no dash, escolhe o funil e o período e vê o tronco real (Lead → MQL → Agendou → Compareceu → SQL; no WO PAGO, Comprou o workshop → Entrou no grupo → Agendou → Compareceu → SQL), com as taxas e o aviso de coorte jovem quando couber.

## Critérios de aceite

- **CA-S5-01** (automática) — A aba Árvore aparece no menu e abre no funil SE. Dado que a pessoa está logada no dash, quando clica em "Árvore" no menu, então a tela mostra a árvore do funil SE para o período do filtro de datas.
- **CA-S5-02** (automática) — Trocar o funil refaz a árvore. Dado a aba Árvore aberta no funil SE, quando a pessoa escolhe WO PAGO no seletor, então todos os números da árvore passam a ser do WO PAGO, e o tronco mostra as etapas do WO PAGO (módulo 2).
- **CA-S5-03** (automática) — A árvore segue o filtro de datas. Dado a aba Árvore aberta, quando a pessoa muda o filtro de datas, então todos os números da árvore passam a ser do novo período.
- **CA-S5-04** (automática) — Cada etapa conta só os leads que entraram no período. Dado 10 leads SE criados no período e 3 criados antes dele, todos com reunião realizada dentro do período, quando a árvore do SE é montada, então a etapa Lead mostra 10 e a etapa Compareceu conta no máximo esses 10 (os 3 antigos ficam fora).
- **CA-S5-05** (automática) — A etapa conta o que o lead já atingiu até hoje. Dado um lead criado no período cuja reunião aconteceu depois do fim do período, quando a árvore do período é montada, então esse lead conta em Agendou e em Compareceu.
- **CA-S5-06** (automática) — A taxa de passagem é etapa ÷ etapa anterior. Dado 40 leads, 20 MQLs, 10 agendados e 6 comparecimentos na coorte, quando a árvore é montada, então as taxas mostradas são Lead→MQL 50%, MQL→Agendou 50%, Agendou→Compareceu 60%.
- **CA-S5-07** (automática) — Etapa anterior zerada não mostra taxa. Dado uma coorte sem nenhum agendamento, quando a árvore é montada, então a taxa Agendou→Compareceu aparece como "sem dado", nunca 0% nem erro.
- **CA-S5-08** (automática) — O tronco do WO PAGO começa na compra do workshop. Dado o funil WO PAGO selecionado, quando a árvore é montada, então a primeira etapa é "Comprou o workshop" (compras pagas na Greenn no período) e a segunda é "Entrou no grupo".
- **CA-S5-09** (automática) — Período recente avisa que a coorte não amadureceu. Dado um período que termina há menos de 14 dias, quando a árvore é montada, então aparece o aviso de que parte dos leads ainda pode avançar nas etapas.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S5-04 | SQL aparece no tronco como informação (Compareceu → SQL), mas a venda esperada sai de RR × %RR→Compra, não do SQL | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-10 | O aviso de coorte jovem usa 14 dias | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S5-03 | Quais funis entram? | respondida | SE, AQUISIÇÃO e WO PAGO; LIVE saiu (Marcelle, 29/10/2026) |
| PER-S5-04 | Taxas por coorte ou pelo mesmo período? | respondida | Por coorte (Marcelle, 29/10/2026) |
| PER-S5-06 | Qual período a aba mostra? | respondida | O filtro de datas do dash; meta proporcional aos dias (Marcelle, 29/10/2026) |
