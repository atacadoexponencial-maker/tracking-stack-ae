# 39: Seletor de funil no dashboard de leads
**Tipo:** Implementação
**Página:** Dashboard de leads (Fase 0 — filtro de funil)

## Descrição
Adicionar ao dashboard existente `public/dash/index.html` um seletor de funil no cabeçalho (ao lado do seletor de período) que repassa o funil escolhido ao `/api/leads`, fazendo o KPI "Leads" e a tabela "Leads recentes" refletirem o funil selecionado combinado com o período.

## Dependência
Depende da issue 38 (parâmetro `funnel` já existir no `/api/leads`).

## Contexto / Reuso (NÃO reconstruir)
- O dashboard `public/dash/index.html` JÁ EXISTE e já tem: seletor de período (`#range-picker`), `periodQuery`, `limit`, KPI "Leads" (`#kpi-leads`), tabela "Leads recentes" (`#leads-tbody`) e a chamada ao `/api/leads`.
- MODIFICAR este arquivo reaproveitando exatamente o padrão com que o período já é capturado e anexado à query do `/api/leads`. Thin client: o seletor só captura a escolha e a envia; NENHUMA regra de mapeamento funil→slug no frontend (isso vive no backend, issue 38).
- NÃO criar dashboard novo.

## O que fazer
1. Adicionar um seletor de funil no `header`, junto ao `#range-picker`, com opções: **"Todos os funis"** (padrão) e ao menos **"Live semanal (`lives-semanais-v1`)"**.
2. Incorporar o funil selecionado à query enviada ao `/api/leads` (junto de `periodQuery` e `limit`), no mesmo ponto/padrão em que o período já é anexado. "Todos os funis" = não enviar filtro de funil (comportamento atual).
3. Ao trocar o funil: recarregar KPI "Leads" e tabela "Leads recentes" mantendo o período atual; ao trocar o período: manter o funil selecionado. Ambos aplicados juntos.
4. KPI "Leads" e tabela passam a refletir somente o funil selecionado no período.
5. Estado vazio: quando não houver leads do funil/período, exibir mensagem clara (ex.: "Nenhum lead deste funil no período.") no lugar de tabela vazia/erro.

## Critérios de aceite
- Ao abrir o dashboard, padrão "Todos os funis": comportamento idêntico ao atual (sem regressão).
- Selecionar "Live semanal" filtra KPI "Leads" e tabela para `lives-semanais-v1`, mantendo o período.
- Voltar para "Todos os funis" restaura a visão completa do período.
- Trocar de período preserva o funil selecionado e vice-versa.
- Sem leads para o funil/período: mensagem de estado vazio exibida.
- Nenhuma regra de mapeamento funil→slug no frontend.

## Arquivos
- MODIFICAR: `public/dash/index.html`

## Fora de escopo
- Seções de receita, produtos, atribuição, UTM, compras e saúde (permanecem inalteradas).
- Persistência canônica do funil (URL/sessão) — opcional, não requisito da Fase 0.
