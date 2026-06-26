# 04: Dashboard — bloco "Leads por funil"

**Tipo:** Implementação
**Página:** `public/dash/index.html`

## Descrição

Renderizar um bloco "Leads por funil" no topo da aba Leads (cards ou mini-tabela), uma linha por funil com a contagem do período, a partir de `data.funnelCounts` (issue 02). Thin client: só exibe o que o backend mandou.

**Depende da issue 02** (`funnelCounts` no backend).

## Critérios de aceite

- Bloco no topo da aba Leads lista `funnel → count` para o período, ordenado por contagem desc.
- Bucket `''` aparece rotulado como **"(sem funil)"**.
- Reflete o período selecionado (recarrega junto com o resto).
- Estado vazio/ausente de `funnelCounts` não quebra o dash (degrada para bloco vazio).
- Sem regra de negócio no frontend (só exibição).
