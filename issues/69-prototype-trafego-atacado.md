# 69: Protótipo da LP /trafego-atacado (gestão de tráfego para atacado)

**Tipo:** Protótipo
**Página:** LP do serviço de gestão de tráfego (`/trafego-atacado`)

## Descrição

Criar a página estática `/trafego-atacado` espelhando a estrutura visual da `/se-v1` — as mesmas 9 seções na mesma ordem (Hero com barra própria de logo+CTA compacto e sem o menu padrão do site, Problema, Metodologia/Serviço, Quem Confia com o mesmo marquee de logos, Como Funciona com 4 cards sem duração em minutos, Resultados com 3 depoimentos, AboutFelipe reutilizada sem alteração, FAQ com 6 perguntas e CTA Final) — usando os mesmos moldes visuais das seções da se-v1 porém com o copy próprio definido na seção "Copy por seção" da spec (fonte de verdade), sem alterar o que a se-v1 renderiza hoje. Regra inviolável de copy: nenhuma menção a "consultoria/diagnóstico/sessão gratuita" em nenhum texto ou metadado; os botões de CTA existem visualmente mas ainda não acionam nada (o mecanismo de conversão é a issue 70, bloqueada); a página usa o layout-base existente, então PageView e captura de UTMs funcionam sem nenhum mecanismo novo de tracking.

## Plano (pesquisa realizada)

### Estado atual do código

- `src/pages/se-v1.astro` monta a LP com `BaseLayout` (`showHeader={false}`) + 9 seções de `src/components/sections/` + `LeadChat`. Só o `Hero.astro` aceita props (`headline?`/`subheadline?`, adicionadas na issue 60 com o padrão "prop opcional + fallback literal + diff do dist"); **todas as outras seções têm o copy do funil de sessão estratégica hardcoded** (constantes no frontmatter ou texto literal no template).
- As seções compartilhadas são consumidas por **três páginas em produção**: `/` (index), `/se-v1` e `/vsl` — todas sem passar props (exceto o Hero da se-v1). Qualquer mudança nelas precisa manter o HTML dessas três páginas byte a byte igual.
- `LogoWall.astro` já contém **exatamente** o copy da seção "Quem Confia" da spec (título "Marcas de atacado reais já constroem seus resultados com a gente" + "Mais de 100 marcas, de moda festa a infantil, já passaram pelo método.") → reuso sem alteração. `AboutFelipe.astro` → reuso sem alteração (mandado pela spec).
- Estilos utilitários (`.section`, `.section--light`, `.eyebrow`, `.section-head`, `.section-title`, `.section-sub`, `.btn-cta`, `.container`) vivem em `src/styles/global.css` — nada a criar.
- Os CTAs da se-v1 são `<button data-open-chat>` (abrem o `LeadChat`). Esta LP **não** inclui `LeadChat` (mecanismo é a issue 70), então os CTAs não podem ser `data-open-chat` (ficariam botões mortos).
- A `/aplicacao-mentoria` resolveu um problema diferente (página nova sem reutilizar seções); o precedente relevante aqui é a **issue 60** (parametrização do Hero com fallback, verificada por diff do `dist/`), cujo checklist foi concluído com diff zero — prova que editar o componente não muda o hash de escopo do Astro.
- Fora do escopo desta issue (já cobertos): whitelist do relatório de conversão → **issue 71**; mecanismo/registro de Lead com funil `trafego-atacado` → **issue 70** (bloqueada). O PageView browser+CAPI e a captura de UTMs vêm de graça do `BaseLayout`/middleware.

### Estratégia escolhida: parametrizar as seções existentes via props com fallback (padrão da issue 60)

**Por quê (e não variantes novas):** as diferenças entre se-v1 e trafego-atacado são quase todas **de dados** (strings e arrays), não de estrutura — parametrizar mantém markup+CSS numa fonte única (regra global de reuso) e centraliza TODO o copy da LP nova em um único arquivo (`src/pages/trafego-atacado.astro`), que passa a mapear 1:1 com a seção "Copy por seção" da spec — ideal para as iterações de copy previstas (Pendências 1–4). O risco de quebrar a se-v1 é controlado do mesmo jeito que na issue 60: todo prop novo tem **default idêntico ao literal atual**, elementos com markup interno (`<span>` de destaque nos títulos, botões `data-open-chat`) usam **condicional de elemento inteiro** preservando o fallback caractere a caractere, e a verificação é **diff byte a byte do `dist/index.html`, `dist/se-v1/index.html` e `dist/vsl/index.html`** antes × depois. Criar 7 variantes duplicaria ~400 linhas de CSS escopado que divergiriam com o tempo. As duas únicas mudanças estruturais são pequenas e ficam atrás de condicionais inertes para as páginas atuais: (a) CTA como `<a href>` quando `ctaHref` é passado (Hero e FinalCta); (b) pílula de duração do HowItWorks renderizada só quando o step tem `duration` (os defaults têm).

**Placeholder do CTA (issue 70 bloqueada):** todos os 3 CTAs (barra do hero, hero principal, CTA final) viram `<a href="#agendar">`; a seção FinalCta recebe `id="agendar"`. Clicar nos CTAs do hero rola suavemente (o `global.css` já tem `scroll-behavior: smooth`) até a seção final; o botão final é âncora para a própria seção (no-op inofensivo). Um único valor (`ctaHref`) a trocar na issue 70, marcado com comentário `PLACEHOLDER — issue 70` na página.

### Micro-decisões de copy (não definidas na spec — validar com a usuária se quiser)

- **`<title>`:** "Gestão de Tráfego Pago para Marcas Atacado | Atacado Exponencial". **`description`:** "Gestão completa de tráfego pago para marcas atacado — campanhas, criativos e otimização pelo time do Atacado Exponencial. A gente gera a entrada de novas revendedoras e seu comercial fecha os pedidos." (zero termos proibidos).
- **Rótulo do CTA compacto da barra do hero** (spec não define o texto): "Agendar reunião" — derivado do botão do CTA final ("AGENDAR REUNIÃO COM O TIME"), enquadramento de reunião comercial.
- **Depoimentos:** iniciais dos avatares `K` (Keren), `V` e `V` (Vivianes); contextos `Moda infantil · 6 dígitos/mês`, `Anifil` e `Moda fitness`.
- **Nota sobre a regra de copy:** o proibido são as expressões de **oferta gratuita** ("consultoria gratuita", "diagnóstico gratuito", "sessão gratuita" e equivalentes). O card "02 · Diagnóstico da operação" do Como Funciona é copy da spec (etapa paga, pós-fechamento) e **permanece** — a verificação automatizável é `grep -i "gratuit"` no HTML gerado = 0 ocorrências.

## Cenários

### Happy Path

1. Visitante abre `/trafego-atacado` e vê, sem o menu padrão do site, as 9 seções na ordem da se-v1:
   - **Hero** (fundo bege, tela cheia): barra própria com logo + CTA compacto "Agendar reunião →" (visível ≥768px); badge "Para marcas atacado com faturamento acima de R$ 20 mil/mês" (CSS já exibe em caixa alta); headline "Escale seu atacado para R$ 100 mil, R$ 200 mil, R$ 400 mil ou mais por mês com tráfego pago feito exclusivamente para atacado"; subheadline "Gestão completa de tráfego pago (campanhas, criativos e otimização) feita pelo time do Atacado Exponencial, o 1º método próprio para o mercado atacado. A gente gera a entrada de novas revendedoras e seu comercial fecha os pedidos."; botão "Quero tráfego para meu atacado →"; trust badges "Reunião individual · Direto com nosso time · Sem enrolação"; 4 stats em cards: `+100 / marcas atacado atendidas`, `2013 / desde quando está no digital`, `1º / método próprio para atacado`, `100% / foco em atacado`.
   - **O Problema** (escura): eyebrow "O Problema" (reusado); título "Sua verba de anúncio está rodando no jogo errado."; intro "A internet ensinou o atacado a anunciar como varejo. E o resultado aparece na sua operação:"; os 4 bullets "✕" da spec em cards.
   - **Metodologia** (clara): eyebrow "Metodologia" (reusado); título "Tráfego para Marcas Atacado: o marketing fazendo o papel certo"; intro com "**gerar novos revendedores.**" em negrito (via slot); cards 01 "Anúncio que vende negócio, não peça" e 02 "Funil que termina no seu comercial" com as descrições da spec.
   - **Quem Confia** (escura): `LogoWall` **inalterada** — mesmo título/texto (já idênticos à spec) e mesmo marquee das 19 logos.
   - **Como Funciona** (escura): título "Do primeiro contato à campanha no ar"; 4 cards numerados 01–04 (Reunião comercial / Diagnóstico da operação / Estruturação das campanhas / Gestão e otimização contínua) **sem a pílula de duração** e sem frase de apoio.
   - **Resultados** (clara): título "Tráfego certo para atacado, na prática"; 3 depoimentos da spec (Keren e as duas Vivianes) com estrelas, citação, avatar de iniciais, nome e contexto; sem a linha "+100 marcas atendidas".
   - **Quem é — Felipe Santos**: `AboutFelipe` **inalterada**.
   - **FAQ** (clara): título "Perguntas frequentes"; apoio "Tem outra dúvida? Agende a reunião e converse direto com nosso time."; acordeão com as 6 perguntas/respostas da spec.
   - **CTA Final** (escura, `id="agendar"`): eyebrow "Próximo passo" (reusado); título "Você já tem a marca. Agora precisa da entrada previsível."; texto de apoio da spec; botão "Agendar reunião com o time →"; microcopy "Reunião individual · Vagas limitadas por semana". Footer padrão ao final (como na se-v1).
2. Clicar em qualquer CTA do hero (compacto ou principal) rola suavemente até a seção `#agendar` (CTA final). Clicar no botão do CTA final não faz nada (âncora para a própria seção) — comportamento placeholder documentado até a issue 70.
3. O `BaseLayout` dispara o tracking padrão sozinho: GA4 PageView, `fbq('track','PageView')` nos 2 pixels + espelho `POST /tracker` com o mesmo `event_id`; o middleware grava a sessão com `landing_url` contendo `/trafego-atacado` e as UTMs/cliques de anúncio da URL. Zero código novo de tracking.
4. `/` , `/se-v1` e `/vsl` continuam renderizando exatamente o que renderizam hoje (fallbacks).

### Edge Cases

- **HTML de produção intocado (crítico):** `dist/index.html`, `dist/se-v1/index.html` e `dist/vsl/index.html` byte a byte idênticos antes × depois das mudanças nas 7 seções (as três páginas usam as seções sem props → caem 100% nos fallbacks). Mesmo método de verificação da issue 60; se houver diferença de whitespace, ajustar a formatação do fallback até o diff zerar.
- **Termos proibidos:** `grep -i "gratuit"` em `dist/trafego-atacado/index.html` = 0 ocorrências (cobre "gratuito/gratuita", incluindo `<title>` e meta description). "Diagnóstico da operação" (card 02) é permitido — não é oferta gratuita (ver Plano).
- **Nenhum botão morto:** `grep "data-open-chat"` em `dist/trafego-atacado/index.html` = 0 — a página não tem `LeadChat`, então nenhum CTA pode depender dele; os 3 CTAs são `<a href="#agendar">`.
- **`/trafego-atacado/` com barra final:** o build gera `dist/trafego-atacado/index.html` (formato `directory` padrão do Astro) — `/trafego-atacado` e `/trafego-atacado/` servem a mesma página, nada a configurar.
- **`id` opcional inerte:** `id={id}` com `id === undefined` faz o Astro omitir o atributo — o `<section class="section final">` da se-v1/index/vsl sai idêntico ao atual.
- **Anchors herdam o visual dos botões:** `.hero__nav-cta`, `.hero__cta` e `.btn-cta` são classes (não seletores de tag) e o reset global já zera `text-decoration`/`color` de `<a>` — o `<a>` fica visualmente idêntico ao `<button>`. Cor do texto do CTA principal já é explícita na classe (`color:#fff` / tokens).
- **Movimento reduzido / hover:** o marquee da `LogoWall` pausa no hover e vira grade estática com `prefers-reduced-motion` — herdado sem mudança.
- **Mobile:** stats do hero em grade 2×2, depoimentos com scroll horizontal e snap por card, seções em coluna única, CTAs com área de toque grande — tudo herdado dos estilos existentes.
- **Steps sem `duration`:** o `.how__top` fica só com o número (o `justify-content: space-between` não quebra com um filho único); os defaults do componente mantêm as durações → se-v1/index/vsl inalteradas.
- **Título do hero em texto puro:** headline/subheadline passam como strings (escape automático do Astro, sem `set:html`) — mesmos `<h1 class="hero__title">`/`<p class="hero__sub">` da issue 60.
- **Negrito da intro da Metodologia:** passado como slot nomeado (`<p class="section-sub" slot="sub">… <strong>gerar novos revendedores.</strong> …</p>`) — o fallback do slot é o `<p>` literal atual, então as páginas que não passam o slot não mudam; `.section-sub` é classe global, funciona vindo do slot.

### Cenário de Erro

- Página estática sem input do usuário — **nenhum fluxo de erro novo é criado**.
- Se o espelho `POST /tracker` do PageView falhar (adblock, rede), o `catch` silencioso do `BaseLayout` já engole (comportamento existente, fire-and-forget).
- Clique em CTA antes da issue 70: por design não converte nada — apenas rola até `#agendar`. Não é bug; está demarcado com comentário `PLACEHOLDER — issue 70` no código.
- URLs inexistentes derivadas (`/trafego-atacado/x`): caem na 404 padrão do site (rota não existe) — comportamento correto, nada a tratar.

## Arquivos

- **Criar:** `src/pages/trafego-atacado.astro` — a LP nova. Imports: `BaseLayout`, `Hero`, `Pain`, `Pillars`, `LogoWall`, `HowItWorks`, `Testimonials`, `AboutFelipe`, `Faq`, `FinalCta` (**sem `LeadChat`**). `<BaseLayout title="Gestão de Tráfego Pago para Marcas Atacado | Atacado Exponencial" description="Gestão completa de tráfego pago para marcas atacado — campanhas, criativos e otimização pelo time do Atacado Exponencial. A gente gera a entrada de novas revendedoras e seu comercial fecha os pedidos." showHeader={false}>`. Concentra TODO o copy da spec como props/constantes no frontmatter (bullets do Problema, cards da Metodologia, 4 steps sem `duration`, 3 depoimentos, 6 FAQs, notas do CTA final) e passa `ctaHref="#agendar"` ao `Hero` e ao `FinalCta` + `id="agendar"` ao `FinalCta`, com comentário `PLACEHOLDER — issue 70 decide o mecanismo de conversão; trocar ctaHref aqui`.
- **Modificar:** `src/components/sections/Hero.astro` — ampliar `Props` com `badge?: string`, `navCtaLabel?: string`, `ctaLabel?: string`, `ctaHref?: string`, `trust?: string[]`, `stats?: { value: string; label: string }[]`; defaults = literais/constantes atuais (badge/trust/stats viram default de prop; texto renderizado idêntico). Os dois CTAs viram condicional de elemento inteiro: com `ctaHref` → `<a class="hero__nav-cta" href={ctaHref}>{navCtaLabel} …</a>` / `<a class="hero__cta" href={ctaHref}>{ctaLabel} …</a>`; sem → os `<button data-open-chat>` atuais, caractere a caractere. `<style>` intocado.
- **Modificar:** `src/components/sections/Pain.astro` — `Props { title?: string; sub?: string; points?: string[] }`; título vira condicional de elemento inteiro (fallback preserva o `<span class="pain__hl">`); `sub`/`points` com default = valores atuais.
- **Modificar:** `src/components/sections/Pillars.astro` — `Props { title?: string; pillars?: { number; title; description }[] }` com defaults atuais; título em condicional de elemento inteiro; o `<p class="section-sub">` atual vira fallback de `<slot name="sub">` (para a intro nova com `<strong>`).
- **Modificar:** `src/components/sections/HowItWorks.astro` — `Props { title?: string; sub?: string; steps?: { number; duration?; title; description }[] }`; defaults atuais (steps com `duration`); título em condicional de elemento inteiro (fallback preserva o `<span class="how__hl">35 minutos</span>`); pílula `{s.duration && <span class="how__dur">…</span>}`; `{sub && <p class="section-sub">{sub}</p>}` (trafego passa `sub=""`).
- **Modificar:** `src/components/sections/Testimonials.astro` — `Props { title?: string; sub?: string; testimonials?: { initials; name; role; quote }[] }`; defaults atuais; título em condicional de elemento inteiro (fallback preserva o `<span class="testi__hl">`); `{sub && <p class="section-sub">{sub}</p>}` (trafego passa `sub=""`).
- **Modificar:** `src/components/sections/Faq.astro` — `Props { sub?: string; faqs?: { q; a }[] }` com defaults atuais (título "Perguntas frequentes" continua fixo — é o mesmo nas duas LPs).
- **Modificar:** `src/components/sections/FinalCta.astro` — `Props { id?: string; title?: string; sub?: string; ctaLabel?: string; ctaHref?: string; notes?: string[] }` com defaults atuais; `<section class="section final" id={id}>` (omitido quando `undefined`); CTA em condicional de elemento inteiro (com `ctaHref` → `<a class="btn-cta final__cta" href={ctaHref}>`; sem → o `<button data-open-chat>` atual); notas via `{notes.map(...)}` com default = as duas strings atuais.
- **Não tocar:** `src/components/sections/LogoWall.astro`, `src/components/sections/AboutFelipe.astro`, `src/layouts/BaseLayout.astro`, `src/components/LeadChat.astro`, `src/styles/global.css`, `src/pages/index.astro`, `src/pages/se-v1.astro`, `src/pages/vsl.astro`, middleware, `functions/` (whitelist do relatório é a issue 71; Lead/funil é a issue 70).

## Checklist

- [x] Baseline: rodar `npx astro build` ANTES de qualquer mudança e guardar cópias de `dist/index.html`, `dist/se-v1/index.html` e `dist/vsl/index.html`
- [x] `Hero.astro` com os 6 props novos + condicionais de elemento inteiro nos 2 CTAs; sem props renderiza exatamente o markup atual (`data-open-chat`, "Agendar diagnóstico", "Quero meu diagnóstico gratuito", trust/stats/badge atuais)
- [x] `Pain.astro`, `Pillars.astro`, `HowItWorks.astro`, `Testimonials.astro`, `Faq.astro`, `FinalCta.astro` parametrizados conforme "Arquivos", todos com fallback = copy atual literal
- [x] `src/pages/trafego-atacado.astro` criado com as 9 seções na ordem da se-v1, todo o copy da seção "Copy por seção" da spec, sem `LeadChat`, com `ctaHref="#agendar"` + `id="agendar"` e comentário `PLACEHOLDER — issue 70`
- [x] `npx astro build` conclui sem erro e gera `dist/trafego-atacado/index.html`
- [x] Diff byte a byte de `dist/index.html`, `dist/se-v1/index.html` e `dist/vsl/index.html` (baseline × pós-mudança) = vazio; se divergir, ajustar formatação dos fallbacks até zerar *(divergências de whitespace em Pain/Pillars/FinalCta corrigidas ajustando os fallbacks; diff final = vazio nas 3 páginas)*
- [x] `grep -i "gratuit"` em `dist/trafego-atacado/index.html` = 0 ocorrências (inclui `<title>` e meta description)
- [x] `grep "data-open-chat"` em `dist/trafego-atacado/index.html` = 0 ocorrências; os 3 CTAs presentes como `<a href="#agendar">` e a seção final com `id="agendar"`
- [x] Conferir no preview (`npx astro dev`): CTAs do hero rolam até o CTA final; marquee de logos rodando/pausando no hover; FAQ abre/fecha as 6 perguntas; cards do Como Funciona sem pílula de duração; Resultados sem a linha "+100 marcas atendidas"; mobile com stats 2×2 e depoimentos com snap *(verificado via `npx astro preview` + browser: scroll suave até `#agendar` ok, marquee animando com pausa no hover, FAQ 6 itens abre/fecha, 0 pílulas de duração, sem "+100 marcas atendidas", stats 2 colunas e snap `x mandatory` no mobile, sem scroll horizontal)*
- [x] `git status` mostra apenas os 7 componentes modificados + `trafego-atacado.astro` novo — nenhum outro arquivo tocado *(por esta issue; o working tree tem também mudanças pré-existentes de outras frentes: `spec.md`, `functions/api/conversion.js` — issue 71 —, `issues/50`, `docs/cutover-*` e os arquivos das issues 69–71)*
