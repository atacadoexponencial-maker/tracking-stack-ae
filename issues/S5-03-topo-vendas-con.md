# S5-03: Topo da árvore com meta e vendas do 🎯 CON

**Tipo:** Implementação
**Página:** Árvore
**Spec:** `spec-arvore-metricas.md`

## Descrição

Ler os cards de fechamento mensal 🎯 CON do ClickUp e montar o topo da árvore: meta de vendas proporcional ao período, taxa histórica RR → Compra e ticket dos últimos 6 meses fechados, vendas e arrecadado consolidados e vendas esperadas a partir das reuniões realizadas da coorte.

## Pronto quando

A usuária abre a árvore de um funil e vê no topo a meta, as vendas esperadas (marcadas como estimativa), o consolidado do CON e de quais meses saiu a taxa, com os números batendo com os cards do ClickUp.

## Critérios de aceite

- **CA-S5-10** (automática) — A meta de vendas vem do #META do card CON do mês. Dado o card "FUNIL SE" de outubro/2026 com #META = 6, quando a árvore do SE é montada para outubro inteiro, então o topo mostra meta de 6 vendas.
- **CA-S5-11** (automática) — Período menor que o mês usa a meta proporcional aos dias. Dado #META = 6 em outubro (31 dias) e o filtro de 01/10 a 15/10, quando a árvore é montada, então a meta do período é 6 × 15 ÷ 31 = 2,9 vendas.
- **CA-S5-12** (automática) — Período que cruza meses soma as metas proporcionais de cada mês. Dado #META = 6 em setembro e 9 em outubro, filtro de 16/09 a 15/10, quando a árvore é montada, então a meta do período é 6 × 15 ÷ 30 + 9 × 15 ÷ 31.
- **CA-S5-13** (automática) — Mês sem #META aparece como "sem meta". Dado um mês cujo card CON não tem #META preenchido (ou não existe), quando a árvore é montada para esse mês, então o topo mostra "sem meta" e a conta de trás pra frente (módulo 6) não aparece, sem erro.
- **CA-S5-14** (automática) — A taxa RR → Compra usa os últimos 6 meses fechados. Dado os cards CON do SE de abril a setembro/2026 com, somados, 60 RR e 18 compras, e o mês corrente outubro, quando a árvore é montada, então a taxa RR → Compra é 30% e a tela diz "abr–set/2026".
- **CA-S5-15** (automática) — Ticket médio histórico é arrecadado ÷ compras dos 6 meses. Dado os mesmos 6 meses com R$ 180.000 arrecadados e 18 compras, quando a árvore é montada, então o ticket médio mostrado é R$ 10.000.
- **CA-S5-16** (automática) — Menos de 6 meses de histórico usa os que existem e avisa. Dado só 2 meses fechados com card CON no funil, quando a árvore é montada, então a taxa e o ticket usam esses 2 meses e a tela avisa "base de 2 meses".
- **CA-S5-17** (automática) — Vendas esperadas = reuniões realizadas × taxa histórica. Dado 10 comparecimentos na coorte e taxa histórica RR → Compra de 30%, quando a árvore é montada, então o topo mostra 3 vendas esperadas, marcadas como estimativa.
- **CA-S5-36** (automática) — Dois cards CON do mesmo funil e mês somam. Dado dois cards "FUNIL AQUISIÇÃO" de outubro/2026, um com 3 compras e #META 4, outro com 2 compras e #META 1, quando a árvore do AQUISIÇÃO é montada para outubro, então o topo usa 5 compras e meta de 5 vendas (a soma dos dois cards).
- **CA-S5-18** (manual) — Os números da árvore batem com os do card CON. Dado o mês de setembro/2026 inteiro no filtro, quando a dona compara a árvore do SE com o card "FUNIL SE" de setembro no ClickUp, então meta, compras e arrecadado são os mesmos, e as diferenças de Leads/MQL/RA/RR são explicadas pela coorte.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S5-01 | O card CON de cada funil é achado pelo 🔻 Funil + 📅 Mês + 🗓️ Ano com 🧠 % MARKETING = CONSOLIDADO; SE = opção SESSÃO ESTRATÉGICA e nome "FUNIL SE", AQUISIÇÃO = "FUNIL AQUISIÇÃO", WO PAGO = "FUNIL WO" | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-02 | Se houver dois cards CON do mesmo funil no mesmo mês, vale o atualizado por último | invalidada | Os números dos cards duplicados SOMAM (Marcelle, 29/10/2026); ver CA-S5-36 |
| SUP-S5-03 | "Mês fechado" = mês anterior ao corrente; o mês corrente nunca entra na taxa histórica | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-04 | SQL aparece no tronco como informação (Compareceu → SQL), mas a venda esperada sai de RR × %RR→Compra, não do SQL | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-09 | Ler os cards CON uma vez por dia basta (são preenchidos à mão, não em tempo real) | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S5-01 | De onde sai a meta de vendas? | respondida | #META do card 🎯 CON do mês; sem cadastro novo no dash (Marcelle, 29/10/2026) |
| PER-S5-02 | Como contar a venda, dado que "contrato assinado" é marcado em lote e sem valor? | respondida | Tronco medido para no SQL; venda vem dos cards 🎯 CON (Marcelle, 29/10/2026) |
| PER-S5-07 | Qual elo liga o tronco às vendas? | respondida | RR → Compra (Marcelle, 29/10/2026) |
| PER-S5-08 | Quantos meses de histórico? | respondida | Últimos 6 meses fechados (Marcelle, 29/10/2026) |
