# 282: Reenvio manual de uma falha ("Tentar de novo")

**Tipo:** Implementação
**Página:** Módulo 3 — Área "Saúde do Meta" (dashboard)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Botão por linha que devolve uma falha definitiva ainda dentro da janela de 6 dias para aguardando reenvio, com tentativas zeradas; fora da janela o botão fica desabilitado com a dica. Não há reenvio em massa.

## Comportamentos cobertos

- Reenviar manualmente uma falha definitiva
- Reenviar manualmente falha fora da janela
- Reenviar manualmente todas as falhas de um motivo

## Critérios de aceite relacionados

- 20, 21

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/meta-saude.js` — POST tentar-de-novo
- **Modificar:** `public/dash/index.html`

## Checklist

- [x] Só dentro de 6 dias; zera tentativas
- [x] Desabilitado fora da janela e no EntrouGrupo
