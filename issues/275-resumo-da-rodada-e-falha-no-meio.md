# 275: Gravar o resumo da rodada e preservar decisões de rodada interrompida

**Tipo:** Implementação
**Página:** Módulo 2 — Reenvio automático (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Rodada com trabalho grava o resumo (aceitas, pendentes, falhas definitivas, expiradas, abortou por credencial); se a rodada cair no meio, o que já foi decidido permanece e o restante fica para a próxima.

## Comportamentos cobertos

- Rodada com trabalho
- Rodada que falha no meio

## Critérios de aceite relacionados

- 16

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/_meta-fila.js` — gravar resumo em meta_reenvio_rodadas

## Checklist

- [x] Resumo só quando houve trabalho
- [x] Decisões gravadas por conversão (rodada que falha no meio preserva o feito)
