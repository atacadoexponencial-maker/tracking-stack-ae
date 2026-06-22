# 38: Parâmetro `funnel` no endpoint `/api/leads` (derivado de landing_url)
**Tipo:** Implementação
**Página:** Dashboard de leads (Fase 0 — filtro de funil)

## Descrição
Adicionar ao endpoint existente `functions/api/leads.js` um parâmetro opcional `funnel` (querystring) que, quando informado, restringe as linhas de leads e a contagem do período ao funil pedido, derivando o critério de `sessions.landing_url` (Opção A — sem migração).

## Contexto / Reuso (NÃO reconstruir)
- O endpoint `functions/api/leads.js` JÁ EXISTE e já faz `event_log LEFT JOIN sessions`, já retorna `s.landing_url`, já lê `key`/`days`/`from`/`to`/`limit`/`include_bots` e já tem auth por `DASH_KEY`.
- MODIFICAR este arquivo reaproveitando o padrão atual de leitura de parâmetros e de montagem das cláusulas WHERE (período + bots). NÃO criar endpoint novo. NÃO migração / schema change. NÃO tocar em `tracker.js`.
- Decisão central da spec: **Opção A** — mapa funil→critério vive no backend, nunca no frontend.

## O que fazer
1. Ler o parâmetro `funnel` da querystring (mesmo padrão dos parâmetros já lidos). Ausente ou vazio = comportamento atual (todos os funis).
2. Definir no backend um mapa funil→critério em `landing_url`. Mínimo exigido: `lives-semanais-v1` → `sessions.landing_url LIKE '%/lives-semanais-v1%'`.
3. Quando `funnel` for informado e conhecido: aplicar a cláusula do funil em conjunto (AND) com as cláusulas de período (`days` ou `from`/`to`) e de bots já existentes — tanto na query das linhas quanto na query de contagem do período (a contagem deve refletir o mesmo filtro, ou seja, contagem isolada por funil).
4. Quando `funnel` for desconhecido (sem mapeamento): retornar conjunto vazio para o filtro, sem derrubar a request e sem cair para "todos".
5. Manter `key`/`DASH_KEY` e todo o resto do comportamento inalterados (sem regressão).

## Critérios de aceite
- `GET /api/leads?...&funnel=lives-semanais-v1` retorna apenas leads cuja sessão de origem casa com `%/lives-semanais-v1%`, dentro do período/bot aplicados, e a contagem reflete esse subconjunto.
- `GET /api/leads?...` (sem `funnel`) retorna exatamente o que retornava antes.
- `funnel` desconhecido retorna lista vazia (não erro, não "todos").
- Filtro de funil combina com período e bots via AND.
- Auth por `DASH_KEY` inalterada.

## Arquivos
- MODIFICAR: `functions/api/leads.js`

## Fora de escopo
- Coluna `funnel` no `event_log` / migração / backfill (Opção B).
- Qualquer mudança em `tracker.js`.
- Filtro de funil em outras seções (compras/UTM/atribuição/receita).
