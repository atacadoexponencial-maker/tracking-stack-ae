# 142: Endpoint `/api/sync/meta-leads`

**Tipo:** Implementação
**Página:** functions/api/sync/meta-leads.js (backend)

## Descrição

Criar a Pages Function que valida `x-sync-secret`, e para cada lead do payload: ignora `id` do Meta já processado (idempotência via `event_id = metaform:<id>`), reusa `sendToClickUp` (com tag `formulario-meta`) e `sendToGHL`, e grava `event_log` com `event_name='Lead'`, `funnel='sessao-estrategica'`, `origin='meta_form'`, atribuição e `sent_to_meta=0` (SEM Meta CAPI). Referência: spec, "Componente 2 — Endpoint".

## Cenários

### Happy Path
Coletor faz POST com `{ leads: [...] }` e `x-sync-secret` válido. Para cada lead novo: cria sessão sintética (`session_id = metaform:<id>`) com os UTMs para o JOIN de atribuição do dashboard; cria/atualiza o card no ClickUp com a tag `formulario-meta`; faz upsert no GHL; grava `event_log` (funnel `sessao-estrategica`, `origin=meta_form`, sem CAPI). Resposta: `{ ok, received, created, skipped, failed }`.

### Edge Cases
- Lead já processado (mesmo `meta_id`): detectado por `SELECT` em `event_log` — pula sem tocar ClickUp/GHL (`skipped++`).
- Lead sem `meta_id`: `failed++`, não processa.
- `created_ts` ausente: usa `now` como fallback.
- E-mail interno (`@seteads.com`): `is_junk=1` — sai das métricas mas exercita o pipeline inteiro (mesma regra do `/tracker`).

### Cenário de Erro
- `x-sync-secret` ausente/errado → 401. Sem `env.DB` → 500. JSON inválido → 400.
- Erro ao processar um lead individual: `try/catch` isola (`failed++`), os demais seguem; `sync_log` grava status `error` com a contagem.

## Banco de Dados
- Escreve em `sessions` (linha sintética por lead), `event_log` (com `origin`), e — via `sendToClickUp` — `lead_dispatch`. `sync_log` com `platform='meta_leads'`.

## Arquivos
- **Criar:** `functions/api/sync/meta-leads.js` — o endpoint.
- **Modificar:** `functions/tracker.js` — exportar `sendToGHL` e `isInternalTestEmail` (o `sendToClickUp` e a extensão de tag vieram da issue 141).

## Dependências
- Reusa de `functions/tracker.js`: `sendToClickUp`, `sendToGHL`, `isInternalTestEmail`.

## Checklist
- [x] Endpoint `functions/api/sync/meta-leads.js` com auth `x-sync-secret`
- [x] Idempotência por `event_id = metaform:<meta_id>`
- [x] Sessão sintética em `sessions` para atribuição no dashboard
- [x] Reuso de `sendToClickUp` (tag `formulario-meta`) + `sendToGHL`
- [x] `event_log` com `funnel=sessao-estrategica`, `origin=meta_form`, sem CAPI
- [x] `sync_log` (`platform='meta_leads'`) + resposta com contadores
- [x] Exports adicionados em `tracker.js` (`sendToGHL`, `isInternalTestEmail`)
