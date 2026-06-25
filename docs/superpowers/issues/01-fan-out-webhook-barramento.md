# 01: Fan-out de Lead para o webhook do barramento (WhatsApp)

**Tipo:** Implementação
**Página:** — (backend: `functions/tracker.js`)

## Descrição

Adicionar um terceiro destino **incondicional** ao array `crmDestinations` em `functions/tracker.js`, reusando a função `sendToCRM` existente, para que todo evento `Lead` seja também enviado a um webhook único do n8n (barramento). Inclui declarar as novas env vars `LEAD_WEBHOOK_URL_WHATSAPP` e `LEAD_WEBHOOK_TOKEN_WHATSAPP` (Cloudflare Pages: preview + prod).

## Escopo

- **Arquivo:** `functions/tracker.js` (único arquivo de código a tocar).
- Inserir no array `crmDestinations`:
  ```js
  { url: env.LEAD_WEBHOOK_URL_WHATSAPP, token: env.LEAD_WEBHOOK_TOKEN_WHATSAPP },
  ```
- O destino é incondicional (igual ao do CRM Supabase), enviando o payload completo (`nome`, `telefone`, `funnel`, `email`, `instagram`, `faturamento` + `attribution`) via `x-webhook-token`.
- Sem nova função, sem alterar a captura das páginas.

## Critérios de aceite

- Um lead da LP da live gera, além de ClickUp/Supabase, um POST no webhook do barramento.
- Nenhuma mudança quebra a captura/conversão atual das páginas (fire-and-forget mantido).
- Env vars documentadas como pendência de configuração no Cloudflare Pages (preview + prod).

## Fora de escopo

- Montagem/ativação do workflow no n8n → ver runbook `docs/superpowers/runbooks/01-workflow-n8n-barramento-whatsapp.md`.

---

## Pesquisa na base de código (reuso)

- `functions/tracker.js:176` — array `crmDestinations`, hoje com 2 destinos (`primaryUrl` por funil + CRM Supabase). É exatamente o ponto de extensão.
- `functions/tracker.js:180` — loop que itera os destinos: já faz `if (!dest.url) continue;` (pula destino sem env var) e `context.waitUntil(sendToCRM({...url: dest.url, token: dest.token}))` (fire-and-forget, independente por destino).
- `functions/tracker.js:359` — `sendToCRM`: já monta o payload `{ ...leadData, attribution }` e seta `headers['x-webhook-token'] = token` quando há token. **Nada a mudar aqui.**
- Guarda em `functions/tracker.js:167` — só dispara para `event_name === 'lead'`.

**Conclusão:** reuso total. Não há função nova nem nova chamada `fetch`. Basta acrescentar um item ao array.

## Cenários

### Happy Path
1. Lead chega no `/tracker` com `event_name = 'lead'`.
2. O loop percorre `crmDestinations`: ClickUp (primário), CRM Supabase e **o novo webhook do barramento**.
3. `sendToCRM` faz POST no `LEAD_WEBHOOK_URL_WHATSAPP` com `x-webhook-token = LEAD_WEBHOOK_TOKEN_WHATSAPP` e payload completo.
4. n8n recebe, roteia por funil e (para `lives-semanais-v1`) dispara o template.

### Edge Cases
- Env var `LEAD_WEBHOOK_URL_WHATSAPP` ausente (ex.: ambiente não configurado) → `if (!dest.url) continue;` pula o destino sem erro. Os outros destinos seguem.
- Evento não-Lead (PageView, Purchase) → bloco inteiro não executa (guarda na linha 167).

### Cenário de Erro
- Falha de rede no POST → `sendToCRM` já tem `try/catch` que faz `console.error('CRM forward error', ...)` e não propaga. Como é `context.waitUntil`, a resposta ao site não é afetada (conversão nunca trava).

## Arquivos

- **Modificar:** `functions/tracker.js` — adicionar 1 item ao array `crmDestinations` (linha 176-179). Nenhum outro arquivo de código.

## Configuração (fora do código, registrar como pendência)

- Cloudflare Pages → env vars em **preview + prod**:
  - `LEAD_WEBHOOK_URL_WHATSAPP` — URL de produção do webhook n8n.
  - `LEAD_WEBHOOK_TOKEN_WHATSAPP` — token do header `x-webhook-token`.

## Checklist

- [x] Adicionar `{ url: env.LEAD_WEBHOOK_URL_WHATSAPP, token: env.LEAD_WEBHOOK_TOKEN_WHATSAPP },` ao array `crmDestinations` em `functions/tracker.js`.
- [x] Comentário curto explicando o destino (barramento WhatsApp), no padrão dos comentários existentes.
- [x] Confirmar que não há outras alterações no arquivo (escopo de 1 linha + comentário).
- [ ] Anotar pendência das 2 env vars no Cloudflare (preview + prod) — configuração manual da usuária.
