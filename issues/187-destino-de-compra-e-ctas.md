# 187: Destino de compra em ponto único de configuração e os botões da página

**Tipo:** Implementação
**Página:** /workshop-black-exponencial-2026

## Descrição

Ler o destino de compra de um único ponto de configuração da página e usá-lo em todos os botões �?" botão da barra fixa, botão do hero, os quatro CTAs do corpo e o botão da caixa de oferta �?", mantendo o mesmo texto e a mesma cor nos botões do corpo. Enquanto a URL real do checkout não existir, todos apontam para o destino placeholder configurado, sem quebrar a navegação nem exibir erro ao visitante, de modo que trocar pela URL real exija alterar apenas esse ponto de configuração, sem tocar em nenhum bloco da página.

## Decisões já tomadas (não reabrir)

1. **O checkout real ainda não existe.** `CHECKOUT_URL` continua no placeholder
   de WhatsApp entregue pela issue 185, com comentário explícito de troca.
   Nenhuma URL de plataforma é inventada aqui.
2. **A plataforma de checkout ainda não foi escolhida.** O nome do parâmetro que
   carrega o identificador de compra muda por plataforma (`trk` na Eduzz, `xcod`
   na Hotmart, `sck` na Kiwify �?" ver `docs/page-types/sales-page.md`). Por isso
   esta issue declara **também** a constante `CHECKOUT_PARAM`, com default
   `'trk'` e comentário de troca ao lado do de `CHECKOUT_URL`.
3. **Todos os botões usam o mesmo texto-base e a mesma cor** (`.btn-cta` do
   `global.css`). A única exceção deliberada é o botão da barra fixa
   (`.wbe-barra__cta`, pílula pequena invertida): ele não é botão "do corpo" e a
   spec só exige uniformidade nos do corpo.
4. **`FinalCta.astro` não é modificado.** Justificativa completa abaixo.

## Estado atual (o que a issue 185 já deixou pronto)

Em `src/pages/workshop-black-exponencial-2026.astro`:

- `CHECKOUT_URL` declarada no frontmatter (linhas 9�?"16), hoje
  `https://wa.me/?text=Quero%20garantir%20minha%20vaga%20no%20Workshop%20Black%20Exponencial`.
- **7 botões** com `href={CHECKOUT_URL}` **e** `data-checkout`: barra fixa (161),
  hero (197), CTA 6 (301), CTA 10 (393), caixa de oferta (474), urgência (520),
  CTA 17 (529).
- **8º botão** vindo de `<FinalCta ctaHref={CHECKOUT_URL} />`, envolvido por
  `<div class="wbe-fechamento">` (543�?"551) �?" tem `href` correto, **não** tem
  `data-checkout`.
- CSS do estado "vendas encerradas" já cobre os dois casos (linhas 628�?"632):
  `:global([data-checkout])` **e** `:global(.wbe-fechamento .btn-cta)`.

Ou seja: o destino já é único. O que falta é (a) formalizar/documentar o ponto
único incluindo o parâmetro da plataforma, (b) tornar os **8** botões alcançáveis
por **um** seletor, e (c) deixar `CHECKOUT_PARAM` legível pelo script da 188.

## Decisão: como cobrir o botão do `FinalCta`

**Escolhida: marcação em tempo de execução pelo script da própria página**, via
`.wbe-fechamento .btn-cta`, que passa a receber `data-checkout` no carregamento.
Depois disso o seletor único de toda a página é `[data-checkout]` �?" 8 de 8.

Alternativas avaliadas e por que foram descartadas:

| Alternativa | Veredito |
|---|---|
| **Adicionar uma prop (ex.: `ctaAttrs`/`dataCheckout`) ao `FinalCta.astro`** | **Não.** �? componente compartilhado �?" `grep FinalCta src/` mostra uso em `src/pages/index.astro`, `se-v1.astro`, `trafego-atacado.astro` e `vsl.astro`, além desta página. Mudar um arquivo compartilhado para atender uma página é exatamente o que a regra "nunca mexa em arquivo que não foi listado / isolamento por comportamento" evita, e obrigaria a reconferir as outras páginas. |
| **A issue 188 usar um seletor duplo `[data-checkout], .wbe-fechamento .btn-cta`** | **Não.** Espalha o conhecimento de "o que é botão de compra" por dois arquivos (a página e o script da 188). Qualquer CTA novo passa a exigir edição em dois lugares, e um esquecimento falha em silêncio �?" sem erro, só sem rastreamento. |
| **Trocar o `FinalCta` por markup local no bloco de fechamento** | **Não.** Reabre uma decisão fechada na 185 (reaproveitar o componente) e duplica markup só para ganhar um atributo. |
| **Marcar em tempo de execução (escolhida)** | **Sim.** Uma linha na página, arquivo compartilhado intocado, e o resultado é um DOM normalizado: a partir daí "botão de compra desta página" = `[data-checkout]`, ponto. Se um dia o fechamento virar markup local com o atributo direto no HTML, o script vira no-op e nada quebra. |

**Contrato com a issue 188 (registrar lá):** o handler de clique da 188 usa
**delegação** �?" `document.addEventListener('click', e => { const a =
e.target.closest('[data-checkout]'); ... })`. Delegação avalia o seletor no
momento do clique, o que elimina qualquer dependência de ordem entre o script de
marcação desta issue e o script da 188 (ambos são módulos do Astro, `defer`).

**O CSS continua com os dois seletores.** A regra de "vendas encerradas" (186)
não pode depender de JS: com JS desligado o `data-checkout` do fechamento nunca
é aplicado, e sem `:global(.wbe-fechamento .btn-cta)` o botão continuaria à
mostra numa página de vendas encerradas. Os dois seletores no CSS são
intencionais e ficam.

## Como `CHECKOUT_PARAM` chega ao navegador

Detalhe do Astro que decide o desenho: **um `<script>` do Astro é bundlado à
parte e não enxerga variáveis do frontmatter**. Para a 188 ler o parâmetro sem
duplicar o literal, o valor é publicado no DOM, no wrapper que já existe:

```astro
<div class="wbe" data-vendas="abertas" data-checkout-param={CHECKOUT_PARAM}>
```

e a 188 lê `document.querySelector('.wbe').dataset.checkoutParam`.

A **URL base não precisa ser publicada**: cada botão já carrega o destino no
próprio `href`, e a 188 monta o destino final a partir do `href` do botão
clicado. Isso mantém um único ponto de configuração (o frontmatter) sem nenhum
literal repetido no cliente.

Descartado `<script define:vars={{...}}>`: transforma o script em `is:inline`
(sem bundle, sem TypeScript) e não é o padrão usado no resto do projeto.

## Cenários

### Happy Path

A visitante abre a página, rola até qualquer bloco e clica em um botão de
compra �?" barra fixa, hero, CTA 6, CTA 10, caixa de oferta, urgência, CTA 17 ou
o botão do fechamento. Todos os oito levam ao mesmo destino, lido de
`CHECKOUT_URL`. Os do corpo têm o mesmo texto-base ("Garantir minha vaga") e a
mesma cor (`.btn-cta`). No dia em que a URL real do checkout existir, a usuária
troca **uma linha** do frontmatter e, se a plataforma não for Eduzz, uma segunda
linha (`CHECKOUT_PARAM`) �?" nenhum bloco da página é tocado, e todos os oito
botões passam a apontar para o checkout na mesma publicação.

### Edge Cases

- **Vendas encerradas (issue 186):** com o wrapper em
  `data-vendas="encerradas"`, os oito botões ficam `display: none` pelas duas
  regras já existentes. Consequências a preservar: (a) elemento com
  `display: none` não é clicável nem focável por teclado, então não existe
  clique órfão nem `InitiateCheckout` fantasma; (b) a 186 **não** deve remover o
  atributo `data-checkout` nem o `href` �?" o estado é só visual, e o gancho
  continua íntegro caso as vendas reabram; (c) o script de marcação desta issue
  roda igual no estado encerrado (é inofensivo) e não deve tentar adivinhar
  estado de venda.
- **Abrir o link em nova aba** (clique do meio, Ctrl/Cmd+clique, "abrir em nova
  aba", toque longo no celular): o navegador usa o `href` **cru**, sem passar
  pelo handler de clique da 188. Portanto o `href` precisa ser sempre um destino
  válido e funcional sozinho �?" **nunca** `#`, `javascript:` ou vazio. A compra
  acontece normalmente; perde-se apenas o identificador de rastreamento daquele
  clique. Perda aceita nesta issue (tratar `auxclick`/`contextmenu` é decisão da
  188, não desta). Consequência direta: **nenhum botão leva `target="_blank"`** �?"
  além de a spec não pedir, abrir em nova aba por padrão atrapalharia o beacon +
  redirecionamento da 188.
- **`CHECKOUT_URL` já com query string:** não é hipótese �?" é o estado de **hoje**
  (`https://wa.me/?text=...`). A 188 tem de escolher o separador:
  `const sep = url.includes('?') ? '&' : '?'`, exatamente como o starter de
  `docs/page-types/sales-page.md`. Fica registrado como restrição para quem
  trocar a constante: **`CHECKOUT_URL` não pode terminar em `?` ou `&`** (geraria
  `?&trk=` / `&&trk=`) e **não pode conter fragmento `#`** (a concatenação
  colocaria o parâmetro depois do hash, e o checkout não o receberia). Se algum
  dia a URL do checkout precisar de fragmento, a 188 troca a concatenação por
  `new URL()` + `searchParams.set()` �?" anotado lá, não implementado aqui.
- **Placeholder de WhatsApp recebendo o parâmetro:** enquanto `CHECKOUT_URL`
  apontar para `wa.me`, o `&trk=<uuid>` que a 188 vai anexar é simplesmente
  ignorado pelo WhatsApp. Não quebra nada e não exige tratamento especial.
- **CTA novo acrescentado depois:** se alguém adicionar um botão de compra sem
  `data-checkout`, ele funciona (leva ao destino) mas fica fora do rastreamento �?"
  falha silenciosa. Mitigação desta issue: o comentário do ponto único diz
  explicitamente "todo botão de compra leva `href={CHECKOUT_URL}` **e**
  `data-checkout`", e o checklist exige conferir a contagem 8 no HTML gerado.
- **`FinalCta.astro` mudar no futuro** (outra issue tirar a classe `.btn-cta` ou
  o wrapper): o seletor `.wbe-fechamento .btn-cta` deixa de casar e o 8º botão
  sai do rastreamento sem erro visível. Mitigação: a conferência da contagem 8
  entra no checklist e o comentário no bloco de fechamento explica a dependência.
- **JS desligado:** os oito botões continuam navegando (são `<a href>` reais) e
  o CSS de vendas encerradas continua escondendo os oito. Só o rastreamento da
  188 deixa de existir �?" degradação aceitável para uma página estática.

### Cenário de Erro

Página estática, sem rede e sem estado nesta issue �?" não há erro em tempo de
execução. Os modos de falha são de configuração e de build:

- **`CHECKOUT_URL` vazia ou malformada:** os oito botões viram `href=""` e
  recarregam a própria página; o visitante nunca chega ao checkout. A constante
  nunca pode ficar vazia �?" enquanto a URL real não existir, o link de WhatsApp
  com mensagem pronta é o valor válido.
- **`CHECKOUT_PARAM` vazio:** a 188 montaria `...&=uuid`, que a plataforma
  descarta e derruba a atribuição da venda. O default `'trk'` nunca pode ser
  apagado; trocar de plataforma significa **substituir** o valor pelo da tabela
  de `docs/page-types/sales-page.md`, nunca esvaziar.
- **Trocar `CHECKOUT_URL` e esquecer `CHECKOUT_PARAM`:** o pior caso, porque não
  quebra nada visivelmente �?" a compra acontece e a venda simplesmente não é
  atribuída. Por isso as duas constantes ficam **coladas**, no mesmo bloco de
  comentário, com a tabela de plataformas citada ali.
- **`.wbe-fechamento` não encontrado pelo script** (bloco removido ou renomeado):
  `querySelectorAll` devolve lista vazia e o script é no-op �?" sem exceção no
  console, sem quebra da página. O custo é silencioso e está coberto pela
  conferência da contagem 8.

## Arquivos

**Criar:** nenhum.

**Modificar:** `src/pages/workshop-black-exponencial-2026.astro` �?" único arquivo
tocado.

1. **Frontmatter (bloco das linhas 9�?"16):** manter `CHECKOUT_URL` no placeholder
   e reescrever o comentário como o "ponto único de configuração", declarando
   logo abaixo `CHECKOUT_PARAM = 'trk'` com comentário citando a tabela de
   plataformas de `docs/page-types/sales-page.md` (Eduzz `trk` · Hotmart `xcod` ·
   Kiwify `sck`) e as restrições da URL (sem `?`/`&` no fim, sem fragmento `#`).
2. **Wrapper `.wbe` (linha 152):** acrescentar `data-checkout-param={CHECKOUT_PARAM}`
   ao lado do `data-vendas` já existente.
3. **Comentário do bloco de fechamento (linhas 540�?"542):** atualizar para
   registrar que o botão do `FinalCta` é marcado em tempo de execução e que o
   seletor único da página é `[data-checkout]`.
4. **Novo `<script>` no fim da página** (depois do `</BaseLayout>`, antes do
   `<style>`), com uma instrução: marcar `.wbe-fechamento .btn-cta` com
   `data-checkout`.
5. **CSS:** **nada muda.** As duas regras de "vendas encerradas" já existentes
   ficam como estão (a de classe é a rede de proteção para JS desligado).

**Explicitamente N�fO modificados:**

- `src/components/sections/FinalCta.astro` �?" arquivo compartilhado; justificativa
  na seção de decisão.
- `src/styles/global.css` �?" `.btn-cta` já entrega texto e cor únicos.
- `functions/` e `docs/page-types/sales-page.md` �?" nada de rastreamento aqui.
- `issues/188-rastreamento-pagina-de-vendas.md` �?" o contrato de delegação e o
  separador `?`/`&` ficam registrados **neste** arquivo; quem edita a 188 é o
  `/plan` dela.

## Dependências Externas

- **URL real do checkout** �?" pendência 1 da spec, depende da usuária. Não
  bloqueia esta issue (o placeholder é valor válido), mas é a única coisa que
  falta para o ponto único virar destino de verdade.
- **Plataforma de checkout escolhida** �?" mesma pendência 1. Define o valor de
  `CHECKOUT_PARAM`. Enquanto não vier, fica `'trk'` (Eduzz), que é o default
  documentado em `docs/page-types/sales-page.md`.
- **Número de WhatsApp da marca** �?" continua ausente do repositório (só existe
  nas env vars de backend `LEAD_REDIRECT_WHATSAPP*`, inacessíveis a página
  estática). O placeholder segue sem número, abrindo o seletor de contato.
- **Nenhuma biblioteca, endpoint, env var, migration ou serviço novo.**

## Checklist

**Ponto único de configuração**

- [x] `CHECKOUT_URL` permanece no placeholder de WhatsApp, com comentário
      explícito de "TROCAR PELA URL DO CHECKOUT"
- [x] Declarar `CHECKOUT_PARAM = 'trk'` imediatamente abaixo, no mesmo bloco de
      comentário, citando Eduzz `trk` · Hotmart `xcod` · Kiwify `sck` e a fonte
      `docs/page-types/sales-page.md`
- [x] O comentário registra as restrições da URL: nunca vazia, sem `?`/`&` no
      final e sem fragmento `#`
- [x] O comentário afirma a regra para CTAs futuros: todo botão de compra leva
      `href={CHECKOUT_URL}` **e** `data-checkout`
- [x] Nenhuma URL de checkout real ou domínio de plataforma inventado aparece no
      arquivo

**Botões**

- [x] Os 7 botões existentes continuam com `href={CHECKOUT_URL}` e
      `data-checkout` �?" nenhum destino literal duplicado na página
- [x] O botão do `FinalCta` recebe `data-checkout` em tempo de execução via
      `.wbe-fechamento .btn-cta`
- [x] `src/components/sections/FinalCta.astro` **não** aparece no `git status`
- [x] Os quatro CTAs do corpo mantêm o mesmo texto-base e a mesma classe
      `.btn-cta` (mesma cor)
- [x] Nenhum botão ganha `target="_blank"`, `rel="noopener"` novo, `#`,
      `javascript:` ou `href` vazio

**Publicação da configuração para o cliente**

- [x] `data-checkout-param={CHECKOUT_PARAM}` no wrapper `.wbe`, ao lado de
      `data-vendas`
- [x] Nenhum `define:vars` e nenhum literal de URL/parâmetro dentro do `<script>`

**Comentários de fronteira**

- [x] Comentário do bloco de fechamento atualizado: botão marcado em tempo de
      execução, seletor único `[data-checkout]`
- [x] Comentário registrando o contrato com a 188: handler por **delegação** em
      `document`, com `closest('[data-checkout]')`, e separador
      `url.includes('?') ? '&' : '?'`
- [x] Nenhuma lógica de `trk`, `/checkout-session` ou `InitiateCheckout` nesta
      issue

**CSS / estado de vendas encerradas**

- [x] As duas regras (`:global([data-checkout])` e
      `:global(.wbe-fechamento .btn-cta)`) permanecem intactas
- [x] Comentário explicando por que a regra de classe é mantida (JS desligado)

**Verificação**

- [x] `npm run build` passa
- [x] Em `dist/workshop-black-exponencial-2026/index.html`, contar **7**
      ocorrências de `data-checkout` no HTML estático (o 8º é aplicado em runtime)
- [x] No HTML gerado, os 8 `href` de compra são idênticos entre si e iguais a
      `CHECKOUT_URL`
- [ ] Com a página aberta no navegador,
      `document.querySelectorAll('[data-checkout]').length === 8` — **falta a
      conferência no navegador de verdade** (ver nota abaixo)
- [ ] `document.querySelector('.wbe').dataset.checkoutParam === 'trk'` — idem
- [ ] Forçando `data-vendas="encerradas"` no wrapper pelo DevTools, os 8 botões
      somem e o aviso de encerramento aparece — idem
- [x] `git status` mostra apenas
      `src/pages/workshop-black-exponencial-2026.astro` e este arquivo de issue

> **Nota sobre os 3 itens de navegador acima.** Não foi possível abrir a página
> num navegador nesta execução (extensão do Chrome não conectada), então eles
> ficam por conferir manualmente. O equivalente foi verificado sobre os
> artefatos do build, com resultado consistente:
>
> - 7 `<a data-checkout>` no HTML estático e **exatamente 1** `.btn-cta` dentro
>   de `.wbe-fechamento` (o do `FinalCta`, sem `data-checkout`) → 7 + 1 = 8;
> - o script inline do bundle contém
>   `document.querySelectorAll(".wbe-fechamento .btn-cta").forEach(e=>{e.dataset.checkout=""})`;
> - o HTML gerado traz `data-checkout-param="trk"` no wrapper `.wbe`;
> - o CSS gerado mantém a regra única com os dois seletores:
>   `.wbe[...][data-vendas=encerradas] [data-checkout], .wbe[...][data-vendas=encerradas] .wbe-fechamento .btn-cta{display:none}`;
> - os 8 `href` de compra do HTML são a mesma string, igual a `CHECKOUT_URL`.
