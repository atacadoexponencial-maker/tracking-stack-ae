# Pendências — Leads fora do CRM + UTM vazia no Supabase

**Criado:** 2026-06-29
**Status:** investigação pausada (a usuária vai reservar tempo pra resolver)
**Onde retomar:** ler este doc + a memória [[disparo-massa-e-crm-comercial]].

---

## Contexto — os "dois mundos"

O projeto tem duas bases de leads que **não estão sincronizadas**:

1. **Tracking do site** — `functions/tracker.js`. Captura todo lead do site (chat de diagnóstico na home, LPs) e faz fan-out: Meta CAPI, GA4, **Supabase** (`LEAD_WEBHOOK_URL_CRM`), **ClickUp** (`LEAD_WEBHOOK_URL` → n8n). O D1 guarda só `raw_email` + flags (`has_name`/`has_phone`) — **não** guarda nome/telefone/instagram/faturamento.
2. **🤑 CRM comercial** (ClickUp, lista `205126080`, folder Comercial) — pipeline de vendas (RA/RR/MQL/SQL). Alimentado por **agendamento (Calendly) / SDR**, não por cada formulário do site.

---

## Problema 1 — Leads preenchem o site mas não entram na 🤑 CRM

**Sintoma:** leads que comprovadamente preencheram o formulário do site (e/ou agendaram no Calendly) não aparecem na 🤑 CRM.

**Evidência (casos confirmados, criados manualmente como paliativo):**
- **Vanessa Paes** — `vanessapaes.vr80@gmail.com`. Lead no D1 em 25/06 21:28 (funil `diagnostico`, home). Não estava na CRM. Criada manual → task `86aj9azyy`.
- **Floresça Joias Brutas** — `nessajacobleal@gmail.com`. Lead no D1 em 28/06 13:13 (funil `sessao-estrategica`, facebookads, home). Não estava na CRM. Criada manual → task `86aj9b8tp`.

**Causa raiz (não confirmada):** a ponte **Calendly → 🤑 CRM** parece quebrada. NÃO sabemos como ela é feita:
- [ ] É um workflow no **n8n** (webhook do Calendly → cria tarefa no ClickUp)?
- [ ] Integração **nativa** Calendly ↔ ClickUp?
- [ ] **Manual** (o time comercial lança quem agenda)?

**Pra retomar:** descobrir o mecanismo acima. Se for n8n, olhar a execução das leads acima (provável erro lá).

---

## Problema 2 — Leads chegam ao Supabase SEM UTM

**Sintoma:** registros no Supabase sem `utm_source`/campaign/etc.

**Evidência (D1, últimos 30 dias):** dos leads, **17 TÊM `utm_source`** capturado na sessão e **9 não** (esses 9 são tráfego direto/orgânico, legítimo). Ou seja, **o dado de UTM existe** na maioria — não é falha de captura.

**Causa raiz mais provável:** o `/tracker` envia as UTMs **aninhadas** dentro de `attribution` (ver `sendToCRM` em `functions/tracker.js`, ~linha 359):
```json
{ "nome": "...", "telefone": "...", "email": "...",
  "attribution": { "utm_source": "facebookads", "utm_campaign": "...", "fbclid": "...", ... } }
```
Se a ingestão do Supabase espera `utm_source` **no topo** do payload (e não dentro de `attribution`), ela grava vazio mesmo o dado existindo.

**Pra retomar:** descobrir o que recebe a `LEAD_WEBHOOK_URL_CRM`:
- [ ] **Edge Function** do Supabase?
- [ ] Workflow no **n8n** → nó de insert no Supabase?
- [ ] REST direto (**PostgREST**)?

**Correções possíveis:**
- (recomendado) Ajustar a ingestão pra ler `attribution.utm_*` — não mexe no contrato que o ClickUp também consome.
- OU achatar as UTMs no payload do `/tracker` (mandar `utm_source` no topo também) — muda o formato pra todos os consumidores.

---

## Solução proposta (quando retomar)

1. **Sync Supabase → ClickUp (limpa o passado):** o Supabase já tem TODOS os leads com dados completos (nome, telefone, IG, faturamento). Comparar Supabase × 🤑 CRM e criar em lote os que faltam, em vez de um a um.
2. **Consertar a ponte Calendly → CRM (protege o futuro).**
3. **Corrigir o mapeamento de UTM na ingestão do Supabase.**

## O que é preciso pra avançar

- **Acesso ao Supabase:** URL do projeto + uma key de leitura (ou rodar uma query fornecida e mandar o resultado).
- **Como a ponte Calendly → 🤑 CRM funciona** (n8n / nativa / manual).
- **Como é a ingestão no Supabase** (Edge Function / n8n / REST).

## Referências úteis (ClickUp 🤑 CRM `205126080`)

Campos personalizados usados na criação manual:
- 👤 Nome `7f70363f-9fc4-4d34-aab1-0a81d4a6f45d`
- ☎️ Whatsapp `754a41c9-2835-48d5-a70e-8b61841e0037` (phone)
- 📩 E-mail `24f5a3d3-e21e-4e08-b396-8a4ce2133a98`
- 📺 Instagram `3f24aa2d-050f-4be2-ab63-09b91307919b`
- 🤑 Faturamento Mensal `97d8308d-d6b2-4dd6-9bd7-76f6662d5de2`
- 🔻 Funil `a663b002-661c-4dc1-86c3-612e94f3a447` (opção SESSÃO ESTRATÉGICA `a158d342-c1ac-4705-a6da-ce39019f0a2a`)
- 🥇 MQL `818e9198-e84a-4695-b4da-b902ef363ea9` (emoji)

---

## NÃO relacionado, mas em aberto (prazo curto)

**Disparo do workshop (30/06)** está **pronto e validado** (workflow n8n "Disparos em massa click-up", 1.444 MQLs, faixa 10k cabe num dia). Falta só a usuária **executar** (habilitar o nó de envio e rodar). Ver memória [[disparo-massa-e-crm-comercial]] e `docs/superpowers/n8n/disparo-massa-workshop.json`.
