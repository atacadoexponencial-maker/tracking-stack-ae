# 192: `/tracker` aceita `CTAClick` e `FormStep` como eventos internos

**Tipo:** Implementação
**Página:** functions/tracker.js
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`
**Depende de:** 191

## Descrição

Acrescentar `ctaclick` e `formstep` ao `EVENTOS_INTERNOS` (linha 379) e gravar o `step` recebido no INSERT da `event_log`. Os dois eventos passam a ser registrados no banco sem sair para Meta, GA4, ClickUp ou GoHighLevel — o mesmo caminho que o `FormStart` já percorre.

## Por que assim

É o ponto central da spec: se qualquer um desses eventos escapar para o pixel, ele vira conversão falsa e polui a otimização das campanhas.

## Checklist

- [x] `ctaclick` e `formstep` acrescentados a `EVENTOS_INTERNOS`
- [x] `loggedStep` derivado do corpo, `NULL` em tudo que nao for `FormStep`
- [x] `step` no INSERT do `event_log` — 36 colunas / 36 placeholders / 36 binds conferidos
- [x] Nenhum dos dois sai para Meta, GA4, ClickUp ou GoHighLevel
- [x] `npm test` 206/206 e build passam
- [x] Verificado em `wrangler pages dev` com evento gravado no D1 local
