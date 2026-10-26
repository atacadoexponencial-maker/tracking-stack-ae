# S4-01: Protótipo da Visão geral da reunião semanal

**Tipo:** Protótipo
**Página:** Visão geral
**Spec:** `spec-visao-geral-reuniao-semanal.md`

## Descrição

Desenhar a nova Visão geral com números fictícios, para a usuária aprovar a ordem e o
visual antes de ligar os dados: manchete, os oito quadros, as três taxas de passagem, os
níveis de qualificação da Sessão Estratégica e a tabela de leads por funil com a coluna de
grupos no workshop.

## Pronto quando

A usuária abre a prévia (no computador e no celular), vê a tela inteira com números de
exemplo e aprova a ordem e o desenho dos blocos.

## Critérios de aceite

Nenhum.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S4-04 | Níveis de qualificação mostram três faixas, incluindo "Não informado", para a soma bater com o total de leads novos de SE. | confirmada | Usuária, 26/10/2026 |
| SUP-S4-07 | A manchete em frase ("X leads nos últimos 7 dias…") sai da Visão geral e vai para a aba Detalhado. | invalidada | A manchete fica na Visão geral (usuária, 26/10/2026); a aba Detalhado também a tem, por ser cópia da tela antiga |

## Perguntas em aberto

Nenhuma.

## Cenários

### Happy Path
1. A usuária abre `#visao?proto=1` no dash.
2. A Visão geral mostra o selo "Protótipo" e, com números de exemplo: a manchete, os oito quadros (Leads, Leads novos, CPL, CPL lead novo, MQLs, SQL, Reunião agendada, Reunião realizada) com a comparação ao período anterior, as três taxas de passagem com "X de Y", o bloco de níveis de qualificação da Sessão Estratégica (três faixas com % e total) e a tabela de leads por funil com Leads, Leads novos e "Entraram nos grupos" só no workshop.
3. Sem `proto=1`, a Visão geral continua a de hoje (nada muda para quem usa o dash).

### Edge Cases
- Celular (largura 375 px): quadros quebram em duas colunas, tabela rola dentro do próprio bloco, nada estoura a página.
- Seletor de cenário no selo: "normal", "CRM fora do ar" (MQLs e SQL com "sem dados do CRM", Lead → MQL e MQL → RA com "—") e "filtro no workshop" (bloco de qualificação some, tabela só com a linha do workshop).

### Cenário de Erro
- Protótipo não chama o backend: não há erro de rede possível. O cenário "CRM fora do ar" mostra como a falha vai aparecer.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|

Nenhum critério nesta issue (protótipo).

## Banco de Dados

Não se aplica.

## Arquivos

- **Criar:** `public/dash/visao-reuniao.js` — desenha a Visão geral da reunião a partir de um objeto de dados já calculado (`window.VisaoReuniao.desenhar(raiz, dados, ctx)`), no padrão IIFE de `cloudflare.js`/`agenda.js`, recebendo `esc`, `fmtInt`, `fmtPct`, `money`, `tile`, `tabela`, `comparar`, `delta`, `deltaChip` do index. Nesta issue traz também `EXEMPLO` (dados fictícios por cenário) e o selo de protótipo.
- **Modificar:** `public/dash/index.html` — (1) `<div id="visao-reuniao"></div>` no topo de `#secao-visao`; (2) no começo de `R.visao`, com `proto=1` no hash, marca a seção com `.visao-proto` (CSS esconde os outros filhos), desenha o protótipo e retorna; (3) `<script src="/dash/visao-reuniao.js?v=...">`; (4) poucas regras CSS `.vr-*` (faixas da qualificação, coluna de grupos) e `.visao-proto`.

Reaproveitados: `tile`/`.grid-etiquetas` (quadros, `heroi` nos oito números), `comparar`/`delta` (balão e carimbo do período anterior), `tabela` + `.tabela-wrap`, `.bloco`, `.regua` (barra da faixa), `.em-proto`/`.em-proto__selo`/`.em-proto__cen` (selo e seletor de cenário), `.carimbo.neutro`.

## Dependências Externas

Nenhuma.

## Checklist

- [x] `visao-reuniao.js` com `desenhar` e os três cenários de exemplo
- [x] Contêiner, gatilho `proto=1`, script e CSS no `index.html`
- [x] Conferir no navegador (computador e 375 px) os três cenários
