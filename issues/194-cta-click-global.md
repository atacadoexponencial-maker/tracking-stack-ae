# 194: Evento `CTAClick` em todas as páginas

**Tipo:** Implementação
**Página:** src/layouts/BaseLayout.astro
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`
**Depende de:** 192, 193

## Descrição

Acrescentar `ativarCtaClick()` ao `funil.ts` e ligá-lo uma única vez no `BaseLayout.astro`, com o seletor `.btn-cta:not([data-checkout])`, no máximo um evento por carregamento de página.

## Por que assim

Ligado no layout, toda LP existente e toda LP futura entram no funil sem instrumentação própria. O `:not([data-checkout])` evita evento duplicado na LP do workshop, onde o clique já dispara `InitiateCheckout`. O envio usa `navigator.sendBeacon` (com `fetch` de reserva): sem isso a navegação cancela a requisição e justamente os cliques mais importantes sumiriam do funil.

## Checklist

- [x] `ativarCtaClick()` em `src/scripts/funil.ts`
- [x] Ligado UMA vez no `BaseLayout.astro`, em `<script>` bundlado (aceita `import`)
- [x] Seletor `.btn-cta:not([data-checkout])` — sem evento duplicado na LP do workshop
- [x] Delegacao no `document`, em fase de CAPTURA (o clique navega; `stopPropagation`
      de alguma pagina o esconderia na fase de bolha)
- [x] No maximo um `CTAClick` por carregamento de pagina
- [x] Envio por `sendBeacon` com reserva em `fetch({keepalive:true})`
- [x] Nenhuma LP tocada individualmente
- [x] Build passa
