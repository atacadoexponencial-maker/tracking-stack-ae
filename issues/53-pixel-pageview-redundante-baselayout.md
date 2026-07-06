# 53: Pixel + PageView redundante com dedup no layout base

**Tipo:** Implementação
**Página:** Módulo: PageView redundante no layout base (`src/layouts/BaseLayout.astro`)

## Descrição

Carregar o Pixel do Meta no `src/layouts/BaseLayout.astro` (via caminho first-party da issue 52), inicializá-lo com o Pixel ID público e disparar o PageView de forma redundante: uma cópia pelo navegador (Pixel) e uma espelhada ao servidor via `/tracker`, ambas com o **mesmo** `event_id` gerado por visualização de página.

## Comportamentos

- O script do Pixel é solicitado ao caminho first-party do próprio domínio (nunca diretamente ao domínio do Meta), ao lado do carregador de analytics já existente no layout.
- Ao carregar a página, o Pixel é inicializado com o identificador público do Pixel (`fbq('init', PIXEL_ID)`).
- Um `event_id` único é gerado por visualização; o PageView é disparado pelo navegador com esse `event_id`.
- O mesmo PageView é espelhado ao servidor via `/tracker` com o **mesmo** `event_id`, nome do evento (PageView), horário e URL da página.
- Se o script do Pixel não carregar (bloqueio, falha de rede), o espelho ao servidor ainda é enviado — o servidor é a via autoritativa.
- Se a requisição ao servidor falhar, a navegação não é afetada (falha silenciosa).
- Cada navegação gera um novo `event_id` — cada visualização tem seu próprio par de eventos deduplicados.
- O backend de tracking (`functions/tracker.js`) **não é alterado**.

## Dependências

- Issue 52 (proxy first-party do fbevents.js) precisa estar pronta. ✅ Já implementada: `functions/scripts/[[path]].js` responde `GET /scripts/fbevents.js` proxiando `https://connect.facebook.net/en_US/fbevents.js` com cache de 1h e fallback de script vazio.

## Plano

### Pixel ID

O valor concreto **não está no repositório** (só a env var `META_PIXEL_ID` referenciada em `wrangler.toml.example:29` e usada pelo backend em `functions/tracker.js:309`). O ID de produção é **`915637492681788`** (confirmado na memória do projeto — Meta CAPI ativo e validado com esse pixel; conferível em Cloudflare Pages → tracking-ae → Settings → Environment variables → `META_PIXEL_ID`).

Como o Pixel ID é público (aparece em claro no HTML de qualquer site com Pixel), ele será **hardcoded no layout**, exatamente como o `G-3C24BQVR59` do gtag já é hardcoded em `src/layouts/BaseLayout.astro:34-39`. Nenhuma env var nova, nenhum secret no frontend.

### Snippet a adicionar no `<head>`

Logo após o bloco do gtag (linhas 34–40), dois scripts `is:inline`:

1. **Base code do Meta Pixel** (snippet padrão do Meta) com **uma única alteração**: o `src` do loader aponta para `/scripts/fbevents.js` em vez de `https://connect.facebook.net/en_US/fbevents.js`. O snippet padrão já cria o stub `window.fbq` que **enfileira** chamadas antes de o script carregar — por isso `init` e `track` podem rodar imediatamente, mesmo se o fbevents.js demorar ou falhar.
2. **Init + PageView redundante:**

```js
fbq('init', '915637492681788');
// event_id único por visualização — mesmo padrão dos pontos de Lead
// (ex.: src/pages/calculadora-atacado/index.astro:86, src/components/LeadChat.astro:364)
var pvEventId = 'pv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
// Cópia do navegador (deduplicada no Meta pelo event_id)
fbq('track', 'PageView', {}, { eventID: pvEventId });
// Espelho server-side — via autoritativa; fire-and-forget, falha silenciosa
fetch('/tracker', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event_name: 'PageView',
    event_id: pvEventId,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: window.location.href,
  }),
}).catch(function () { /* silencioso */ });
```

Notas de conformidade com o backend (que **não é alterado**):
- `functions/tracker.js` lê `body.event_name`, `body.event_id`, `body.event_time` (segundos unix) e `body.event_source_url`; `user_data` é opcional (`body.user_data || {}` na linha 17) — PageView não envia PII, então o campo é omitido.
- fbp/fbc/external_id são resolvidos pelo tracker a partir dos cookies (`_fbp`, `_fbc`, `_krob_sid`, `_krob_eid`) — nada disso precisa ir no payload.
- Padrão do `event_id` segue os 4 pontos de Lead existentes (`'lead-' + Date.now() + '-' + Math.random()...`), trocando o prefixo para `pv-`. Novo id a cada carregamento de página (Astro é MPA — o layout re-executa em toda navegação).

## Cenários

### Happy Path
1. Visitante abre qualquer página do site (todas usam `BaseLayout.astro`).
2. O navegador solicita `/scripts/fbevents.js` (first-party, proxied pela issue 52) — nunca `connect.facebook.net`.
3. O stub `fbq` já existe; `fbq('init', '915637492681788')` e `fbq('track', 'PageView', {}, { eventID: 'pv-…' })` são enfileirados e disparados quando o script carrega.
4. Em paralelo, `fetch('/tracker')` envia o espelho com o **mesmo** `event_id`; o tracker registra no D1 e envia ao Meta CAPI.
5. O Meta recebe as duas cópias e deduplica pelo `event_id` — conta 1 PageView com sinal de navegador + servidor.

### Edge Cases
- **fbevents.js bloqueado ou falhou:** o stub do snippet padrão enfileira as chamadas sem lançar erro (e o proxy da issue 52 devolve script vazio em falha de origem — página nunca quebra). O espelho ao `/tracker` é independente e segue normalmente — o servidor é a via autoritativa.
- **Navegação entre páginas:** Astro é MPA — cada navegação recarrega o layout inteiro, gerando novo `event_id` e novo par PageView deduplicado. Nenhum tratamento de SPA/History API é necessário.
- **`event_id` único por pageview:** `Date.now()` + sufixo aleatório garante unicidade prática entre visualizações da mesma sessão e entre visitantes (mesmo padrão já aceito nos Leads); colisão dentro da janela de dedup de ~48h do Meta é desprezível.
- **Página de Lead dispara PageView e depois Lead:** `event_id`s distintos e `event_name`s distintos — o dedup do Meta é por par (event_name, event_id), sem interferência.
- **Adblock bloqueia o `fetch('/tracker')`:** o `.catch` engole; a cópia do navegador (se o Pixel carregou) ainda vai. Cenário de perda total (ambos bloqueados) é o status quo pré-feature.

### Cenário de Erro
- **`fetch('/tracker')` falha (rede, 5xx):** `.catch(() => {})` — nenhum erro no console visível ao usuário, navegação não é afetada.
- **`fbq` indisponível (script inline não rodou por algum motivo extremo):** o bloco de init/track e o fetch estão no mesmo script inline após o snippet base — se o snippet base rodou, `fbq` (stub) existe. O espelho server-side não depende do fbq em nenhum ponto.
- **Backend `/tracker` com env vars ausentes:** responsabilidade do tracker (já loga e segue) — fora do escopo; frontend não muda nada.

## Arquivos

- **Modificar:** `src/layouts/BaseLayout.astro` — único arquivo tocado. No `<head>`, após o bloco do gtag (linha 40):
  1. Adicionar o snippet base do Meta Pixel (`is:inline`) com o `src` do loader trocado para `'/scripts/fbevents.js'` (caminho first-party da issue 52).
  2. No mesmo fluxo, `fbq('init', '915637492681788')` (hardcoded, ID público — mesmo tratamento do `G-3C24BQVR59`).
  3. Gerar `event_id` único por visualização: `'pv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)` (padrão dos pontos de Lead).
  4. Disparar `fbq('track', 'PageView', {}, { eventID: pvEventId })`.
  5. Espelhar via `fetch('/tracker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_name: 'PageView', event_id: pvEventId, event_time: Math.floor(Date.now() / 1000), event_source_url: window.location.href }) }).catch(() => {})` — sem `user_data`, fire-and-forget.
  6. Comentário curto no HTML explicando a redundância browser+server com dedup por `event_id` (mesmo estilo do comentário do GA4 nas linhas 31–33).

**Não tocar:** `functions/tracker.js` (proibido pela spec), `functions/scripts/[[path]].js` (issue 52, pronta), páginas individuais (o layout cobre todas), pontos de Lead (issue 54).

## Checklist

- [x] Snippet base do Meta Pixel adicionado no `<head>` de `src/layouts/BaseLayout.astro` com `is:inline` e loader apontando para `/scripts/fbevents.js` (não `connect.facebook.net`)
- [x] `fbq('init', '915637492681788')` presente antes do track
- [x] `event_id` gerado por visualização no padrão `'pv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)`
- [x] `fbq('track', 'PageView', {}, { eventID: pvEventId })` disparado com o event_id gerado
- [x] `fetch('/tracker')` POST JSON com exatamente `{ event_name: 'PageView', event_id, event_time (segundos unix), event_source_url }` e o **mesmo** `event_id` do fbq
- [x] Falha do fetch é silenciosa (`.catch` vazio) — sem `await` bloqueando nada visível
- [x] Nenhum outro arquivo modificado (`git status` mostra só `src/layouts/BaseLayout.astro`)
- [x] `functions/tracker.js` intacto
- [x] Verificação manual: abrir uma página, DevTools → Network → confirmar request a `/scripts/fbevents.js` (200, first-party), request a `/tracker` (200) com o mesmo `event_id` do fbq, e nenhuma chamada a `connect.facebook.net` para carregar o script — verificado localmente via `wrangler pages dev dist`: `/scripts/fbevents.js` 200 (381 KB, first-party), `POST /tracker` 200 com payload PageView, zero referências a `connect.facebook.net` no HTML das 11 páginas buildadas; fbq e fetch usam a mesma variável `pvEventId` (mesmo event_id por construção)
