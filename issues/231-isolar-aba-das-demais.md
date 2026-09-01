# 231: Navegar para outras abas sem interferência

**Tipo:** Implementação
**Página:** Módulo 3 — Aba Greenn

## Descrição

Garantir que a aba Greenn não altera os números das outras abas do dashboard.

## Spec

`spec-greenn-aba-dashboard.md`

## Arquivos

- **Modificar:** `public/dash/index.html` — isolamento

## Checklist

- [x] Nenhuma variável global compartilhada com outras seções
- [x] `purchase_log` e demais endpoints não são tocados
- [x] Conferir Visão geral, Vendas e Meta Ads antes e depois
