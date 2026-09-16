# 281: Lista de falhas definitivas com filtros, paginação e detalhe

**Tipo:** Implementação
**Página:** Módulo 3 — Área "Saúde do Meta" (dashboard)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Listar as falhas definitivas do período (mais recentes primeiro, incluindo EntrouGrupo) com motivo legível, filtros por tipo e por motivo, paginação e detalhe com a resposta completa do Meta e o identificador do evento.

## Comportamentos cobertos

- Ver a lista de falhas
- Filtrar a lista de falhas por tipo de evento
- Filtrar a lista de falhas por motivo
- Mudar de página na lista
- Abrir o detalhe de uma falha
- Fechar o detalhe

## Critérios de aceite relacionados

- 13

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/meta-saude.js` — view=falhas e view=detalhe
- **Modificar:** `public/dash/index.html`

## Checklist

- [x] Filtros tipo e motivo
- [x] Paginação
- [x] Detalhe no modal
