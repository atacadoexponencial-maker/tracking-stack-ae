# 02: Backend — contagem de leads por funil (`funnelCounts`)

**Tipo:** Implementação
**Página:** — (backend: `functions/api/leads.js`)

## Descrição

Estender a resposta de `/api/leads` com `funnelCounts`: `COUNT(*)` de eventos `Lead` agrupado por `s.funnel`, no período pedido, bots excluídos, ignorando o filtro `&funnel=` e incluindo o bucket sem funil (`''`). Reusa o padrão da query `funnels` que já existe no arquivo.

## Critérios de aceite

- Resposta passa a incluir `funnelCounts: [{ funnel, count }]`, ordenado por `count` desc.
- Respeita `since`/`until` (período), exclui bots (`is_bot = 0`).
- **Ignora** o filtro `&funnel=` (mostra todos os funis).
- Leads sem funil entram como `funnel: ''` (o frontend rotula "(sem funil)").
- Regra de contagem 100% no backend (thin client).
