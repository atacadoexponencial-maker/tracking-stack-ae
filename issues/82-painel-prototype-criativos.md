# 82: Protótipo — Criativos

**Tipo:** Protótipo
**Página:** Criativos

## Descrição

Tabela de criativos Meta Ads: miniatura, nome, investimento, receita, pedidos, alcance,
frequência, cliques, sessões, CTR. Dados mockados.

## Resultado

- [x] Implementado em `painel/src/pages/dash.astro` + `painel/src/styles/dash.css` + `painel/public/dash.js` (app único com navegação por seção — mesmo padrão do dash do tracking)
- [x] Identidade AE: Satoshi (copiada de public/fonts), fundo #1e1e1e, série âmbar única; deltas ▲▼ com seta+cor (invertido p/ métricas de custo)
- [x] Dados mockados com o MESMO contrato das APIs reais (issues 94–100 trocam USE_MOCK)
- [x] Verificado em produção via /c/<slug> (screenshots Home, Receita c/ gráfico+tooltip, Funil; demais seções conferidas via DOM)
