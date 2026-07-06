# Spec: Restauração do Meta Pixel client-side com setup redundante (browser + servidor)

## Visão Geral

Hoje o site envia eventos ao Meta **apenas pelo lado do servidor** (via o endpoint `/tracker`): nenhuma página dispara PageView (nem no navegador, nem no servidor) e os eventos de Lead são enviados só pelo servidor. Isso significa que o Meta não recebe o sinal do navegador (Pixel), perdendo qualidade de correspondência, cobertura de PageView e a redundância recomendada pelo próprio Meta (setup "browser + servidor" com deduplicação).

Esta feature restaura o Pixel do Meta no navegador em **todas as páginas do site**, de forma redundante e deduplicada:

- Cada visualização de página dispara um PageView **duas vezes com o mesmo identificador de evento** (`event_id`): uma pelo navegador (Pixel) e uma pelo servidor (espelho via `/tracker`). O Meta descarta a duplicata pelo `event_id`.
- Cada envio de lead — que hoje já dispara o evento Lead pelo servidor com um `event_id` — passa a disparar **também** a cópia do navegador com o **mesmo** `event_id`, para a mesma deduplicação.
- O script do Pixel é carregado por um caminho **first-party** do próprio site (mesmo padrão já usado para o script de analytics), para não ser bloqueado por ad-blockers que barram domínios de terceiros.

Público: a operação de tráfego pago do Atacado Exponencial, que depende da qualidade dos sinais enviados ao Meta para otimização e atribuição de campanhas.

Restrições respeitadas:
- O identificador do Pixel é público e pode ficar no frontend; o token de acesso da API de conversões permanece exclusivamente no backend.
- O backend de tracking (`functions/tracker.js`) **não é alterado** — ele já envia qualquer evento recebido (incluindo PageView) ao Meta com `event_id`.
- Escopo fechado em 3 itens: PageView redundante no layout base, proxy first-party do script do Pixel, e espelho browser do Lead nos 4 pontos de captura existentes.

## Páginas / Módulos

### Módulo: PageView redundante no layout base (`src/layouts/BaseLayout.astro`)

**Descrição:** O layout base — compartilhado por todas as páginas do site — passa a carregar o Pixel do Meta e a disparar o evento PageView de forma redundante (navegador + servidor) com deduplicação. É o único lugar onde o Pixel é inicializado; nenhuma página precisa fazer isso individualmente.

**Componentes:**
- Carregador do script do Pixel: carrega o script do Pixel do Meta a partir do caminho first-party do próprio site (servido pelo módulo de proxy abaixo), ao lado do carregador de analytics que já existe no layout.
- Inicializador do Pixel: inicializa o Pixel com o identificador público do Pixel (`fbq('init', PIXEL_ID)`).
- Disparador de PageView redundante: gera um `event_id` único por visualização de página e dispara as duas cópias do PageView.

**Comportamentos:**
- Visitante abre qualquer página do site e o script do Pixel é solicitado ao caminho first-party do próprio domínio (nunca diretamente ao domínio do Meta).
- Ao carregar a página, o Pixel é inicializado com o identificador do Pixel.
- Ao carregar a página, um `event_id` único é gerado para aquela visualização.
- Ao carregar a página, o PageView é disparado pelo navegador (Pixel) com esse `event_id`.
- Ao carregar a página, o mesmo PageView é espelhado ao servidor via requisição a `/tracker`, carregando o **mesmo** `event_id`, o nome do evento (PageView), o horário do evento e a URL da página.
- Se o script do Pixel não carregar (bloqueio, falha de rede), o espelho ao servidor ainda é enviado — o servidor continua sendo a via autoritativa.
- Se a requisição ao servidor falhar, a navegação do visitante não é afetada (falha silenciosa, sem erro visível).
- Visitante navega para outra página do site e um novo `event_id` é gerado — cada visualização tem seu próprio par de eventos deduplicados.

### Módulo: Proxy first-party do script do Pixel (`functions/scripts/[[path]].js`)

**Descrição:** O módulo que hoje serve o script de analytics como first-party passa a servir **também** o script do Pixel do Meta (`fbevents.js`) pelo mesmo caminho `/scripts/…` do próprio domínio, contornando bloqueadores que barram o domínio do Meta. O comportamento atual para o script de analytics permanece **intacto**.

**Componentes:**
- Roteador por nome de script: identifica se a requisição pede o script de analytics (comportamento atual) ou o script do Pixel do Meta (novo), pelo caminho solicitado.
- Buscador/repassador do script do Pixel: busca o `fbevents.js` na origem do Meta e o devolve como se fosse um arquivo do próprio site.
- Cache do script: guarda a cópia do script por um período, evitando buscar a origem a cada visita (mesmo padrão do script de analytics).

**Comportamentos:**
- Requisição ao caminho do script de analytics continua respondendo exatamente como hoje (nada muda para o analytics).
- Requisição ao novo caminho do script do Pixel devolve o conteúdo do `fbevents.js` do Meta, servido como arquivo do próprio domínio.
- Resposta do script do Pixel é entregue com o tipo de conteúdo de script e passa a ser cacheada, respondendo das cópias em cache nas visitas seguintes enquanto o cache for válido.
- Se a busca na origem do Meta falhar, a resposta é um script vazio inofensivo (sem erro na página do visitante), no mesmo padrão do analytics.
- Requisição a qualquer outro caminho sob `/scripts/…` que não seja um dos dois scripts conhecidos não passa a ser proxiada para lugar nenhum (sem proxy aberto).

### Módulo: Espelho browser do evento Lead (4 pontos de captura)

**Descrição:** Os quatro pontos do site que hoje capturam leads e enviam o evento Lead ao servidor (`/tracker`) com um `event_id` passam a disparar **também** a cópia do navegador do mesmo evento — `fbq('track', 'Lead', {}, { eventID })` — reutilizando o **mesmo** `event_id` já gerado. Nenhum dado a mais é coletado; nenhum fluxo de envio existente muda.

Os quatro pontos afetados:
- `src/components/LeadChat.astro` (chat de captura, ~linha 359)
- `src/components/LeadFormModal.astro` (modal de formulário, ~linha 122)
- `src/pages/lives-semanais-v1.astro` (formulário da LP da live, ~linha 142)
- `src/pages/calculadora-atacado/index.astro` (captura da calculadora, ~linha 83)

**Componentes:**
- Disparo do Lead no navegador: em cada ponto de captura, a chamada de Pixel do evento Lead com o `event_id` compartilhado.

**Comportamentos:**
- Visitante conclui a captura no chat e o evento Lead é disparado pelo navegador com o mesmo `event_id` enviado ao servidor.
- Visitante envia o formulário do modal e o evento Lead é disparado pelo navegador com o mesmo `event_id` enviado ao servidor.
- Visitante envia o formulário da LP da live e o evento Lead é disparado pelo navegador com o mesmo `event_id` enviado ao servidor.
- Visitante envia a captura da calculadora e o evento Lead é disparado pelo navegador com o mesmo `event_id` enviado ao servidor.
- Em todos os pontos, o disparo do navegador acontece de forma protegida: se o Pixel não estiver disponível (bloqueado ou não carregado), o envio ao servidor segue normalmente e o visitante não vê erro.
- Em todos os pontos, o envio ao servidor permanece exatamente como é hoje (mesmo payload, mesmo destino, mesmo `event_id`) — o disparo do navegador é apenas uma cópia adicional para deduplicação no Meta.
- Nenhum dado pessoal adicional é anexado à cópia do navegador — os dados do lead seguem indo apenas pela via do servidor, que já os trata.
