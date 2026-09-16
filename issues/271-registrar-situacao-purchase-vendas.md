# 271: Registrar a situação das vendas (Purchase) após a primeira tentativa

**Tipo:** Implementação
**Página:** Módulo 1 — Registro da conversão para reenvio (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Aplicar o mesmo registro de situação às vendas enviadas ao Meta pelos gateways e pela ponte do CRM, com origem "venda". Vendas que hoje não vão ao Meta por configuração continuam fora.

## Comportamentos cobertos

- Primeira tentativa aceita pelo Meta
- Primeira tentativa recusada por credencial
- Credencial do Meta não configurada no momento do envio
- Primeira tentativa com falha passageira
- Primeira tentativa recusada por problema do próprio evento
- Evento que hoje não vai ao Meta por decisão de configuração (ex.: venda de teste interno)
- Falha ao registrar a situação

## Critérios de aceite relacionados

- 9

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/webhook/_core.js` — registrar situação do Purchase; sendToMeta devolve payload sem credencial

## Checklist

- [x] Origem "venda", referência = produto
- [x] Só quando o handleTracking rodou
