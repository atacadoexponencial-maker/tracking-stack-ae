# 185: Protótipo da página de vendas do Workshop Black Exponencial

**Tipo:** Protótipo
**Página:** /workshop-black-exponencial-2026

## Descrição

Criar a página `/workshop-black-exponencial-2026` com todos os blocos na ordem definida na spec (Barra fixa, Hero, Dor, Problema real, Antes e depois, CTA, Solução, Cronograma, Entregáveis, CTA, Autoridade, Prova social, Ancoragem, Oferta, Garantia, Urgência, CTA, FAQ, Fechamento, CTA e rodapé padrão), com todo o conteúdo de texto da spec, a identidade visual do restante do site e o layout responsivo — no celular a mesma ordem de blocos do desktop, blocos de duas colunas empilhados em coluna única e imagem acima do texto nos cards de entregáveis. Sem vídeo, sem formulário, sem contador de vagas e sem contador regressivo; o preço, o destino dos botões, a prova social, o FAQ e o rastreamento entram nas issues seguintes.

## Decisões já tomadas (não reabrir)

1. **Checkout ainda não existe.** Todos os botões leem uma constante única
   `CHECKOUT_URL`, declarada no frontmatter da página. Hoje ela aponta para um
   link de WhatsApp com mensagem pronta ("Quero garantir minha vaga no Workshop
   Black Exponencial"), com comentário explícito de "trocar pela URL do
   checkout". A issue 187 formaliza esse ponto único.
2. **Sem formulário, sem contador de vagas, sem contador regressivo.**
3. **Preço/lote calculado pela data é a issue 186.** Aqui só ficam prontos os
   *pontos de preço* (marcados no HTML), sem duplicar a lógica de data.
4. **Prova social usa os prints reais** de `src/assets/proof/` — os mesmos da
   `/lives-semanais-v2`. Detalhamento na issue 189.
5. **FAQ reaproveita `src/components/sections/Faq.astro`.** Detalhamento na
   issue 190.
6. **Depois de 09/09 às 18h** (fuso de Brasília) a página esconde preço e
   botões e mostra aviso de vendas encerradas; **antes de 10/08** mostra o
   Lote 0 normalmente. Aqui entra só o *markup* do aviso (oculto) e o gancho de
   estado; quem liga o gancho é a issue 186.

## Pesquisa da base de código (o que já existe e o que falta)

### O que vem de graça do `BaseLayout.astro`

`src/layouts/BaseLayout.astro` já entrega, sem nenhuma linha extra na página:
fonte Satoshi pré-carregada, `global.css`, GA4 via proxy `/scripts/gtag.js`,
Meta Pixel via proxy `/scripts/fbevents.js` com `PageView` no navegador +
espelho server-side no `/tracker` (dedup por `event_id`) e Microsoft Clarity.
Props: `title`, `description`, `showHeader`, `showFooter`, `noindex`.

Uso nesta página: `showHeader={false}` (a página tem barra fixa própria e o
logo no topo do hero, igual a `/workshop-gratuito-atacado` e
`/lives-semanais-v2`) e `showFooter` no padrão `true` — a spec pede
"rodapé padrão do site", que é o `src/components/Footer.astro`.

### Tokens e utilitárias já disponíveis em `src/styles/global.css`

`--font-sans` (Satoshi), paleta HSL (`--background` #1e1e1e, `--foreground`
branco, `--secondary`/`--border`/`--muted` #393536, `--muted-foreground` cinza
65%, `--light-bg` bege #f5f0eb, `--light-fg`, `--destructive`), `--radius`
0.75rem e `--container` 72rem. Utilitárias: `.container`, `.section`
(padding-block 4rem), `.section--light` (bege, e já inverte o `.btn-cta`),
`.btn-cta` (pílula branca, caixa alta, letter-spacing 0.1em), `.eyebrow`,
`.section-head`, `.section-title` (`clamp(1.75rem, 4vw, 2.75rem)`),
`.section-sub`. Cores de ✓/✕ usadas no site: `#4ade80` e `#f87171`
(ver `/workshop-gratuito-atacado`).

**Nada precisa ser acrescentado ao `global.css`** — o resto é `<style>` local
com prefixo `wbe-`.

### Componentes de seção: o que dá para reaproveitar

| Componente | Veredito |
|---|---|
| `src/components/sections/Faq.astro` | **Reaproveitar.** Aceita `sub` e `faqs: {q,a}[]`, é `<details>` nativo (todas fechadas por padrão, várias abertas ao mesmo tempo, sem JS) e já vive em `.section--light`. Atende ponto a ponto o comportamento de FAQ da spec. |
| `src/components/Footer.astro` (via `BaseLayout`) | **Reaproveitar** — é o "rodapé padrão do site" pedido. |
| `src/components/sections/FinalCta.astro` | **Reaproveitar no bloco de Fechamento** (que é frase + botão, exatamente a forma do componente): `title` = frase de fechamento, `ctaLabel` = "Quero minha vaga", `ctaHref={CHECKOUT_URL}`, `notes` com data/horário. Ele já renderiza `<a class="btn-cta">` quando recebe `ctaHref`. **Não** serve para os 3 CTAs intermediários (eyebrow fixo "Próximo passo" repetido três vezes). |
| `src/assets/brand/felipe.webp` | **Reaproveitar a imagem** no bloco de autoridade. |
| `src/components/sections/AboutFelipe.astro` | **Não reaproveitar.** Não tem props (bio, stats e eyebrow são fixos), traz 3 stats e 5 parágrafos, enquanto a spec pede foto + nome + papel + **4 frases**. Propifica-lo mudaria um arquivo compartilhado por `/`, `/workshop-gratuito-atacado` e outras — fora do escopo desta issue. Markup próprio na página, importando o mesmo `felipe.webp`. |
| `src/components/sections/HowItWorks.astro` | **Não reaproveitar** no cronograma: eyebrow fixo "Como funciona", título default próprio e layout de cards; a spec pede 7 linhas com horário à esquerda. Markup próprio. |
| `src/components/sections/Pain.astro` | **Não reaproveitar** no bloco de dor: renderiza lista/cards com `section-head`, e a spec pede texto corrido centralizado, sem ícone, sem lista, sem card. Markup próprio. |
| `src/components/sections/Testimonials.astro` | **Não reaproveitar**: são depoimentos em texto com iniciais fictícias; a prova social desta página são os prints. |
| `src/components/ProvaSocialLive.astro` | **Não é isto.** Apesar do nome, é o balão flutuante de notificação fictícia da issue 184 — não tem relação com o bloco de depoimentos. |
| `src/components/LeadFormModal.astro`, `LeadChat.astro`, `AplicacaoForm.astro` | **Proibidos aqui** — a página não capta dados. |
| `Hero.astro`, `HeroVSL.astro`, `Pillars.astro`, `LogoWall.astro`, `VideoTestimonials.astro` | Não se aplicam (hero com formulário/vídeo, grade de pilares, muro de logos, vídeos). |

### Padrão a copiar (não componentizar agora)

O grid de prints de depoimento já existe idêntico em
`src/pages/lives-semanais-v2.astro` (linhas 16–19 e 60–72) e em
`src/pages/video-workshop-instagram.astro`:

```js
const proofModules = import.meta.glob('../assets/proof/*.{jpg,png}', { eager: true });
const proofImages = Object.entries(proofModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, m]) => (m as { default: ImageMetadata }).default);
```

Reproduzir esse padrão aqui (terceira ocorrência). Extrair um componente
compartilhado obrigaria a mexer nas duas páginas existentes — fora do escopo;
fica registrado como avaliação para a issue 189.

São 9 prints hoje: `proof-1.jpg`, `proof-2.png` … `proof-8.png`, `proof-9.jpg`.

### Restrição técnica decisiva: o site é estático

`astro.config.mjs` usa `output: 'static'` e `build: { format: 'directory' }`.
Não há SSR: **qualquer coisa calculada no frontmatter congela no momento do
build**. Consequência direta para esta issue: os pontos de preço e o estado de
"vendas encerradas" não podem ser só interpolação de frontmatter — precisam ser
elementos marcados com `data-*`, que a issue 186 preenche no navegador. Esta
issue entrega os *ganchos*; a 186 entrega o cálculo.

### Fronteiras com as outras issues

- **187 (destino de compra):** aqui já existe a constante `CHECKOUT_URL` e todos
  os botões a usam. A 187 formaliza o ponto único e o parâmetro da plataforma.
- **188 (rastreamento):** **não** escrever aqui `trk`, `/checkout-session` nem
  `InitiateCheckout` — é da 188, conforme `docs/page-types/sales-page.md`. Esta
  issue só deixa os botões de compra marcados com `data-checkout` (atributo
  inerte, sem JS), que é o seletor de que a 188 vai precisar.
- **188, nota de dependência:** `functions/api/conversion.js` tem uma
  **whitelist** `KNOWN_PAGE_PATHS` (linhas 107–127). Enquanto
  `/workshop-black-exponencial-2026` não estiver nela, a página não aparece na
  visão "Conversão por LP" do dash. Esse arquivo **não** é tocado nesta issue —
  fica anotado como pendência da 188.
- **A/B:** o `functions/_middleware.js` já intercepta qualquer path de página;
  a compatibilidade com o teste A/B é automática e não exige nada aqui.

## Cenários

### Happy Path

Uma dona de marca de atacado abre `/workshop-black-exponencial-2026` no celular
vinda de um anúncio. A barra fixa aparece no topo com "BLACK EXPONENCIAL · 09/09
· 19h · ao vivo" e o botão pequeno de compra, e continua visível enquanto ela
rola. Ela lê o hero (selo, headline com "2 horas" em destaque, subtítulo com
data/horário/duplo pico, botão "Garantir minha vaga" e, logo abaixo, a linha de
valor + rótulo do lote), passa pelo bloco de dor, pelo problema real com a linha
do tempo OUT/NOV, pelo antes e depois, e encontra o primeiro CTA. Segue por
solução, cronograma de 7 linhas, entregáveis (card largo do planner, três cards
menores, segundo card largo dos checklists) e o segundo CTA. Depois vêm
autoridade, prova social em prints, ancoragem, caixa de oferta (R$ 297 riscado,
valor do lote em destaque, rótulo do lote, botão com o valor no texto, aviso do
próximo valor), faixa de garantia, urgência e o terceiro CTA. Abre duas
perguntas do FAQ ao mesmo tempo, lê o fechamento e clica no último botão, que a
leva ao destino de `CHECKOUT_URL`. Todos os blocos aparecem na mesma ordem do
desktop; os de duas colunas ficam empilhados; nos cards de entregáveis a imagem
fica acima do texto.

### Edge Cases

- **Barra fixa vs. conteúdo:** a barra é `position: fixed` sobre o conteúdo. O
  topo do hero precisa de espaço (`padding-top` igual à altura da barra) e o
  `html` precisa de `scroll-padding-top`, senão a barra come o início do hero.
  Ela não pode cobrir o botão de compra de nenhum bloco em nenhuma largura.
- **Barra fixa no celular:** quebra em duas linhas **ou** omite o nome do
  evento, preservando sempre a data e o botão. Em telas muito estreitas
  (≤360px), o botão nunca some.
- **Ordem no celular:** nada de `order:` no CSS nem de blocos duplicados
  escondidos por media query — a ordem do DOM é a ordem final, no desktop e no
  celular.
- **Cards de entregáveis no celular:** imagem acima do texto. Como no desktop os
  cards largos são de duas colunas, a ordem do DOM deve ser imagem→texto e o
  desktop reposiciona via grid, não o contrário.
- **Assets que ainda não existem:** o mockup do planner não existe em
  `src/assets/`. O hero cai para a alternativa já decidida (`felipe.webp`), e o
  card largo do planner fica **sem imagem** — sem moldura vazia, sem
  placeholder, sem "em breve".
- **Prova social sem material:** se `src/assets/proof/` estiver vazio, o bloco
  inteiro não é renderizado (guarda `proofImages.length > 0`).
- **Pontos de preço antes da issue 186:** os `data-*` já renderizam os valores
  do Lote 0 como conteúdo estático, para a página nunca aparecer com espaço em
  branco no lugar do preço.
- **Depois de 09/09 18h:** o aviso "vendas encerradas" existe no DOM com
  `hidden` e as regras CSS de esconder preço e botões ficam presas a um gancho
  de estado no wrapper (ex.: `[data-vendas="encerradas"]`). Nesta issue o gancho
  nasce em "abertas" e nada o muda.
- **Antes de 10/08:** a página mostra o Lote 0 normalmente — que é exatamente o
  estado estático entregue aqui.
- **`prefers-reduced-motion`:** nenhuma animação de entrada; se houver
  transição, respeitar a media query (padrão já usado em `ProvaSocialLive.astro`).
- **Impressão / leitor de tela:** a linha do tempo OUT/NOV é decorativa em CSS,
  mas os dois marcos precisam existir como texto real, não como imagem.

### Cenário de Erro

Página estática, sem rede e sem estado — não existe erro em tempo de execução.
Os modos de falha reais são de build e de configuração:

- **`CHECKOUT_URL` vazia ou malformada:** os botões viram `href=""` e recarregam
  a própria página. A constante nunca pode ficar vazia; enquanto a URL real não
  existir, o link de WhatsApp com mensagem pronta é o valor válido.
- **Import de asset inexistente:** importar `planner.webp` antes de o arquivo
  existir **quebra o build** do `astro:assets`. Por isso o card do planner sai
  sem imagem nesta issue.
- **Nome de rota errado:** o arquivo precisa se chamar exatamente
  `workshop-black-exponencial-2026.astro` — qualquer variação muda a URL da
  spec e desalinha o rastreamento das issues seguintes.

## Arquivos

- **Criar:** `src/pages/workshop-black-exponencial-2026.astro` — a página
  inteira: frontmatter com `CHECKOUT_URL`, os textos em arrays (cronograma,
  antes/depois, entregáveis, itens da oferta, FAQ), o glob dos prints e o import
  de `felipe.webp`; markup dos 19 blocos na ordem da spec; `<style>` local com
  prefixo `wbe-` e os breakpoints.

**Nenhum arquivo existente é modificado.** `Faq.astro`, `FinalCta.astro`,
`Footer.astro`, `BaseLayout.astro` e `global.css` entram só por uso/props.
`functions/api/conversion.js` fica para a issue 188.

## Dependências Externas

- **Número/link de WhatsApp para o `CHECKOUT_URL`:** **não existe** nada
  reaproveitável no repositório. A busca por `wa.me/<número>` e
  `api.whatsapp.com` não retorna nenhum resultado; o único link de WhatsApp fixo
  no frontend é o **grupo** da live
  (`src/pages/video-workshop-instagram.astro:6` →
  `https://chat.whatsapp.com/LgTdlh5fUOw69bQ96pv5SG`), que não serve aqui; e o
  número de atendimento vive apenas nas env vars de backend
  `LEAD_REDIRECT_WHATSAPP` / `LEAD_REDIRECT_WHATSAPP_TRAFEGO`
  (`functions/tracker.js:320,326`), inacessíveis a uma página estática.
  → Pedir o número à usuária. Enquanto não vier, usar
  `https://wa.me/?text=Quero%20garantir%20minha%20vaga%20no%20Workshop%20Black%20Exponencial`
  (abre o WhatsApp com a mensagem pronta e o seletor de contato — não quebra a
  navegação), com o comentário de "trocar pela URL do checkout".
- **Mockup do planner (imagem):** não existe. Pendência 2 da spec — hero cai
  para `felipe.webp` e o card do planner fica sem imagem.
- **Artes dos cards de entregáveis:** fora de escopo (spec).
- **URL e plataforma do checkout:** pendência 1 da spec; bloqueia a 187/188, não
  esta issue.

## Checklist

**Estrutura**

- [x] Criar `src/pages/workshop-black-exponencial-2026.astro` usando
      `BaseLayout` com `showHeader={false}` e rodapé padrão
- [x] `title` e `description` descrevendo o workshop de Black Friday para marcas
      de atacado, **com data e horário** (09/09, 19h)
- [x] Declarar `CHECKOUT_URL` como constante única no frontmatter, com o
      comentário "trocar pela URL do checkout", e usá-la em **todos** os botões
      (barra fixa, hero, 3 CTAs do corpo, botão da oferta, botão da urgência e
      botão do fechamento)
- [x] Marcar todo botão de compra com `data-checkout` (atributo inerte, para a
      issue 188) — 7 dos 8 botões. O 8º é o do `FinalCta.astro` (fechamento):
      ele é renderizado por um componente compartilhado, que esta issue não pode
      modificar. O seletor para a issue 188 é `.wbe-fechamento .btn-cta`.

**Blocos, nesta ordem**

- [x] 1. Barra fixa — "BLACK EXPONENCIAL · 09/09 · 19h · ao vivo" + botão
      pequeno de compra; `position: fixed`, visível na rolagem inteira
- [x] 2. Hero — selo "Exclusivo para marcas atacado"; headline "Monte a Black
      Friday da sua marca atacado em 2 horas, com metas, oferta e calendário
      semana a semana definidos." com "2 horas" em destaque; subtítulo com data,
      horário e a tese do duplo pico; botão "Garantir minha vaga"; linha de
      valor + rótulo do lote logo abaixo do botão; `felipe.webp` como elemento
      visual. **Sem vídeo.**
- [x] 3. Dor — texto corrido centralizado, frases curtas em linhas separadas,
      sem ícone/lista/card, fundo diferente do hero
- [x] 4. Problema real — texto + linha do tempo com dois marcos
      ("OUT: decisão do lojista" / "NOV: você anuncia (tarde)")
- [x] 5. Antes e depois — "Como a maioria faz" (4 itens ✕, apagado) x "Como
      funciona o duplo pico" (4 itens ✓, destacado) + fecho "No dia 09/09 você
      monta os dois."
- [x] 6. **CTA**
- [x] 7. Solução — nome, data, horário, duração e o posicionamento de sessão de
      execução (entra com o planner em branco, sai preenchido)
- [x] 8. Cronograma — 7 linhas (19h00, 19h15, 19h30, 20h00, 20h15, 20h40,
      20h50), horário à esquerda, título em negrito, descrição secundária abaixo
- [x] 9. Entregáveis — card largo "Planner da Black Atacado" (sem imagem por
      ora) + grade de 3 cards (Mapa mental do método completo; Calendário Black
      Atacado 2026; Pack de mensagens de WhatsApp) + card largo "Os 3 checklists
      de execução"
- [x] 10. **CTA**
- [x] 11. Autoridade — `felipe.webp` à esquerda, nome, "fundador do Atacado
      Exponencial" e bio de **4 frases** à direita (markup próprio, sem tocar em
      `AboutFelipe.astro`)
- [x] 12. Prova social — prints de `src/assets/proof/` via `import.meta.glob`,
      com `loading="lazy"`; bloco inteiro omitido se não houver imagem
- [x] 13. Ancoragem — "Quanto custa uma Black mal planejada?" + duas linhas
      ("desconto dado no ano passado", "investimento em anúncio em novembro")
      com valores em branco alinhados à direita + fecho "O workshop custa menos
      que um pedido mínimo da sua marca."
- [x] 14. Caixa de oferta — borda destacada, centralizada; título "WORKSHOP
      BLACK EXPONENCIAL — 09/09 · 19h · 2 horas ao vivo"; 6 itens com check;
      R$ 297 riscado, menor e apagado; valor do lote em tamanho grande; rótulo
      do lote; botão "Garantir minha vaga por R$ [valor]"; linha do próximo valor
- [x] 15. Garantia — faixa horizontal, selo à esquerda e texto dos 7 dias
      (limite 16 de setembro, reembolso integral sem formulário e sem pergunta)
      à direita, sobre fundo diferente do bloco anterior
- [x] 16. Urgência — por que existe prazo (pico 1 na primeira quinzena de
      outubro; campanha montada em setembro) e que cada lote aumenta o valor sem
      mudar conteúdo/materiais + botão "Quero garantir minha vaga"
- [x] 17. **CTA**
- [x] 18. FAQ — `<Faq faqs={...} />` com as 6 perguntas da spec (o texto final é
      afinado na issue 190)
- [x] 19. Fechamento + CTA — `<FinalCta />` com "Duas opções para outubro:
      chegar com a campanha montada em setembro ou improvisar quando o lojista
      já tiver comprado." e botão "Quero minha vaga"
- [x] 20. Rodapé padrão (`showFooter` no default)

**Preço e estado (só os ganchos — lógica é da 186)**

- [x] Marcar os 4 pontos de preço com `data-*` estável: linha do hero, valor da
      caixa de oferta, texto do botão da oferta e linha do próximo valor
- [x] Marcar os 2 pontos de rótulo do lote (hero e caixa de oferta)
- [x] Renderizar estaticamente o Lote 0 (R$ 47) e "Depois do Lote 0, o valor
      sobe para R$ 97" como conteúdo inicial, sempre no formato brasileiro sem
      centavos
- [x] Aviso de "vendas encerradas" presente no DOM com `hidden`, e o gancho de
      estado no wrapper nascendo em "vendas abertas"
- [x] **Não** escrever nenhuma lógica de data/lote nesta issue

**Responsividade e desempenho**

- [x] Mesma ordem de blocos no desktop e no celular (sem `order:`, sem blocos
      duplicados escondidos)
- [x] Empilhar em coluna única no celular: problema real, antes e depois,
      autoridade e entregáveis
- [x] Nos cards de entregáveis, imagem acima do texto no celular
- [x] Barra fixa no celular: duas linhas ou sem o nome do evento, sempre com
      data e botão; nunca cobrindo o botão de compra de nenhum bloco
- [x] Compensar a altura da barra fixa (`padding-top` no topo e
      `scroll-padding-top`)
- [x] Todas as imagens via `astro:assets` (`<Image>`); as abaixo da primeira
      dobra com `loading="lazy"`
- [x] Sem vídeo, sem formulário, sem contador de vagas, sem contador regressivo,
      sem biblioteca nova

**Verificação**

- [x] `npm run build` passa e gera `dist/workshop-black-exponencial-2026/index.html`
- [ ] Conferir em 360px, 768px e 1280px — CSS escrito para os três (breakpoints
      480px, 768px e 880px), mas **falta a conferência visual**: não havia
      navegador disponível no ambiente de execução
- [x] Nenhum arquivo além do criado aparece no `git status`
