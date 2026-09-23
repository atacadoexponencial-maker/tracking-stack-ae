# 304: A folha de impressão

**Tipo:** Implementação
**Página:** `/planner-workshop-black`

## Descrição

Desenhar a folha: um bloco por página, sem menu, sem botão e sem cor de fundo.
É o artefato que vai para a parede da expedição, e é também a base do PDF da
issue seguinte — as duas saídas produzem a mesma folha.

**A barra aqui é alta.** Esta folha vai ficar pendurada até dezembro, à vista
de quem preencheu e de quem trabalha com ela. Não é "a tela sem os botões": é
peça de design própria. Tirar o fundo escuro e esconder os controles é o piso,
não o teto. Uma folha legível mas com cara de formulário web impresso não passa
nesta issue.

## O que "ótima" quer dizer aqui

- **Capa com a marca.** A primeira folha nomeia a marca de quem preencheu, o
  nome da campanha e a data. Quem vê a folha na parede sabe de quem ela é antes
  de ler qualquer campo.
- **A resposta manda, o rótulo serve.** O que a pessoa escreveu vem em corpo
  maior e mais escuro; o rótulo vem menor e mais claro, como legenda. Hoje, na
  tela, é o contrário — e na folha isso ficaria errado.
- **Hierarquia de três níveis**, visível de longe: bloco, seção, resposta.
- **Os números em destaque.** O total da base e as três faixas do desconto são
  o que a pessoa vai conferir na virada do ano. Merecem peso tipográfico, não
  sair no meio do texto corrido.
- **Respiro.** Margem de folha generosa, e nada encostando na borda.
- **Sem sobra de interface.** Nenhuma borda de campo, nenhuma caixa vazia,
  nenhum texto de apoio que só servia para orientar durante a aula.

## Escopo

- **Os quatro blocos saem sempre**, esteja a pessoa na aba que estiver. A
  navegação por abas esconde blocos da TELA; a folha ignora isso e imprime tudo.
  Um bloco escondido com campos preenchidos que saísse em branco seria o pior
  defeito possível desta issue.
- Um bloco por folha, nesta ordem: capa com marca, campanha e data, depois os
  blocos 1 a 4.
- Sai sempre em tema claro, qualquer que seja o tema da tela.
- Somem da folha: botões, botão de tema, indicador de salvamento, avisos de
  interface e os textos de apoio que só servem para orientar o preenchimento
  durante a aula.
- O que a pessoa escreveu aparece como texto, não como caixa de formulário vazia
  com borda.
- Campo vazio sai vazio, sem placeholder e sem texto cinza de exemplo.
- Canal desmarcado não aparece na tabela de canais.
- Black VIP respondida com "não" não aparece.
- As contas derivadas saem com o número calculado: o painel da base e as três
  faixas do desconto.
- Nenhum bloco corta no meio de uma linha entre duas páginas.

## Pronto quando

Abrir a prévia de impressão mostra cinco folhas — capa e quatro blocos — sem
nenhum botão, sem fundo escuro e sem campo vazio poluído de placeholder. Os
canais desmarcados e a Black VIP recusada não aparecem. O painel da base mostra
o total calculado. Imprimir a partir do tema escuro dá o mesmo resultado que a
partir do claro. Imprimir estando na aba do bloco 1 sai igual a imprimir estando
na do bloco 4.

E o teste que decide: **imprimir, olhar a folha e ter vontade de pendurar.** Se
ela parece um formulário que foi impresso, a issue não terminou. A conferência
é visual e é sua, não minha — eu mostro a prévia e você diz se está de pé.

---

## Plano (21/09)

### A decisão que resolve o problema

Na tela, o valor vive dentro de um `<input>`. Imprimir um input entrega uma
caixa com borda e o texto miúdo dentro — é exatamente isso que faz a folha
parecer formulário fotocopiado, e nenhuma quantidade de ajuste de cor conserta.

A folha precisa do inverso da tela: a **resposta** em corpo grande e escuro, o
**rótulo** em corpo pequeno e claro, como legenda.

Para isso, um script escreve cada resposta como texto no documento antes de
imprimir, e o CSS de impressão troca quem aparece: some o controle, entra a
resposta. O script varre os controles pelo `name` e insere o elemento de
resposta sozinho — assim os sete componentes de bloco não precisam ganhar
marcação duplicada, e um campo novo no futuro entra na folha sem ninguém
lembrar de fazer nada.

Casos que o script trata um a um, porque cada um imprime diferente:

- **Texto, número, dinheiro e percentual:** o valor, formatado.
- **Data:** por extenso em português, não `2026-11-27`.
- **Escolha única (narrativa, Black VIP):** o texto da opção marcada.
- **Marcação múltipla (itens de oferta):** as marcadas, em lista. Nenhuma
  marcada, nada sai.
- **Canais:** linha de canal desmarcado não aparece.
- **Campo vazio:** não vira linha em branco com borda — sai um traço discreto
  ou nada, conforme o caso.

### Arquivos

- **Criar:** `src/components/planner/PlannerCapa.astro` — a capa, invisível na
  tela e primeira folha na impressão: marca, nome da campanha e data.
- **Criar:** `src/scripts/planner-impressao.ts` — monta as respostas antes de
  imprimir, esconde o que não vai para o papel e liga o botão de imprimir.
- **Modificar:** `src/styles/planner.css` — o `@media print` de verdade: tema
  claro forçado, um bloco por folha, hierarquia, respostas em destaque, sem
  borda de campo.
- **Modificar:** `src/pages/planner-workshop-black.astro` — monta a capa e
  carrega o script.
- **Modificar:** `src/data/planner-black.js` — os meses por extenso, para a
  data impressa.
- **Modificar:** `tests/planner-black-dados.test.js` — travar os doze meses.
- **Criar:** `tests/planner-impressao.test.js` — testes das funções puras de
  formatação (data por extenso, dinheiro, resposta vazia).
