# 36: Formulário de inscrição funcional (validação + envio + estados)

**Tipo:** Implementação
**Página:** Landing "Live do Atacado"

## Descrição

Tornar o formulário de inscrição da live funcional, reaproveitando o padrão de `src/components/LeadFormModal.astro`: validar nome + WhatsApp, enviar `POST /tracker` com evento `Lead`, e tratar os estados de loading, erro e sucesso/redirect.

## Escopo

- **Validação no envio:** bloquear o submit se o nome não atingir o mínimo de caracteres ou o WhatsApp estiver vazio (usar `required`/`minlength` + `checkValidity()`/`reportValidity()` como no componente existente).
- **Envio do lead:** ao validar, fazer `POST /tracker` com:
  - `event_name: 'Lead'`
  - `event_id` único (`'lead-' + Date.now() + '-' + random`)
  - `event_time` (epoch em segundos)
  - `event_source_url: window.location.href`
  - `user_data: { ph: telefone, fn: nome }` (sem email — esta live capta só nome + WhatsApp)
  - `lead_data: { nome, telefone, funnel: '<identificador-da-live>' }` com um identificador de funil próprio da live (distinto de `'workshop'`).
- **Estado de loading:** desabilitar o botão e trocar o texto para "Enviando…" durante o envio, evitando duplo envio.
- **Sucesso / redirect:** ao concluir, redirecionar para `json.redirect` retornado pelo backend; na ausência, usar um destino padrão local de confirmação.
- **Estado de erro:** seguir o padrão do projeto. Manter consistência com `LeadFormModal` ("nunca bloquear a conversão" — redirecionar para o destino padrão mesmo em falha) OU reabilitar o botão, restaurar o texto e exibir a mensagem de erro no elemento oculto criado no protótipo. Escolher uma das duas abordagens e implementá-la de forma consistente.

## Restrições de arquitetura

- O front fala APENAS com `/tracker`. Nenhuma chave/segredo/regra de negócio no front.
- NÃO implementar Meta CAPI, GA4, ClickUp, Supabase, D1 ou o endpoint `/tracker` — tudo isso já existe e é disparado pelo backend ao receber o `POST /tracker`.

## Fora de escopo

- Atribuição/cookies de sessão (já feitos automaticamente pelo `functions/_middleware.js` ao carregar a página — ver issue 37).
- Qualquer alteração em `functions/tracker.js` ou em variáveis de ambiente do backend (roteamento de redirect / webhook de CRM do novo funil). Ver a observação em "Dependências Externas" — é uma configuração de backend separada, não faz parte desta implementação de front.

## Decisões de implementação (tomadas pelo orquestrador)

- **Identificador de funil:** `funnel: 'lives-semanais-v1'` em `lead_data`.
  - **Justificativa:** precisa ser distinto de `'workshop'` (o `tracker.js` roteia o workshop por igualdade exata em `leadFunnel === 'workshop'`) e descritivo do funil. O slug bate com a rota da página (`/lives-semanais-v1`), facilitando o roteamento por funil no backend e a leitura nos relatórios/CRM. Diferente do workshop, esta live NÃO envia `faturamento`.
- **Comportamento de erro:** seguir fielmente o padrão de `LeadFormModal.astro` — "nunca bloquear a conversão". Em falha de rede/backend, redirecionar para o destino padrão local mesmo assim (bloco `try/catch` que cai no `window.location.href = redirect`). O elemento `#inscricao-erro` já existente no protótipo permanece como salvaguarda (pode ser usado apenas para erro de validação client-side, se desejado), mas o caminho principal espelha o componente existente.
- **`user_data` sem email:** como a live capta apenas nome + WhatsApp, o `user_data` enviado é `{ ph: telefone, fn: nome }` — SEM a chave `em`. (No `LeadFormModal` é `{ em, ph, fn }`.)
- **Destino padrão local de redirect:** definir uma constante de fallback no script (ex.: `let redirect = '/obrigado-live'` ou outro destino de confirmação acordado). Como o backend hoje pode devolver `redirect` vazio ou incorreto para um funil novo (ver "Dependências Externas"), este fallback local é o que efetivamente leva o lead a uma página de confirmação enquanto o backend não for configurado. Confirmar com a usuária qual deve ser este destino padrão; na ausência de definição, usar um placeholder local de confirmação.

## Cenários

### Happy Path

1. Visitante chega na página (sessão/atribuição já estabelecida pelo `_middleware.js`).
2. Preenche **Nome** (≥ 2 caracteres) e **WhatsApp**.
3. Clica em "QUERO PARTICIPAR DA LIVE →".
4. `checkValidity()` passa; o botão é desabilitado e o texto muda para "Enviando…".
5. Front faz `POST /tracker` com `event_name: 'Lead'`, `event_id` único, `event_time` (epoch s), `event_source_url`, `user_data: { ph, fn }`, `lead_data: { nome, telefone, funnel: 'lives-semanais-v1' }`.
6. Backend dispara o fan-out (Meta CAPI / GA4 / CRM / D1) e devolve `{ ok: true, redirect: <destino> }`.
7. Front lê `json.redirect`; se presente, redireciona para ele; senão, redireciona para o destino padrão local.

### Edge Cases

- **Nome com menos de 2 caracteres ou WhatsApp vazio:** `required` + `minlength="2"` + `checkValidity()`/`reportValidity()` bloqueiam o envio; o navegador aponta o campo a corrigir. Nenhum `POST` é feito.
- **Duplo clique / múltiplos submits:** o botão fica `disabled` durante o envio, impedindo envio duplicado (mesmo padrão do `LeadFormModal`).
- **Backend responde 200 mas com `redirect` vazio/nulo** (cenário provável para um funil novo ainda não configurado no backend — ver "Dependências Externas"): o front cai no destino padrão local. A conversão (CAPI/GA4/CRM/D1) já foi disparada no backend independentemente do redirect.
- **Resposta sem JSON válido:** o `await res.json()` lança; cai no `catch` → redireciona para o destino padrão (não bloqueia a conversão).

### Cenário de Erro

- **Falha de rede ou erro do backend (timeout, 5xx, fetch rejeitado):** o `try/catch` captura; o front NÃO exibe erro nem reabilita o botão — segue o padrão "nunca bloquear a conversão" e executa `window.location.href = redirect` (destino padrão local). O `#inscricao-erro` permanece oculto neste caminho.

## Arquivos

- **Modificar:** `src/pages/lives-semanais-v1.astro`
  - Adicionar `id` ao `<form>` (ex.: `id="inscricao-form-el"`) e, se necessário, `id` ao botão de submit (o protótipo já usa a classe `inscricao__submit`; preferir `id` para selecionar no script). O `#inscricao-erro` já existe.
  - Adicionar `required minlength="2"` ao input `name="nome"` e `required` ao input `name="telefone"` (hoje sem validação).
  - Adicionar um `<script>` (client-side, sem `is:inline` necessário — Astro empacota normalmente) replicando o handler de `submit` de `LeadFormModal.astro`, adaptado: `user_data` sem `em`, `lead_data` sem email/instagram/faturamento, `funnel: 'lives-semanais-v1'`, destino padrão local próprio.
  - (Opcional) Wiring do CTA do hero `#inscricao` já funciona por âncora nativa (`href="#inscricao"`); não requer JS. Não adicionar scroll/focus por JS a menos que solicitado.

## Dependências Externas (se aplicável)

- **Nenhuma dependência de pacote.** O front só fala com `/tracker`, que já existe.
- **Observação de backend (NÃO faz parte desta issue de front):** o `functions/tracker.js` roteia por `lead_data.funnel`. Um funil novo (`'lives-semanais-v1'`) NÃO tem tratamento próprio e cai no ramo `else` (caminho do diagnóstico):
  - **Redirect:** como esta live não envia `faturamento`, `baixoTicket` é `false` e o backend devolve `env.LEAD_REDIRECT_CALENDLY || ''`. Ou seja, o lead seria enviado ao Calendly do diagnóstico (se a env estiver setada) ou receberia `redirect` vazio (caindo no fallback local do front). Para o destino correto da live, é preciso adicionar um ramo no backend (ex.: `LEAD_REDIRECT_LIVE`) — configuração de backend, fora desta issue.
  - **CRM fan-out:** o ramo `else` usa `env.LEAD_WEBHOOK_URL` (webhook padrão/diagnóstico), então o lead da live cairia no CRM do diagnóstico. Para roteá-lo a um destino próprio é preciso adicionar um ramo/env (ex.: `LEAD_WEBHOOK_URL_LIVE`) no backend.
  - **Impacto nesta issue:** nenhum bloqueio. O front pode ser implementado e funciona (lead é capturado, CAPI/GA4/D1 disparam, fallback local cobre o redirect). A configuração de roteamento por funil no backend é um item separado a ser acordado com a usuária.

## Checklist

- [x] `<form>` com `id` e botão de submit selecionável; `#inscricao-erro` mantido.
- [x] Input `nome` com `required minlength="2"`; input `telefone` com `required`.
- [x] `<script>` valida via `checkValidity()`/`reportValidity()` antes de enviar.
- [x] `POST /tracker` com `event_name: 'Lead'`, `event_id` único, `event_time` (epoch s), `event_source_url`.
- [x] `user_data: { ph: telefone, fn: nome }` — SEM `em`.
- [x] `lead_data: { nome, telefone, funnel: 'lives-semanais-v1' }`.
- [x] Botão desabilita e troca texto para "Enviando…" durante o envio.
- [x] Lê `json.redirect`; usa destino padrão local na ausência.
- [x] Em falha (try/catch), redireciona para o destino padrão (não bloqueia conversão).
- [x] Nenhuma chave/segredo/regra de negócio no front; front só fala com `/tracker`.
- [x] Nenhum arquivo além de `src/pages/lives-semanais-v1.astro` é tocado.
- [x] Copy/textos do protótipo inalterados.
