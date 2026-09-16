# 283: Captura de identificadores de clique nas visitas de anúncio

**Tipo:** Implementação
**Página:** Módulo 3 — Área "Saúde do Meta" (dashboard)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Calcular no servidor, para o período e sem bots, a porcentagem de visitas de anúncio do Meta com identificador de clique do Meta e de visitas de anúncio do Google com o do Google, com os números absolutos, usando a regra de canal já existente no dashboard.

## Comportamentos cobertos

- Calcular a captura de identificadores de clique
- Nenhuma visita de anúncio no período

## Critérios de aceite relacionados

- 14, 16

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/meta-saude.js` — captura de clique
- **Modificar:** `public/dash/index.html`

## Checklist

- [x] Meta: utm_source facebookads; Google: utm_source google*/adwords com mídia paga
- [x] Bots fora (UA e IP)
- [x] "—" sem visitas
