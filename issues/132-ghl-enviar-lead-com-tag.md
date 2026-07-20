# 132: Enviar lead ao GoHighLevel com tag por funil

**Tipo:** Implementação
**Página:** —  (backend — `functions/tracker.js`)

## Descrição

Criar `sendToGHL({ leadData, env })` como 4º destino best-effort do fan-out (só em evento de Lead, via `context.waitUntil`): `POST /contacts/upsert` com nome/email/telefone (sem tags, pra não sobrescrever) e depois `POST /contacts/{id}/tags` com a tag do funil (aditiva, usando a normalização da issue 131). Confere `res.ok` e loga erro com status+corpo; nunca bloqueia o lead. Pula se não houver email nem telefone.

## Cenários

### Happy Path
1. Lead chega em `/tracker` (`event_name = 'Lead'`).
2. `sendToGHL` monta o contato: `firstName = leadData.nome`, `email = leadData.email`, `phone = toClickUpPhone(leadData.telefone)`.
3. `POST /contacts/upsert` com `{ locationId, firstName, email, phone }` (sem `tags`) → deduplica por email/telefone, devolve `contact.id`.
4. `ghlFunnelTag(leadData.funnel)` devolve a tag; `POST /contacts/{id}/tags` com `{ tags: [tag] }` → adiciona sem remover as existentes.
5. Contato no GHL com nome/email/telefone e a tag do funil somada às anteriores.

### Edge Cases
- **Sem email e sem telefone:** não há como deduplicar → não chama o GHL (retorna cedo).
- **Sem funil (ou `ghlFunnelTag` = `null`):** faz só o upsert do contato, pula a etapa de tag.
- **Reentrada no mesmo funil:** `POST tags` com tag repetida é no-op no GHL → não duplica.
- **`TOKEN_GHL` ou `LOCAL_ID` ausentes no env:** retorna cedo com `console.error` (mesmo cuidado da lição do Evolution — não falha calado).

### Cenário de Erro
- **Upsert `!res.ok`:** `console.error` com status + corpo; sem `contactId`, a etapa de tag não roda; lead segue nos outros destinos (best-effort).
- **Add-tags `!res.ok`:** `console.error` com status + corpo; contato já foi criado/atualizado, só a tag falhou.
- **Exceção de rede:** capturada em `try/catch`, logada; nunca propaga (não bloqueia a resposta do `/tracker`).

## Arquivos

- **Modificar:** `functions/tracker.js`
  - Constantes do GHL perto das do ClickUp (~linha 522): `GHL_API = 'https://services.leadconnectorhq.com'`, `GHL_VERSION = '2021-07-28'`.
  - Função `sendToGHL({ leadData, env })` junto dos outros `sendTo*`.
  - Plugar no fan-out (~linha 219, logo após `sendToClickUp`): `context.waitUntil(sendToGHL({ leadData: body.lead_data || {}, env }));`.
  - Reutilizar `toClickUpPhone` (`tracker.js:583`) e `ghlFunnelTag` (issue 131).

## Dependências Externas

- **GoHighLevel API v2** (sem pacote npm; `fetch` direto):
  - `POST /contacts/upsert` — headers `Authorization: Bearer <TOKEN_GHL>`, `Version: 2021-07-28`, `Content-Type: application/json`. Body `{ locationId, firstName, email, phone }`. Resposta traz `contact.id` (ler `data.contact?.id`).
  - `POST /contacts/{contactId}/tags` — mesmos headers. Body `{ tags: ["funil-..."] }`.

## Checklist

- [ ] Constantes `GHL_API` e `GHL_VERSION`
- [ ] `sendToGHL({ leadData, env })` — guarda de env (`TOKEN_GHL`, `LOCAL_ID`) com `console.error`
- [ ] Retorno cedo se não houver email nem telefone
- [ ] `POST /contacts/upsert` sem `tags`, extrair `contact.id`, conferir `res.ok`
- [ ] `POST /contacts/{id}/tags` com a tag de `ghlFunnelTag`, conferir `res.ok`
- [ ] `try/catch` best-effort, nunca bloqueia
- [ ] Plugar `context.waitUntil(sendToGHL(...))` no fan-out de Lead
