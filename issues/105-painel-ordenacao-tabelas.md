# 105: Ordenação das tabelas do dashboard

**Tipo:** Implementação
**Página:** Todas (dashboard do cliente)

## Descrição

Clicar no cabeçalho de qualquer coluna ordena a tabela por aquela coluna (asc/desc,
com indicador ↑↓), como no Looker Studio. Vale para todas as tabelas do dashboard
(Home, Conversão, Produtos, Metas, Criativos).

## Arquivos

- **Modificar:** `painel/public/dash.js` — função `tabela()` ganha ordenação por coluna (campo por coluna, delegação de clique, nulls por último)
- **Modificar:** `painel/src/styles/dash.css` — cursor/hover nos cabeçalhos ordenáveis

## Resultado

- [x] `tabela()` reescrita: clique no cabeçalho ordena asc/desc com indicador ↑↓, nulos por último, delegação de clique (sobrevive a re-renders)
- [x] Todas as tabelas do dashboard ganharam `campo` por coluna (Home, Conversão, Produtos, Metas, Criativos)
- [x] Verificado em produção: desc → Organic Social no topo; asc → Paid Search (R$ 0); setas alternando
