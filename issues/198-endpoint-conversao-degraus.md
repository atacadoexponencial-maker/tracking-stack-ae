# 198: `/api/conversion` devolve os degraus e a data de início da coleta

**Tipo:** Implementação
**Página:** functions/api/conversion.js
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`
**Depende de:** 191, 197

## Descrição

Fazer o endpoint devolver, junto de cada LP, os degraus do funil (`COUNT(DISTINCT session_id)` por degrau, com o clique lido como `CTAClick` OU `InitiateCheckout`) e a data de início da coleta.

## Por que assim

A data de início é o `MIN(timestamp)` do primeiro `CTAClick`/`FormStep` da tabela INTEIRA — sem filtro de página, de funil ou de período. Calculá-la dentro do filtro da consulta faria a data variar conforme o que o usuário escolhesse, virando um número sem significado. Herdar os filtros de bot, junk, funil e período que a tabela já usa, para os números baterem com o resto do dashboard.
