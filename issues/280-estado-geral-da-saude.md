# 280: Estado geral: Saudável, Atenção ou Incidente

**Tipo:** Implementação
**Página:** Módulo 3 — Área "Saúde do Meta" (dashboard)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Determinar no servidor a faixa de estado geral e a frase do motivo, a partir da última resposta do Meta, da aceitação e das falhas das últimas 24 h, das pendentes que expiram em 24 h e da condição de nenhuma conversão aceita.

## Comportamentos cobertos

- Determinar o estado geral "Incidente"
- Determinar o estado geral "Atenção"
- Determinar o estado geral "Saudável"

## Critérios de aceite relacionados

- 4, 21

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/_meta-envio.js` — estadoGeral
- **Modificar:** `functions/api/_meta-fila.js` — metricasSaude
- **Modificar:** `public/dash/index.html`

## Checklist

- [x] Incidente/Atenção/Saudável com frase do motivo
- [x] Testes
