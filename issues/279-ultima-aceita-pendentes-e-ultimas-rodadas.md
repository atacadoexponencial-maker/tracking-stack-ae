# 279: Última conversão aceita, pendentes de reenvio e últimas rodadas

**Tipo:** Implementação
**Página:** Módulo 3 — Área "Saúde do Meta" (dashboard)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Blocos do momento atual, independentes do período: última conversão aceita (geral e por tipo), pendentes (total, por categoria, mais antiga, expiram em 24 h, incluindo EntrouGrupo) e a lista curta das últimas rodadas de reenvio.

## Comportamentos cobertos

- Ver as pendentes
- Componentes: última conversão aceita, últimas rodadas de reenvio

## Critérios de aceite relacionados

- 15, 16

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/meta-saude.js`
- **Modificar:** `public/dash/index.html`

## Checklist

- [x] Última aceita geral e por tipo
- [x] Pendentes por categoria, mais antiga, expiram em 24 h
- [x] Últimas rodadas
