# 60: Página /se-v1 — variante da home com hero parametrizado

**Tipo:** Implementação
**Página:** /se-v1 (`src/pages/se-v1.astro`)

## Descrição

Criar a página `/se-v1`, espelho da home (`src/pages/index.astro`) que muda apenas a copy do hero para teste de tráfego pago, comparável na tabela "Conversão por LP" do dashboard. O `Hero.astro` ganha props opcionais `headline` e `subheadline` com fallback para a copy atual (zero mudança visual na home), e `src/pages/se-v1.astro` replica as 33 linhas finas do index passando as duas strings novas — mesmo `title`/`description`, mesmas 9 seções, mesmo `<LeadChat funnel="sessao-estrategica" />`, sem funil novo e sem tracking novo.

## Cenários

### Happy Path

1. Visitante abre `/se-v1` e vê a home completa com o hero novo:
   - Headline (texto puro, sem `<strong>`): "Descubra o que está travando seu atacado de escalar para R$ 100 mil, R$ 200 mil, R$ 400 mil ou mais por mês"
   - Subheadline: "Em uma sessão individual e gratuita, nosso time analisa seu atacado de ponta a ponta e te entrega um plano de ação personalizado para gerar novos revendedores e aumentar a recompra."
2. Todas as demais seções (Pain, Pillars, LogoWall, HowItWorks, Testimonials, AboutFelipe, Faq, FinalCta) idênticas à home, na mesma ordem, dentro do mesmo `<main>`.
3. O chat de captura funciona igual ao da home (`LeadChat` com `funnel="sessao-estrategica"`); os botões `data-open-chat` do hero abrem o mesmo chat; o lead segue o fluxo de envio existente.
4. O middleware registra a sessão com `landing_url` contendo `/se-v1` (comportamento já existente, zero código de tracking novo), permitindo comparar `/` × `/se-v1` no dashboard.

### Edge Cases

- **Home renderiza EXATAMENTE como antes (fallback):** `<Hero />` sem props cai no ramo de fallback, que contém o markup atual literal — inclusive o `<strong>R$ 400 mil</strong>` dentro do `<h1 class="hero__title">`. Verificado por diff do `dist/index.html` antes × depois da mudança (deve ser idêntico; no máximo diferença de whitespace interno ao `<h1>`/`<p>`, e nesse caso ajustar a formatação do ramo de fallback até o diff zerar).
- **/se-v1 com hero novo em texto puro:** com props, o `Hero` renderiza `{headline}` e `{subheadline}` como texto (escape automático do Astro — nenhum `set:html`), nos mesmos `<h1 class="hero__title">` e `<p class="hero__sub">`, herdando todos os estilos.
- **/se-v1/ com barra final:** o build gera `dist/se-v1/index.html` (formato `directory`, padrão do Astro), então `/se-v1` e `/se-v1/` servem a mesma página — nada a configurar.
- **Página aparece no build:** `npx astro build` inclui `/se-v1` na saída sem configuração extra (qualquer `.astro` em `src/pages/` vira rota).
- **Badge, nav, CTAs, trust items, stats e todo o `<style>` do Hero** permanecem intactos e compartilhados pelas duas páginas.
- **Title/description:** a `/se-v1` usa os mesmos da home (decisão da spec: o title não deriva da headline). Sem SEO extra.

### Cenário de Erro

- Nenhum novo — página estática, sem input do usuário além do chat já existente; nenhum fluxo de erro é adicionado.

## Arquivos

- **Modificar:** `src/components/sections/Hero.astro`
  - No frontmatter (após os imports existentes), adicionar a interface e a desestruturação:
    ```ts
    interface Props {
      headline?: string;
      subheadline?: string;
    }
    const { headline, subheadline } = Astro.props;
    ```
  - No template, trocar o `<h1>` (linhas 24–26) e o `<p>` (linhas 27–30) por condicionais que branqueiam o **elemento inteiro**, mantendo o fallback com o markup atual caractere a caractere (estratégia escolhida por ser a mais simples que preserva o `<strong>` e o whitespace original — evita interpolar a copy antiga como string, o que perderia o `<strong>`, ou usar `set:html`, que é desnecessário e arriscado):
    ```astro
    {headline ? (
      <h1 class="hero__title">{headline}</h1>
    ) : (
      <h1 class="hero__title">
        O Plano de Ação que seu Atacado precisa para faturar <strong>R$ 400 mil</strong> ou mais por mês
      </h1>
    )}
    {subheadline ? (
      <p class="hero__sub">{subheadline}</p>
    ) : (
      <p class="hero__sub">
        Em uma sessão individual e gratuita, analisamos seu atacado de ponta a ponta
        e entregamos um plano personalizado para destravar seu crescimento.
      </p>
    )}
    ```
  - Nada mais muda: nav, badge, CTA, trust, stats e o bloco `<style>` ficam intocados.

- **Criar:** `src/pages/se-v1.astro` — espelho exato de `src/pages/index.astro` (mesmos 11 imports na mesma ordem: `BaseLayout`, `Hero`, `Pain`, `Pillars`, `LogoWall`, `HowItWorks`, `Testimonials`, `AboutFelipe`, `Faq`, `FinalCta`, `LeadChat`; mesmo `<BaseLayout title="Atacado Exponencial — Diagnóstico gratuito para sua marca atacado" description="Em uma sessão individual e gratuita, analisamos seu atacado de ponta a ponta e entregamos um plano de ação personalizado para destravar seu crescimento." showHeader={false}>`; mesmo `<main>` com as 8 seções na mesma ordem; mesmo `<LeadChat funnel="sessao-estrategica" />`), com a única diferença no Hero:
  ```astro
  <Hero
    headline="Descubra o que está travando seu atacado de escalar para R$ 100 mil, R$ 200 mil, R$ 400 mil ou mais por mês"
    subheadline="Em uma sessão individual e gratuita, nosso time analisa seu atacado de ponta a ponta e te entrega um plano de ação personalizado para gerar novos revendedores e aumentar a recompra."
  />
  ```

- **Não tocar:** `BaseLayout.astro`, `Pain`, `Pillars`, `LogoWall`, `HowItWorks`, `Testimonials`, `AboutFelipe`, `Faq`, `FinalCta`, `LeadChat`, middleware, tracking.

## Checklist

- [x] Antes de mexer no Hero: rodar `npx astro build` e guardar cópia do `dist/index.html` atual (baseline para o diff)
- [x] `src/components/sections/Hero.astro` com `interface Props { headline?: string; subheadline?: string }` e condicionais de elemento inteiro; sem props renderiza exatamente o markup atual (com o `<strong>R$ 400 mil</strong>`)
- [x] `src/pages/se-v1.astro` criado espelhando o index (mesmos imports, mesmo title/description/showHeader, mesma ordem de seções, `<LeadChat funnel="sessao-estrategica" />`), passando as duas strings novas ao `<Hero />`
- [x] `npx astro build` conclui sem erro e gera `dist/se-v1/index.html`
- [x] Diff do `dist/index.html` (baseline × pós-mudança) vazio — HTML da home byte a byte idêntico; se houver diferença de whitespace, ajustar a formatação do fallback até zerar
- [x] `dist/se-v1/index.html` contém a headline nova dentro de `<h1 class="hero__title">` (sem `<strong>`) e a subheadline nova em `<p class="hero__sub">`
- [x] Nenhum outro arquivo de código modificado (`git status` mostra só `Hero.astro` modificado e `se-v1.astro` novo)
