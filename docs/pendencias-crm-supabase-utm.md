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

## Problema 1 — Quem agenda não entra na 🤑 CRM (ponte Calendly → CRM)

**Sintoma:** leads que agendaram uma reunião (sessão estratégica) não aparecem na 🤑 CRM.

**Evidência — 5 casos confirmados (todos agendaram, nenhum estava na CRM; criados manualmente como paliativo):**

| Lead | Email | No tracking do site? | Task criada |
|------|-------|----------------------|-------------|
| Vanessa Paes | vanessapaes.vr80@gmail.com | ✅ 25/06 (diagnostico) | `86aj9azyy` |
| Floresça Joias Brutas | nessajacobleal@gmail.com | ✅ 28/06 (sessao-estrategica/fb) | `86aj9b8tp` |
| Flavia Brandao | flaybrandao@gmail.com | ✅ 27/06 (sessao-estrategica/fb) | `86aj9c3ac` |
| Rosangela Araújo | rosangelaacarvalho@hotmail.com | ✅ 26/06 (diagnostico) | `86aj9c3du` |
| **Alana Mirts** | alanapkmirts@gmail.com | ❌ **NÃO está no tracking** | `86aj9c3gd` |

**Conclusão (causa raiz):** o furo é a **ponte `Calendly (agendamento) → 🤑 CRM`**, NÃO o caminho do site. Prova: a **Alana agendou mas nem passou pelo site** (zero eventos no D1, nem variação de email). Como todo mundo que agenda passa pelo Calendly — venha do site ou de DM/link direto — consertar essa ponte resolve **todos** os casos. Os 4 que estão no tracking é só porque vieram do site; o canal de entrada é incidental.

**O que falta saber — como a ponte Calendly → 🤑 CRM é feita:**
- [ ] Workflow no **n8n** (webhook do Calendly → cria tarefa no ClickUp)?
- [ ] Integração **nativa** Calendly ↔ ClickUp?
- [ ] **Manual** (o time comercial lança quem agenda)?

**Pra retomar:** descobrir o mecanismo acima. Se for n8n, olhar a execução de um agendamento recente (provável erro lá). Conferir também a config do Calendly (webhook/integração ativa? quebrou quando?).

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

1. **PRINCIPAL — consertar a ponte Calendly → 🤑 CRM.** Resolve todos os casos (inclusive os que não vêm do site, como a Alana). É o lugar certo: todo agendamento passa pelo Calendly.
2. **Corrigir o mapeamento de UTM na ingestão do Supabase** (Problema 2).
3. ~~Sync Supabase → ClickUp~~ **NÃO é a solução** pra Problema 1: o Supabase é alimentado pelo site, então não teria a Alana, e jogaria no CRM comercial leads que não agendaram. Útil só se um dia quisermos cruzar bases, não pra este furo.

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
