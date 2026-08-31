# 198: `/api/conversion` devolve os degraus e a data de início da coleta

**Tipo:** Implementação
**Página:** functions/api/conversion.js
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`
**Depende de:** 191, 197

## Descrição

Fazer o endpoint devolver, junto de cada LP, os degraus do funil (`COUNT(DISTINCT session_id)` por degrau, com o clique lido como `CTAClick` OU `InitiateCheckout`) e a data de início da coleta.

## Por que assim

A data de início é o `MIN(timestamp)` do primeiro `CTAClick`/`FormStep` da tabela INTEIRA — sem filtro de página, de funil ou de período. Calculá-la dentro do filtro da consulta faria a data variar conforme o que o usuário escolhesse, virando um número sem significado. Herdar os filtros de bot, junk, funil e período que a tabela já usa, para os números baterem com o resto do dashboard.

## Checklist

- [x] Consulta dos degraus (`CTAClick` OU `InitiateCheckout`, `FormStart`) por landing_url
- [x] Consulta das etapas agrupada por `landing_url` e `step`
- [x] Mesmo recorte de sessoes da tabela existente (janela, bot, junk, funil)
- [x] Degraus novos usam o funil da SESSAO — o do evento zeraria `CTAClick`/`FormStep`
- [x] Inicio da coleta = `MIN(timestamp)` GLOBAL, sem filtro de pagina/funil/periodo
- [x] Segundos do D1 convertidos para ms na fronteira com o modulo
- [x] Merge pelo path normalizado, igual ao `byPath` existente
- [x] Aritmetica delegada ao `_funil-etapas.js` (endpoint so faz I/O)
- [x] As tres queries validadas contra o D1 local
- [x] Verificado ponta a ponta em `wrangler pages dev`
