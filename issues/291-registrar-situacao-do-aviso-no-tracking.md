# 291: Registrar a situação do aviso nos eventos do tracking

**Tipo:** Implementação
**Página:** Módulo 2 — Registro da situação do aviso no tracking (sistema)
**Spec:** spec-aviso-cookies.md

## Descrição

Todos os eventos enviados pelas páginas levam "aviso exibido" ou "aviso fechado" no campo de consentimento; o "Entendi" gera um evento interno que não vai a Meta, GA4 nem CRM.

## Comportamentos cobertos

- Todos os comportamentos do módulo 2

## Critérios de aceite relacionados

- 4
- 5
- 17
- 18
- 19

## Arquivos

- **Criar:** `functions/_aviso-cookies.js` — normalizar a situação recebida
- **Criar:** `tests/aviso-cookies.test.js`
- **Modificar:** `functions/tracker.js` — gravar situação normalizada; AvisoCookiesFechado como evento interno
- **Modificar:** `src/layouts/BaseLayout.astro` — função de situação no head + PageView
- **Modificar:** `src/scripts/funil.ts` — eventos internos
- **Modificar:** `src/components/AplicacaoForm.astro`, `src/components/LeadChat.astro`, `src/components/LeadFormModal.astro`, `src/pages/calculadora-atacado/index.astro`, `src/pages/lives-semanais-v1.astro`, `src/pages/materiais/[slug].astro` — Lead leva a situação

## Checklist

- [x] Valor desconhecido vira unknown
- [x] Nada novo vai a Meta/GA4/CRM
- [x] Evento interno fora do degrau "clicou"
