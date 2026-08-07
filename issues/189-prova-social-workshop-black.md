# 189: Bloco de prova social reaproveitando os depoimentos das lives

**Tipo:** Implementação
**Página:** /workshop-black-exponencial-2026

## Descrição

Exibir o bloco de prova social entre Autoridade e Ancoragem usando o mesmo conjunto de depoimentos já publicado na `/lives-semanais-v2` (prints em `src/assets/proof/`), sem duplicar o material. Se não houver material de depoimento disponível, omitir o bloco inteiro — nunca exibir espaço vazio, placeholder ou aviso de "em breve".

---

## Situação atual (verificada em 06/08, após a issue 185)

A issue **já está atendida** pela implementação da 185. Nada precisa ser
escrito. O que segue é o resultado da conferência, item por item:

- **Reaproveitamento sem duplicar material:** `src/pages/workshop-black-exponencial-2026.astro`
  (linhas 137–142) carrega os prints com
  `import.meta.glob('../assets/proof/*.{jpg,png}', { eager: true })`, ordenados
  por nome de arquivo (`localeCompare`). É exatamente o mesmo trecho de
  `src/pages/lives-semanais-v2.astro` (linhas 14–19) e de
  `src/pages/video-workshop-instagram.astro`. Nenhum arquivo de imagem foi
  copiado: as três páginas leem a mesma pasta `src/assets/proof/`.
- **Conjunto de depoimentos:** a pasta tem **9 arquivos** — `proof-1.jpg`,
  `proof-2.png`, `proof-3.png`, `proof-4.png`, `proof-5.png`, `proof-6.png`,
  `proof-7.png`, `proof-8.png`, `proof-9.jpg`. Como o glob é o mesmo, as 9
  imagens exibidas aqui são as 9 exibidas na `/lives-semanais-v2`, na mesma
  ordem.
- **Posição na página:** o bloco está entre Autoridade (seção 11) e Ancoragem
  (seção 13), conforme a ordem da spec.
- **Omissão quando não há material:** o `<section>` inteiro está dentro de
  `{proofImages.length > 0 && (...)}`. Com a pasta vazia o glob devolve `{}`,
  `proofImages` fica com length 0 e nada é renderizado — sem título, sem grade,
  sem placeholder e sem "em breve". Regra da spec cumprida.
- **Carregamento preguiçoso:** cada `<Image>` da grade usa `loading="lazy"`
  (linha 422). O bloco fica bem abaixo da dobra, então nenhuma das 9 imagens
  entra no carregamento inicial. As imagens passam pelo `astro:assets`, que já
  gera `width`/`height` — não há salto de layout ao carregar.
- **Texto alternativo:** o `alt` é `Depoimento 1`…`Depoimento 9`, idêntico ao
  padrão da `/lives-semanais-v2`. É um alt válido e não vazio: identifica a
  imagem e a numera. **Limitação conhecida:** os prints são texto dentro de
  imagem, então o conteúdo do depoimento em si não chega a quem usa leitor de
  tela. Transcrever os 9 prints seria uma melhoria real de acessibilidade, mas
  (a) exigiria conteúdo que nem a issue nem a spec fornecem, (b) divergiria do
  padrão já publicado nas outras duas páginas e (c) está fora do escopo desta
  issue. Fica registrado como decisão para a usuária, **não** como trabalho a
  executar aqui.

## Cenários

**Happy Path**
- Visitante abre `/workshop-black-exponencial-2026`, rola até depois do bloco do
  Felipe Santos e encontra a seção "Depoimentos / O que dizem quem já aplicou o
  método" com os 9 prints em grade — 2 colunas no celular, 3 a partir de 768px.
- As imagens só começam a baixar quando se aproximam da viewport; o topo da
  página carrega sem esperar por elas.
- Logo abaixo da grade vem a Ancoragem ("Quanto custa uma Black mal
  planejada?"), sem nenhum bloco no meio.

**Edge Cases**
- **Pasta `src/assets/proof/` vazia:** o glob devolve objeto vazio, a condição
  `proofImages.length > 0` é falsa e a seção inteira desaparece do HTML gerado.
  A página segue de Autoridade direto para Ancoragem, sem buraco visual.
- **Print novo adicionado à pasta:** entra automaticamente nas três páginas que
  usam o glob (workshop, lives v2 e video-workshop), na posição definida pela
  ordenação por nome. Nenhuma alteração de código é necessária.
- **Print removido da pasta:** some das três páginas do mesmo jeito; a grade se
  reorganiza sozinha e a numeração dos `alt` é recalculada na build.
- **Número ímpar de prints (é o caso hoje: 9):** no celular, com 2 colunas, a
  última imagem ocupa metade da linha. É o comportamento normal de grid e já
  acontece na `/lives-semanais-v2` publicada.
- **Arquivo com extensão fora de `.jpg`/`.png`** (ex.: `.webp` ou `.jpeg`): é
  ignorado silenciosamente pelo glob. Se um print novo não aparecer, essa é a
  primeira coisa a conferir.

**Cenário de Erro**
- **Imagem corrompida ou ilegível na pasta:** o `astro:assets` falha na build
  (`npm run build` quebra). O erro é de build, nunca chega ao visitante — a
  produção continua servindo o último deploy válido.
- **Falha de rede ao baixar um print no navegador:** o navegador exibe o `alt`
  ("Depoimento N") no lugar da imagem. As demais continuam carregando
  normalmente; nada mais na página quebra, porque não há JavaScript envolvido.

## Arquivos

**Criar:** Nenhum.

**Modificar:** Nenhum.

Motivo: a implementação da issue 185 já cobre integralmente o comportamento
descrito nesta issue — o glob compartilhado (sem duplicar material), a posição
entre Autoridade e Ancoragem, o `loading="lazy"` e a omissão do bloco inteiro
quando não há material. Escrever qualquer código aqui seria reimplementar o que
já existe. Esta issue vira uma **verificação**.

Arquivos apenas consultados na verificação (nenhum é alterado):
- `src/pages/workshop-black-exponencial-2026.astro` — linhas 137–142
  (frontmatter do glob) e 412–427 (bloco de prova social).
- `src/pages/lives-semanais-v2.astro` — linhas 14–19 e 59–72 (fonte do padrão
  reaproveitado).
- `src/assets/proof/` — os 9 arquivos de print.

## Checklist

Checklist de **verificação**, não de implementação. Nenhum item pede escrita de
código.

- [ ] Confirmar que `src/assets/proof/` continua com os 9 arquivos (`proof-1.jpg`
      a `proof-9.jpg`/`.png`) e que nenhum print foi duplicado para dentro de
      outra pasta.
- [ ] Confirmar que o glob de `workshop-black-exponencial-2026.astro` é
      literalmente o mesmo de `lives-semanais-v2.astro`, inclusive a ordenação
      por `localeCompare`.
- [ ] Rodar `npm run build` e conferir, no HTML gerado em
      `dist/workshop-black-exponencial-2026/index.html`, que aparecem 9 `<img>`
      dentro de `.wbe-prova__grid`.
- [ ] Conferir nesse mesmo HTML que **todas** as 9 imagens da grade têm
      `loading="lazy"`.
- [ ] Conferir que o bloco de prova social aparece no HTML **depois** de
      `.wbe-autoridade` e **antes** de `.wbe-ancoragem`.
- [ ] Testar a regra de omissão: renomear temporariamente `src/assets/proof/`
      para `proof-off/`, rodar `npm run build`, confirmar que o HTML gerado não
      contém `wbe-prova` nem a palavra "Depoimentos", e **restaurar o nome da
      pasta** em seguida.
- [ ] Conferir visualmente em 360px, 768px e 1280px que a grade fica com 2 / 3 /
      3 colunas e que os prints continuam legíveis (a conferência visual ficou
      pendente desde a issue 185).
- [ ] Registrar para a usuária a decisão em aberto sobre transcrever os prints
      no `alt` — hoje o texto é genérico ("Depoimento N"), igual ao da
      `/lives-semanais-v2`. **Não** alterar sem aprovação.
- [ ] Confirmar que `git status` continua limpo ao fim da verificação (nenhum
      arquivo tocado).
