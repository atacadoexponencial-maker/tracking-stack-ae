# 218: Ver o ticket médio das vendas

**Tipo:** Implementação
**Página:** Módulo 3 — Aba Greenn

## Descrição

Indicador com o valor médio por venda paga.

## Spec

`spec-greenn-aba-dashboard.md`

## Arquivos

- **Modificar:** `functions/api/_greenn-metricas.js` — ticket médio
- **Modificar:** `public/dash/index.html` — indicador

## Checklist

- [ ] Ticket = receita ÷ vendas pagas
- [ ] `null` quando não há venda (sem divisão por zero)
