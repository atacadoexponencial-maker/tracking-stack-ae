# 188: Rastreamento de página de vendas (sessão de checkout e InitiateCheckout)

**Tipo:** Implementação
**Página:** /workshop-black-exponencial-2026

## Descrição

Aplicar nesta página o rastreamento de página de vendas descrito em `docs/page-types/sales-page.md`: registrar a visita com os mesmos dados de origem das demais páginas pelo mecanismo compartilhado, criar na chegada um identificador de compra para a visita e registrá-lo junto com esses dados (reaproveitando o mesmo identificador enquanto o visitante estiver na mesma visita, mesmo que recarregue a página), registrar o evento de início de checkout ao acionar qualquer botão de compra de forma que sobreviva à saída da página, e propagar o identificador ao destino de compra no nome de parâmetro exigido pela plataforma de checkout escolhida. O evento de início de checkout é contado uma única vez por clique, sem duplicação entre navegador e servidor; a página aparece sem configuração extra na visão de desempenho por landing page do painel e continua compatível com o mecanismo de teste A/B existente.

## Pesquisa da base de código (o que já existe e o que falta)

### O que já vem pronto, sem escrever nada

- **`functions/_middleware.js`** — já roda em `/workshop-black-exponencial-2026`
  (não é `/api/*`, `/webhook/*`, `/tracker`, `/scripts/`, `/checkout-session`,
  `/dash` nem `/links`). Ele sozinho: gera/lê os cookies `_krob_sid`,
  `_krob_eid`, `_fbp` e `_fbc`; extrai `fbclid` cru, `gclid`, `msclkid`, os
  cinco UTMs e `funnel`; faz o UPSERT em `sessions` com `landing_url` completa
  em `waitUntil`. **Nada de registro de visita precisa ser escrito nesta
  issue** — o item "registrar a visita com os mesmos dados de origem" já está
  atendido pelo mecanismo compartilhado.
- **Compatibilidade com o teste A/B** — também é do middleware (bloco
  `carregarTestesAtivos` / `escolherVariante`, cookie `_krob_ab`, tabela
  `ab_assignments`). Ele age por `path`, sem nenhum opt-in da página. **Nada a
  fazer**: o requisito é satisfeito por não fazer nada de especial. A única
  regra a respeitar é não depender de `location.pathname` para decidir
  comportamento — uma variante viveria em `/ab/<slug>/b/`.
- **`functions/checkout-session.js`** — endpoint `POST /checkout-session` pronto
  e não precisa de alteração. Exige `trk` no corpo (400 sem ele), enriquece com
  a linha de `sessions` pelo cookie `_krob_sid`, resolve `fbp` / `fbc` /
  `external_id` pela cadeia cookie → sessão → corpo, extrai `ga_client_id` do
  cookie `_ga`, e grava em `checkout_sessions` com `INSERT OR REPLACE`
  (chave `trk`) — ou seja, **repostar o mesmo `trk` é idempotente**.
- **`functions/tracker.js`** — aceita qualquer `event_name`. Para
  `InitiateCheckout` ele: manda ao Meta CAPI com o `event_id` recebido (é o que
  permite a dedup com o navegador), traduz para `begin_checkout` no GA4 (linha
  421), grava em `event_log` (não é PageView, então é logado) e **não** dispara
  ClickUp/GHL/CRM (esse fan-out é exclusivo de `lead`). `InitiateCheckout` não
  está em `EVENTOS_INTERNOS`, então sai de verdade para Meta e GA4.
  **Nenhuma alteração.**
- **`BaseLayout.astro`** — já carrega o gtag e o `fbq` (pixel
  `2800317883678788`) pelo proxy `/scripts`, e já dispara o `PageView` com
  `eventID` próprio. A página usa `BaseLayout`, então `fbq` existe no momento do
  clique — mas pode estar **ausente** se um bloqueador derrubar o proxy, daí o
  `try/catch` obrigatório em volta da chamada.
- **Adaptadores de webhook** — `functions/webhook/eduzz/[slug].js`,
  `hotmart/[slug].js` e `kiwify/[slug].js` já existem e já leem o `trk` de
  `body.tracker.code1`, `data.purchase.origin.xcod` e
  `order.TrackingParameters.sck`, respectivamente.
  `functions/webhook/_core.js` faz o `SELECT * FROM checkout_sessions WHERE
  trk = ?` e só envia o `Purchase` quando a linha existe. **A ponta do servidor
  está inteira**; ver "Dependências Externas".

### O que NÃO existe (achados a considerar no plano)

1. **`examples/sales-page/index.html` não existe.** O caminho citado em
   `docs/page-types/sales-page.md` tem apenas `examples/sales-page/assets/`,
   e essa pasta está vazia. O starter que a doc descreve não pode ser copiado —
   **a receita a seguir é o próprio texto de `docs/page-types/sales-page.md`**
   (blocos de código dos itens 3, 4, 5 e 6 mais a seção "The full CTA click
   handler, annotated"), que está completo o bastante para implementar sem o
   arquivo. Não criar o starter nesta issue.
2. **A whitelist de LPs bloqueia a página — achado CONFIRMADO.**
   `functions/api/conversion.js` define `KNOWN_PAGE_PATHS` nas linhas 107–127 e
   a função `isKnownPage` (linhas 131–134) descarta qualquer path fora do
   conjunto (`if (!isKnownPage(lp)) continue;`, linha 76).
   `/workshop-black-exponencial-2026` **não** está lá. Sem acrescentá-lo, a
   página nunca aparece na tabela "Conversão por LP" do `/dash` — o requisito da
   spec ("aparecer sem configuração extra na visão de desempenho por landing
   page") **exige esta linha**. É a única alteração de backend desta issue.
   - Observação sobre como ler a tabela: `/api/conversion` conta como conversão
     apenas `event_log.event_name = 'Lead'`. Esta página não gera lead nenhum,
     então vai aparecer com `visitors > 0` e `leads = 0`, taxa 0%. **Isso é o
     comportamento correto e esperado** — a linha existe para dar visibilidade
     do tráfego da LP. Medir InitiateCheckout/Purchase por LP mudaria a
     semântica do endpoint: fora de escopo, não fazer.
3. **`CHECKOUT_PARAM` ainda não existe no frontmatter.** A issue 187 entregou só
   o `CHECKOUT_URL` (linhas 15–16 de
   `src/pages/workshop-black-exponencial-2026.astro`). Como é o nome do
   parâmetro que carrega o `trk` e ninguém mais o consome, **esta issue cria
   `CHECKOUT_PARAM` no mesmo bloco de configuração do `CHECKOUT_URL`**, com
   valor padrão `'trk'` (o nome da Eduzz, e também o fallback neutro que a doc
   usa). Trocar de plataforma passa a ser trocar duas constantes vizinhas, sem
   tocar em nenhum bloco da página.
   - **Não** replicar a tabela `TRK_FIELD_BY_PLATFORM` da doc: ela existe no
     starter genérico, para páginas que não sabem qual é a plataforma. Aqui a
     plataforma é uma decisão única por página — uma constante com o nome do
     parâmetro dá o mesmo resultado sem código morto. Registrar em comentário a
     tabela `eduzz → trk`, `hotmart → xcod`, `kiwify → sck` para quem for
     trocar.

### Os 8 botões de compra e como alcançá-los

Sete já têm o atributo `data-checkout` (linhas 161, 197, 301, 393, 474, 520 e
529). O oitavo é renderizado pelo componente compartilhado `FinalCta.astro`, que
**não** aceita atributos extras — a issue 185 previu isso e o embrulhou em
`.wbe-fechamento`. O seletor único, o mesmo que o CSS de vendas encerradas já
usa (linhas 629–630), é:

```js
'[data-checkout], .wbe-fechamento .btn-cta'
```

Não alterar `FinalCta.astro` (arquivo compartilhado com outras páginas).

### Restrição técnica: a página é estática

`output: 'static'` e o frontmatter roda no build. O `trk`, os UTMs e o clique
são todos de tempo de execução no navegador → todo o código desta issue vive num
`<script>` da página. As duas constantes do frontmatter (`CHECKOUT_URL`,
`CHECKOUT_PARAM`) precisam atravessar para o script: usar
`define:vars={{ CHECKOUT_URL, CHECKOUT_PARAM }}` — que força `is:inline`, logo o
script não passa pelo bundler e deve ser JS puro, sem `import`.

## Cenários

### Happy Path

1. Visitante clica num anúncio e chega em
   `/workshop-black-exponencial-2026?utm_source=meta&utm_campaign=black&fbclid=…`.
2. O middleware grava a sessão, seta `_krob_sid` / `_krob_eid` / `_fbp` / `_fbc`
   e entrega o HTML. O `BaseLayout` dispara o `PageView` (fbq + espelho
   server-side).
3. O script da página roda: não há `krob_trk` no `sessionStorage`, então gera um
   `crypto.randomUUID()`, guarda e faz `fetch('/checkout-session', …)` com o
   `trk`, os cinco UTMs lidos de `location.search` e
   `event_source_url: location.href`.
4. `functions/checkout-session.js` responde `{"ok": true}` e grava a linha em
   `checkout_sessions` com `session_id`, `fbp`, `fbc`, `external_id`,
   `ga_client_id`, UTMs e `created_at`.
5. O visitante rola e recarrega a página no meio: o script encontra o mesmo
   `krob_trk` no `sessionStorage`, **não** gera outro e reposta — o
   `INSERT OR REPLACE` regrava a MESMA linha (mesmo `trk`), sem duplicar.
6. Ele clica em qualquer um dos 8 botões. O handler: gera um `eventId` novo;
   dispara `navigator.sendBeacon('/tracker', Blob({ event_name:
   'InitiateCheckout', event_id, event_time, event_source_url, user_data: {} }))`;
   dispara `fbq('track', 'InitiateCheckout', {}, { eventID: eventId })` dentro de
   `try/catch`; monta o destino
   `CHECKOUT_URL + (tem '?' ? '&' : '?') + CHECKOUT_PARAM + '=' + encodeURIComponent(trk)`;
   e navega com `setTimeout(…, 80)` para a fila do beacon esvaziar no Chrome
   Android.
7. O Meta recebe **um** `InitiateCheckout`: a cópia do navegador e a do servidor
   chegam com o mesmo `event_id` e são deduplicadas pelo próprio Meta. O GA4
   recebe `begin_checkout` só pelo servidor (o gtag não dispara nada aqui).
   O `event_log` ganha uma linha.
8. Horas depois a plataforma chama `/webhook/<plataforma>/<slug>`, o adaptador lê
   o `trk`, o `_core.js` acha a linha de `checkout_sessions` e envia o `Purchase`
   com a atribuição da visita original, gravando em `purchase_log`.
9. No `/dash`, a página passa a aparecer na tabela "Conversão por LP" com o
   número de visitantes (leads 0 — ver achado 2).

### Edge Cases

- **`sessionStorage` indisponível** (navegação privada com cota zero, extensão
  bloqueando, `SecurityError` dentro de iframe): o acesso fica dentro de
  `try/catch` e cai para uma variável em memória do script. Consequência
  aceita: se a pessoa recarregar, um `trk` novo é gerado e uma segunda linha
  entra em `checkout_sessions` — a atribuição continua correta, porque o `trk`
  que vai ao checkout é sempre o da aba viva. **Nunca** deixar a exceção
  escapar: um `throw` aqui mataria o script inteiro e junto o handler de clique.
  Proteger o par leitura/escrita, não só a leitura — é o `setItem` que lança no
  Safari privado.
- **Falha de rede no POST inicial** (offline, D1 fora, 500, bloqueador matando o
  `fetch`): `.catch(() => {})` explícito. A página **não** exibe erro, **não**
  bloqueia botão e **não** repete a chamada — os botões seguem funcionando com o
  `trk` que já está em memória. Consequência: aquela venda chega no webhook sem
  linha em `checkout_sessions` e o `_core.js` não envia o `Purchase` ao Meta
  (comportamento existente do core, fora do escopo daqui). Vender importa mais
  que rastrear — essa é a ordem de prioridade da issue.
- **Clique duplo / duplo toque no mesmo botão** (ou clique em dois botões antes
  de a navegação sair): sem guarda seriam dois `InitiateCheckout` com `event_id`
  diferentes, ou seja, dupla contagem real (a dedup do Meta é por `event_id`,
  não por pessoa). Usar uma flag booleana `jaDisparou`: o primeiro clique
  dispara beacon + pixel e agenda a navegação; os seguintes só deixam o
  navegador seguir, sem redisparar. A flag vale por carregamento de página —
  voltar pelo botão "voltar" recarrega o script e o próximo clique volta a
  valer, reaproveitando o mesmo `trk` do `sessionStorage` (correto: mesma
  visita).
- **Vendas encerradas** (a issue 186 troca o wrapper para
  `data-vendas="encerradas"`): o CSS já esconde `[data-checkout]` e
  `.wbe-fechamento .btn-cta` com `display:none`, logo não há clique possível e o
  `InitiateCheckout` não dispara sozinho. Ainda assim o handler deve checar
  `document.querySelector('.wbe')?.dataset.vendas === 'encerradas'` e sair cedo —
  sem isso, um botão alcançado por teclado, por leitor de tela ou por um futuro
  estado "encerrado" que apenas esmaeça o botão viraria checkout fantasma. O
  POST de `/checkout-session` **continua acontecendo** mesmo com as vendas
  encerradas: é barato, mantém a visita medida e não tem efeito colateral.
- **Página servida como variante A/B** (`/ab/<slug>/b/` reescrito pelo
  middleware): o script é idêntico, `location.href` reflete a URL pública, então
  `event_source_url` sai certo tanto no beacon quanto em
  `checkout_sessions.event_source_url`. Nada a fazer — só não condicionar nada a
  `pathname`.
- **`CHECKOUT_URL` já com query string** (`?off=abc` da Hotmart, por exemplo): o
  separador é calculado (`includes('?') ? '&' : '?'`), nunca fixo.
- **`crypto.randomUUID` ausente** (contexto não seguro, navegador antigo): a
  página só é servida por HTTPS, então é praticamente inalcançável, mas o
  gerador fica isolado numa função com fallback para
  `Date.now() + '-' + Math.random().toString(16).slice(2)`, para nenhum caminho
  jogar `TypeError` e derrubar o clique.
- **`navigator.sendBeacon` ausente**: `try/catch` em volta; falhando, seguir para
  a navegação assim mesmo. Não trocar por `fetch` síncrono nem avisar o
  visitante. Perder o evento é aceitável; perder a venda não.

### Cenário de Erro

- **O `<script>` da página lança na inicialização** (qualquer erro inesperado):
  os botões são `<a href={CHECKOUT_URL}>` de verdade, então **a navegação
  continua funcionando sem JS** — só se perde o `trk` e o `InitiateCheckout`.
  Esse é o motivo de o `href` continuar apontando para `CHECKOUT_URL` e de o
  `trk` ser anexado no handler, em vez de reescrever o `href` no carregamento.
  Como garantia, todo o corpo do script fica dentro de um `try/catch` externo
  que só registra no console.
- **`/checkout-session` responde 400 "Missing trk"**: só aconteceria com `trk`
  vazio, o que a função geradora impede. Se acontecer, é falha silenciosa do
  mesmo jeito (o `.catch` cobre); nada aparece para o visitante.
- **D1 indisponível na hora do POST**: `checkout-session.js` responde 500 com
  `{error}`. Mesma resposta: engolir. Não retentar — o retry atrasaria a saída
  para o checkout sem ganho, já que a venda ainda pode ser conciliada à mão pelo
  `transaction_id` no `purchase_log`.

## Banco de Dados

**Nenhuma migration.** Todas as tabelas envolvidas já existem e são escritas por
código que não muda nesta issue.

| Tabela | Escrita por | Colunas envolvidas |
|---|---|---|
| `sessions` | `functions/_middleware.js` (já roda na página) | `session_id`, `external_id`, `fbclid`, `gclid`, `fbc`, `fbp`, `landing_url`, `utm_*`, `funnel`, `created_at` |
| `checkout_sessions` | `functions/checkout-session.js` (já existe) | `trk` (PK — o UUID gerado pela página), `session_id`, `ip_address`, `user_agent`, `external_id`, `fbp`, `fbc`, `gclid` / `gbraid` / `wbraid`, `ga_client_id`, `utm_source` / `utm_medium` / `utm_campaign` / `utm_content` / `utm_term`, `event_source_url`, `created_at` |
| `event_log` | `functions/tracker.js` (já existe) | Uma linha por clique: `event_name = 'InitiateCheckout'`, `event_id`, `timestamp`, `session_id`, `meta_*`, `ga4_*`. `funnel` e `material` saem **vazios** — não há `lead_data` neste evento (comportamento documentado na issue 148) |
| `purchase_log` | `functions/webhook/_core.js` (já existe) | Só quando a plataforma existir e chamar o webhook: `trk` (o mesmo desta página), `transaction_id`, `value`, `fbp` / `fbc` / `gclid` copiados de `checkout_sessions` |

**Consequência conhecida e aceita** (documentada em
`docs/page-types/sales-page.md`): visitante que só passa pela página também cria
linha em `checkout_sessions`. A tabela fica mais barulhenta que `purchase_log`;
o índice `idx_checkout_sessions_created` dá conta. Não implementar limpeza aqui.

## Arquivos

### Criar

Nenhum arquivo novo. Em particular: **não** criar
`examples/sales-page/index.html` — o starter ausente é um achado registrado, não
uma tarefa desta issue.

### Modificar

| Arquivo | O que fazer |
|---|---|
| `src/pages/workshop-black-exponencial-2026.astro` | **(a)** No mesmo bloco de configuração do `CHECKOUT_URL` (frontmatter, linhas 9–16), acrescentar `const CHECKOUT_PARAM = 'trk';` com o comentário da tabela por plataforma (`eduzz → trk`, `hotmart → xcod`, `kiwify → sck`). **(b)** Antes de `</BaseLayout>` (linha 554), acrescentar um único `<script define:vars={{ CHECKOUT_URL, CHECKOUT_PARAM }}>` contendo: obtenção/criação do `trk` no `sessionStorage` (chave `krob_trk`), o `POST /checkout-session` com `.catch` mudo, e o handler de clique delegado em `document` filtrando por `[data-checkout], .wbe-fechamento .btn-cta` via `event.target.closest(...)` (cobre os 8 botões, inclusive o do `FinalCta`), com a guarda de clique duplo e a guarda de vendas encerradas. Não alterar nenhum bloco de conteúdo, nenhum `href` e nenhum CSS. |
| `functions/api/conversion.js` | Acrescentar `'/workshop-black-exponencial-2026',` ao `Set` `KNOWN_PAGE_PATHS` (linhas 107–127). Uma linha; nada mais no arquivo. |

### Não tocar

`functions/checkout-session.js`, `functions/tracker.js`,
`functions/_middleware.js`, `functions/webhook/**`,
`src/components/sections/FinalCta.astro`, `src/layouts/BaseLayout.astro`,
`public/dash/index.html`, migrations.

## Dependências Externas

- **Plataforma de checkout ainda não escolhida** (pendência 1 da `spec.md`).
  Enquanto isso, `CHECKOUT_URL` aponta para um `wa.me` e `CHECKOUT_PARAM` fica em
  `'trk'`. **O que fica pendente até a escolha:**
  1. Trocar `CHECKOUT_URL` pela URL real e `CHECKOUT_PARAM` pelo nome exigido
     (`trk` na Eduzz, `xcod` na Hotmart, `sck` na Kiwify) — duas linhas do
     frontmatter, sem tocar em mais nada.
  2. Cadastrar, no painel da plataforma, a URL do webhook
     `https://atacadoexponencial.com/webhook/<plataforma>/<slug>` e habilitar o
     evento de venda paga (`sale.paid` / `PURCHASE_APPROVED` / `order_approved`).
     O slug vem da env correspondente (`EDUZZ_WEBHOOK_SLUG` etc.) e é o único
     gate do endpoint — tratar como senha. **Fora do escopo desta issue**: a
     `spec.md` exclui explicitamente "configuração do webhook de venda".
  3. Validar ponta a ponta com uma compra de teste e conferir `purchase_log`.
  - **Nada disso bloqueia esta issue.** O `trk` já é criado, gravado e anexado à
    URL placeholder desde já; enquanto o destino for o WhatsApp, o `?trk=…` vai
    junto e o `wa.me` simplesmente ignora — inofensivo, e prova em produção que a
    anexação funciona.
  - Os três adaptadores (`eduzz`, `hotmart`, `kiwify`) **já existem** em
    `functions/webhook/` e leem o `trk` corretamente. Se a escolhida for uma
    quarta plataforma (Ticto, Guru, Perfect Pay…), será preciso um adaptador
    novo — issue própria, não esta.
- **Meta Pixel** (`2800317883678788`) e **GA4** (`G-3C24BQVR59`): já carregados
  pelo `BaseLayout`; nada a configurar. O `InitiateCheckout` aparece no Events
  Manager sem cadastro prévio.
- **D1 (`env.DB`)** e as envs de Meta CAPI / GA4: já em produção.

## Checklist

- [x] Declarar `CHECKOUT_PARAM = 'trk'` no frontmatter, junto do `CHECKOUT_URL`,
      com o comentário da tabela de nomes por plataforma
      *(já entregue pela issue 187)*
- [x] Script único na página, JS puro (sem `import` novo) e corpo dentro de
      `try/catch`
      *(**divergência consciente**: sem `define:vars`. A issue 187 já publicou o
      nome do parâmetro no DOM via `data-checkout-param` no wrapper `.wbe`, e o
      script dela já existe no fim do arquivo. O código desta issue foi
      acrescentado a esse mesmo script, lendo o parâmetro de
      `.wbe.dataset.checkoutParam` e a URL base do `href` do botão clicado —
      sem duplicar constantes no cliente e sem transformar o script em
      `is:inline`.)*
- [x] `trk` lido de `sessionStorage['krob_trk']`; criado com `crypto.randomUUID()`
      (com fallback) só quando ausente; recarregar a página reaproveita o mesmo
- [x] Acesso ao `sessionStorage` (leitura E escrita) protegido por `try/catch`,
      com fallback para variável em memória
- [x] `POST /checkout-session` no carregamento, com
      `Content-Type: application/json`, enviando `trk`, os cinco UTMs de
      `location.search` e `event_source_url`
- [x] Falha desse POST tratada com `.catch` mudo: nada na tela, botões seguem
      funcionando, sem retry
- [x] Handler delegado alcançando os 8 botões via `[data-checkout]` — o 8º, o do
      `FinalCta`, já recebe o atributo em runtime pelo bloco da 187
      (`.wbe-fechamento .btn-cta`), sem alterar `FinalCta.astro`
- [x] `navigator.sendBeacon('/tracker', …)` com `Blob` `application/json`,
      `event_name: 'InitiateCheckout'`, `event_id` novo por clique, `event_time`
      em segundos e `event_source_url`
- [x] `fbq('track', 'InitiateCheckout', {}, { eventID: eventId })` com o MESMO
      `event_id`, dentro de `try/catch` (dedup navegador × servidor)
- [x] Guarda de clique duplo: um único `InitiateCheckout` por carregamento
      *(cliques seguintes não redisparam o evento, mas continuam levando o `trk`
      ao destino)*
- [x] Guarda de vendas encerradas: sai cedo quando `.wbe` estiver com
      `data-vendas="encerradas"`
- [x] Destino montado com separador calculado (`?` ou `&`), `CHECKOUT_PARAM` e
      `encodeURIComponent(trk)`
- [x] Navegação com `setTimeout(…, 80)` para a fila do beacon esvaziar
- [x] `href` dos botões **inalterado** — a página continua navegável sem JS
- [x] `'/workshop-black-exponencial-2026'` acrescentado a `KNOWN_PAGE_PATHS` em
      `functions/api/conversion.js`
- [x] Nenhuma migration, nenhum arquivo novo, nenhum arquivo compartilhado tocado
- [x] `npm run build` passa *(e `npm test`: 148/148)*
- [ ] Verificação em produção conforme `docs/page-types/sales-page.md`:
      `/checkout-session` retorna 200 `{"ok":true}`; a linha mais recente de
      `checkout_sessions` traz o `utm_source` da URL e `fbp` preenchido; o
      destino do clique contém `?trk=<mesmo UUID>`; e a página aparece na tabela
      "Conversão por LP" do `/dash`
