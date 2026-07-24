# 145: Cutover — ativar cron e desligar o n8n

**Tipo:** Implementação
**Página:** operação (VPS / n8n)

## Descrição

Após validar em produção com lead de teste, agendar o cron do coletor na VPS (a cada 15 min) com o marco de corte inicial, e desligar o workflow do n8n que lê a planilha e cria no ClickUp — evitando processamento em duplicidade (o dedup do `sendToClickUp` cobre a sobreposição). Referência: spec, "Transição / aposentar o n8n".

## Estado (2026-07-24)

Validação end-to-end OK (lead de teste → card no ClickUp com tag `formulario-meta`, `event_log` com `origin=meta_form`/`funnel=sessao-estrategica`/`is_junk=1`/sem CAPI, sessão sintética com atribuição; tudo limpo depois). Marco de corte já gravado (`cursor=1784840157`) — leads a partir de 23/07 15:55 serão pegos quando o cron rodar; nada se perde no intervalo.

**Pendente — a USUÁRIA vai fazer (passo 5):**
1. Agendar o cron na VPS (a cada 15 min):
   ```
   */15 * * * * cd /root/scripts/meta-leads-sync && set -a && . ./.env && set +a && /usr/bin/python3 sync.py >> /var/log/tracking-meta-leads-sync.log 2>&1
   ```
2. Desligar o workflow do n8n que lê a planilha → ClickUp.

Ordem segura: agendar o cron primeiro, confirmar um lead novo entrando pelo tracking (badge "form Meta" no /dash), e só então desligar o n8n. O dedup (`telefone`/`email`) cobre a janela de sobreposição — rodar os dois em paralelo por um tempo não gera card duplicado.

## Checklist
- [x] Validação end-to-end em produção
- [ ] [USUÁRIA] Agendar cron 15/15min na VPS
- [ ] [USUÁRIA] Desligar o workflow do n8n
