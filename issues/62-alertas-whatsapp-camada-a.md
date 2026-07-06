# 62: Alertas WhatsApp — camada A (falhas críticas do /tracker com throttle)

**Tipo:** Implementação
**Página:** backend `/tracker` (Meta CAPI, forwards de CRM, ClickUp)

## Descrição

Hoje só a falha de escrita no ClickUp alerta a usuária via WhatsApp
(`sendEvolutionMessage` com `EVOLUTION_APIKEY_ALERTA`/`EVOLUTION_NUMERO_ALERTA`).
As outras falhas críticas do `/tracker` morrem em `console.error`: um Meta CAPI
recusando leads (token expirado, env sumida) ou um webhook de CRM respondendo
500 passam DESPERCEBIDOS — o `sendToCRM` nem conferia `response.ok`.

Esta issue estende o canal de alerta para essas falhas, com throttle de no
máximo 1 alerta por tipo por hora (tabela `alert_throttle` no D1), para que uma
plataforma fora do ar não vire spam no WhatsApp. O throttle é FAIL-OPEN: se o
D1 falhar, o alerta sai mesmo assim — melhor duplicado que silêncio.

Pontos de alerta:

- **Meta CAPI** (`maybeAlertMetaFailure`, tipo `meta_capi`): lead/purchase
  não-bot com `metaResponseOk === 0` — cobre erro HTTP, fetch rejeitado E o
  skip por env ausente (morte silenciosa). Disparado em `context.waitUntil`
  próprio, sem atrasar a resposta.
- **Forwards de CRM** (`sendToCRM`, tipo `crm_forward:<label>`): a função ganhou
  `label` e `env`, e passou a conferir `response.ok` (antes um 500 do webhook
  contava como sucesso). Labels por call site: `Workshop (n8n)`
  (LEAD_WEBHOOK_URL_WORKSHOP), `Supabase/CRM` (LEAD_WEBHOOK_URL_CRM),
  `WhatsApp barramento` (LEAD_WEBHOOK_URL_WHATSAPP). O lead nunca trava:
  tudo continua dentro do try/catch best-effort.
- **ClickUp** (tipo `clickup_write`): o alerta existente foi roteado pelo
  throttle — decisão registrada aqui: fica mais consistente (todos os alertas
  críticos num só canal anti-spam) e nada se perde, pois todo lead que falha
  continua integralmente gravado em `clickup_sync_failures`.

## Cenários

### Happy Path
1. Meta falha num Lead real (não-bot) → 1 alerta WhatsApp
   `⚠️ Meta CAPI falhou num Lead: status ... — <180 chars do body>`.
2. Segunda falha do mesmo tipo dentro da mesma hora → silenciada pelo throttle;
   após 3600s, volta a alertar.

### Edge Cases
- PageView com Meta falho → sem alerta (só lead/purchase alertam).
- Evento de bot → sem alerta (bots nem disparam CAPI).
- Meta "skipped: missing meta env" num lead → alerta (env sumida é exatamente
  o caso silencioso que queremos pegar).
- Webhook de CRM responde 500 → alerta com o label do destino
  (`crm_forward:Supabase/CRM` etc.); fetch lançado (rede) idem.
- D1 do throttle fora do ar → alerta sai mesmo assim (fail-open).
- Falha de escrita no ClickUp → log em `clickup_sync_failures` como antes +
  alerta via throttle (`clickup_write`).

## Arquivos

- **Criar:** `migrations/0019_alert_throttle.sql` — tabela
  `alert_throttle (alert_type TEXT PRIMARY KEY, last_sent INTEGER NOT NULL)`.
  (0018 já estava ocupado por `clickup_sync_failures`; o escopo original citava
  0018, ajustado para o próximo número livre.) Aplicada APENAS no D1 local;
  o remoto será aplicado pela orquestradora.
- **Modificar:** `functions/tracker.js` — helper `sendThrottledAlert(type, text,
  env)` + `maybeAlertMetaFailure(...)` perto de `sendEvolutionMessage`; chamada
  em `waitUntil` após o parse do resultado do Meta; `sendToCRM` com
  `label`/`env` + checagem de `response.ok` + alerta; call sites com labels;
  alerta do ClickUp roteado pelo throttle.

## Checklist

- [x] Migration `0019_alert_throttle.sql` criada e aplicada no D1 local
- [x] `sendThrottledAlert` com janela de 3600s, INSERT ... ON CONFLICT e fail-open
- [x] Alerta Meta: lead/purchase não-bot com ok=0 (inclui skip por env ausente), em waitUntil próprio
- [x] `sendToCRM` confere `response.ok` e alerta em !ok e em throw, com label por destino; lead nunca trava
- [x] Alerta existente do ClickUp roteado pelo throttle (tipo `clickup_write`), mensagem inalterada
- [x] `node --check functions/tracker.js` limpo
- [x] Teste one-off (scratchpad, fetch/D1 stubados): throttle bloqueia 2º na mesma hora e libera após 3600s; fail-open com D1 quebrado; sendToCRM alerta em 500 e em throw com o label certo; meta alerta em lead ok=0 e NÃO em pageview/bot
