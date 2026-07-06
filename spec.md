# Spec: Página /se-v1 — variante da home para teste de copy

## Visão Geral

Criar a página `/se-v1`, uma variante da home (`src/pages/index.astro`, landing de atacadoexponencial.com) que muda **apenas** a copy do hero — headline e subheadline. Todo o resto é idêntico: mesmas seções, mesmo chat de captura (`LeadChat`) com o **mesmo funnel da home** (`sessao-estrategica`), mesmo tracking (o `BaseLayout` já cuida de Pixel/GA4 e o middleware grava a sessão com `landing_url` automaticamente por path). Propósito: comparar variantes de LP na tabela "Conversão por LP" do dashboard (`se-v1` = sessão estratégica v1, para tráfego pago). Sem funil novo, sem SEO extra.

**Onde está a copy hoje (levantamento):**
- A home (`src/pages/index.astro`) é fina (33 linhas): só importa 9 componentes de seção + `LeadChat` e passa `title`/`description` ao `BaseLayout`. A copy do hero **não** está inline na página.
- Headline e subheadline estão hardcoded em `src/components/sections/Hero.astro`: `<h1 class="hero__title">` (linhas 24–26, com `<strong>R$ 400 mil</strong>` no meio) e `<p class="hero__sub">` (linhas 27–30). O componente `Hero` não recebe props hoje.
- Funnel da home: `<LeadChat funnel="sessao-estrategica" />` (index.astro, linha 31).
- Title/description da home: `title="Atacado Exponencial — Diagnóstico gratuito para sua marca atacado"` e `description="Em uma sessão individual e gratuita, analisamos seu atacado de ponta a ponta..."`. **Decisão:** o title NÃO deriva da headline (é uma string independente, focada em "diagnóstico gratuito"), então a `/se-v1` usa **os mesmos** title e description da home — só o hero muda.

**Decisão duplicar × parametrizar:** parametrizar. O `Hero.astro` ganha duas props opcionais (`headline` e `subheadline`) com fallback para a copy atual — mudança mínima e sem risco para a home. A nova página `src/pages/se-v1.astro` é uma cópia das 33 linhas finas do `index.astro` passando as duas strings novas ao `Hero` (duplicar a página é inevitável — cada rota exige um arquivo — mas nenhum markup/estilo de seção é duplicado).

**Nova copy do hero em /se-v1:**
- Headline: "Descubra o que está travando seu atacado de escalar para R$ 100 mil, R$ 200 mil, R$ 400 mil ou mais por mês"
- Subheadline: "Em uma sessão individual e gratuita, nosso time analisa seu atacado de ponta a ponta e te entrega um plano de ação personalizado para gerar novos revendedores e aumentar a recompra."

## Páginas / Módulos

### Página /se-v1

**Descrição:** Cópia da home com hero de copy alternativa para teste de tráfego pago. Arquivo novo `src/pages/se-v1.astro`, espelho de `src/pages/index.astro` (mesmo `BaseLayout` com o mesmo `title`/`description`/`showHeader={false}`, mesmas 9 seções na mesma ordem, mesmo `<LeadChat funnel="sessao-estrategica" />`), diferindo apenas nas props `headline` e `subheadline` passadas ao `<Hero />`.

**Componentes:**
- `src/pages/se-v1.astro` (novo): página espelho da home; passa a headline e a subheadline novas ao `Hero`.
- `src/components/sections/Hero.astro` (modificado): passa a aceitar props opcionais `headline?: string` e `subheadline?: string`. Sem props (caso da home), renderiza exatamente o markup atual — `<h1>` com o `<strong>R$ 400 mil</strong>` e o `<p class="hero__sub">` atuais. Com props (caso da /se-v1), renderiza as strings puras no mesmo `<h1 class="hero__title">` e `<p class="hero__sub">` (a headline nova não tem trecho em negrito). Badge, CTAs, trust items, stats e estilos permanecem intactos.
- Reutilizados sem alteração: `BaseLayout.astro`, `Pain`, `Pillars`, `LogoWall`, `HowItWorks`, `Testimonials`, `AboutFelipe`, `Faq`, `FinalCta`, `LeadChat`.

**Comportamentos:**
- Visitante abre `/se-v1` e vê a home completa com o hero novo: headline "Descubra o que está travando seu atacado de escalar para R$ 100 mil, R$ 200 mil, R$ 400 mil ou mais por mês" e subheadline "Em uma sessão individual e gratuita, nosso time analisa seu atacado de ponta a ponta e te entrega um plano de ação personalizado para gerar novos revendedores e aumentar a recompra."; todas as demais seções idênticas à home.
- Visitante abre `/` (home) e vê exatamente a copy atual do hero — o fallback das props garante zero mudança visual na home.
- O chat de captura na `/se-v1` funciona igual ao da home: mesmo `LeadChat` com `funnel="sessao-estrategica"`; lead capturado segue o mesmo fluxo de envio existente, sem nenhum funil novo.
- A sessão do visitante da `/se-v1` é registrada pelo middleware com `landing_url` contendo `/se-v1` (comportamento já existente, nenhum código de tracking novo), permitindo comparar `/` × `/se-v1` na tabela "Conversão por LP" do dashboard.
- O tracking de página (Pixel/GA4/cookies de sessão) roda na `/se-v1` exatamente como na home, via `BaseLayout` — nada é adicionado ou configurado.
- A `/se-v1` usa o mesmo `title` e a mesma `description` da home no `BaseLayout` (decisão registrada na Visão Geral: o title não deriva da headline).
- O build do Astro gera a página estática `/se-v1` junto com as demais páginas, sem configuração extra.
