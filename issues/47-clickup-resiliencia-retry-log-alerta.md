# 47: Resiliência — retry + log em D1 + alerta de falha

**Tipo:** Implementação
**Página:** ClickUp direto — remover n8n (transversal)

## Descrição

Envolver as chamadas de ESCRITA ao ClickUp (criar/comentar/status) num helper com 1 retry em erro transitório. Se a escrita principal falhar mesmo após o retry, gravar o lead em `clickup_sync_failures` e disparar alerta no WhatsApp da Marcelle (best-effort). Nenhum lead pode se perder.

> **Nota de arquitetura:** `docs/architecture.md` define "no retry / no alerting" como filosofia v1. Este comportamento é um **desvio intencional, pedido pela usuária** ("não posso perder leads"), restrito ao caminho do ClickUp. Não muda a filosofia dos demais fan-outs (Meta/GA4).

## Cenários

### Happy Path
1. `clickupWrite(fetchFn)` executa a chamada; se resposta `429` ou `5xx` ou throw de rede → espera curta e tenta **1 vez** mais.
2. Sucesso em qualquer tentativa → segue normal.

### Edge Cases
- Erro `4xx` que não seja 429 (ex.: 401 token inválido) → **não** faz retry (não é transitório); vai direto pro fallback de falha.

### Cenário de Erro
- Escrita principal (criar OU comentar) falha após o retry:
  1. `INSERT INTO clickup_sync_failures (phone, email, lead_json, error)` via `env.DB` (dentro de `waitUntil`/try-catch — se o D1 também falhar, ao menos o alerta sai).
  2. Alerta best-effort: `POST {EVOLUTION_API_URL}` header `apikey: {EVOLUTION_APIKEY_ALERTA}`, body `{ number: EVOLUTION_NUMERO_ALERTA, text: "Erro ao criar lead no ClickUp: <erro>" }`.
- O alerta e o log nunca lançam para fora (try/catch silencioso).

## Banco de Dados

- Usa `clickup_sync_failures` (criada na issue 43).

## Arquivos

- **Modificar:** `functions/tracker.js` — `clickupWrite(fn)` (retry) envolvendo create/comment/status; `logClickUpFailure(leadData, phone, email, error, env)` (INSERT D1); `sendEvolutionMessage(apikey, number, text, env)` (helper compartilhado com a issue 48).

## Checklist

- [x] `clickupWrite(fn)` com 1 retry em 429/5xx/erro de rede; sem retry em 4xx não-429
- [x] `logClickUpFailure(...)` grava lead completo em `clickup_sync_failures`
- [x] `sendEvolutionMessage(...)` helper genérico (reusado pela issue 48)
- [x] Alerta de falha pra `EVOLUTION_NUMERO_ALERTA` com `EVOLUTION_APIKEY_ALERTA`
- [x] Log e alerta são best-effort (try/catch, nunca quebram o fluxo)
