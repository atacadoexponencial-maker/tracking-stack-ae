# 298: Protótipo da página do planner

**Tipo:** Protótipo
**Página:** `/planner-workshop-black`

## Descrição

Criar a rota `/planner-workshop-black` com os quatro blocos inteiros na tela —
toda a copy, todos os campos, todos os textos de apoio e a microcopy — no visual
escuro do `DESIGN.md`, sem nenhum comportamento ligado. É o esqueleto que as
issues seguintes vêm dar vida.

Inclui tirar a rota da lista de páginas que o `functions/_middleware.js`
intercepta: o planner não cria sessão, não recebe pixel e não gera evento de
tracking.

## Escopo

- Cabeçalho: título, linha de apoio, campo Nome da sua marca, campo Data de hoje,
  aviso de onde o preenchimento mora, lugar reservado para o indicador de
  salvamento e para o botão de tema.
- Bloco 1 de 4: os três números de hoje, as quatro metas e o painel da base
  (estático por enquanto).
- Bloco 2 de 4: margem, Pico 1 completo (data, três narrativas, narrativa
  própria, mínimo de hoje, mínimo reduzido, prazo, tabela de três faixas, quatro
  itens de oferta, campo de condição) e Pico 2 completo (data, três narrativas,
  narrativa própria, quatro itens, campo de condição, Black VIP sim/não, dia e
  local).
- Bloco 3 de 4: as duas trilhas de cinco semanas cada com as datas e as funções
  já escritas, o diferencial da Black Week, o que fazer em 27/11 e as três fases.
- Bloco 4 de 4: tabela dos oito canais, o recado abaixo dela, nome da campanha e
  prazo da arte.
- Rodapé: frase de fecho, botão de baixar PDF, botão de imprimir e o aviso
  permanente.
- Todas as datas de 2026 já preenchidas nos campos, conforme a tabela da spec.
- Responsivo: no celular as duas trilhas do bloco 3 e a tabela de canais do
  bloco 4 viram lista vertical, sem rolagem lateral.

## Pronto quando

Dá para abrir `/planner-workshop-black` no navegador e ler o planner inteiro, do
cabeçalho ao rodapé, no computador e no celular, com todos os campos visíveis e
as datas de 2026 já postas. Nada calcula, nada salva e nada valida ainda — mas
não falta um texto sequer em relação à spec, e a página não aparece no tracking.

---

## Pesquisa na base de código

**O que dá para reusar:**

- `src/styles/global.css` — tokens de cor em HSL, Satoshi self-hosted via
  `@font-face` e o reset. Importar direto no layout do planner.
- `src/data/materiais.js` e `src/data/lotes-workshop.js` — o padrão do projeto
  para conteúdo declarativo. O planner segue: toda a copy num módulo de dados,
  e a página vira renderizadora.
- `src/pages/calculadora-atacado/index.astro` — referência de página de
  ferramenta que não usa `Header`/`Footer` (`showHeader={false}`) e guarda estado
  no navegador.
- `src/assets/brand/logo.png` — a logo, via `astro:assets`.
- `tests/argo-auth.test.js` e `tests/ab-estatistica.test.js` — o padrão de teste
  com `node --test` sobre módulo puro.

**O que NÃO dá para reusar, e por quê:**

- `src/layouts/BaseLayout.astro` **não serve**. Ele embute GA4, Meta Pixel,
  Microsoft Clarity, o `PageView` disparado para `/tracker` e o `AvisoCookies`.
  A spec manda o planner não rastrear nada. Usar o `BaseLayout` com
  `showHeader={false}` resolveria a moldura, mas não o tracking — os scripts
  estão no `<head>`, fora dos condicionais. Daí o layout próprio.
- `src/components/Header.astro` e `Footer.astro` — a spec pede o planner sem a
  moldura do site.

**Restrição de arquitetura descoberta:**

- `astro.config.mjs` está em `output: 'static'`, sem adapter. A página vira um
  arquivo em `dist/planner-workshop-black/index.html`. Quem protege esse arquivo
  é a Pages Function da issue 299, que tem prioridade sobre o asset estático.
  Esta issue **não** cria essa function — só não atrapalha a chegada dela.

## Cenários

### Happy Path

1. A participante abre `/planner-workshop-black`.
2. A página carrega no tema escuro, com a fonte Satoshi já disponível.
3. Ela vê o cabeçalho com o título, a linha de apoio, o campo do nome da marca,
   a data de hoje e o aviso de onde o preenchimento mora.
4. Rolando, encontra os quatro blocos na ordem da aula, cada um anunciado como
   "Bloco X de 4", com todos os campos e todos os textos de apoio.
5. Os campos de data já vêm com as datas de 2026 postas.
6. No fim, encontra a frase de fecho e os dois botões de saída.
7. Nada calcula, nada guarda, nada avisa — e nenhum evento de tracking sai.

### Edge Cases

- **Celular em pé.** As duas trilhas de cinco semanas do bloco 3 e a tabela de
  oito canais do bloco 4 não cabem como tabela. Viram lista vertical, cada item
  carregando a semana (ou o canal) junto do campo, sem rolagem lateral.
- **Tela muito estreita (≤360px).** Os rótulos e os textos de apoio continuam
  legíveis; nada é cortado nem exige zoom.
- **Fonte Satoshi ainda não carregada.** A página renderiza na fonte de sistema
  e troca sem quebrar o layout (`font-display: swap`, já no `global.css`).
- **JavaScript desligado.** O protótipo é HTML e CSS — continua legível e
  preenchível na tela. As issues seguintes é que dependem de JavaScript.
- **Impressão acionada nesta issue.** Ainda sai feia, com botões e fundo. É a
  issue 304 que resolve, e isso não é defeito desta.

### Cenário de Erro

- **A página não existe / dá 404 no deploy.** Sinal de que o nome do arquivo em
  `src/pages/` não bate com a rota, ou de que uma Function está capturando a
  rota antes. Conferir que o build gerou `dist/planner-workshop-black/index.html`.
- **A página aparece no dashboard como visita.** Sinal de que a exclusão no
  `functions/_middleware.js` não pegou. Conferir que nenhuma sessão nova foi
  criada ao abrir a rota.
- **Falta copy.** Como a copy mora em `src/data/planner-black.js`, campo faltando
  é entrada faltando no dado, não HTML esquecido. O teste desta issue pega as
  contagens (10 semanas, 8 canais, 6 narrativas, 4 blocos).

## Banco de Dados

Não se aplica. O planner não tem banco — decisão registrada na spec.

## Arquivos

- **Criar:** `src/data/planner-black.js` — toda a copy e a estrutura declarativa:
  os quatro blocos, cada campo com sua chave estável, rótulo, tipo e texto de
  apoio; as seis narrativas; as dez semanas com data e função; os oito canais; as
  datas sugeridas de 2026; e a microcopy de interface. É a fonte única — a página
  não tem texto solto no HTML.
- **Criar:** `src/layouts/PlannerLayout.astro` — layout sem tracking, sem
  `Header`, sem `Footer` e sem `AvisoCookies`. Importa `src/styles/global.css` e
  `src/styles/planner.css`, marca `noindex`, e põe no `<html>` o atributo de tema
  que a issue 303 vai alternar.
- **Criar:** `src/styles/planner.css` — tokens do planner, base tipográfica dos
  blocos, e os ganchos de tema claro/escuro e de impressão declarados mas ainda
  sem regra (issues 303 e 304 preenchem).
- **Criar:** `src/pages/planner-workshop-black.astro` — a página, montando o
  cabeçalho, os quatro blocos e o rodapé a partir do dado.
- **Criar:** `src/components/planner/PlannerCabecalho.astro` — título, linha de
  apoio, nome da marca, data de hoje, aviso, indicador de salvamento (inerte) e
  botão de tema (inerte).
- **Criar:** `src/components/planner/CampoPlanner.astro` — o campo genérico
  (rótulo, controle e texto de apoio), usado pelos quatro blocos. Evita repetir
  a mesma marcação cinquenta vezes.
- **Criar:** `src/components/planner/BlocoOndeVoceEsta.astro` — bloco 1.
- **Criar:** `src/components/planner/BlocoOfertas.astro` — bloco 2.
- **Criar:** `src/components/planner/BlocoCalendario.astro` — bloco 3.
- **Criar:** `src/components/planner/BlocoCanais.astro` — bloco 4.
- **Criar:** `src/components/planner/PlannerRodape.astro` — frase de fecho, botão
  de baixar PDF e botão de imprimir (ambos inertes), aviso permanente.
- **Criar:** `tests/planner-black-dados.test.js` — testes sobre
  `src/data/planner-black.js`.
- **Modificar:** `functions/_middleware.js` — acrescentar
  `/planner-workshop-black` à lista de rotas que não viram sessão de tracking,
  junto de `/links`, `/grupo-da-live` e `/grupo-workshop`, com o comentário do
  porquê no mesmo tom das vizinhas.

## Pontos de entrada que esta issue deixa prontos (sem implementar)

Estes ganchos existem no HTML desde já, inertes, para as issues seguintes não
precisarem remexer na marcação:

- **Para a 300 (salvamento):** todo controle tem `name` único e estável, vindo da
  chave do campo em `planner-black.js`. Essa chave é o contrato do autosave, do
  PDF e da impressão — mudar uma chave depois apaga o rascunho de quem já
  preencheu.
- **Para a 301 (contas):** os alvos calculados já existem vazios — o painel da
  base, as três células de "Se comprar" e a área do aviso de margem — cada um com
  seu identificador.
- **Para a 302 (campos que reagem):** os dois grupos de narrativa marcados como
  grupo, e o trecho da Black VIP marcado como região condicional.
- **Para a 303 (tema):** o atributo de tema no `<html>` e o botão no cabeçalho.
- **Para a 304 (impressão):** cada bloco é uma seção própria, com a classe que vai
  receber a quebra de página.
- **Para a 305 (PDF) e a 306 (avisos):** os dois botões do rodapé e a área de
  recado reservada.

## Dependências Externas

Nenhuma. Astro, Satoshi e os tokens do `global.css` já estão no projeto.

## Checklist

- [x] Escrever `src/data/planner-black.js` com a copy inteira da spec, sem
      resumir nem reescrever texto, e com uma chave estável por campo
- [x] Conferir no dado as datas de 2026: 28/09 segunda, 12/10 segunda, 11/11
      quarta, 27/11 sexta, 30/11 segunda, 25/09 sexta
- [x] Criar `src/styles/planner.css` com os tokens e os ganchos de tema e
      impressão
- [x] Criar `src/layouts/PlannerLayout.astro` sem nenhum script de tracking,
      sem Header, sem Footer e sem AvisoCookies
- [x] Criar `src/components/planner/CampoPlanner.astro`
- [x] Criar os quatro componentes de bloco e os dois de moldura
- [x] Criar `src/pages/planner-workshop-black.astro` montando tudo
- [x] Acrescentar a exclusão de `/planner-workshop-black` no
      `functions/_middleware.js`, com comentário explicando o porquê
- [x] Escrever `tests/planner-black-dados.test.js`: contagens (4 blocos, 10
      semanas, 8 canais, 6 narrativas), chaves de campo únicas, e cada data
      sugerida caindo no dia da semana que a spec afirma
- [x] Rodar `npm test` e ver a suíte inteira passar, não só os testes novos
      — 771 de 771, incluindo os 15 novos
- [x] Rodar `npm run build` e confirmar que saiu
      `dist/planner-workshop-black/index.html` — 32 KB, sem tracking nenhum
- [~] Abrir no navegador em largura de computador e de celular e comparar com a
      copy da spec, texto por texto

---

## Revisão de 21/09: a rolagem única caiu

A primeira versão empilhou os quatro blocos numa rolagem só, como a spec
mandava. Aberta no navegador, a usuária reprovou: **longa demais, e sem
definição entre as seções.** A crítica procede e é sobre o momento de uso —
quem preenche está assistindo aula. Quando o Felipe diz "agora bloco 2", caçar
no meio de cinquenta campos é o suficiente para a pessoa desistir do planner.

A spec foi corrigida antes do código (módulo 2, "Um bloco por vez"), e esta
issue cresceu para incluir a navegação.

### O que muda

- **Um bloco por vez.** Só o bloco ativo aparece; os outros ficam escondidos,
  nunca removidos.
- **Barra fixa** abaixo do cabeçalho, com os quatro blocos numerados e
  nomeados, marcando onde a pessoa está.
- **Botão de avançar** no fim de cada bloco, nomeando o próximo. O bloco 4 não
  tem: nele aparece o fecho e as duas saídas.
- **Esconder nunca é apagar.** Trocar de bloco preserva tudo o que foi
  preenchido, e o que está escondido continua indo para a impressão e o PDF.
- **Sem JavaScript, nada se perde:** os quatro blocos aparecem empilhados. Os
  blocos nascem visíveis na marcação e é o script que esconde os inativos ao
  carregar — nunca o contrário.

### Arquivos que a revisão acrescenta

- **Criar:** `src/components/planner/PlannerAbas.astro` — a barra dos quatro
  blocos.
- **Criar:** `src/scripts/planner-navegacao.ts` — trocar de bloco, marcar a
  barra e ligar o botão de avançar. Mora em `src/scripts/` junto de `funil.ts` e
  `lead-validacao.ts`, o padrão do projeto.
- **Modificar:** `src/pages/planner-workshop-black.astro` — monta a barra e
  carrega o script.
- **Modificar:** `src/styles/planner.css` — barra fixa, estado ativo, bloco
  escondido e o botão de avançar.
- **Modificar:** `src/data/planner-black.js` — um rótulo curto por bloco, para
  a barra caber no celular ("Onde", "Ofertas", "Agenda", "Canais").
- **Modificar:** `src/components/planner/PlannerRodape.astro` — o fecho e as
  saídas passam a aparecer junto do bloco 4.
- **Modificar:** `tests/planner-black-dados.test.js` — travar que todo bloco
  tem rótulo curto e que os quatro são distintos.

### Repasses para outras issues

- **304 (impressão) e 305 (PDF):** passam a ter obrigação explícita de imprimir
  os quatro blocos, esteja a pessoa na aba que estiver. Registrado lá.
- **300 (salvamento):** avaliar se a aba em que a pessoa estava também deve
  voltar ao recarregar. Não é rascunho, é conveniência — fica lá, não aqui.
- **306 (avisos):** o aviso de bloco incompleto agora pode levar direto à aba do
  bloco que falta. Registrado lá.

## Conferência visual — o que foi e o que não foi verificado

**Conferido no navegador, em largura de computador:** os quatro blocos, o
cabeçalho, o rodapé, as seis narrativas com o marcador de lacuna, as datas de
2026 já postas nos campos, a tabela de desconto e as duas trilhas de semanas.
Dois defeitos apareceram e foram corrigidos: o `%` da tabela de desconto
quebrava para a linha de baixo, e as caixas de texto das semanas saíam sem
estilo (brancas), porque não passam pelo `CampoPlanner` e as regras do CSS
estavam presas a `.pl-campo`.

**NÃO conferido visualmente:** a largura de celular. O redimensionador do
navegador não teve efeito neste ambiente — a captura voltou sempre em 1358px,
em duas tentativas. As regras existem em `src/styles/planner.css`
(`@media (max-width: 40rem)`: trilhas e tabela de canais viram lista, cabeçalho
em coluna única), mas ninguém as viu funcionando. **Isto precisa ser olhado num
celular de verdade antes do dia 23** — a maior parte da turma vai preencher o
planner no telefone enquanto assiste à aula.
