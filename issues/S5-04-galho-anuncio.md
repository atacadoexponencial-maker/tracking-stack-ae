# S5-04: Galho do anúncio (coleta por anúncio no Meta)

**Tipo:** Implementação
**Página:** Árvore
**Spec:** `spec-arvore-metricas.md`

## Descrição

Passar a coletar do Meta, por anúncio, os cliques no link e as visualizações de 3 s e até o fim, e mostrar na árvore o galho do anúncio do funil: investimento, impressões, CPM, hook rate, hold rate, CTR do link, CPC, CPL e custo por MQL.

## Pronto quando

A usuária abre a árvore do SE ou do WO PAGO e vê o galho do anúncio preenchido com os números reais do período; no AQUISIÇÃO aparece "funil sem mídia paga".

## Critérios de aceite

- **CA-S5-19** (automática) — CPM, CTR do link e CPC são calculados das campanhas do funil. Dado campanhas do SE com R$ 1.000 investidos, 50.000 impressões e 500 cliques no link no período, quando a árvore é montada, então CPM = R$ 20,00, CTR do link = 1,0% e CPC = R$ 2,00.
- **CA-S5-20** (automática) — Hook e hold rate aparecem para os anúncios em vídeo. Dado anúncios do funil com 50.000 impressões, 10.000 visualizações de 3 s e 2.000 visualizações até o fim, quando a árvore é montada, então hook rate = 20% e hold rate = 20%.
- **CA-S5-21** (automática) — Sem vídeo, hook e hold mostram "sem vídeo". Dado um funil cujos anúncios no período são só imagem, quando a árvore é montada, então hook rate e hold rate mostram "sem vídeo", nunca 0%.
- **CA-S5-22** (automática) — CPL e custo por MQL usam os leads e MQLs do tronco. Dado R$ 1.000 investidos, 40 leads e 20 MQLs na coorte, quando a árvore é montada, então CPL = R$ 25,00 e custo por MQL = R$ 50,00.
- **CA-S5-23** (automática) — Funil sem mídia paga não mostra o galho do anúncio. Dado o funil AQUISIÇÃO selecionado, quando a árvore é montada, então no lugar do galho do anúncio aparece "funil sem mídia paga".

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S5-06 | Hook rate, hold rate e cliques no link passam a ser coletados do Meta por anúncio (hoje o dash guarda só investimento, impressões e cliques totais por campanha) | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-07 | As campanhas de cada funil são as que o dash já atribui ao funil (regra automática + classificação manual da aba Meta Ads; WO PAGO pelo trecho "workshop-pago") | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S5-05 | Até onde abre a parte de anúncio e página? | respondida | Número do funil na árvore + lista por campanha/anúncio ao clicar (Marcelle, 29/10/2026) |
