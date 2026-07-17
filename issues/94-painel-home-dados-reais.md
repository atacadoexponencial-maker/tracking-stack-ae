# 94: Home com dados reais

**Tipo:** Implementação
**Página:** Home

## Descrição

API de consulta que agrega KPIs, fontes de receita e produtos do D1 pelo período
selecionado, com deltas vs período anterior, ligada ao protótipo da Home.

## Resultado

- [x] Endpoint em `painel/functions/api/painel/` (home, funil, receita, conversao, produtos, metas, criativos + _dados.js compartilhado) — agrega o D1 pelo período com deltas vs período anterior; toda matemática no backend
- [x] Slug validado em toda chamada (404 se inválido); fonte sem conta some da resposta; `atualizado_ate` em todas as respostas
- [x] dash.js ligado às APIs (mocks removidos); verificado em produção com dados reais da UP Semijoias (Home R$ 100,8k/30d, criativos com thumbnail do Meta, metas 68,4% atingimento)
