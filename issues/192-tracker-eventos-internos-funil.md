# 192: `/tracker` aceita `CTAClick` e `FormStep` como eventos internos

**Tipo:** Implementação
**Página:** functions/tracker.js
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`
**Depende de:** 191

## Descrição

Acrescentar `ctaclick` e `formstep` ao `EVENTOS_INTERNOS` (linha 379) e gravar o `step` recebido no INSERT da `event_log`. Os dois eventos passam a ser registrados no banco sem sair para Meta, GA4, ClickUp ou GoHighLevel — o mesmo caminho que o `FormStart` já percorre.

## Por que assim

É o ponto central da spec: se qualquer um desses eventos escapar para o pixel, ele vira conversão falsa e polui a otimização das campanhas.
