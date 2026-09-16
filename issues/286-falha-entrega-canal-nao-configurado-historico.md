# 286: Falha de entrega, canal não configurado e histórico de alertas na aba

**Tipo:** Implementação
**Página:** Módulo 4 — Alerta de saúde do envio (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Registrar o alerta não entregue e tentar de novo na verificação seguinte, exibir o histórico de alertas na aba "Saúde do Meta" e o aviso quando não há canal configurado.

## Comportamentos cobertos

- Falha ao entregar o alerta
- Canal de alerta não configurado
- Componente: registro de alertas exibido na aba

## Critérios de aceite relacionados

- 17

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/_meta-alerta.js`
- **Modificar:** `functions/api/meta-saude.js`
- **Modificar:** `public/dash/index.html`

## Checklist

- [x] Não entregue fica no histórico e é reentregue
- [x] Canal não configurado avisa na aba
- [x] Histórico de alertas na aba
