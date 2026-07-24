# Sync de leads do formulário nativo do Meta → tracking

**Data:** 2026-07-24
**Status:** desenho aprovado, aguardando plano de implementação

## Problema

Leads que preenchem o **formulário nativo do Meta** (Instant Form / Lead Ads,
funil Sessão Estratégica) caem numa planilha do Google Sheets que o próprio Meta
alimenta. Hoje um workflow do **n8n lê a planilha e cria o card no ClickUp**.
Esses leads ficam **fora do tracking**: não aparecem no `/dash` e dependem de um
sistema separado (n8n) para chegar ao CRM. Objetivo: **concentrar tudo no
tracking**, aposentar o papel do n8n, e não deixar nenhum lead "separado".

Evidência do furo: ontem (23/07 15:55) entrou um lead de formulário nativo na
planilha que não apareceu no dashboard, porque não passou pelo `/tracker`.

## Fonte de dados

- Planilha **"Leads SE - Formulario Nativo"**
  (`1RwYtyDT7R94nRK-BvhjlpTCRzAyexXn47ltq1ksZMTs`).
- Aba **ativa**: `SessaoEstrategica-Nova` (leads desde 08/07; a aba antiga
  `Sessão Estratégica` parou em 06/07 e é histórica, fora do escopo).
- 20 colunas, uma linha por lead. Chave única: coluna `id` (ex `l:1008…`).

### Colunas relevantes → destino

| Coluna da planilha | Destino |
|---|---|
| `nome_completo` | 👤 Nome (ClickUp) |
| `email` | 📩 E-mail (ClickUp) + `raw_email` (D1) |
| `telefone` (remove prefixo `p:`) | ☎️ Whatsapp (via `toClickUpPhone`) |
| `qual_o_@instagram_da_sua_marca?_` | 📺 Instagram |
| `qual_o_faturamento_mensal_do_seu_negócio?` (`de_200_a_300_mil` → "De 200 a 300 Mil") | 🤑 Faturamento |
| `qual_o_principal_desafio_do_seu_negócio_atualmente?` | ✍️ Justificativa |
| `e_qual_o_seu_maior_objetivo_para_2026?` | 🎯 Objetivo |
| `campaign_name` | utm_campaign |
| `adset_name` | utm_medium |
| `ad_name` | utm_content |
| `platform` (`ig`/`fb` → `instagram`/`facebook`) | utm_source |
| `created_time` | `event_log.timestamp` |
| `id` | idempotência (`event_id = metaform:<id>`) |
| — (fixo) | 🔻 Funil → SESSÃO ESTRATÉGICA · 🛒 Produto → AE |

Normalização do faturamento: troca `_` por espaço e aplica title-case ("de_200_a_300_mil" → "De 200 A 300 Mil"), só cosmético para o card.

## Arquitetura

```
Meta → Planilha (aba SessaoEstrategica-Nova)
        │  (cron 15 min na VPS)
        ▼
  scripts/meta-leads-sync/  ── lê via Sheets API (chave vega, escopo drive,
        │                       impersona marcelle@seteads.com)
        │  POST x-sync-secret
        ▼
  /api/sync/meta-leads (Cloudflare Pages Function)
        ├── sendToClickUp()  → card + dedup + lead_dispatch + tag `formulario-meta`
        │                       + notificação WhatsApp ao comercial (Evolution)
        ├── sendToGHL()      → upsert de contato + tag de funil
        └── event_log        → funnel=sessao-estrategica, origin=meta_form, SEM CAPI
```

Mesmo padrão dos syncs existentes (`workshops`, `meta-ads`): coletor "burro" na
VPS, lógica no Pages. Reusa as funções já exportadas do `tracker.js`.

### Componente 1 — Coletor (VPS)

`scripts/meta-leads-sync/` (irmão de `scripts/workshop-sync/`):
- Lê a aba ativa via Sheets API. Credencial: `GOOGLE_KEY_PATH` (mesma chave
  `vega`), escopo **`https://www.googleapis.com/auth/drive`** (confirmado
  autorizado na delegação domain-wide), `with_subject('marcelle@seteads.com')`.
- **Marco de corte** (só daqui pra frente): na ativação, o cursor inicial é o
  `created_time` do lead mais recente já existente (23/07 15:55). Processa só
  linhas com `created_time` > cursor. Cursor persistido num arquivo local
  (`.cursor`) ou relido do D1 via um GET no endpoint — decisão no plano.
- Monta o payload normalizado (campos acima) e faz `POST` para o endpoint com
  header `x-sync-secret`.
- Idempotência de segunda camada: envia o `id` do Meta; o endpoint ignora ids já
  vistos, então reenvio acidental não duplica.

### Componente 2 — Endpoint `/api/sync/meta-leads`

Cloudflare Pages Function. Valida `x-sync-secret` (mesmo `SYNC_SECRET`). Para
cada lead do payload:
1. **Idempotência**: se já existe `event_log` com `event_id = metaform:<id>`,
   pula (nada é reprocessado).
2. **ClickUp**: `sendToClickUp({ leadData, sessionData, env, eventId })` — reusa
   dedup por telefone/email, `lead_dispatch`, notificação Evolution ao comercial.
   Estende `sendToClickUp` com um parâmetro opcional de **tag** (`formulario-meta`)
   aplicada na criação (e via API de tags quando a task já existe).
3. **GHL**: `sendToGHL({ leadData, env })` — contato + tag `funil-sessao-estrategica`.
4. **Dashboard**: grava `event_log` com `event_name='Lead'`,
   `funnel='sessao-estrategica'`, **`origin='meta_form'`**, `timestamp=created_time`,
   `raw_email`, atribuição nos campos de sessão, `sent_to_meta=0` (SEM CAPI),
   `is_bot=0`, `is_junk` conforme regra de e-mail interno.

**Não dispara**: Meta CAPI (o lead já nasceu no Meta — reenviar contaria a
conversão duas vezes), barramento WhatsApp via n8n, Supabase.

### Componente 3 — D1

- Migration nova: coluna **`origin TEXT NOT NULL DEFAULT 'site'`** em `event_log`.
  Todas as linhas existentes ficam `site`; os leads do Meta gravam `meta_form`.
- `leads.js` passa a devolver `origin` para o dashboard poder filtrar/exibir a
  origem ("tag própria" mantendo o funil somado).

## Atribuição e origem ("tag própria")

Os leads contam **junto** com Sessão Estratégica (mesmo `funnel`), mas são
distinguíveis por três marcadores:
- **Dashboard**: `event_log.origin = 'meta_form'`.
- **ClickUp**: tag `formulario-meta` na task.
- **Atribuição**: utm_source/medium/campaign/content preenchidos com
  platform/adset/campaign/ad do Meta.

## Configuração / secrets

Já existentes (reusar): `SYNC_SECRET` (Pages + VPS), `GOOGLE_KEY_PATH`,
`GOOGLE_SUBJECT`, `CLICKUP_API_TOKEN`, `TOKEN_GHL`/`LOCAL_ID`, Evolution notif.
Novos (VPS `.env` do coletor): `META_LEADS_SHEET_ID`, `META_LEADS_SHEET_TAB`,
`META_LEADS_SYNC_ENDPOINT`.

Cron na VPS: **a cada 15 min**.

## Transição / aposentar o n8n

Ao validar em produção, **desligar o workflow do n8n** que lê a planilha e cria
no ClickUp. Durante a sobreposição, o dedup de `sendToClickUp` (telefone/email)
evita cards duplicados — no pior caso o lead vira "comentado" em vez de dois
cards.

## Testing

- Coletor: rodar manual na VPS contra a aba real, conferir que só pega leads
  após o cursor e que o payload sai normalizado.
- Endpoint: lead de teste (e-mail interno `@seteads.com` → `is_junk=1`, sai das
  métricas mas exercita o pipeline) — conferir card no ClickUp com a tag,
  `lead_dispatch=criado`, `event_log.origin=meta_form`, GHL contato+tag, e
  **ausência** de chamada ao Meta CAPI.
- Idempotência: reenviar o mesmo `id` → segundo envio é ignorado.

## Fora de escopo

- Reimportar o histórico (92 leads antigos + os 8 da aba nova).
- Meta CAPI / Supabase / barramento WhatsApp via n8n para esses leads.
- Formulários de outros funis (só Sessão Estratégica hoje). O desenho é
  extensível: nova aba/funil = nova entrada de configuração + mapeamento.
