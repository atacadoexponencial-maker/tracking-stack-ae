# S11-01: Tráfego real na aba Imersão 2027

**Tipo:** Avulsa
**Spec:** nenhuma (issue avulsa, combinada na triagem)
**Depende de:** nenhuma
**Risco:** não

## Descrição

Com a primeira venda real, a aba Imersão 2027 passou a usar só dados reais, mas o endpoint
`/api/imersao` devolvia o tráfego fixo como "sem dado". Esta issue liga o investimento, as
impressões e os cliques do Meta (tabela `ad_spend`, campanhas com `vendas-imersao` no nome)
e as visitas da página `/imersao-planejamento-atacado` (tabela `sessions`), por dia.

## Pronto quando

A subaba "Tráfego e página" mostra investimento, CAC, CPM, CTR e connect rate reais, e o
Resumo mostra as visitas e a conversão de cada dia.

## Critérios de aceite

- **CA-S11-01** (automática) — Investimento das campanhas da Imersão. Dado gasto do Meta em campanhas com `vendas-imersao` no nome e em outras campanhas, quando a aba é aberta com venda real, então investimento, impressões e cliques somam só as campanhas da Imersão.
- **CA-S11-02** (automática) — Visitas da página por dia. Dado sessões na página da Imersão (com e sem querystring ou barra final) e em outras páginas, quando a aba é aberta com venda real, então as visualizações e as visitas por dia contam só a página da Imersão, a partir do primeiro dia de venda, sem bots.
- **CA-S11-03** (automática) — Sem dado do Meta, sem número inventado. Dado nenhum gasto de campanha da Imersão, quando a aba é aberta com venda real, então o investimento continua vazio ("—").

## Suposições

| Suposição | Status |
|---|---|
| As campanhas de venda da Imersão têm `vendas-imersao` no nome (hoje `ae_vendas-imersao-12-12_publico-frio` e `_publico-quente`). | confirmada (lida no banco em 23/11/2026) |

## Perguntas em aberto

Nenhuma.

## Arquivos

- **Modificar:** `functions/api/imersao/index.js` — com venda real, lê o gasto do Meta (ad_spend) e as visitas da página (sessions).
- **Modificar:** `functions/api/_imersao.js` — `trafegoDasLinhas` e `visitasDasLinhas` (puras).
- **Modificar:** `functions/api/conversion.js` — exporta `normalizePath`, reaproveitada.
- **Criar:** `tests/imersao-trafego.test.js`

## Fora desta issue

- Inícios de checkout (a Zouti não envia) e ranking de criativos (a coleta do Meta é por campanha, não por anúncio).
