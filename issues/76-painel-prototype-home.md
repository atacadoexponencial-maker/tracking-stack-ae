# 76: Protótipo — Home

**Tipo:** Protótipo
**Página:** Home

## Descrição

KPIs gerais (Receita, Pedidos, Ticket, Tx Conversão, Sessões, Novos usuários,
Investimento, ROAS, CPA, CPS) + tabelas Principais Fontes de Receita e Produtos.
Dados mockados, deltas ▲▼ incluídos.

## Resultado

- [x] Implementado em `painel/src/pages/dash.astro` + `painel/src/styles/dash.css` + `painel/public/dash.js` (app único com navegação por seção — mesmo padrão do dash do tracking)
- [x] Identidade AE: Satoshi (copiada de public/fonts), fundo #1e1e1e, série âmbar única; deltas ▲▼ com seta+cor (invertido p/ métricas de custo)
- [x] Dados mockados com o MESMO contrato das APIs reais (issues 94–100 trocam USE_MOCK)
- [x] Verificado em produção via /c/<slug> (screenshots Home, Receita c/ gráfico+tooltip, Funil; demais seções conferidas via DOM)
