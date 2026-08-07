# 186: Lote vigente calculado pela data e exibição do preço

**Tipo:** Implementação
**Página:** /workshop-black-exponencial-2026

## Descrição

Determinar o lote vigente a partir da data e hora correntes no fuso de Brasília (Lote 0 — R$ 47, de 10/08 a 20/08; Lote 1 — R$ 97, de 20/08 a 30/08; Lote 2 — R$ 147, de 30/08 até 09/09 às 18h) e exibir o mesmo valor e o mesmo rótulo em todos os pontos da página que mostram preço: linha abaixo do botão do hero, caixa de oferta e texto do botão da caixa de oferta, sempre com o valor cheio de R$ 297 riscado como ancoragem e no formato brasileiro sem centavos. Incluir a linha "Depois do Lote [N], o valor sobe para R$ [próximo valor]" apenas enquanto existir lote seguinte, resolver as viradas de 20/08 e 30/08 com um único lote vigente por instante, e definir o comportamento fora da tabela — antes de 10/08 apresenta o primeiro lote e depois de 09/09 às 18h apresenta o encerramento das vendas, sem preço inventado.

---

## Decisões técnicas que sustentam o plano

**1. O cálculo é no navegador, não no build.** O `astro.config.mjs` usa
`output: 'static'`. O frontmatter de uma página `.astro` roda no momento do
build, não no acesso do visitante — se o lote fosse decidido lá, ele congelaria
no valor do dia do deploy e só mudaria com um novo build. Por isso o lote
vigente é decidido em um `<script>` da própria página e aplicado aos ganchos
`data-*` que a issue 185 já deixou prontos.

**2. O HTML nasce no Lote 0.** Os pontos de preço já vêm renderizados com
`VALOR_INICIAL` / `LOTE_INICIAL` / `PROXIMO_VALOR_INICIAL` (Lote 0, R$ 47). O
script só sobrescreve o que mudou. Isso evita o flash de espaço vazio e dá um
fallback legível quando o JavaScript não roda.

**3. O fuso é resolvido por instante absoluto, não por fuso do dispositivo.**
As fronteiras dos lotes são escritas como strings ISO com deslocamento explícito
(`'2026-08-20T00:00:00-03:00'`) e convertidas para epoch em milissegundos com
`Date.parse`. A comparação passa a ser `numero >= numero` — o fuso configurado no
aparelho do visitante deixa de participar da conta. É o mesmo raciocínio já
documentado em `functions/api/webhooks/_classificar.js` (Brasília sem horário de
verão desde 2019; se o horário de verão voltar, este é o único ponto a mudar).
Não se usa `toLocaleString('pt-BR', { timeZone: ... })` para decidir o lote:
formatar em outro fuso e reinterpretar a string é o caminho que gera erro de
1 hora nas bordas.

**4. Não existe utilidade reaproveitável para isto no `src/`.** A busca por
`America/Sao_Paulo`, `toLocaleString` e `Intl.NumberFormat` encontrou apenas:
`functions/api/webhooks/_classificar.js` (backend, converte ISO→dia local — não
serve para "qual faixa contém agora") e `public/dash/index.html` (helpers
`money`/`quandoBRT` embutidos no HTML do painel, não importáveis pelo site).
Portanto o módulo de lotes é novo — mas segue o padrão já consolidado no repo:
lógica pura em `.js` isolada da página, importada tanto pelo `<script>` da
página quanto por um teste `node --test` (mesmo formato de
`functions/_links-destino.js` + `tests/links-destino.test.js` e de
`src/data/materiais.js` + `tests/materiais.test.js`).

**5. Os valores são strings fixas na tabela, sem formatador.** São quatro
valores ("R$ 47", "R$ 97", "R$ 147", "R$ 297"). Escrevê-los prontos na tabela é
mais simples e mais determinístico que chamar `Intl.NumberFormat` para depois ter
de arrancar os centavos, e não há formatador compartilhado no `src/` para
reaproveitar.

---

## Cenários

### Happy Path

1. Visitante abre `/workshop-black-exponencial-2026` no dia 22/08/2026, às 10h
   de Brasília.
2. O HTML chega com Lote 0 / R$ 47 já pintado (nunca há espaço em branco).
3. O `<script>` da página roda, pega `Date.now()`, e o módulo devolve o Lote 1.
4. O script escreve, de uma vez:
   - `[data-preco="hero"]` → `R$ 97`
   - `[data-lote="hero"]` → `Lote 1`
   - `[data-preco="oferta"]` → `R$ 97`
   - `[data-lote="oferta"]` → `Lote 1`
   - `[data-preco="botao-oferta"]` → `R$ 97` (o botão fica "Garantir minha vaga
     por R$ 97")
   - `[data-preco="proximo"]` → `Depois do Lote 1, o valor sobe para R$ 147`
5. O `R$ 297` riscado (`.wbe-oferta__cheio`) não é tocado: é texto fixo no HTML.
6. `data-vendas` continua `"abertas"`, o aviso `.wbe-encerrado` continua com
   `hidden`, todos os botões `[data-checkout]` continuam visíveis.
7. Todos os pontos de preço da página exibem o mesmo número. Nada mais na página
   muda.

### Edge Cases

Todos os instantes abaixo são no fuso de Brasília (UTC−3).

| # | Instante | Resultado esperado |
|---|---|---|
| 1 | 09/08/2026, 23:59 (antes da tabela) | Lote 0, R$ 47, vendas abertas, linha "Depois do Lote 0, o valor sobe para R$ 97". A página não inventa "em breve" nem esconde o preço. |
| 2 | 10/08 00:00:00 exato (abertura) | Lote 0. Idêntico ao caso 1 — a abertura não é uma virada visível. |
| 3 | **19/08 23:59:59** | Ainda Lote 0 / R$ 47. |
| 4 | **20/08 00:00:00 exato** | Já Lote 1 / R$ 97. Regra: **início inclusivo, fim exclusivo** (`inicio <= agora < fim`). É isso que garante "apenas um lote vigente por instante" — nenhum instante pertence a dois lotes e nenhum instante fica órfão entre eles. |
| 5 | **29/08 23:59:59** | Ainda Lote 1 / R$ 97. |
| 6 | **30/08 00:00:00 exato** | Já Lote 2 / R$ 147. Aqui a linha `[data-preco="proximo"]` **some** (`hidden = true`) — não existe lote seguinte e a página nunca anuncia um valor que não existe. |
| 7 | **09/09 17:59:59** | Ainda Lote 2 / R$ 147, vendas abertas, botões visíveis. Faltando 1 segundo ainda dá para comprar. |
| 8 | **09/09 18:00:00 exato** | Vendas encerradas. `data-vendas="encerradas"` no wrapper `.wbe`, `hidden` removido de `.wbe-encerrado`. O CSS da 185 assume daqui. |
| 9 | Qualquer instante depois de 09/09 18:00 | Igual ao caso 8. Sem preço, sem "próximo lote", sem botão de compra. |
| 10 | **Relógio do dispositivo errado** (ex.: aparelho marcando 2025, ou adiantado em 2 dias) | A página mostra o lote correspondente ao relógio errado — inclusive "encerradas" antes da hora, ou R$ 47 depois de 20/08. **Isto é aceito conscientemente**, não é bug a corrigir aqui: a página é estática (`output: 'static'`), não há servidor no caminho da renderização para fornecer a hora, e a spec proíbe qualquer relógio/contador na página. Consequência prática: o preço na página é informativo e quem cobra de verdade é o checkout — o valor final é sempre o configurado lá. Registrar isso como comentário no código, para ninguém "consertar" depois com um fetch de hora do servidor sem discutir. |
| 11 | Fuso do dispositivo diferente de Brasília (visitante em Portugal, ou celular em UTC) | **Não afeta nada.** A comparação é entre epoch em ms; o fuso do aparelho só influenciaria se a data fosse montada com `new Date(2026, 7, 20)` ou lida com `getHours()` — e nenhum dos dois é usado. |
| 12 | **JavaScript desabilitado / bloqueado / script falha ao carregar** | A página fica exatamente como nasceu no build: **Lote 0, R$ 47, "Depois do Lote 0, o valor sobe para R$ 97", vendas abertas, todos os botões funcionando**. É degradação legível — não aparece caixa vazia, `undefined`, nem `{VALOR}`. O risco real é mostrar R$ 47 depois que o lote virou, ou botão de compra depois de encerrado; a mitigação é operacional (o checkout é a fonte da verdade do preço, e depois de 09/09 a página pode ser despublicada/atualizada). Nenhum tratamento a mais é feito aqui. |
| 13 | **Comportamento do CSS com `data-vendas="encerradas"`** (regra já escrita na 185, apenas verificada aqui) | Três seletores disparam: (a) `.wbe-encerrado[hidden]` volta a `display: block` — por isso o script pode manter ou remover o `hidden`, o CSS vence de qualquer forma; (b) `.wbe-preco-bloco` some, o que apaga de uma vez a linha de preço do hero, o bloco de preços da oferta (**inclusive o R$ 297 riscado**, correto: sem venda não há ancoragem) e a linha do próximo lote; (c) `[data-checkout]` e `.wbe-fechamento .btn-cta` somem, o que apaga o botão da barra fixa, o do hero, os três CTAs do corpo, o da caixa de oferta, o da urgência e o do `FinalCta`. **Verificar visualmente:** a barra fixa fica só com o texto do evento (sem botão) e a caixa de oferta fica sem preço e sem botão, com a lista de itens e um `gap` sobrando — se ficar feio, o ajuste é de CSS na própria página, não de lógica. |
| 14 | Algum gancho `data-*` não existe no DOM (alguém removeu um bloco depois) | O script não quebra: cada escrita é condicional (`el && (el.textContent = ...)`) ou feita via `querySelectorAll`, que simplesmente não itera. O resto da página continua atualizado. |
| 15 | Visitante deixa a aba aberta atravessando a virada (ex.: abre 19/08 às 23h e volta na aba dia 20) | O preço **não** se atualiza sozinho — o cálculo roda uma vez, no carregamento. Aceito: a alternativa seria um timer periódico, que é justamente o "contador" proibido pela spec. Um refresh já corrige. |

### Cenário de Erro

- **Exceção dentro do script** (gancho inesperado, ambiente exótico): todo o
  bloco de aplicação ao DOM fica dentro de um `try/catch`. No `catch`, o script
  não faz nada além de deixar a página no estado inicial do HTML (Lote 0,
  vendas abertas) — nunca esvazia um preço nem escreve `undefined`. Não há
  mensagem de erro para o visitante: a página continua vendável.
- **`Date.parse` devolvendo `NaN`** para alguma fronteira (só aconteceria com um
  literal escrito errado): a função pura valida as fronteiras e, se alguma não
  for finita, devolve o primeiro lote (Lote 0) em vez de "encerradas" — errar
  para o lado de continuar vendendo é menos danoso que fechar a loja por engano.
  Este caso é coberto por teste.
- **Falha de rede no bundle do script**: idêntico ao Edge Case 12.
- Não há chamada de rede, `fetch`, API nem `localStorage` nesta issue —
  logo, não há erro de backend a tratar.

---

## Arquivos

### Criar

1. **`src/data/lotes-workshop.js`** — módulo puro, sem DOM, sem `window`, sem
   I/O. Mora em `src/data/` pelo mesmo motivo de `src/data/materiais.js`: é a
   tabela de negócio da página, e fica importável tanto pelo `<script>` da
   página quanto pelo teste em Node. Exporta:
   - `LOTES` — o array-fonte, na ordem: `{ rotulo: 'Lote 0', valor: 'R$ 47',
     inicio: '2026-08-10T00:00:00-03:00', fim: '2026-08-20T00:00:00-03:00' }`,
     idem Lote 1 (R$ 97, 20/08→30/08) e Lote 2 (R$ 147, 30/08→
     `2026-09-09T18:00:00-03:00`). O fim de um lote é exatamente o início do
     seguinte — é o que torna impossível existir buraco ou sobreposição.
   - `VALOR_CHEIO = 'R$ 297'` — a ancoragem, exportada para documentar que ela é
     fixa (a página já a tem escrita no HTML; a constante existe para o teste
     poder afirmar que ninguém a transformou em lote).
   - `loteVigente(agoraMs)` — recebe epoch em ms (injetado, nunca lido de
     `Date.now()` dentro da função: é o que torna os 15 edge cases testáveis).
     Devolve `{ estado: 'aberto', rotulo, valor, proximoValor }` com
     `proximoValor` = `null` no último lote, ou `{ estado: 'encerrado' }` depois
     do fim do último lote. Antes do início do primeiro lote devolve o primeiro
     lote. Regra de faixa: `agora < fim` do primeiro lote cujo fim ainda não
     passou.
   - `textoProximo(proximoValor, rotulo)` — devolve
     `"Depois do Lote N, o valor sobe para R$ X"` ou `null`. Existe para o texto
     ficar em um lugar só e ser testável, em vez de concatenado no meio do DOM.

2. **`tests/lotes-workshop.test.js`** — `node --test`, no formato dos testes já
   existentes (`import { test } from 'node:test'` + `assert/strict`). Cobre um
   caso por linha da tabela de Edge Cases: antes de 10/08; 20/08 00:00 exato vs
   19/08 23:59:59; 30/08 00:00 exato vs 29/08 23:59:59; 09/09 17:59:59 vs
   18:00:00; ausência de `proximoValor` no Lote 2; `estado: 'encerrado'` depois
   do fim; e o teste-chave de fuso: **o mesmo instante em ms produz o mesmo
   resultado independentemente de `process.env.TZ`** (rodar as asserções também
   com `TZ` fictício, ou simplesmente afirmar sobre epoch cru, que é
   fuso-agnóstico por construção).

### Modificar

3. **`src/pages/workshop-black-exponencial-2026.astro`** — três alterações,
   nada além disto:
   - **Frontmatter:** trocar os três literais `VALOR_INICIAL` / `LOTE_INICIAL` /
     `PROXIMO_VALOR_INICIAL` por valores derivados de `LOTES[0]` (importado do
     módulo novo), para que o HTML inicial e o script leiam a mesma tabela e não
     possam divergir. O comentário do bloco é atualizado: deixa de dizer "a
     lógica é da issue 186" e passa a explicar que o HTML nasce no primeiro lote
     de propósito (fallback sem JS).
   - **Adicionar um único `<script>`** no fim do arquivo (depois do `</style>`,
     seguindo o padrão de `src/pages/materiais/[slug].astro`, que importa de
     `../../scripts/`). Ele: importa `loteVigente` e `textoProximo`; chama
     `loteVigente(Date.now())`; se `encerrado`, põe
     `wrapper.dataset.vendas = 'encerradas'` e remove o `hidden` do
     `.wbe-encerrado`; se `aberto`, preenche os `[data-preco]` e `[data-lote]`
     via `querySelectorAll` e esconde `[data-preco="proximo"]` quando não houver
     próximo valor. Tudo dentro de `try/catch`. Sem timer, sem
     `setInterval`, sem `fetch` — a spec proíbe contador.
   - **Nenhuma mudança de CSS** é necessária: as regras de
     `data-vendas="encerradas"` já existem. Só entra CSS se o Edge Case 13
     revelar um espaçamento feio na caixa de oferta encerrada.

### Não tocar

- `src/components/sections/FinalCta.astro` e `Faq.astro` — compartilhados com
  outras páginas; o CSS da 185 já os alcança pelo seletor
  `.wbe-fechamento .btn-cta`.
- `astro.config.mjs` — nada aqui pede SSR. Trocar `output` para resolver o
  relógio do dispositivo estaria fora do escopo desta issue e afetaria o site
  inteiro.
- `CHECKOUT_URL` e qualquer bloco de conteúdo da página.

---

## Dependências Externas

**Nenhuma.** Sem biblioteca de datas (nada de `date-fns`, `dayjs`, `luxon`), sem
API de horário, sem variável de ambiente, sem migração de banco, sem chamada de
rede. Tudo resolve com `Date.parse` de literais ISO com deslocamento explícito —
suportado por todos os navegadores em uso e por Node, e já é o padrão do repo.
As `dependencies` do `package.json` (`astro`, `sharp`) ficam intactas.

Pendências da spec que **não** bloqueiam esta issue: a URL real do checkout
(item 1) e a confirmação da redação do aviso de encerramento (item 5) — o texto
do aviso já está no HTML desde a 185 e trocá-lo depois é edição de uma linha.

---

## Checklist

- [x] `src/data/lotes-workshop.js` criado, exportando `LOTES`, `VALOR_CHEIO`,
      `loteVigente(agoraMs)` e `textoProximo(...)`, sem tocar em DOM, `window`,
      `Date.now()` interno ou I/O.
- [x] As fronteiras estão escritas como ISO com `-03:00` explícito, e o fim de
      cada lote é literalmente igual ao início do próximo.
- [x] Comentário no módulo registrando: Brasília sem horário de verão desde
      2019, e que este é o único ponto a mudar se voltar (mesmo aviso de
      `functions/api/webhooks/_classificar.js`).
- [x] Regra de faixa implementada como início inclusivo / fim exclusivo — um e
      só um lote vigente por instante.
- [x] Antes de 10/08 devolve o Lote 0 (não devolve "encerrado" nem vazio).
- [x] A partir de 09/09 18:00:00 devolve `estado: 'encerrado'`, sem preço.
- [x] `proximoValor` é `null` no Lote 2 e a linha do próximo valor some.
- [x] Fronteira inválida (`NaN`) cai no primeiro lote, nunca em "encerrado".
- [x] `tests/lotes-workshop.test.js` criado cobrindo: 09/08; 19/08 23:59:59;
      20/08 00:00:00; 29/08 23:59:59; 30/08 00:00:00; 09/09 17:59:59;
      09/09 18:00:00; depois de 09/09; ausência de próximo no Lote 2;
      independência de fuso.
- [x] `npm test` passa (todos os testes do repo, não só o novo).
- [x] Frontmatter da página passou a derivar `VALOR_INICIAL` / `LOTE_INICIAL` /
      `PROXIMO_VALOR_INICIAL` de `LOTES[0]`, sem literais duplicados.
- [x] `<script>` único adicionado à página, com `try/catch`, sem `setInterval`,
      sem `fetch`, sem contador regressivo.
- [x] Todos os seis ganchos são atualizados e mostram **o mesmo valor**:
      `data-preco` hero / oferta / botao-oferta e `data-lote` hero / oferta,
      mais `data-preco="proximo"`.
- [x] O `R$ 297` riscado (`.wbe-oferta__cheio`) não é tocado pelo script e
      continua visível enquanto as vendas estiverem abertas.
- [x] Valores no formato brasileiro, com `R$` e sem centavos, em todos os
      pontos.
- [ ] Estado encerrado testado à mão no navegador (forçando a data no console ou
      trocando temporariamente a fronteira): wrapper vira
      `data-vendas="encerradas"`, o aviso aparece, e somem a linha de preço do
      hero, o bloco de preços da oferta e **todos** os botões de compra
      (barra fixa, hero, 3 CTAs, oferta, urgência, fechamento).
- [ ] Aparência da caixa de oferta e da barra fixa conferida no estado
      encerrado (sem buraco de `gap` evidente).
- [x] Com JavaScript desabilitado a página exibe Lote 0 / R$ 47 e continua
      navegável — sem espaço em branco, `undefined` ou botão quebrado.
- [x] Comentário no código registrando que o relógio errado do dispositivo é um
      risco aceito e por quê (página estática + spec proíbe contador).
- [x] `npm run build` passa.
- [x] Nenhum arquivo além dos três listados em **Arquivos** foi tocado.
