# 294: Horário suspeito nas integrações

**Tipo:** Implementação
**Página:** Módulo 2 — Horário suspeito nas integrações
**Spec:** spec-protecoes-integracoes.md

## Descrição

Medir, por fonte, o desvio entre o horário informado e o de chegada, com resumo por hora, amostra de suspeitos e critério de desvio sistemático.

## Critérios de aceite relacionados

- 9
- 10
- 11
- 12
- 13

## Arquivos

- **Criar:** `functions/api/_horario-fontes.js` — regras puras
- **Criar:** `functions/api/_horario-registro.js` — registro e avaliação
- **Modificar:** `functions/api/webhooks/whatsapp-grupo.js`, `functions/api/webhooks/greenn.js`, `functions/webhook/clickup.js`, `functions/api/sync/meta-leads.js`, `functions/webhook/kiwify/[slug].js`, `functions/webhook/hotmart/[slug].js`, `functions/webhook/eduzz/[slug].js` — registrar horário

## Checklist

- [x] Texto sem fuso lido como UTC de propósito
- [x] Grupos: antes e depois da correção; "corrigido" sem alerta
- [x] Nada descartado nem corrigido
- [x] Resumos com mais de 30 dias apagados
