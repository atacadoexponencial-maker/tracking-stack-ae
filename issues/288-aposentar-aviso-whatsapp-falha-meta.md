# 288: Aposentar o aviso por WhatsApp de falha do Meta

**Tipo:** Implementação
**Página:** Módulo 4 — Alerta de saúde do envio (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Depois de comprovado o alerta de teste pelo Slack, deixar de usar o WhatsApp para avisar falha de conversão do Meta, mantendo os demais avisos do projeto como estão.

## Comportamentos cobertos

- Aviso antigo por WhatsApp para falha do Meta

## Critérios de aceite relacionados

- 17

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/tracker.js` — remover maybeAlertMetaFailure (sendThrottledAlert continua para outros avisos)

## Checklist

- [x] Só a falha do Meta deixa o WhatsApp
- [x] Ativar em produção só depois do teste do Slack
