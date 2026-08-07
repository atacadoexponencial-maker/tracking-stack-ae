# 190: FAQ em sanfona com as seis perguntas do workshop

**Tipo:** Implementação
**Página:** /workshop-black-exponencial-2026

## Descrição

Exibir o FAQ em sanfona reaproveitando o componente existente `src/components/sections/Faq.astro`, com as seis perguntas da spec (preciso já vender no atacado; e se eu não puder assistir ao vivo; serve para o meu nicho; já estou atrasada; quanto tempo dura; e se eu não gostar), todas fechadas quando a página carrega, abrindo e fechando ao serem acionadas e podendo ficar mais de uma aberta ao mesmo tempo. A resposta sobre não assistir ao vivo informa que a gravação vitalícia é adicional no checkout, por R$ 27 — e em nenhum outro lugar da página a gravação é prometida como incluída no ingresso.

---

## Situação atual (verificada em 06/08, após a issue 185)

A issue **já está atendida** pela implementação da 185. Nada precisa ser
escrito. O que segue é o resultado da conferência, item por item:

- **Reaproveitamento do componente:** `src/pages/workshop-black-exponencial-2026.astro`
  importa `Faq` de `../components/sections/Faq.astro` (linha 3) e o usa nas
  linhas 534–537, passando `sub` e o array `faqs`. O componente não foi
  duplicado nem alterado — é o mesmo arquivo compartilhado com as outras
  páginas, que continuam usando o `faqs` padrão do `Astro.props`.
- **As seis perguntas da spec:** o array `faqs` (linhas 110–135) traz, nesta
  ordem, exatamente as seis da spec — "Preciso já vender no atacado?", "E se eu
  não puder assistir ao vivo?", "Serve para o meu nicho?", "Já estou
  atrasada?", "Quanto tempo dura?" e "E se eu não gostar?".
- **Sanfona sem JavaScript:** `Faq.astro` renderiza cada pergunta como
  `<details class="faq__item">` com `<summary class="faq__q">` (linhas 26–31).
  É o elemento nativo do HTML — não há `<script>` no componente nem na página
  para o FAQ.
- **Todas fechadas ao carregar:** nenhum `<details>` recebe o atributo `open`,
  e o padrão do elemento é fechado. Confirmado: a string `open` só aparece no
  CSS, no seletor `.faq__item[open] .faq__q::after`, que troca o "+" por "−".
- **Abrir e fechar ao acionar:** comportamento nativo do `<details>`/`<summary>`,
  que alterna com clique, toque, `Enter` e `Espaço`, e é focável por teclado sem
  nenhum atributo ARIA extra.
- **Mais de uma aberta ao mesmo tempo:** os `<details>` **não** compartilham
  atributo `name` (o agrupamento exclusivo do HTML depende dele) e não há JS
  fechando irmãos. Portanto abrir uma pergunta nunca fecha outra.
- **Gravação vitalícia só no FAQ:** a busca por `grava`, `vitalíci` e `R$ 27`
  em toda a página retorna **uma única ocorrência** — a linha 117, que é a
  resposta de "E se eu não puder assistir ao vivo?": *"A gravação vitalícia
  está disponível como adicional no checkout, por R$ 27."* A lista
  `ofertaItens` (linhas 95–102, os 6 itens da caixa de oferta) **não** menciona
  gravação, e nem o hero, nem os entregáveis, nem o bloco de garantia. A regra
  da spec — nunca prometer a gravação como incluída no ingresso — está
  cumprida.

## Cenários

**Happy Path**
- Visitante rola até o fim da página e encontra o bloco "FAQ / Perguntas
  frequentes" com as seis perguntas, todas fechadas, cada uma com um "+" à
  direita.
- Ao tocar em uma pergunta, a resposta abre e o "+" vira "−". Tocar de novo
  fecha.
- Ao abrir a segunda pergunta sem fechar a primeira, as duas ficam abertas ao
  mesmo tempo.
- Quem procura pela gravação encontra em "E se eu não puder assistir ao vivo?"
  a informação de que ela é adicional no checkout, por R$ 27 — e não a encontra
  como item incluído em nenhum outro ponto da página.

**Edge Cases**
- **JavaScript desligado no navegador:** a sanfona continua funcionando por
  completo, porque é `<details>` nativo. Nenhum comportamento se perde.
- **Navegação só por teclado:** `Tab` chega em cada `<summary>` (focável por
  padrão) e `Enter`/`Espaço` abrem e fecham. O `list-style: none` do CSS remove
  só o marcador visual, sem afetar foco nem semântica.
- **Leitor de tela:** o `<details>` expõe estado expandido/recolhido
  nativamente, sem precisar de `aria-expanded` manual.
- **Busca do navegador (Ctrl+F) com respostas fechadas:** navegadores modernos
  abrem o `<details>` automaticamente ao encontrar o termo dentro dele; em
  navegadores antigos o texto fechado pode não ser encontrado. É limitação
  conhecida do elemento nativo e o mesmo comportamento já vigora nas demais
  páginas do site.
- **`prefers-reduced-motion`:** não há animação de abertura (o CSS do
  `Faq.astro` não anima altura), então nada a ajustar.
- **Alteração futura no `Faq.astro`:** o arquivo é compartilhado com outras
  páginas. Qualquer mudança nele afeta todas — o correto continua sendo passar
  conteúdo por props, como esta página faz.

**Cenário de Erro**
- **`faqs` chegar vazio ou não ser passado:** o componente cai no valor padrão
  do `Astro.props` (as 5 perguntas do diagnóstico), o que exibiria conteúdo
  errado nesta página. Não acontece hoje, porque o array é literal e estático
  no frontmatter, mas é o único jeito de este bloco "quebrar" — e quebraria na
  build/visual, nunca em runtime.
- **Texto sobre gravação vazar para outro bloco** (ex.: alguém acrescentar
  "gravação" em `ofertaItens` numa issue futura): viraria promessa de gravação
  incluída no ingresso, contrariando a spec. Por isso o checklist inclui a
  busca por `grava` na página inteira como item recorrente.
- Não há chamada de rede, formulário ou estado no FAQ — não existe cenário de
  erro de servidor.

## Arquivos

**Criar:** Nenhum.

**Modificar:** Nenhum.

Motivo: a issue 185 já entregou o FAQ completo — componente compartilhado
reaproveitado, as seis perguntas da spec com os textos finais, sanfona nativa
por `<details>` (fechadas ao carregar, várias abertas ao mesmo tempo, sem JS) e
a menção à gravação de R$ 27 restrita ao FAQ. Não há nada a alterar, nem na
página nem em `src/components/sections/Faq.astro`. Esta issue vira uma
**verificação**.

Arquivos apenas consultados na verificação (nenhum é alterado):
- `src/pages/workshop-black-exponencial-2026.astro` — linha 3 (import), linhas
  110–135 (array `faqs`), linhas 534–537 (uso do componente) e linhas 95–102
  (`ofertaItens`, onde a gravação **não** pode aparecer).
- `src/components/sections/Faq.astro` — linhas 26–31 (`<details>`/`<summary>`)
  e 41–60 (CSS, incluindo o seletor `[open]`).

## Checklist

Checklist de **verificação**, não de implementação. Nenhum item pede escrita de
código.

- [ ] Confirmar que a página importa `Faq.astro` do caminho compartilhado e que
      o componente não foi duplicado nem editado (`git log` limpo para ele nas
      issues 185–190).
- [ ] Conferir que o array `faqs` traz as seis perguntas da spec, nesta ordem:
      preciso já vender no atacado; e se eu não puder assistir ao vivo; serve
      para o meu nicho; já estou atrasada; quanto tempo dura; e se eu não
      gostar.
- [ ] Confirmar em `Faq.astro` que cada pergunta é um `<details>` com
      `<summary>`, sem `<script>` associado.
- [ ] Rodar `npm run build` e conferir, em
      `dist/workshop-black-exponencial-2026/index.html`, que existem 6
      `<details class="faq__item">` e que **nenhum** deles tem o atributo
      `open`.
- [ ] Conferir nesse mesmo HTML que nenhum `<details>` do FAQ tem atributo
      `name` (o que os tornaria mutuamente exclusivos).
- [ ] No navegador: abrir duas perguntas seguidas e confirmar que as duas
      permanecem abertas; fechar uma e confirmar que a outra continua aberta.
- [ ] No navegador: navegar por `Tab` até um `<summary>` e abrir com `Enter` e
      com `Espaço`.
- [ ] Buscar `grava`, `vitalíci` e `R$ 27` no arquivo `.astro` **e** no HTML
      gerado, e confirmar que só aparecem dentro da resposta de "E se eu não
      puder assistir ao vivo?".
- [ ] Confirmar que os 6 itens de `ofertaItens` (caixa de oferta) seguem sem
      qualquer menção a gravação.
- [ ] Conferir visualmente em 360px, 768px e 1280px que o FAQ empilha
      corretamente e vira duas colunas (intro + lista) a partir de 880px.
- [ ] Confirmar que `git status` continua limpo ao fim da verificação (nenhum
      arquivo tocado).
