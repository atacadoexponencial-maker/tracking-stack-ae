# Runbook — Workflow n8n: barramento de leads → WhatsApp

**Data:** 2026-06-25
**Spec:** `docs/superpowers/specs/2026-06-25-barramento-leads-whatsapp-design.md`
**Natureza:** configuração manual na UI do n8n (VPS Hostinger, modo fila atrás do Traefik). Não é issue de código.

## Pré-requisitos

- Template da live **aprovado na Meta** (nome exato, idioma e estrutura). Variável nomeada: `{{nome_lead}}`.
- Credencial `WhatsApp account` (`whatsAppApi`) já existente no n8n.
- Token compartilhado definido (mesmo valor que irá em `LEAD_WEBHOOK_TOKEN_WHATSAPP` no Cloudflare).

## Passos

1. **Webhook node** (POST)
   - Header Auth esperando `x-webhook-token` = token compartilhado (criar credencial Header Auth).
   - Responder 200 imediatamente (Respond: "Immediately"). URL de produção: `https://webhook.seteaceleradora.com.br/webhook/<id>` → vai em `LEAD_WEBHOOK_URL_WHATSAPP`.

2. **Switch** por `{{ $json.body.funnel }}`
   - Ramo `lives-semanais-v1` → ATIVO (segue o fluxo).
   - Saída default → **NoOp** (não envia, não erra).

3. **Code node — normalizar telefone**
   - Portar `normalizePhone` do `tracker.js`: remove não-dígitos, remove zeros à esquerda, prefixa `55`. Garante número idêntico ao do Meta CAPI.

4. **HTTP Request — Graph API WhatsApp**
   - Envia o template com `components` montado à mão (variável nomeada `nome_lead`).
   - Body param: `nome_lead = {{ $json.body.nome }}`.
   - Credencial: `WhatsApp account`.
   - **Continue on Fail** ligado (número inválido / template não aprovado registra erro sem quebrar o recebimento).

## Validação (critérios de sucesso da spec)

1. Lead da LP da live dispara o template com o nome correto preenchido.
2. Leads de outros funis chegam ao webhook mas caem no NoOp (sem erro).
3. Webhook rejeita requisições sem o token válido (401/403).
4. Webhook responde 200 rápido — `/tracker` é fire-and-forget, nunca trava conversão.

## Pegadinha conhecida

- `/webhook-test/` dá 404 com nós de gatilho; usar sempre a URL de produção `/webhook/`. Ver `vps-n8n-arquitetura`.
