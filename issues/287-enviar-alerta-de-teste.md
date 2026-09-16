# 287: Enviar alerta de teste

**Tipo:** Implementação
**Página:** Módulo 4 — Alerta de saúde do envio (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Botão "Enviar alerta de teste" que dispara uma mensagem pelo canal do Slack para confirmar a entrega, sem alterar o estado de nenhuma condição.

## Comportamentos cobertos

- Enviar alerta de teste

## Critérios de aceite relacionados

- 19

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/meta-saude.js` — POST alerta-teste
- **Modificar:** `public/dash/index.html`

## Checklist

- [x] Não altera estado das condições
- [x] Mostra resultado da entrega
