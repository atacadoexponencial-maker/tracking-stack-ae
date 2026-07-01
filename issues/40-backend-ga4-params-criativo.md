# 40: Enviar `funnel` + UTMs como params do evento no payload do GA4
**Tipo:** Implementação
**Página:** Tracking / integração GA4 (breakdown por criativo)

## Descrição
Enriquecer o payload do Measurement Protocol enviado ao GA4 em `sendToGA4` com `funnel` e os `utm_*` (principalmente `utm_content`), para que os eventos de conversão (`generate_lead` etc.) possam ser segmentados por criativo (`ad02`/`ad03`) dentro do GA4.

## Contexto / Reuso (NÃO reconstruir)
- `functions/tracker.js` JÁ enriquece o evento com a linha da sessão: `sessionData` (SELECT * FROM sessions) contém `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` e `funnel`.
- `sendToGA4({ body, gaClientId, gaSessionId, hashedEm, env })` (chamada em `tracker.js:126`, definida ~`tracker.js:340`) HOJE monta `params` só com `session_id`, `engagement_time_msec`, `page_location`.
- O GA4 já está conectado e funcionando (env vars `GA4_MEASUREMENT_ID` / `GA4_API_SECRET` em produção; validado com `ga4_status_code=204`). Esta issue NÃO mexe em env/conexão.
- Funil efetivo do evento = mesmo critério do dashboard: `COALESCE(NULLIF(<funnel do evento>, ''), sessionData.funnel)`. O funil do evento vem do formulário (`body.lead_data?.funnel`), como já usado na gravação do `event_log`. Reaproveitar esse valor, não recalcular de outro jeito.

## O que fazer
1. Passar os campos necessários para `sendToGA4`: incluir `sessionData` (ou os `utm_*` extraídos dela) e o `funnel` efetivo do evento nos argumentos da função.
2. Dentro de `sendToGA4`, adicionar a `params` (mantendo os existentes): `funnel`, `utm_content`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`.
3. Omitir/valor vazio quando o dado não existir (não enviar `undefined`; string vazia ou ausência do param).
4. Manter o gate atual: PageView continua sendo `skipped` (`tracker.js:346`); só conversões levam os params.
5. Não alterar o mapeamento de nome de evento (`generate_lead`/`purchase`/`begin_checkout`) nem `client_id`/`session_id`/`user_properties` já existentes.

## Critérios de aceite
- Um `Lead` real gera evento GA4 cujo `ga4_payload_sent` (gravado no `event_log`) contém `params.funnel` e `params.utm_content` preenchidos quando a sessão tem esses dados.
- `utm_source/medium/campaign/term` também presentes no payload.
- Eventos sem UTM/funil não quebram (params ausentes ou vazios, sem `undefined`).
- `ga4_status_code` continua `204`/`ga4_response_ok=1` (sem regressão na entrega).
- PageView continua sem ser enviado ao GA4.

## Arquivos
- MODIFICAR: `functions/tracker.js`

## Fora de escopo
- Registrar as dimensões personalizadas no painel do GA4 (issue 41 — sem isso os params chegam mas não aparecem nos relatórios).
- Qualquer mudança no envio ao Meta/CRM ou no `event_log`.
- Dashboard puxando dados do GA4 (Data API) — issue/spec separada.
