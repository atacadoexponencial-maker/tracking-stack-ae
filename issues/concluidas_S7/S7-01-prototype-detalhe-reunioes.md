# S7-01: Protótipo da seção Detalhe das reuniões

**Tipo:** Protótipo
**Página:** Visão geral
**Spec:** `spec-detalhe-reunioes.md`

## Descrição

Desenhar a seção nova no fim da Visão geral com dados fictícios, para a usuária aprovar o
visual antes de ligar os dados: a linha de números (criadas, realizadas, faltaram,
canceladas, a acontecer, sem presença marcada, no-show) com a comparação ao período
anterior, e as cinco listas fechadas em "drop" (Ainda vão acontecer, Faltaram, Cancelaram,
Sem presença marcada, Reagendamentos) com a quantidade no título.

## Pronto quando

A usuária abre a prévia (no computador e no celular), vê a seção com números e nomes de
exemplo, abre e fecha as listas e aprova o desenho.

## Critérios de aceite

Nenhum.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S7-04 | Cada linha das listas mostra nome, funil, dia e hora; sem telefone, e-mail ou link do ClickUp | confirmada | usuária, 09/11/2026 |
| SUP-S7-05 | A seção fica abaixo do funil e da tabela por funil, no fim da Visão geral | confirmada | usuária, 09/11/2026 |

## Perguntas em aberto

Nenhuma.

## Cenários

### Happy Path
1. A usuária abre `#visao?proto=1` no dash.
2. No fim da Visão geral (depois do funil e da tabela por funil, que seguem com os dados reais) aparece a seção "Detalhe das reuniões" com o selo "Protótipo": a linha de números (criadas, realizadas, faltaram, canceladas, a acontecer, sem presença marcada, no-show) com o carimbo de variação e o valor anterior, como os cards da Visão geral.
3. Embaixo, as cinco listas fechadas, cada uma só com título e quantidade: "Ainda vão acontecer (8)", "Faltaram (1)", "Cancelaram (1)", "Sem presença marcada (0)", "Reagendamentos (2)".
4. Clicar numa lista abre só ela (nome, funil, dia e hora; remarcadas com a marca "remarcada"; em Reagendamentos, quantas vezes, as trocas de horário e a situação atual); clicar de novo fecha.
5. Trocar o filtro de datas ou de funil mantém `proto=1` no link e a seção de exemplo continua lá.
6. Sem `proto=1`, a Visão geral continua exatamente a de hoje.

### Edge Cases
- Lista vazia (Sem presença marcada com 0): abre e mostra "ninguém nesta situação no período", em vez de sumir.
- Celular (até 640px): os números quebram em duas colunas; cada linha da lista empilha nome em cima e funil/dia/hora embaixo, sem rolagem lateral.
- No-show sem base aparece como "—" (exemplo num seletor de cenário "sem presença marcada ainda").

### Cenário de Erro
- Protótipo não lê API: não há erro de carga possível. Se o script do módulo não carregar, a seção simplesmente não aparece e o resto da Visão geral segue normal.

## Prova

Protótipo sem critérios de aceite: a aprovação é a usuária olhando a prévia no ar (desenho), sem teste automático.

## Banco de Dados

Não se aplica (números e nomes fictícios no próprio módulo).

## Arquivos

- **Criar:** `public/dash/detalhe-reunioes.js` — módulo `window.DetalheReunioes` da seção (padrão de `visao-reuniao.js`/`arvore.js`: IIFE, recebe `ctx` com `esc`, `fmtInt`, `fmtPct`, `tile`, `deltaChip`). Nesta issue só `prototipo(raiz, ctx)` com dados de exemplo e um seletor de cenário (normal / sem presença marcada ainda / período vazio). Listas em `<details>`/`<summary>` (fechadas por padrão, cada uma abre e fecha sozinha). Reaproveita `tile` do index para os números (mesmo card com carimbo e balão do anterior).
- **Modificar:** `public/dash/index.html` — (1) `<div id="visao-detalhe-reunioes"></div>` logo abaixo de `#visao-reuniao` na `#secao-visao`; (2) `<script src="/dash/detalhe-reunioes.js?v=2026-11-09a">`; (3) bloco CSS `.dr-*` junto do bloco da Visão geral (S4), com a quebra de 640px; (4) flag `visaoProto` lida de `proto=1` no hash em `lerUrl()` e mantida em `escreverUrl()` (mesmo padrão do protótipo S4-01, commit 2396d1f); (5) em `R.visao`, com a flag ligada, chama `DetalheReunioes.prototipo($('#visao-detalhe-reunioes'), ctx)`; sem ela, o container fica vazio.

## Dependências Externas

Nenhuma.

## Checklist

- [x] Criar `public/dash/detalhe-reunioes.js` com `prototipo()`, dados de exemplo da semana 02–08/11 (nomes fictícios) e o seletor de cenário
- [x] Container, script e CSS da seção em `public/dash/index.html`
- [x] Flag `proto=1` lida e mantida no link; `R.visao` desenha o protótipo só com ela

### Depois do commit (fora do checklist: só dá para fazer com o código no ar)

1. Push na main e esperar o deploy do Pages terminar.
2. Conferir no ar `#visao?proto=1` no computador e no celular.
3. Usuária aprova o desenho (é o "Pronto quando" desta issue).
