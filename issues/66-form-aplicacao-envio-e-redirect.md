# 66: Envio do formulário de aplicação e redirecionamento pós-envio

**Tipo:** Implementação
**Página:** Página de Aplicação (`/aplicacao-mentoria`)

## Descrição

Com todos os campos válidos, ao clicar em enviar o botão entra em estado de envio (desabilitado, texto "Enviando…", sem cliques repetidos) e o lead é entregue ao fluxo de captação já existente do site (`/tracker`) com todas as respostas — nome, whatsapp, email, instagram, faturamento, cargo, principal desafio (justificativa) e maior objetivo — mais a identificação de que veio desta página (funnel próprio) e a atribuição de campanha da visita (UTMs já capturadas pelo mecanismo padrão). Após resposta bem-sucedida, redirecionar automaticamente para o destino retornado pelo backend (faixa "Menos de 20 Mil" → conversa de WhatsApp; demais faixas → página de agendamento — regra decidida pelo backend, nunca pela página). Se o envio falhar ou o destino não vier, redirecionar para um destino padrão da página, sem nova tentativa automática que duplicaria o lead. Nenhuma regra de negócio ou segredo na página.

## Decisões de Plano

Pesquisa feita em `src/pages/lives-semanais-v1.astro` (form de página que envia lead), `src/components/LeadChat.astro` (chat que envia lead) e `functions/tracker.js` (contrato do endpoint). O padrão existente é reutilizado na íntegra — nada novo é inventado.

- **Funnel:** `aplicacao-mentoria`. No `functions/tracker.js` (bloco "Roteamento pós-captação", ~linha 319), funis que não são `workshop` nem `lives-semanais-v1` caem no `else`, que roteia pelo faturamento: `"menos de 20"` → `env.LEAD_REDIRECT_WHATSAPP`; demais → `env.LEAD_REDIRECT_CALENDLY`. Ou seja, **o backend já implementa exatamente a regra desta issue sem nenhuma mudança** — basta declarar o funnel novo no `lead_data`.
- **Payload (idêntico ao da lives-semanais-v1/LeadChat):** `POST /tracker` com JSON:
  - `event_name: 'Lead'`
  - `event_id: 'lead-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)`
  - `event_time: Math.floor(Date.now() / 1000)`
  - `event_source_url: window.location.href`
  - `user_data: { em: email, ph: telefone, fn: nome }`
  - `lead_data: { nome, telefone, email, instagram, faturamento, cargo, justificativa, objetivo, funnel: 'aplicacao-mentoria' }`
- **Espelho browser do Pixel (padrão existente):** antes do fetch, `fbq('track', 'Lead', {}, { eventID: eventId })` dentro de try/catch que nunca bloqueia o envio — mesmo `eventId` do payload, para dedup browser+CAPI no Meta.
- **Resposta do backend:** `{ ok: true, redirect: <string|null> }`. A página usa `json.redirect` quando vier truthy.
- **Fallback de falha/sem destino:** `/obrigada` (mesmo padrão da `lives-semanais-v1`: `let redirect = '/obrigada'` sobrescrito pela resposta; em erro de rede/parse, segue para o fallback sem retry — nunca reenviar, para não duplicar o lead). A página `src/pages/obrigada.astro` existe.
- **UTMs/atribuição:** nada a fazer na página. O backend junta a atribuição pela sessão: cookie `_krob_sid` → tabela `sessions` no D1 (preenchida pelo middleware no pageview, que o `BaseLayout` já dispara). O form não manda UTM nenhuma.
- **Campo `cargo`:** o `/tracker` **aceita campos extras no `lead_data` sem erro** — ele repassa `...leadData` inteiro aos forwards de CRM (Supabase e barramento WhatsApp recebem `cargo` automaticamente) e o `sendToClickUp` só lê os campos que conhece, ignorando `cargo` em silêncio. Logo, esta issue não depende de mudança no backend para funcionar. **Dependência registrada (issue 67):** mapear `cargo` a um custom field do ClickUp e, opcionalmente, criar a opção do dropdown 🔻 Funil para `aplicacao-mentoria` (hoje `mapFunnelToOption` carimba funis desconhecidos como SESSÃO ESTRATÉGICA — comportamento aceitável no interim).

## Cenários

### Happy Path
1. Usuário preenche os 8 campos válidos e clica em "ENVIAR APLICAÇÃO →".
2. Validação da issue 65 passa; o botão fica `disabled` com texto "Enviando…" (cliques repetidos impossíveis).
3. `fbq('track', 'Lead', ...)` espelha no browser (se o Pixel estiver carregado).
4. `POST /tracker` com o payload acima; backend registra atribuição, dispara CAPI/GA4/CRM e devolve `{ ok, redirect }`.
5. Faixa "Menos de 20 Mil" → `redirect` = link de WhatsApp; demais faixas → `redirect` = agendamento (Calendly). A página executa `window.location.href = redirect`.

### Edge Cases
- **Duplo clique / Enter repetido durante o envio:** botão `disabled` desde antes do fetch — só um POST sai.
- **`fbq` inexistente ou bloqueado (adblock):** try/catch engole; o envio ao `/tracker` acontece normalmente (CAPI server-side cobre).
- **Resposta 200 com `redirect: null` ou vazio** (ex.: env `LEAD_REDIRECT_*` não setada): página redireciona para o fallback `/obrigada`.
- **Campo `cargo` no `lead_data`:** ignorado pelo ClickUp, repassado ao Supabase/barramento — nenhum erro (ver Decisões).

### Cenário de Erro
- **Fetch falha (rede) ou resposta não-JSON / status 5xx:** try/catch captura; **sem retry automático** (evita lead duplicado); redireciona para `/obrigada`. O lead pode ter sido registrado ou não — o backend tem os próprios alertas de falha (WhatsApp/D1), a página não tenta compensar.
- **Validação falha:** já coberto pela issue 65 — o submit nem chega ao código desta issue; o botão não entra em "Enviando…".

## Arquivos

- **Criar:** nenhum.
- **Modificar:** `src/pages/aplicacao-mentoria.astro` — apenas o `<script>` do handler de submit, no ponto marcado `// issue 66: envio ao /tracker + estado "Enviando…" + redirect entram AQUI.`:
  1. Tornar o listener de `submit` `async`.
  2. Obter referência ao botão `#aplicacao-submit` e ao erro geral `#aplicacao-erro` (já existem no HTML).
  3. Após `validateAll()` passar: `disabled = true` + texto "Enviando…" no botão.
  4. Montar `lead_data` lendo os valores via `getEl(...)` (ou `FormData`) dos 8 campos + `funnel: 'aplicacao-mentoria'`.
  5. Gerar `eventId`, espelhar `fbq` em try/catch, fazer o `fetch('/tracker', ...)` em try/catch com `let redirect = '/obrigada'` sobrescrito por `json.redirect` — cópia do padrão de `src/pages/lives-semanais-v1.astro` (linhas 127–162).
  6. `window.location.href = redirect` ao final (sucesso ou falha).

Nenhuma alteração em `functions/tracker.js`, `src/layouts/BaseLayout.astro` ou qualquer outro arquivo.

## Checklist

- [x] Submit com campos válidos desabilita o botão e troca o texto para "Enviando…" antes do fetch.
- [x] `POST /tracker` sai com `event_name: 'Lead'`, `event_id` único, `event_time`, `event_source_url`, `user_data { em, ph, fn }` e `lead_data` com os 8 campos + `funnel: 'aplicacao-mentoria'`.
- [x] Espelho `fbq('track', 'Lead', {}, { eventID })` com o mesmo `event_id`, em try/catch que não bloqueia o envio.
- [x] Resposta com `redirect` truthy → `window.location.href = redirect` (regra de destino 100% no backend).
- [x] Resposta sem `redirect`, erro de rede ou JSON inválido → redireciona para `/obrigada`, sem segundo POST.
- [x] Duplo clique não gera lead duplicado (botão desabilitado durante todo o envio).
- [x] Nenhuma regra de negócio (faixas de faturamento, URLs de destino) e nenhum segredo na página.
- [x] Nenhum arquivo além de `src/pages/aplicacao-mentoria.astro` foi tocado.
- [x] Dependência registrada: issue 67 = campo `cargo` (custom field) e opção de funil `aplicacao-mentoria` no ClickUp — não bloqueia esta issue.
