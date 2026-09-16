# 273: Reenviar uma conversão e decidir o resultado

**Tipo:** Implementação
**Página:** Módulo 2 — Reenvio automático (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Reenviar ao Meta o conteúdo preservado, com o mesmo identificador e o mesmo horário original, e atualizar a situação conforme a resposta: aceita, falha passageira com espera crescente, evento recusado ou limite de 5 tentativas atingido.

## Comportamentos cobertos

- Reenviar uma conversão
- Reenvio aceito
- Reenvio com falha passageira
- Reenvio recusado por problema do evento
- Atingir o limite de tentativas

## Critérios de aceite relacionados

- 2, 3, 6, 8, 9

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/_meta-fila.js` — reenvio e decisão
- **Modificar:** `functions/api/_meta-envio.js` — proximaTentativaEm

## Checklist

- [x] Mesmo payload/event_id/event_time
- [x] Aceita marca aceita_por_reenvio e apaga payload
- [x] Passageira consome e agenda com espera crescente
- [x] Evento recusado vira falha
- [x] Esgotou vira falha com última resposta
- [x] Trava em_envio_ate contra rodadas simultâneas
