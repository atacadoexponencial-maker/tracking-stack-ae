# 276: Recuperar recusas dos últimos 6 dias na ativação

**Tipo:** Implementação
**Página:** Módulo 1 — Registro da conversão para reenvio (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Na ativação da feature, colocar na fila as conversões já registradas que foram recusadas e cujo horário original ainda está dentro de 6 dias; as mais antigas ficam só como registro.

## Comportamentos cobertos

- Conversões registradas antes da ativação da feature

## Critérios de aceite relacionados

- 2, 7

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/_meta-fila.js` — recuperarRecentes
- **Modificar:** `functions/api/sync/meta-reenvio.js` — ?acao=recuperar

## Checklist

- [x] Lê recusas dos últimos 6 dias do event_log e purchase_log
- [x] INSERT OR IGNORE (idempotente)
- [x] Classifica com as mesmas regras
