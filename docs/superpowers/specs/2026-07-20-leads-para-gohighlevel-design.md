# Design — Enviar leads ao GoHighLevel com tag por funil

**Data:** 2026-07-20
**Status:** aprovado no brainstorming, aguardando revisão do spec

## Contexto

Hoje todo lead do site (`POST /tracker`) faz fan-out em paralelo para ClickUp
(direto na API), CRM Supabase e barramento de WhatsApp — ver `functions/tracker.js`
(bloco "Encaminhar lead ao CRM", ~linha 206). O GoHighLevel (GHL) é a ferramenta de
email marketing da operação (domínio de envio `ae.atacadoexponencial.com`), mas os
leads do site **não** chegam nele automaticamente hoje.

Esta é a **feature 1 de 3** de um conjunto maior sobre email/GHL. As outras duas
(capturar abertura/clique de email; aba de email no dash) são features separadas, com
spec próprio, e ficam **fora do escopo** deste documento.

## Objetivo

Ao receber um evento de Lead, criar/atualizar o contato no GHL e aplicar uma tag que
identifica o **funil** de origem — de forma **aditiva**, para que um lead que passa por
vários funis acumule todas as tags. As tags apenas marcam (segmentação manual); **não**
disparam nenhuma automação do GHL nesta fase.

## Arquitetura

Adicionar o GHL como **mais um destino** do fan-out existente em `functions/tracker.js`,
no mesmo molde best-effort dos outros (`context.waitUntil`, não bloqueia a conversão do
lead). Nova função `sendToGHL({ leadData, env })`, disparada só para eventos de Lead.

Nenhum endpoint existente é alterado; a mudança é aditiva.

## Fluxo (duas chamadas à API do GHL)

Base: `https://services.leadconnectorhq.com`
Headers: `Authorization: Bearer <TOKEN_GHL>`, `Version: 2021-07-28`, `Content-Type: application/json`

1. **Upsert do contato** — `POST /contacts/upsert`
   Body: `{ locationId, firstName: <nome>, email, phone }`.
   **Sem** o campo `tags` — assim o upsert nunca sobrescreve tags já existentes no
   contato. Deduplica por email/telefone (cria ou atualiza o mesmo contato). Resposta
   traz o `contact.id`.

2. **Adicionar a tag do funil** — `POST /contacts/{contactId}/tags`
   Body: `{ tags: ["funil-<funil>"] }`.
   É **aditivo**: não remove tags existentes. Adicionar uma tag que o contato já tem é
   no-op no GHL, então reentrada no mesmo funil não duplica; entrada em funil novo soma
   a tag nova às antigas.

## Normalização do funil → tag

A tag é **derivada** do funil efetivo do lead (não há tabela fixa — funis podem surgir
via `&funnel=` na URL), com prefixo `funil-` e duas regras especiais:

| Funil de entrada | Tag resultante |
|---|---|
| `lives-semanais-v1`, `lives-semanais-v2` | `funil-lives-semanais` |
| `diagnostico` (chat da home) | `funil-sessao-estrategica` |
| qualquer outro (`workshop`, `sessao-estrategica`, `trafego-atacado`, `aplicacao-mentoria`, `calculadora`, futuros…) | `funil-<nome>` |

A regra `lives-*` implementa o pedido "separar por funil, não por LP". A regra
`diagnostico → sessao-estrategica` reflete que a home é o funil de sessão estratégica
(consistente com o rename interno pendente `diagnostico→sessao-estrategica`; este spec
**não** executa esse rename, só espelha o resultado na tag).

## Configuração / secrets

`TOKEN_GHL` (Private Integration Token, prefixo `pit-`) e `LOCAL_ID` (locationId) estão
hoje só no `.env` local. Para valer em produção viram **secrets do Pages**
(`wrangler pages secret put ... --project-name tracking-ae`). Lição do incidente do
Evolution (2026-07-20): secret nova só entra em vigor **no deployment seguinte** — após
cadastrar, forçar um novo deploy.

## Tratamento de falha

Best-effort, nunca trava o lead. Diferente do bug do Evolution: a função **confere
`res.ok`** de cada chamada e loga `console.error` com status + corpo quando falha. Não
há retry nesta fase (o lead já está garantido no D1 e nos outros destinos).

## Casos de borda

- **Lead sem funil** (raro): faz o upsert do contato mesmo assim, sem aplicar tag.
- **Lead sem email e sem telefone**: não há como deduplicar → pula o GHL (só acontece se
  o form falhar na validação; email é obrigatório em todas as LPs desde `3630df1`).
- **Upsert falha**: sem `contactId`, a etapa 2 não roda; erro logado, lead segue nos
  outros destinos.

## Fora de escopo (features/itens separados)

- Captura de abertura/clique de email (feature 2 — depende do webhook LCEmailStats e de
  app de nível location; ver [[metricas-email-gohighlevel]]).
- Aba de email no dashboard (feature 3).
- Backfill dos leads históricos para o GHL — só valem leads novos a partir do deploy.
- Disparo de automação/nutrição pela tag — decisão explícita de "só marcar por enquanto".

## Como testar

Enviar um lead de teste com `email = marcelle@seteads.com` (já marcado `is_junk`, não
suja métrica) via `POST /tracker` e confirmar no GHL: o contato existe e carrega a tag
`funil-lives-semanais` (ou a do funil usado no teste). Repetir com um segundo funil e
confirmar que a segunda tag **soma** à primeira no mesmo contato.
