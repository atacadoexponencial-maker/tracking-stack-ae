# 284: Avaliar as condições de alerta periodicamente

**Tipo:** Implementação
**Página:** Módulo 4 — Alerta de saúde do envio (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Verificação a cada 15 minutos, junto da rodada e independente do tráfego, que avalia com dados recentes as condições credencial recusada, aceitação baixa (abaixo de 80% em 6 h com ao menos 10 conversões), nenhuma Lead aceita há 24 h / nenhuma conversão aceita há 6 h e pendentes prestes a expirar — incluindo EntrouGrupo e excluindo bots, leads bloqueados e eventos internos.

## Comportamentos cobertos

- Verificar a saúde
- Evento de bot, lead bloqueado ou evento interno

## Critérios de aceite relacionados

- 4, 10, 16, 21

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/_meta-envio.js` — avaliarCondicoes
- **Modificar:** `functions/api/sync/meta-reenvio.js`

## Checklist

- [x] Credencial, aceitação baixa, sem aceitas com volume, sem Lead aceita 24 h, pendentes expirando
- [x] Testes
