# 207: Marcar venda sem campanha identificada

**Tipo:** Implementação
**Página:** Módulo 1 — Origem dos dados de venda

## Descrição

Rotular como "sem campanha" a venda cuja origem não foi identificada — acesso direto, link compartilhado ou indicação. É um grupo legítimo, não um erro.

## Spec

`spec-greenn-aba-dashboard.md`

## Arquivos

- **Modificar:** `functions/api/_greenn-metricas.js` — rótulo de venda sem origem

## Checklist

- [x] Rótulo único e constante para 'sem campanha'
- [x] UTMs vazias tratadas como sem campanha (não como campanha de nome vazio)
- [x] Não é erro: aparece normalmente na tela
