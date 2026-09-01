# 209: Somar o investimento de cada campanha

**Tipo:** Implementação
**Página:** Módulo 2 — Cruzamento com investimento

## Descrição

Totalizar o gasto em anúncios de cada campanha do produto ao longo de todo o seu ciclo, do primeiro dia até hoje.

## Spec

`spec-greenn-aba-dashboard.md`

## Arquivos

- **Modificar:** `functions/api/greenn.js` — consulta `ad_spend`
- **Modificar:** `functions/api/_greenn-metricas.js` — soma por campanha

## Checklist

- [x] Soma `spend_cents` agrupando por `campaign_name`
- [x] Sem recorte de data: ciclo inteiro
- [x] Conversão de centavos para reais num só lugar
