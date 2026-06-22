# 37: CTA do hero rola até o formulário

**Tipo:** Implementação
**Página:** Landing "Live do Atacado"

## Descrição

Ao clicar no CTA primário do hero ("QUERO MINHA VAGA NA LIVE →"), levar o usuário ao bloco do formulário de inscrição (rolagem suave até o formulário e/ou foco no primeiro campo).

## Escopo

- Vincular o CTA do hero ao container do formulário (âncora/id definido no protótipo, issue 35) com rolagem até o bloco e, opcionalmente, foco no campo Nome.
- Comportamento puramente de navegação interna na página — sem rede, sem lógica de negócio.

## Notas

- O carregamento da página já estabelece a sessão de tracking/atribuição automaticamente via `functions/_middleware.js` (cookies de sessão, UTMs/click IDs persistidos no backend). Nenhuma ação é necessária no front para isso — basta a página existir. Esta issue só cobre a navegação do CTA até o formulário.

## Fora de escopo

- Envio, validação e estados do formulário (issue 36).

## Cenários

### Happy Path
- Usuário no topo da página clica no CTA do hero "QUERO MINHA VAGA NA LIVE →".
- O navegador resolve a âncora `href="#inscricao"` e rola a página até a `<section id="inscricao">`.
- Como o `html` tem `scroll-behavior: smooth` (`src/styles/global.css`, linha 66), a rolagem é suave.
- O formulário (`#inscricao-form-el`, campos Nome e WhatsApp) fica visível na viewport, pronto para preenchimento.

### Edge Cases
- **Usuário já com o formulário visível** (telas altas): o clique apenas reposiciona o scroll para o topo da seção; comportamento idempotente, sem erro.
- **`prefers-reduced-motion` ativo**: o navegador ignora a rolagem suave e faz o salto instantâneo para a âncora. A navegação continua funcionando — comportamento acessível e correto. (Não há override de `prefers-reduced-motion` no CSS, e nem é necessário: o salto nativo já é o fallback acessível.)
- **JavaScript desabilitado**: irrelevante — a âncora é HTML/CSS puro, não depende de JS. Continua funcionando.
- **Cliques repetidos**: cada clique reaplica a âncora; sem efeito colateral.

### Cenário de Erro
- Não há caminho de erro real nesta issue: é navegação interna pura, sem rede e sem lógica de negócio.
- O único modo de falha concebível seria a âncora apontar para um `id` inexistente. Verificado que NÃO ocorre: o CTA usa `href="#inscricao"` (linha 26) e a seção do formulário tem `id="inscricao"` (linha 60). IDs casam.

## Arquivos

**Nenhum arquivo a modificar — comportamento já satisfeito pelo protótipo (âncora nativa + `scroll-behavior: smooth`).**

Justificativa:
- O protótipo (issue 35) já implementou o CTA do hero como `<a href="#inscricao" class="btn-cta lv-hero__cta">` em `src/pages/lives-semanais-v1.astro` (linha 26).
- A seção do formulário já tem o id correspondente: `<section id="inscricao" ...>` (linha 60).
- O `global.css` já aplica `scroll-behavior: smooth` no `html` (linha 66), tornando a rolagem suave.
- O comportamento exigido pela spec — "levar ao formulário (rolagem até o formulário OU foco no primeiro campo)" — é satisfeito pela rolagem nativa até o bloco. A âncora HTML cobre o requisito sem JavaScript.
- O foco no primeiro campo é explicitamente "opcional" na issue. Adicionar um script para `.focus()` num formulário de 2 campos que já fica plenamente visível seria expandir escopo sem ganho real de UX/acessibilidade (a âncora já entrega o formulário pronto na tela). Pelo princípio anti-vibe coding (não expandir escopo), **não** se adiciona JS para foco.

## Checklist
- [ ] Confirmar que o CTA do hero é `<a href="#inscricao" class="btn-cta lv-hero__cta">` em `src/pages/lives-semanais-v1.astro` (linha 26) — JÁ OK.
- [ ] Confirmar que a seção do formulário tem `id="inscricao"` (linha 60) — JÁ OK.
- [ ] Confirmar que `scroll-behavior: smooth` está no `html` em `src/styles/global.css` (linha 66) — JÁ OK.
- [ ] Validar manualmente no navegador: clicar no CTA do hero rola suavemente até o formulário.
- [ ] Validar com `prefers-reduced-motion` ativo: o salto é instantâneo e ainda chega ao formulário.
- [ ] Confirmar que nenhum arquivo foi modificado (issue já satisfeita pelo protótipo).
