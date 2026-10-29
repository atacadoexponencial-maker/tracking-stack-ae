# S5-07: Lista por campanha e anúncio + aprovação da aba

**Tipo:** Implementação
**Página:** Árvore
**Spec:** `spec-arvore-metricas.md`

## Descrição

Ao clicar no galho do anúncio ou da página, abrir os mesmos números quebrados por campanha e por anúncio, ordenáveis, com uma linha para leads sem anúncio identificado. Fecha a série com a aprovação da aba no ar.

## Pronto quando

A usuária clica no galho do anúncio, vê a lista por campanha e anúncio cujos totais batem com a árvore, ordena por qualquer coluna, volta à árvore e aprova a aba no ar.

## Critérios de aceite

- **CA-S5-31** (automática) — Clicar no galho do anúncio abre a lista por campanha e anúncio. Dado a árvore do SE com 2 campanhas e 5 anúncios no período, quando a pessoa clica no galho do anúncio, então aparece a lista com as 2 campanhas e os 5 anúncios, cada um com seus números.
- **CA-S5-32** (automática) — A soma da lista bate com o número da árvore. Dado a lista aberta, quando se somam investimento, impressões, cliques no link e leads dos anúncios, então os totais são iguais aos do galho na árvore.
- **CA-S5-33** (automática) — A lista ordena por coluna. Dado a lista aberta, quando a pessoa clica no título "CPL", então os anúncios ficam do menor para o maior CPL, e um novo clique inverte.
- **CA-S5-34** (automática) — Lead sem anúncio identificado aparece numa linha própria. Dado leads do funil sem UTM de anúncio, quando a lista é aberta, então eles aparecem na linha "sem anúncio identificado", para a soma continuar batendo.
- **CA-S5-35** (manual) — A dona aprova o desenho da árvore no ar. Dado a aba publicada, quando a dona abre a árvore do SE no período da última semana, então ela aprova a leitura (ordem dos níveis, onde ficam "precisa/tem", destaques) no próprio dash.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S5-07 | As campanhas de cada funil são as que o dash já atribui ao funil (regra automática + classificação manual da aba Meta Ads; WO PAGO pelo trecho "workshop-pago") | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S5-05 | Até onde abre a parte de anúncio e página? | respondida | Número do funil na árvore + lista por campanha/anúncio ao clicar (Marcelle, 29/10/2026) |
