# 274: Credencial recusada no reenvio interrompe a rodada

**Tipo:** Implementação
**Página:** Módulo 2 — Reenvio automático (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Quando o reenvio é recusado por credencial, a conversão não consome tentativa e a rodada para; as rodadas seguintes fazem uma única tentativa até a credencial voltar e então retomam as pendentes por antiguidade. O disparo do alerta é ligado na issue 285.

## Comportamentos cobertos

- Reenvio recusado por credencial
- Rodadas seguintes com credencial ainda quebrada
- Credencial consertada

## Critérios de aceite relacionados

- 4, 5

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/_meta-fila.js`

## Checklist

- [x] Credencial não consome tentativa e interrompe a rodada
- [x] Rodadas seguintes tentam só a mais antiga
