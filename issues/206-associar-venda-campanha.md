# 206: Associar cada venda à sua campanha de origem

**Tipo:** Implementação
**Página:** Módulo 1 — Origem dos dados de venda

## Descrição

Ligar cada venda à campanha, criativo, origem e mídia gravados na visita que a originou.

## Spec

`spec-greenn-aba-dashboard.md`

## Arquivos

- **Modificar:** `functions/api/_greenn-metricas.js` — casamento `sf_trk` → `trk`

## Checklist

- [ ] Índice das sessões por `trk` para o casamento
- [ ] Campanha, criativo, origem e mídia anexados à venda
- [ ] Teste com venda atribuída
