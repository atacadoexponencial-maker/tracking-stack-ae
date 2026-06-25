# Design — Barramento de leads + WhatsApp por funil

**Data:** 2026-06-25
**Status:** Aprovado (aguardando revisão final do spec)

## Objetivo

Fazer com que **todo lead, de qualquer página do site**, seja enviado a um webhook único do n8n ("barramento de leads"), permitindo disparar mensagens de WhatsApp (API oficial) de forma controlada — ativando/desativando por funil **sem tocar no site**.

Primeira versão (v1): infraestrutura completa + funil **`lives-semanais-v1`** ativo de ponta a ponta. Os demais funis ficam com o encanamento pronto, prontos para plugar quando seus templates forem aprovados.

## Contexto atual

- O site fala apenas com `functions/tracker.js` (Cloudflare Pages Function).
- Para eventos `Lead`, o `/tracker` já faz **fan-out** para dois destinos via `sendToCRM`: ClickUp (varia por funil) e CRM Supabase (incondicional). Cada destino dispara de forma independente (`context.waitUntil`, fire-and-forget).
- Funis existentes (todos capturam `nome` e `telefone`):
  | Funil | Origem |
  |-------|--------|
  | `lives-semanais-v1` | `src/pages/lives-semanais-v1.astro` |
  | `diagnostico` | `src/components/LeadChat.astro` |
  | `workshop` | `src/components/LeadFormModal.astro` |
  | `calculadora` | `src/pages/calculadora-atacado/index.astro` |
- n8n roda na VPS em modo fila (Docker Swarm) atrás do Traefik. Webhooks de produção em `https://webhook.seteaceleradora.com.br/webhook/<id>`. Credencial de envio do WhatsApp já existe: `WhatsApp account` (`whatsAppApi`). Ver [[vps-n8n-arquitetura]].

## Arquitetura

Front "burro", toda a inteligência no n8n. O site ganha **um destino a mais** no fan-out já existente; a decisão de "qual funil dispara WhatsApp e com qual template" fica 100% no n8n.

```
QUALQUER página → /tracker (fan-out de Lead)
   ├── ClickUp (n8n)              [já existe]
   ├── CRM Supabase               [já existe]
   └── 🆕 Webhook barramento (n8n) [NOVO — recebe TODOS os leads]
              │
              ▼
       Workflow n8n (novo)
       1. Webhook (POST, Header Auth = token) → responde 200
       2. Switch por funnel
            ├─ lives-semanais-v1 → ATIVO
            └─ default            → NoOp (não envia, não erra)
       3. Normaliza telefone (55+DDD)
       4. HTTP Request → Graph API: envia template (nome_lead = nome)
```

## Componentes

### 1. `functions/tracker.js` (mudança mínima)

Adicionar um terceiro destino **incondicional** ao array `crmDestinations`:

```js
{ url: env.LEAD_WEBHOOK_URL_WHATSAPP, token: env.LEAD_WEBHOOK_TOKEN_WHATSAPP },
```

Reusa a função `sendToCRM` existente — sem nova função. O webhook recebe o payload completo (`nome`, `telefone`, `funnel`, `email`, `instagram`, `faturamento` + `attribution`). Nenhuma alteração na captura das páginas.

Novas env vars (Cloudflare Pages, preview + prod):
- `LEAD_WEBHOOK_URL_WHATSAPP` — URL do webhook de produção do n8n.
- `LEAD_WEBHOOK_TOKEN_WHATSAPP` — token compartilhado para o header `x-webhook-token`.

### 2. Workflow n8n (novo)

- **Webhook node** (POST) com Header Auth esperando `x-webhook-token`. Responde 200 imediatamente.
- **Switch** por `{{ $json.body.funnel }}`: ramo `lives-semanais-v1` ativo; saída default → **NoOp**.
- **Normalização de telefone**: portar a função `normalizePhone` do `tracker.js` (tira não-dígitos, remove zeros à esquerda, prefixa `55`) para um Code node — garante o número idêntico ao que o Meta CAPI já usa.
- **Envio**: **HTTP Request** para a Graph API do WhatsApp (o template usa **variável nomeada** `{{nome_lead}}`, que o node nativo do n8n pode não montar bem; HTTP Request dá controle total do `components`). Credencial: `WhatsApp account`. Body param: `nome_lead = {{ $json.body.nome }}`.

Template da live: **em aprovação na Meta**. Nome exato, idioma e estrutura a plugar quando aprovar.

### 3. Tratamento de erro

- Funil sem ramo → NoOp (segue normalmente).
- Falha no envio (número inválido, template não aprovado) → node com **Continue on Fail**: registra erro, não quebra o recebimento.
- Webhook responde 200 rápido; o `/tracker` é fire-and-forget, então nunca trava a conversão.

### 4. Segurança

Webhook exige header `x-webhook-token` (mesmo padrão do destino Supabase). Sem isso, terceiros poderiam injetar leads falsos e gerar custo de disparos pagos. Credencial Header Auth criada no n8n.

## Fora de escopo (v1)

- Templates/ativação dos funis `diagnostico`, `workshop`, `calculadora` (encanamento pronto; ativar depois).
- Régua de relacionamento / lembretes da live (mensagens agendadas) — evolução futura.
- Persistência das mensagens recebidas (assunto separado).

## Critérios de sucesso

1. Um lead da LP da live gera, além de ClickUp/Supabase, um POST no webhook do barramento.
2. O workflow roteia o funil `lives-semanais-v1` e envia o template com o nome correto preenchido.
3. Leads de outros funis chegam ao webhook mas **não** disparam envio (NoOp), sem erro.
4. Webhook rejeita requisições sem o token válido.
5. Nenhuma mudança quebra a captura/conversão atual das páginas.
