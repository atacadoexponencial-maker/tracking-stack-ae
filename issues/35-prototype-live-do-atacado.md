# 35: Protótipo da landing "Live do Atacado"

**Tipo:** Protótipo
**Página:** Landing "Live do Atacado"

## Descrição

Criar a página standalone `src/pages/lives-semanais-v1.astro` com toda a estrutura visual e a copy estática da spec (badge de status, hero + CTA, lista de aprendizados, bloco "para quem é", prova social, bloco do formulário e mensagem de erro oculta), sem o fluxo de envio funcional.

## Escopo

- Página standalone usando `BaseLayout` com `showHeader={false}`, no mesmo padrão visual de `src/pages/workshop-gratuito-atacado.astro`.
- Reutilizar a logo da marca (`src/assets/brand/logo.png`).
- Renderizar exatamente a copy da seção "Conteúdo / Copy" da spec (fonte de verdade — NÃO alterar texto):
  - Badge: `🔴 LIVE GRATUITA E ONLINE • QUINTA, 12H`
  - Headline + subtítulo do hero.
  - CTA primário do hero: `QUERO MINHA VAGA NA LIVE →`.
  - Bloco "Nesta hora, você vai entender:" com os 4 bullets.
  - Bloco "Para quem é a live" (parágrafo de qualificação).
  - Bloco de prova social (Anifil e Essência de Menina).
  - Bloco do formulário: título "Garanta sua vaga gratuita", reforço "Quinta-feira, 12h · ao vivo e online", campos **Nome** e **WhatsApp**, botão `QUERO PARTICIPAR DA LIVE →` e a microcopy de garantia.
  - Elemento de mensagem de erro do formulário, oculto por padrão.
- Marcação semântica e estrutura prontas para o comportamento (campos com `name`, botão de submit, container do formulário com id/âncora alvo do CTA do hero). Sem JavaScript de envio nesta issue.

## Fora de escopo

- Lógica de envio, validação, estados de loading/erro/sucesso, tracking e redirect (issues 36 e 37).

## Cenários

### Happy Path
- Usuária acessa `/lives-semanais-v1` e a página carrega com: badge de status no topo + logo, hero com headline/subtítulo e CTA primário, bloco "Nesta hora, você vai entender" (4 bullets), bloco "Para quem é a live", bloco de prova social (Anifil e Essência de Menina), bloco do formulário (título + reforço de data/horário + campos Nome e WhatsApp + botão + microcopy de garantia) e o elemento de erro oculto.
- A copy renderizada bate caractere a caractere com a seção "Conteúdo / Copy" da spec (fonte de verdade — não alterar texto).
- Ao clicar no CTA primário do hero (`QUERO MINHA VAGA NA LIVE →`), a página rola suavemente até o bloco do formulário, graças à âncora `href="#inscricao"` + `scroll-behavior: smooth` já definido no `global.css`. Como é protótipo, este é o único comportamento interativo presente.
- Visual consistente com `workshop-gratuito-atacado.astro`: `BaseLayout` com `showHeader={false}`, hero claro (bege) e seções alternando fundo escuro/claro, utilitárias `container`/`section`/`section--light`/`eyebrow`/`section-head`/`section-title`/`btn-cta` reaproveitadas do `global.css`.

### Edge Cases
- **Mobile (< 768px):** layout em coluna única; bullets, prova social e formulário empilham e permanecem legíveis (max-width central como nas demais seções).
- **Desktop largo:** conteúdo limitado pela largura máxima do `.container` (`--container: 72rem`); blocos de texto com max-width próprio centralizado, igual ao padrão do workshop.
- **Sem `showFooter` explícito:** `BaseLayout` renderiza o `Footer` por padrão (`showFooter = true`) — manter, igual ao workshop, que não passa a prop.
- **Botão do formulário sem ação:** por ser protótipo, o `<button type="submit">` não dispara navegação/POST; clicar nele apenas tenta submeter o `<form>` (sem `action`, recarrega a própria página). Aceitável nesta issue — a issue 36 anexa o handler.

### Cenário de Erro
- Não há fluxo de erro funcional nesta issue (sem envio, sem validação JS). O elemento de mensagem de erro é renderizado **oculto** (atributo `hidden`), apenas como marcação pronta para a issue 36 popular e exibir.
- Se a logo (`src/assets/brand/logo.png`) não existir no caminho, o build do Astro falha em `astro:assets` — caminho já validado (usado por `workshop-gratuito-atacado.astro`).

## Arquivos

- **Criar:** `src/pages/lives-semanais-v1.astro` — landing standalone da Live do Atacado. Usa `import BaseLayout from '../layouts/BaseLayout.astro'` com `showHeader={false}`, `import { Image } from 'astro:assets'` e `import logo from '../assets/brand/logo.png'`. Estrutura espelhando o workshop: `<header>` com nav/logo + badge `🔴 LIVE GRATUITA E ONLINE • QUINTA, 12H`, hero (headline, subtítulo, CTA `QUERO MINHA VAGA NA LIVE →` como `<a href="#inscricao" class="btn-cta">`), `<main>` com as seções (aprendizados, para quem é, prova social) e o bloco do formulário (`<section id="inscricao">` contendo um `<form>` com `<input name="nome">`, `<input name="telefone">`/WhatsApp, `<button type="submit">QUERO PARTICIPAR DA LIVE →</button>` e `<p ... hidden>` de erro). Bloco `<style>` no próprio `.astro` (scoped), reaproveitando os tokens HSL do `global.css` e seguindo as classes/estilo do workshop. **Sem `<script>` de envio nesta issue.**

> Nenhum arquivo existente precisa ser modificado. `BaseLayout.astro`, `global.css` e `logo.png` são apenas importados/reaproveitados, não alterados. O `LeadFormModal.astro` **não** é usado aqui (esta live usa formulário inline na própria página, com 2 campos; o modal do workshop tem 5 campos e lógica de envio — fora de escopo).

## Checklist
- [x] Criar `src/pages/lives-semanais-v1.astro` com `BaseLayout` + `showHeader={false}`
- [x] Importar e renderizar a logo (`../assets/brand/logo.png`) via `<Image>` no topo
- [x] Renderizar o badge `🔴 LIVE GRATUITA E ONLINE • QUINTA, 12H`
- [x] Hero: headline `Como ter novos revendedores chegando toda semana no seu atacado` + subtítulo da spec + CTA `QUERO MINHA VAGA NA LIVE →` como link âncora para `#inscricao`
- [x] Bloco "Nesta hora, você vai entender:" com os 4 bullets exatos da spec (com os ✅)
- [x] Bloco "Para quem é a live" com o parágrafo de qualificação da spec
- [x] Bloco de prova social (Anifil e Essência de Menina) com o texto exato da spec
- [x] Bloco do formulário: `<section id="inscricao">`, título `Garanta sua vaga gratuita`, reforço `Quinta-feira, 12h · ao vivo e online`
- [x] Campos `name="nome"` (Nome) e `name="telefone"` (WhatsApp) como markup estático
- [x] Botão de submit com texto `QUERO PARTICIPAR DA LIVE →`
- [x] Microcopy de garantia: `Vaga gratuita. Você recebe o link e os lembretes direto no seu WhatsApp.`
- [x] Elemento de mensagem de erro com `id` e atributo `hidden`
- [x] Estilos scoped no `.astro` reaproveitando tokens/classes do `global.css` e o padrão visual do workshop
- [x] Conferir que a copy bate com a spec caractere a caractere (não alterar texto)
- [x] NÃO adicionar `<script>` de envio/validação (fica para a issue 36)
- [x] Validar build: `npm run build` sem erros e página acessível em `/lives-semanais-v1`
