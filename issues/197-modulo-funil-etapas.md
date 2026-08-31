# 197: Módulo puro que monta os degraus do funil

**Tipo:** Implementação
**Página:** functions/api/_funil-etapas.js
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`

## Descrição

Criar `functions/api/_funil-etapas.js` transformando as linhas do banco nos degraus com o percentual de passagem sobre o degrau anterior, marcando a maior queda, e criar `tests/funil-etapas.test.js`.

## Por que assim

Módulo puro, sem DOM e sem I/O, testável com `node --test` — mesmo precedente de `_ab-estatistica.js`, `_canal.js` e `_cpl-calculo.js`. Precisa normalizar o funil que "sobe" (etapa perdida por falha de rede) para a tela nunca exibir um funil crescente, e não dividir por zero quando o degrau anterior for 0.
