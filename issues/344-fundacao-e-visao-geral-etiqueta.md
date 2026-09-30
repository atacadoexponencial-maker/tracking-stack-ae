# 344: Fundação visual + Visão geral na direção "Etiqueta"

**Tipo:** Implementação
**Página:** Dash (`public/dash/index.html`): barra lateral, tela de acesso e aba Visão geral
**Spec:** `spec.md` (Módulos 0 e 1)

## Descrição

Trocar o mundo visual do dash pelo da direção "Etiqueta" (papel claro, tinta, etiqueta pendurada, tabela-grade, carimbo, barra lateral carvão com bege) construindo a fundação de tokens e componentes e aplicando-a na Visão geral, a aba que valida a direção. O protótipo é o mockup A do artifact (https://claude.ai/artifact/D53wRnsubqBz7quVzJDueM, arquivos `a-etiqueta.html` e `shared.js`). Tudo em branch: produção continua escura até a issue 355.

Entra aqui tudo do Módulo 0: paleta, tipografia Satoshi, barra lateral com quatro grupos, topo da aba com fio forte, campos e botões, etiqueta (normal e herói) com furo e ilhós, carimbo, bloco de conteúdo, tabela-grade ordenável, barra de proporção em célula, régua de metas, pílulas e chips, avisos (`explica`, `alerta`, `falha`), selos, modal, tooltip e gráfico de linha, estados (esqueleto ao carregar, vazio, erro, aba que falhou inteira), tela de acesso, responsivo abaixo de 900px, foco visível, "reduzir movimento". A marca "Dados de exemplo" dos mockups não entra.

## Pronto quando

- Na preview do branch, a tela de acesso e a Visão geral aparecem no mundo claro: manchete, três etiquetas-herói com carimbo, régua de metas do mês, quatro etiquetas (Novos visitantes, Investimento Meta com delta neutro, Receita, ROAS), "Leads por dia" em gráfico de linha ao lado de "Leads por funil" com barra de proporção, "Conversão por LP" em tabela-grade.
- Os números da Visão geral são idênticos aos de produção para o mesmo filtro (nenhum dado, cálculo ou chamada mudou).
- Trocar funil ou período recarrega os blocos com esqueleto, nunca com os números do período anterior; "Personalizado…" mostra os dois campos de data.
- Mouse no gráfico mostra cursor tracejado e tooltip do dia; clicar no cabeçalho ordena. "Conversão por LP" segue sem clique na linha (hoje já não tem; a spec supôs que tinha).
- ROAS sem venda mostra "—" com a nota do motivo.
- Tab mostra foco em todo controle; hover sobe a etiqueta e escurece a linha; com "reduzir movimento" nada anima.
- No celular a barra lateral vira faixa horizontal rolável, colunas viram uma, tabelas rolam dentro do bloco e a página não rola de lado.
- As outras 18 abas ainda abrem (podem estar visualmente quebradas na preview; elas entram nas issues seguintes).
- `PRODUCT.md`, o brief `.impeccable/surfaces/public-dash-index-html.md` e `spec.md` entram no mesmo commit.

## Pesquisa (o que já existe e será reaproveitado)

O dash é um arquivo só, `public/dash/index.html` (5.570 linhas): CSS nas linhas 8–698, HTML 700–1287, JS 1288–5568. Nada de framework, nada de build. Fontes Satoshi já em `public/fonts/`. Logo branco em `public/dash/logo-atacado-exponencial.png`.

Reaproveitar sem mudar assinatura (só muda o HTML/CSS que produzem):
- `tile(k, heroi)` (linha 1384): gera o KPI; passa a gerar a etiqueta (33 chamadas no arquivo inteiro, todas as abas ganham etiqueta de graça).
- `deltaChip(pct, invertido, neutro)` (1378): gera o delta; passa a gerar o carimbo (`.carimbo.alta/.queda/.neutro`) mantendo ▲ ▼ e o "•" do zero vira "=".
- `tabela(el, colunas, linhas, aoClicar)` (1439): já ordena por cabeçalho, já tem `th.ordenavel`, `aria-sort`, `tr.clicavel`, teclado. Só o CSS muda (grade de tamanhos) e a seta de ordenação já é escrita no texto do `th`.
- `grafico(el, serie, valorFmt, opcoes)` (1504): SVG com área em degradê, ponta com halo, cursor tracejado, tooltip, `ResizeObserver`. Muda: classes/cores via tokens (`.linha`, `.area`, `.ponta`, `.cursor`, `.tooltip`) e o valor escrito acima do último ponto (novo `<text class="ponta-valor">`). O degradê hoje é hard-coded `#f5f0eb` no `<stop>`; trocar por `currentColor`/token da tinta.
- `contarNumeros` (1395): contagem dos heróis, já respeita `prefers-reduced-motion`; fica.
- `pedirConfirmacao` (1414): confirmação em linha, já existe; só o CSS de `.confirma`. Usado nas issues 349–351.
- `render()` (5500): já marca `aria-busy` na seção, já trata falha inteira da aba com `.erro-carga` e botão "Tentar de novo". É aqui que entra o esqueleto.
- `aplicarFiltrosDaAba()` (5438) e `FILTROS` (5414): subtítulo e quais filtros aparecem; não mudam. O "atualizado há X" da spec não existe hoje: o `#status` mostra "· atualizando…" durante a carga; manter isso (não inventar relógio).
- `desenharMetasCompacto()` (1689) e `carregarMetasAcompanhamento()`: os dados da régua já vêm de `/api/metas/acompanhamento` com `funis[].indicadores[]` onde o de `tipo: 'volume'` traz `realizado`, `meta`, `pct`, `projecao` (números) e `situacao`; o de `tipo: 'custo'` traz `realizado`, `meta`, `diferenca`. Régua = `pct` preenchido, marca da projeção em `projecao / meta * 100` (teto 100). `crm_ok === false` → "não foi possível ler os leads agora". Sem meta → `metasVazioHtml()` (link para Funis do relatório) já existe.
- `R.visao` (1885): já busca `leadsA.funnelCounts` e `leadsB.funnelCounts` (atual e anterior). O bloco "Leads por funil" da spec nasce só desses dois arrays: contagem, barra proporcional ao maior, carimbo de `delta(atual, anterior)`. Nenhuma chamada nova.
- `.selo`, `.aviso.explica`, `.aviso.alerta`, `.falha`, `.ok`, `.modal`, `.tooltip`, `.chips`, `.abas`, `.tipo-pill`, `.gate`, `.confirma`: seletores já usados pelas outras abas; ganham o visual novo aqui e as issues seguintes só ajustam o que é específico delas.

Tokens antigos que as outras 18 abas usam (`--bg`, `--card`, `--card-2`, `--border`, `--fg`, `--muted`, `--bege`, `--taupe`, `--up`, `--down`, `--info`, `--warn`, `--serie`, `--serie2`, `--radius`): 100+ ocorrências em CSS específico de Argo, Instagram, Disparos, Metas, Saúde. Não reescrever isso aqui (é o trabalho das issues 345–354). Estratégia: os nomes antigos viram **apelidos temporários** dos tokens novos (`--bg: var(--papel)`, `--card: var(--etiqueta)`, `--border: var(--fio)`, `--fg: var(--tinta)`, `--muted: var(--apagado)`, `--up: var(--alta)`, `--down: var(--queda)`, `--warn: var(--alerta)`, `--info`, `--serie: var(--tinta)`, `--serie2: var(--queda)`, `--radius: 2px`). Assim as 18 abas abrem legíveis no papel, com os cantos e gradientes antigos ainda à mostra onde o CSS delas é próprio. A issue 355 apaga os apelidos.

Protótipo: `a-etiqueta.html` e `shared.js` do artifact (salvos nesta sessão em `%TEMP%\claude\...\scratchpad\artifact-files\61be7329-.../`). O CSS de lá é a base do Módulo 0; o JS de lá é descartado (só mock).

Preview: Cloudflare Pages `tracking-ae` é git-connected; branches viram preview em `https://<branch-com-hifens>.tracking-ae.pages.dev` (os branches `design/dash-*` anteriores já usaram isso). Branch desta entrega: `design/dash-etiqueta`. Nada vai para `main` até a issue 355. Lembrar que "Active" no painel do Pages ainda é "construindo".

Testes: `npm test` roda só `tests/*.test.js` (backend); nenhum toca o HTML do dash. A verificação é visual na preview, desktop e celular, mais a comparação dos números com produção no mesmo filtro.

## Cenários

### Happy Path
1. Ela abre a preview sem chave: tela de acesso em papel, etiqueta central com faixa carvão e o logo, campo de chave, botão primário tinta. Digita a chave e entra.
2. Visão geral carrega: topo com título 1.6rem e subtítulo apagado, filtros à direita (select com seta própria), fio forte de 2px embaixo. Enquanto as oito chamadas correm, manchete, etiquetas, gráfico e tabelas mostram esqueletos em fio piscando devagar.
3. Chegando os dados: manchete em 1.45rem com números em tinta; três etiquetas-herói (Leads, Conversão geral, CPL "todos os canais") com furo, ilhós, valor 2.9rem e carimbo de delta inclinado; régua de metas do mês entre dois fios (uma por funil com meta: feito na tinta, marca coral da projeção, legenda com % e projeção); quatro etiquetas (Novos visitantes, Investimento Meta com carimbo neutro tracejado, Receita, ROAS); "Leads por dia" (3/5) com gráfico na tinta e o último valor escrito acima do ponto; "Leads por funil" (2/5) em tabela-grade com barra de proporção e carimbo por funil; "Conversão por LP" em tabela-grade com seis linhas.
4. Ela troca o funil: tudo volta ao esqueleto e recarrega. Troca o período: manchete reescreve o "quando". Escolhe "Personalizado…": os dois campos de data aparecem ao lado.
5. Mouse no gráfico: cursor tracejado e tooltip em etiqueta pequena. Clique num cabeçalho: ordena, seta aparece. Linhas de "Conversão por LP" continuam sem clique: hoje a tabela da Visão geral não tem `aoClicar` (a spec supôs que tinha); o funil por página fica na aba Leads, como hoje.
6. Tab percorre nav, selects, cabeçalhos ordenáveis: foco de 2px na tinta (bege na barra lateral). Hover na etiqueta sobe 2px; hover na linha escurece 3%.
7. Celular (< 900px): barra lateral vira faixa carvão horizontal rolável, grupos separados por fio vertical bege translúcido, rótulos de grupo somem; heróis e KPIs em uma coluna; `.duas` em uma coluna; tabelas rolam dentro de `.tabela-wrap`; `body` sem rolagem lateral.

### Edge Cases
- ROAS sem venda: `tile` recebe `valor: null` e `nota` → etiqueta mostra "—" grande apagado e a nota do motivo no rodapé (já é assim; só o visual muda).
- CPL sem sync de investimento: idem, nota "precisa do sync de investimento".
- Sem meta cadastrada: bloco de metas mostra `metasVazioHtml()` entre os dois fios, sem régua.
- Meta com `crm_ok === false`: régua some e fica a frase "não foi possível ler os leads agora" no lugar.
- `pct` acima de 100: preenchido trava em 100% e a legenda diz "meta atingida" (campo `atingida`).
- Projeção maior que a meta: marca coral trava em 100%.
- Preset diferente de "mes": nota "As metas mostram sempre o mês corrente…" continua aparecendo, em texto apagado sob a régua.
- Série de leads com 500+ linhas: nota "amostra dos 500 leads mais recentes" no complemento do título, como hoje.
- `funnelCounts` vazio: tabela "Leads por funil" mostra o estado vazio "Nenhum lead no período: aqui aparece um funil por linha, com a comparação ao período anterior."
- Funil que existe no período atual mas não no anterior (ou vice-versa): delta `null` → carimbo neutro "novo" / "=" sem inclinação.
- `prefers-reduced-motion: reduce`: sem transição de hover, sem piscar do esqueleto, sem contagem dos heróis.
- Chave inválida na tela de acesso: erro em coral abaixo do botão, campo mantém o foco.
- Aba trocada no meio da carga: `renderAtual` já descarta a resposta velha; o esqueleto da aba abandonada é limpo junto com o `aria-busy`.

### Cenário de Erro
- Uma das oito chamadas falha: `render()` cai no `catch`, a seção ganha `.falhou`, o esqueleto some e no lugar do conteúdo fica o aviso `falha` ("Não foi possível carregar os dados desta aba…") com botão secundário "Tentar de novo"; topo e barra lateral continuam.
- `/api/metas/acompanhamento` falha: só o bloco de metas mostra "Não foi possível ler as metas agora." em aviso `explica`; o resto da aba carrega (já é isolado do `Promise.all`).
- Fonte Satoshi não carrega: `font-display: swap` cai em system-ui; nada quebra.

## Banco de Dados

Não se aplica. Nenhuma tabela, migration ou endpoint muda.

## Arquivos

- **Modificar:** `public/dash/index.html` — único arquivo de código desta issue.
  - CSS (linhas 8–698): (a) `:root` novo com os tokens da spec (`--papel`, `--etiqueta`, `--tinta`, `--tinta-2`, `--apagado`, `--fio`, `--fio-forte`, `--carvao`, `--bege`, `--taupe`, `--alta`, `--queda`, `--info`, `--alerta`) e os apelidos temporários dos nomes antigos; `color-scheme: light`; (b) reescrever as regras base: `body`, `.layout`, `.sidebar`, `.marca`, `.nav*`, `.conteudo`, `.topo`, `select/input/textarea`, `.btn*`, `:focus-visible`, `.confirma`, `.grid-kpi/.grid-heroi` (viram `.grid-etiquetas`), `.kpi` (vira `.etiqueta`, mantendo `.kpi` como seletor-irmão para as abas antigas), `.delta` (vira `.carimbo`), `.manchete`, `.semdado`, `.card` (vira `.bloco`: sem caixa, fio forte no `h2`), `.duas-colunas`, `table/th/td`, `.mini`, `.ok/.falha`, `.aviso*`, `.selo*`, `.status`, `.erro-carga`, `.grafico *`, `.legenda`, `.tooltip`, `.chips/.chip`, `.abas`, `.tipo-pill`, `.gate`, `.modal*`, `pre`, `.tl*`, `.faixa-estado`; (c) novos: `.regua`, `.meta`, `.metas` (régua de metas), `.barra` (proporção em célula), `.esqueleto` (com `@keyframes` piscar devagar), `.ponta-valor` do gráfico, `.gate .marca-faixa`; (d) apagar a camada "Painel refinado" (linhas 193–315: `body` com radial-gradient, `.kpi/.card` com degradê, `.faixa-heroi*`, `.nav a.ativo::before`) e a regra `.secao[aria-busy] … opacity 0.35` (substituída pelo esqueleto); (e) `@media (max-width: 900px)` unificado para layout/sidebar/`.duas`/heróis (hoje há 980px e 760px espalhados; os das abas específicas ficam); (f) `@media (prefers-reduced-motion: reduce)` já existe na linha 315, ampliar para `animation: none`.
  - HTML (700–780): tela de acesso (`#gate`) com a faixa carvão e o logo; barra lateral: `small` vira "TRACKING INTERNO"; `#secao-visao` reescrita: `<p class="manchete">`, `<div class="grid-etiquetas" id="visao-herois" data-esqueleto="etiquetas:3">`, `<div class="metas" id="visao-metas">`, `<div class="grid-etiquetas" id="visao-kpis" data-esqueleto="etiquetas:4">`, `<div class="duas">` com `.bloco` "Leads por dia" (`#visao-grafico`, `data-esqueleto="grafico"`) e `.bloco` "Leads por funil" (`#visao-funis`, `data-esqueleto="tabela"`), `.bloco` "Conversão por LP" (`#visao-lps`, `data-esqueleto="tabela"`). A classe `.faixa-heroi` sai.
  - JS: `tile()` gera `.etiqueta` (`.ref`, `.valor`, `.rodape` com carimbo + `.nota`); `deltaChip()` gera `.carimbo`; nova `esqueleto(el)` que lê `data-esqueleto` e escreve os placeholders, chamada em `render()` logo após `aria-busy = true` para todo `[data-esqueleto]` da seção ativa; `desenharMetasCompacto()` gera a régua (`.meta > h3 + .regua + .mini`) a partir do indicador de volume `leads_novos` e mostra o CPL na legenda quando existir; `R.visao` ganha o bloco "Leads por funil" via `tabela($('#visao-funis'), …)` com colunas Funil (negrito), Leads (barra + número) e vs. anterior (carimbo), usando `leadsA.funnelCounts` × `leadsB.funnelCounts`; `grafico()` escreve o último valor acima da ponta e troca o `#f5f0eb` do degradê pelo token; `tabela()` passa a mostrar a seta de ordenação também no cabeçalho não ordenado ao hover (só CSS) e a mensagem de vazio vira o texto que ensina, recebido por parâmetro opcional `vazio`.
- **Commitar junto (já existem, não commitados):** `PRODUCT.md`, `.impeccable/surfaces/public-dash-index-html.md`, `spec.md`, `docs/specs-arquivadas/spec-grupo-live-manychat-automatico.md` (git mv já feito), `issues/344-…` a `issues/355-…`.

> Sem arquivo novo de CSS: o dash é um arquivo só por decisão registrada no brief (HTML/CSS/JS num arquivo, sem framework).

## Dependências Externas

Nenhuma. Satoshi já está hospedada em `public/fonts/`.

## Checklist

- [x] Criar o branch `design/dash-etiqueta` a partir de `main` e commitar nele `PRODUCT.md`, o brief, `spec.md`, a spec arquivada e as issues 344–355
- [x] CSS: `:root` com os tokens novos + apelidos temporários; `color-scheme: light`; `body` papel/tinta 14px
- [x] CSS: barra lateral carvão + bege (grupos, rótulo taupe, item ativo bege sólido com texto carvão, foco bege); "TRACKING INTERNO" no HTML
- [x] CSS: topo (título 1.6rem, sub apagado, fio forte 2px), campos (`select` com seta própria, `input`, `textarea`, canto 2px) e botões (primário/secundário/perigo/desabilitado na mesma altura)
- [x] CSS: `.etiqueta` (+`.heroi`, furo/ilhós, `.ref`, `.valor` tabular, `.rodape` tracejado, `.nota`, hover 2px) e `.carimbo` (alta/queda/neutro)
- [x] CSS: `.bloco` com `h2` de fio forte + `small` apagado; `.duas` 3fr/2fr; `.grid-etiquetas`
- [x] CSS: tabela-grade (`th` caixa alta com fio forte, `td` fio fino, hover 3%, `td.lp`/primeira coluna negrito, `.num` à direita, `th.ordenavel` com seta) e `.barra`
- [x] CSS: `.metas`/`.meta`/`.regua` (marcas a cada 10%, preenchido tinta, marca coral) e `.metas-nota`
- [x] CSS: `.esqueleto` + `@keyframes`; `.aviso`, `.aviso.explica`, `.aviso.alerta`, `.erro-carga`, `.semdado`, estado vazio
- [x] CSS: gráfico (linha tinta, área degradê da tinta 16%→0, grade fio, rótulos 11px apagados, ponta com halo, `.ponta-valor`, cursor tracejado, `.linha2` coral, `.legenda`) e `.tooltip` como etiqueta pequena
- [x] CSS: `.chips/.chip`, `.abas`/`.tipo-pill`, `.selo` (+`ar`/`pago`/`parcial`), `.modal*` (véu tinta 40%, fio forte no topo), `pre`, `.tl*`, `.confirma`, `.faixa-estado`, `.gate` com faixa carvão e logo
- [x] CSS: apagar a camada "Painel refinado" e `.faixa-heroi*`; `@media (max-width: 900px)` para layout/sidebar/heróis/`.duas`; `prefers-reduced-motion` também zera `animation`; `overflow-x: hidden` só onde a spec pede (tabela dentro do bloco), `body` nunca rola de lado
- [x] HTML: `#gate` novo; `#secao-visao` reescrita com manchete, heróis, metas, KPIs, `.duas` (gráfico + `#visao-funis`) e Conversão por LP, todos com `data-esqueleto`
- [x] JS: `tile()` → etiqueta; `deltaChip()` → carimbo (▲ ▼, "=" no zero, neutro tracejado)
- [x] JS: `esqueleto(el)` e chamada em `render()`; remover a dependência do `opacity 0.35`
- [x] JS: `desenharMetasCompacto()` em régua (pct, projeção, atingida, crm_ok, sem meta, nota do preset)
- [x] JS: bloco "Leads por funil" em `R.visao` a partir de `funnelCounts` A × B (barra proporcional, carimbo, vazio que ensina)
- [x] JS: `grafico()` com valor escrito acima da ponta e degradê por token; `tabela()` com `vazio` opcional
- [x] Conferir na preview (com respostas simuladas, sem a chave): Visão geral desktop e celular (< 900px), Tab em todos os controles, hover, reduced motion no DevTools, "Personalizado…" mostra datas, tooltip, ordenação, esqueleto ao trocar funil/período, "—" no ROAS
- [ ] Conferir que os números batem com produção para o mesmo preset e funil (Leads, Conversão geral, CPL, Novos visitantes, Investimento, Receita, ROAS, Conversão por LP)
- [x] Abrir as outras 18 abas na preview: todas carregam sem erro de JS (visual ainda misto é esperado)
- [ ] Anotar na issue o link da preview e o que ficou para as issues seguintes

## Resultado (30/09/2026)

- Branch `design/dash-etiqueta`, preview em https://design-dash-etiqueta.tracking-ae.pages.dev/dash/ (commits 7229e6c, c1f0821, 7010d0d).
- Verificado por mim na preview, com respostas de API simuladas (não tenho a chave do dash e não devo digitá-la): tela de acesso, barra lateral, manchete, etiquetas-herói com carimbo, régua de metas (89% com projeção; 105% "meta atingida"), quatro etiquetas (ROAS "—" com nota), gráfico com valor na ponta e tooltip, "Leads por funil" com barra e carimbo, "Conversão por LP" ordenável, esqueleto ao trocar período, "Personalizado…" mostra as datas, celular a 390px (faixa horizontal, uma coluna, sem rolagem lateral), 18 abas abrem sem erro de JS.
- **Falta ela conferir na preview com a chave real:** números iguais aos de produção para o mesmo filtro; foco por Tab; "reduzir movimento".
- Fora do escopo (issues seguintes): visual das outras 18 abas ainda mistura o CSS antigo (apelidos dos tokens); a spec supôs clique na linha de "Conversão por LP" que nunca existiu, segue sem clique.
