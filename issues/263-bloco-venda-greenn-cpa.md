# 263: Montar o bloco do tipo Venda na Greenn com CPA

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Montar o bloco do tipo "Venda na Greenn" com investido, compras realizadas, quebra por origem e CPA, e avisar quando não há funil de venda cadastrado.

## Comportamentos cobertos

- CPA = investido do funil ÷ total de compras, em reais com duas casas
- Investimento sem venda: compras 0 e CPA vazio
- Venda sem investimento: CPA 0 marcado "sem investimento no período"
- Nenhum funil de venda cadastrado: aviso "Há N vendas pagas na Greenn no período e nenhum funil de venda cadastrado."

## Cenários

### Happy Path
1. Para o funil ativo do tipo `venda_greenn` (cadastro inicial: WO PAGO), `montarBlocoVenda` recebe o funil, o investimento do bloco (issue 256, campanhas só pelo trecho) e as compras: total (issue 261) e quebra por origem (issue 262).
2. Devolve `nome`, `tipo`, `posicao`, `investido`, `sem_investimento`, `campanhas`, `metricas: { compras_realizadas, compras_por_origem: { trafego_pago, disparo, outra_origem, sem_rastreio } }`, `custo_tipo: 'CPA'`, `custo_por_resultado` e `avisos`.
3. CPA = investido ÷ compras realizadas (todas as origens), em centavos, duas casas (`calcularCusto`, o mesmo do CPL). Ex.: R$ 60,00 ÷ 3 = 20,00.

### Edge Cases
- **Investimento sem venda:** `compras_realizadas: 0`, origens 0, `custo_por_resultado: null`.
- **Venda sem investimento** (ex.: só disparo): compras contadas, `custo_por_resultado: 0`, `sem_investimento: true`, `avisos: ['sem investimento no período']`.
- **Dia sem nada:** investido 0, compras 0, CPA null, sem aviso.
- **Nenhum funil ativo `venda_greenn`:** as vendas não aparecem em bloco; se houver N > 0 vendas pagas, aviso geral "Há N vendas pagas na Greenn no período e nenhum funil de venda cadastrado." (decisão própria: com 0 vendas não há o que avisar — nada some).
- **Compra atribuída pelo Meta:** não é lida em lugar nenhum.

### Cenário de Erro
- Nenhum específico: leituras da Greenn que falham caem na falha inesperada (issue 265).

## Arquivos

- **Modificar:** `functions/api/_feedback-marketing-blocos.js` — `montarBlocoVenda`, `avisoVendasSemFunilDeVenda`.
- **Modificar:** `tests/feedback-marketing-blocos.test.js`
- **Modificar:** `functions/api/feedback-marketing.js` — bloco de venda por `montarBlocoVenda`, sem o modelo do protótipo; aviso de vendas sem funil de venda.

## Reuso (pesquisado na base)

- `baseDoBloco`, `calcularCusto`, `MARCA_SEM_INVESTIMENTO` (`_feedback-marketing-blocos.js`); `contarComprasDoPeriodo`/`contarPorOrigem` (`_feedback-marketing-greenn.js`).

## Checklist

- [x] CPA em centavos, duas casas, sobre todas as compras
- [x] 0 compras → CPA null; compras sem investimento → CPA 0 com a marca
- [x] Aviso de vendas sem funil de venda
- [x] Endpoint usa `montarBlocoVenda`; nada do protótipo no bloco de venda
- [x] Testes
- [x] `npm test` passando

## Ajustes pós-revisão

- Mesma correção da issue 259 no CPA: a marca passa a usar `investimento.sem_investimento && compras > 0`, e não `custo === 0` (R$ 0,01 em 3 compras arredondava para 0,00 e era marcado). Teste com R$ 0,01 em `tests/feedback-marketing-blocos.test.js`.
