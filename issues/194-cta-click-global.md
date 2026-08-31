# 194: Evento `CTAClick` em todas as páginas

**Tipo:** Implementação
**Página:** src/layouts/BaseLayout.astro
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`
**Depende de:** 192, 193

## Descrição

Acrescentar `ativarCtaClick()` ao `funil.ts` e ligá-lo uma única vez no `BaseLayout.astro`, com o seletor `.btn-cta:not([data-checkout])`, no máximo um evento por carregamento de página.

## Por que assim

Ligado no layout, toda LP existente e toda LP futura entram no funil sem instrumentação própria. O `:not([data-checkout])` evita evento duplicado na LP do workshop, onde o clique já dispara `InitiateCheckout`. O envio usa `navigator.sendBeacon` (com `fetch` de reserva): sem isso a navegação cancela a requisição e justamente os cliques mais importantes sumiriam do funil.
