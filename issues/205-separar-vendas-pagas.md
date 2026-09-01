# 205: Separar vendas pagas das não pagas

**Tipo:** Implementação
**Página:** Módulo 1 — Origem dos dados de venda

## Descrição

Somar como receita apenas as vendas pagas. Reembolsos e recusas ficam contados à parte, nunca misturados ao arrecadado.

## Spec

`spec-greenn-aba-dashboard.md`

## Arquivos

- **Modificar:** `functions/api/_greenn-metricas.js` — separação por `current_status`

## Checklist

- [x] Só `paid` soma receita
- [x] Não pagas contadas à parte
- [x] Nenhum status desconhecido some em silêncio
