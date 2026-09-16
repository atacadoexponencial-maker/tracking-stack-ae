# 289: Protótipo do aviso de cookies

**Tipo:** Protótipo
**Página:** Módulo 1 — Aviso de cookies (páginas públicas)
**Spec:** spec-aviso-cookies.md

## Descrição

Faixa fixa no rodapé com texto, link para a política e botão "Entendi", na identidade do DESIGN.md, sem ser modal.

## Comportamentos cobertos

- Componentes do módulo 1: faixa, texto, link, botão, região acessível

## Critérios de aceite relacionados

- 16

## Arquivos

- **Criar:** `src/components/AvisoCookies.astro` — marcação e estilo
- **Modificar:** `src/layouts/BaseLayout.astro` — incluir o componente

## Checklist

- [x] Faixa escura com contorno cinza quente, Satoshi, botão primário, link bege
- [x] Nunca modal, sem véu
- [x] Escondida por padrão (sem script não aparece)
