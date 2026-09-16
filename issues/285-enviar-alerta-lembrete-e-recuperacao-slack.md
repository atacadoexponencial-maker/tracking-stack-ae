# 285: Enviar alerta, lembrete e recuperação pelo Slack

**Tipo:** Implementação
**Página:** Módulo 4 — Alerta de saúde do envio (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Enviar ao canal do Slack a mensagem quando uma ou mais condições começam a valer (um único alerta listando todas), o lembrete "ainda acontecendo" só depois de 6 h e a mensagem de recuperação única com duração e quantidade recuperada, gravando cada envio no registro de alertas. Inclui o disparo imediato na recusa por credencial.

## Comportamentos cobertos

- Condição começa a valer
- Condição continua valendo
- Lembrete de condição persistente
- Condição deixa de valer
- Várias condições ao mesmo tempo

## Critérios de aceite relacionados

- 4, 5, 18

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Criar:** `functions/api/_meta-alerta.js`
- **Modificar:** `functions/api/sync/meta-reenvio.js`

## Checklist

- [x] Alerta único listando condições novas
- [x] Lembrete após 6 h
- [x] Recuperação com duração e recuperadas
- [x] Slack via SLACK_WEBHOOK_META
