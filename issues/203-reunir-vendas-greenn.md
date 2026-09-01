# 203: Reunir as vendas do produto da Greenn

**Tipo:** Implementação
**Página:** Módulo 1 — Origem dos dados de venda

## Descrição

Ler todas as vendas registradas do produto da Greenn, com data, valor, forma de pagamento, nome do comprador e status.

## Spec

`spec-greenn-aba-dashboard.md`

## Arquivos

- **Modificar:** `functions/api/greenn.js` — consulta `greenn_webhook_event` (event = 'saleUpdated')
- **Modificar:** `functions/api/_greenn-metricas.js` — normaliza cada linha lendo o `raw_json`

## Checklist

- [ ] Consulta filtra `event = 'saleUpdated'`
- [ ] `raw_json` parseado com try/catch por linha
- [ ] Campos extraídos: nome, e-mail, método, produto, `sf_trk`
- [ ] Linha ilegível não derruba as demais
