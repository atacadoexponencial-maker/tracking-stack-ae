# 272: Rodada de reenvio: expirar e selecionar pendentes

**Tipo:** Implementação
**Página:** Módulo 2 — Reenvio automático (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Rotina a cada 15 minutos que primeiro move para "falhou de vez" as pendentes com mais de 6 dias e depois seleciona, das mais antigas para as mais novas, as que já cumpriram a espera, até o tamanho máximo da rodada — lendo só o que está pendente e sem que duas rodadas peguem a mesma conversão.

## Comportamentos cobertos

- Iniciar rodada
- Selecionar conversões da rodada
- Rodada sem nenhuma pendente
- Duas rodadas simultâneas

## Critérios de aceite relacionados

- 7, 16

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/_meta-fila.js` — executarRodada (expirar, selecionar)
- **Criar:** `functions/api/sync/meta-reenvio.js`

## Checklist

- [x] Expira pendentes > 6 dias como "expirou"
- [x] Seleciona vencidas por antiguidade até 50
- [x] Rodada vazia não grava nada
- [x] Auth x-sync-secret
