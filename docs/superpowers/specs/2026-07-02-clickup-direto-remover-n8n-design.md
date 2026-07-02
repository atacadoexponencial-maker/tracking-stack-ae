# Spec — Criar leads direto no ClickUp (remover o n8n do caminho do ClickUp)

**Data:** 2026-07-02
**Status:** desenho aprovado, aguardando revisão da spec
**Memória:** [[remover-n8n-clickup-direto]]
**Fonte da verdade do fluxo n8n atual:** `Downloads/Typebot -_ Click-Up.json` (export do workflow "Typebot -> Click-Up")

---

## Problema

O `/tracker` (`functions/tracker.js`) faz fan-out do lead para três webhooks do n8n. Um deles, `LEAD_WEBHOOK_URL`, leva `n8n → ClickUp` (cria a task do lead na 🤑 CRM). O n8n vem dando problemas recorrentes, e a criação da task depende dele. Queremos **eliminar o n8n desse caminho**, criando a task **direto na API do ClickUp** de dentro do próprio `/tracker` (backend), sem perder nenhuma capacidade do fluxo atual.

Fora de escopo (não muda nada): Meta CAPI, GA4, `event_log`, roteamento de redirect, o CRM Supabase (`LEAD_WEBHOOK_URL_CRM` — **já é direto**, não passa pelo n8n) e o barramento WhatsApp (`LEAD_WEBHOOK_URL_WHATSAPP`).

---

## Estado atual (o que o n8n faz hoje, p/ o lead do site)

Fluxo do webhook para o funil diagnóstico (chat nativo do site → `/tracker` → `LEAD_WEBHOOK_URL` → n8n):

1. Normaliza campos (telefone → `+55…`, só dígitos, sem zeros à esquerda).
2. *(Debounce Redis de 2 min — específico do Typebot, que postava parciais. **Não é necessário**: o chat nativo dispara o Lead uma única vez com o lead completo.)*
3. **Busca** na lista `205126080` uma task cujo custom field de telefone (`754a41c9…`) == telefone do lead.
4. **Se existe** → muda status para `LEADS DE ENTRADA` + adiciona **comentário** "Lead Voltou ao CRM" com os dados novos.
5. **Se não existe** → **cria a task** com os custom fields (mapeamento abaixo).
6. **Erro ao criar** → dispara alerta no WhatsApp da Marcelle (Evolution API).
7. Notificação interna pro comercial a cada lead: "Novo lead no CRM 🎉" (criação) / "Voltou ao CRM 🎉" (dedup).

**Onde os leads caem:** lista `205126080` (🤑 CRM), folder `90130846433` (Comercial), space `90131757817` (1 SETE ACELERADORA), team `3100163`.

**Bug latente do n8n:** ele lê Instagram de `body.site`, mas o chat nativo manda `lead_data.instagram` → hoje o Instagram chega **vazio** no ClickUp. A migração corrige isso.

---

## O que o site envia (`functions/tracker.js` → `sendToCRM`)

O chat (`src/components/LeadChat.astro`) dispara UMA vez, em `event_name: 'Lead'`, com:

```
lead_data: { nome, telefone, email, instagram, faturamento, funnel }
```

O `sendToCRM` monta o payload com `...leadData` + UTMs no topo (`utm_source/medium/campaign/content/term`) + `attribution{}`. Campos `justificativa`/`objetivo` **não existem** no chat nativo (ficam vazios, como já acontece).

---

## Desenho da solução

### Componente novo: `sendToClickUp(...)` em `functions/tracker.js`

Função isolada, disparada em `context.waitUntil` (fire-and-forget, nunca bloqueia a conversão), quando `event_name === 'lead'` e o funil é **qualquer um exceto `workshop`** — exatamente o conjunto que hoje usa `LEAD_WEBHOOK_URL` (diagnóstico, `lives-semanais-v1` e demais). Isso preserva 100% o comportamento atual (as lives também viram task, como já acontece). Substitui o destino `{ url: primaryUrl }` (n8n → ClickUp) no array `crmDestinations`; o ramo `workshop` (`LEAD_WEBHOOK_URL_WORKSHOP`) continua indo pro n8n.

Reusa a `normalizePhone` já existente no arquivo (a task deve gravar o mesmo telefone `+55…` que o Meta CAPI usa).

**Fluxo:**

```
1. Normaliza telefone → phoneE164 = '+55…' (dígitos; prefixa 55 se faltar)
2. DEDUP:
   a. GET tasks na lista CLICKUP_LIST_ID filtrando custom field telefone (754a41c9…) == phoneE164
   b. se vazio → GET filtrando custom field email (24f5a3d3…) == email
3a. ACHOU (task existente) →
      - PUT /task/{id}  status = "LEADS DE ENTRADA"
      - POST /task/{id}/comment  (texto "Lead Voltou ao CRM" + dados novos)
      - best-effort: WhatsApp "Voltou ao CRM 🎉" pro comercial
3b. NÃO ACHOU →
      - POST /list/{CLICKUP_LIST_ID}/task  (name + custom_fields, mapeamento abaixo)
      - best-effort: WhatsApp "Novo lead no CRM 🎉" pro comercial
4. RESILIÊNCIA:
   - As chamadas de ESCRITA (create/comment/status) usam helper com 1 retry em erro
     transitório (HTTP 429 / 5xx / falha de rede).
   - Se a escrita principal (criar OU comentar) falhar mesmo após o retry:
       → INSERT em D1 clickup_sync_failures (lead completo + erro)
       → best-effort: WhatsApp de alerta pra Marcelle
```

As chamadas best-effort (notificação/alerta via Evolution API) são `try/catch` silenciosas — o worker nunca falha por causa delas, e elas nunca atrasam a resposta ao visitante.

### Mapeamento de campos — criar task (lista `205126080`)

`name` = `nome`. `custom_fields`:

| Origem (lead) | Field ID | Campo ClickUp |
|---|---|---|
| nome | `7f70363f-9fc4-4d34-aab1-0a81d4a6f45d` | 👤 Nome |
| email | `24f5a3d3-e21e-4e08-b396-8a4ce2133a98` | 📩 E-mail |
| instagram | `3f24aa2d-050f-4be2-ab63-09b91307919b` | 📺 Instagram |
| faturamento | `97d8308d-d6b2-4dd6-9bd7-76f6662d5de2` | 🤑 Faturamento Mensal |
| telefone → +55 | `754a41c9-2835-48d5-a70e-8b61841e0037` | ☎️ Whatsapp |
| funnel → opção *(ver abaixo)* | `a663b002-661c-4dc1-86c3-612e94f3a447` | 🔻 Funil (dropdown) |
| *(fixo)* | `6fd27248-beb5-49e1-9626-f1ab7ed81e5a` = `6cf677ce-5592-4ff7-9f63-d18d52d42be5` | 🛒 Produto = AE |
| utm_source | `64ffa839-dac1-4995-9cbb-7bd50f9dc5d5` | Fonte |
| utm_medium | `e367ce2e-a06c-43b6-ac9b-0feb4923f007` | Mídia |
| utm_content | `5710cb4d-a375-464b-8ac6-5267745eaddc` | Conteúdo |

Campos vazios são omitidos do array (não mandar `""` onde não há valor, seguindo o padrão do `/tracker`).

**Mapa funil do site → opção do dropdown 🔻 Funil** (corrige o n8n atual, que marcava tudo como SESSÃO ESTRATÉGICA):

| `funnel` (lead) | Opção ClickUp | Option ID |
|---|---|---|
| `diagnostico` (e default/desconhecido) | SESSÃO ESTRATÉGICA | `a158d342-c1ac-4705-a6da-ce39019f0a2a` |
| `lives-semanais-v1` | LIVES SEMANAIS | `e6893b0b-5a69-4f48-9c99-a3c0a415a118` |
| `workshop` *(futuro; hoje no n8n)* | WORKSHOP | `b5e04cdb-f62d-4159-b89b-751726a61831` |

Funil não reconhecido → **fallback SESSÃO ESTRATÉGICA** (preserva o comportamento atual, nunca deixa o campo vazio).

### Comentário (task existente)

Texto no formato do n8n:

```
Lead Voltou ao CRM:

Novos Dados:
Nome: {nome}
Telefone: {phoneE164}
E-mail: {email}
Instagram: {instagram}
Faturamento: {faturamento}

{utm_source} - {utm_medium} - {utm_content}
```

E status → `LEADS DE ENTRADA`.

### Notificações internas (Evolution API, best-effort)

Mensagem "Novo lead no CRM 🎉" (criação) / "Voltou ao CRM 🎉" (dedup) pro número do comercial, no formato do export (Nome/Número/Whatsapp link/Email/Instagram/Faturamento). POST em `EVOLUTION_API_URL` com header `apikey`.

### Alerta de falha (Evolution API, best-effort)

Se a escrita principal falhar após o retry: WhatsApp curto pra Marcelle ("Erro ao criar lead no ClickUp: {erro}") + o registro em D1 garante que o lead não se perde.

---

## Dados — nova tabela D1 `clickup_sync_failures`

```sql
CREATE TABLE IF NOT EXISTS clickup_sync_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  phone TEXT,
  email TEXT,
  lead_json TEXT NOT NULL,   -- payload completo do lead p/ replay
  error TEXT,                -- mensagem/status do erro
  resolved INTEGER NOT NULL DEFAULT 0
);
```

Consultável pela usuária; base para um replay manual/futuro. (Replay automático fica fora desta spec — YAGNI.)

---

## Configuração — secrets novos no Cloudflare (nada no front)

| Var | Uso |
|---|---|
| `CLICKUP_API_TOKEN` | Bearer token da API do ClickUp (reaproveitar o existente; **rotacionar** recomendado) |
| `CLICKUP_LIST_ID` | `205126080` (lista da 🤑 CRM) |
| `EVOLUTION_API_URL` | Endpoint sendText da Evolution (ex.: `https://api.marcellemesquita.com.br/message/sendText/MarcelleProfissional`) |
| `EVOLUTION_APIKEY_ALERTA` + `EVOLUTION_NUMERO_ALERTA` | Alerta de falha (Marcelle) |
| `EVOLUTION_APIKEY_NOTIF` + `EVOLUTION_NUMERO_NOTIF` | Notificação interna (comercial) |

> Os apikeys da Evolution **vazaram em texto** no export do n8n — rotacionar ao migrar.

---

## Critérios de sucesso

1. Lead novo de qualquer funil não-workshop **cria a task** na `205126080` com todos os campos certos — **incluindo Instagram** (que hoje vem vazio).
2. Lead repetido (mesmo telefone **ou** email) **não duplica**: muda status p/ `LEADS DE ENTRADA` e adiciona comentário.
3. O funil da task reflete o funil de origem: diagnóstico → **SESSÃO ESTRATÉGICA**, live → **LIVES SEMANAIS**.
4. Notificação interna "Novo lead / Voltou ao CRM 🎉" chega pro comercial.
5. Se o ClickUp falhar: 1 retry; persistindo, o lead vai pra `clickup_sync_failures` **e** um alerta chega no WhatsApp da Marcelle. **Nenhum lead é perdido.**
6. Nenhuma chamada best-effort (Evolution) atrasa/quebra a resposta do `/tracker`.
7. Meta CAPI, GA4, Supabase, barramento WhatsApp e o roteamento de redirect seguem idênticos.

## Pós-implementação (validação em produção)

- Conferir 1 lead novo e 1 repetido no ClickUp.
- Remover a env `LEAD_WEBHOOK_URL` e **desligar** o workflow n8n do ClickUp.

## Fora de escopo (specs próprias, depois)

- Funil **workshop** direto no ClickUp (`LEAD_WEBHOOK_URL_WORKSHOP` → outro fluxo/lista).
- Renomear o rótulo interno `diagnostico` → `sessao-estrategica` ([[renomear-funil-diagnostico-sessao-estrategica]]).
- Replay automático da `clickup_sync_failures`.
