# S12-01: Investido até agora em destaque e connect rate só com visita de anúncio

**Tipo:** Avulsa
**Spec:** nenhuma (issue avulsa, combinada na triagem)
**Depende de:** nenhuma
**Risco:** não

## Descrição

Na subaba "Tráfego e página" da Imersão 2027, o total investido aparecia só em letra pequena
ao lado do título. Ele passa a ter um card em destaque, com o investido do dia na nota. O
connect rate dividia todas as visitas da página (inclusive as orgânicas) pelos cliques do
anúncio e passava de 100%; agora conta só as visitas que chegaram com UTM de campanha da
Imersão.

## Pronto quando

O card "Investido até agora" aparece primeiro no bloco, com o valor do dia, e o connect rate
deixa de contar visita orgânica.

## Critérios de aceite

- **CA-S12-01** (automática) — Investido de hoje. Dado gasto das campanhas da Imersão em dias diferentes, quando a aba é aberta com venda real, então a resposta traz o total e, à parte, só o gasto do dia de hoje (zero quando hoje não teve gasto).
- **CA-S12-02** (automática) — Card em destaque. Dado um investimento total e um do dia, quando a subaba "Tráfego e página" é desenhada, então o primeiro card é "Investido até agora", em destaque, com o total no valor e o do dia na nota.
- **CA-S12-03** (automática) — Connect rate com visita de anúncio. Dado visitas na página com e sem UTM de campanha da Imersão, quando a aba é aberta com venda real, então o connect rate divide só as visitas com UTM da campanha da Imersão pelos cliques.

## Suposições

| Suposição | Status |
|---|---|
| Visita de anúncio é a sessão com `utm_campaign` contendo `vendas-imersao`, o mesmo trecho do gasto. | confirmada (lida no banco em 27/11/2026: 426 das 497 visitas da página desde 16/11 têm essa UTM) |

## Perguntas em aberto

Nenhuma.

## Arquivos

- **Modificar:** `functions/api/imersao/index.js` — lê a data do gasto e conta as visitas com UTM de campanha da Imersão.
- **Modificar:** `functions/api/_imersao.js` — `investimento_hoje` em `trafegoDasLinhas`, `visitas_anuncio` no connect rate.
- **Modificar:** `public/dash/imersao.js` — card "Investido até agora" em destaque.
- **Criar:** `tests/imersao-investido.test.js`
