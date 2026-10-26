# S4-03: Visão geral com os oito números da reunião

**Tipo:** Implementação
**Página:** Visão geral — números do período
**Spec:** `spec-visao-geral-reuniao-semanal.md`

## Descrição

A Visão geral passa a mostrar só a manchete e os quadros Leads, Leads novos, CPL, CPL lead
novo, MQLs (só novos), SQL (campo "🏆 SQL" do card), Reunião agendada e Reunião realizada
(agenda própria + Calendly, pela data em que a reunião aconteceu), comparados com o período
anterior e respeitando o filtro de funil. Os blocos que saem da tela continuam na aba
Detalhado (S4-02).

## Pronto quando

Na Visão geral em "Últimos 7 dias", aparecem os oito quadros na ordem da spec, com SQL e
Reunião realizada batendo com o CRM e com a aba Agenda, e o CRM fora do ar só esvazia MQLs e
SQL.

## Critérios de aceite

- **CA-S4-01** (automática) — A Visão geral mostra a manchete, o funil da reunião e a lateral. Dado o dash aberto na Visão geral, quando a tela termina de carregar, então abaixo da manchete aparece o funil Leads novos → MQL → SQL → Reunião agendada → Reunião realizada, nesta ordem, com a lateral Investimento em ads, Leads e CPL, e não aparecem conversão geral, visitantes, receita, ROAS, gráfico diário, LPs, metas nem funil da agenda (ajuste de 26/10; antes eram oito quadros em linha).
- **CA-S4-02** (automática) — SQL conta os leads novos com o campo de SQL preenchido no CRM. Dado três leads novos no período, dois com o campo "🏆 SQL" (emoji ✅) preenchido e um sem, e um lead antigo (card de antes do período) com o campo preenchido, quando a Visão geral calcula o período, então o quadro SQL mostra 2.
- **CA-S4-03** (automática) — MQLs conta só os leads novos. Dado no período um lead novo com faturamento de R$ 50 mil, um lead novo com R$ 10 mil e um lead antigo que voltou com R$ 80 mil, quando a Visão geral calcula o período, então o quadro MQLs mostra 1.
- **CA-S4-04** (automática) — Reunião realizada soma agenda própria e Calendly. Dado no período uma reunião da agenda própria com presença Realizada, uma com Faltou, uma consultoria do Calendly marcada como Realizada no dash e uma do Calendly sem presença, quando a Visão geral calcula o período, então o quadro Reunião realizada mostra 2.
- **CA-S4-05** (automática) — Números comparados com o período anterior. Dado 10 leads no período escolhido e 8 no período anterior de mesmo tamanho, quando a Visão geral abre, então o quadro Leads mostra 10 e a variação de +25% em relação ao período anterior, e os outros sete quadros mostram a comparação do mesmo jeito.
- **CA-S4-06** (automática) — Filtro de funil vale para todos os quadros. Dado leads, MQLs, SQLs e reuniões em dois funis diferentes no período, quando a usuária escolhe um dos funis no filtro do topo, então cada quadro mostra só os números daquele funil.
- **CA-S4-07** (automática) — CRM fora do ar não derruba a tela. Dado o CRM sem responder, quando a Visão geral abre, então os quadros MQLs e SQL mostram "sem dados do CRM", e Leads, Leads novos, CPL, CPL lead novo, Reunião agendada e Reunião realizada aparecem com os números.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S4-01 | SQL é o campo checkbox "🏆 SQL" da lista de leads do ClickUp. Existe também um campo emoji com o mesmo nome, que fica de fora. | invalidada | Vale o campo emoji "🏆 SQL" (id b68130e0-204c-417f-b554-3b9f3782b941), não o checkbox (usuária, 26/10/2026) |
| SUP-S4-02 | SQL conta só leads novos do período (como MQL), lido do estado atual do card no momento da consulta. | confirmada | Usuária, 26/10/2026 |
| SUP-S4-03 | Reunião realizada conta pela data da reunião (não pela data em que agendou), e o Calendly só entra a partir de 19/10/2026, quando a presença passou a ser marcada no dash. | confirmada | Conta na data em que a reunião foi realizada (usuária, 26/10/2026) |
| SUP-S4-06 | Todos os números continuam comparados com o período anterior de mesmo tamanho, como hoje. | confirmada | Usuária, 26/10/2026 |
| SUP-S4-07 | A manchete em frase ("X leads nos últimos 7 dias…") sai da Visão geral e vai para a aba Detalhado. | invalidada | A manchete fica na Visão geral (usuária, 26/10/2026); a aba Detalhado também a tem, por ser cópia da tela antiga |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S4-01 | O que conta como SQL? | respondida | Checkbox no CRM ClickUp (usuária, 26/10/2026); campo confirmado depois: emoji "🏆 SQL" b68130e0-204c-417f-b554-3b9f3782b941 |

## Cenários

### Happy Path
1. A usuária abre a Visão geral ("Últimos 7 dias", todos os funis).
2. A tela desenha a manchete e os oito quadros com os números de leads, CPL e reuniões (mesmas fontes da tela antiga: `/api/leads`, `/api/cpl`, `/api/attribution`); MQLs e SQL aparecem "carregando…" até o CRM responder (`/api/agenda/taxas`, que já lê o CRM uma vez por período) e então ganham o número.
3. Cada quadro mostra carimbo e balão contra o período anterior.
4. Com um funil no filtro, cada quadro usa só o número daquele funil (`por_funil` das respostas).

### Edge Cases
- Lead que voltou (card criado antes do período) não entra em MQL nem em SQL: os dois contam só os cards criados no período, os mesmos dos leads novos.
- Campo "🏆 SQL" com 0 ou vazio não conta.
- Reunião do Calendly só conta como realizada com presença "Realizada" marcada no dash, a partir de 19/10/2026.
- Funil sem reunião no período: Reunião agendada e realizada mostram 0.

### Cenário de Erro
- CRM fora do ar (`crm_lido: false` ou `/api/agenda/taxas` falhou): MQLs e SQL mostram "sem dados do CRM"; os outros seis quadros aparecem normalmente.
- `/api/cpl` falhou: Leads novos, CPL lead novo e reuniões ficam "—", como na tela antiga.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S4-01 | automática | `tests/visao-reuniao.test.js` | a tela desenha manchete e exatamente os oito quadros na ordem pedida, sem os blocos antigos |
| CA-S4-02 | automática | `tests/visao-reuniao.test.js` | com 2 de 3 leads novos com o campo SQL preenchido e um card antigo marcado, SQL = 2 |
| CA-S4-03 | automática | `tests/visao-reuniao.test.js` | com um lead novo de R$ 50 mil, um de R$ 10 mil e um antigo de R$ 80 mil, MQLs = 1 |
| CA-S4-04 | automática | `tests/visao-reuniao.test.js` | agenda própria Realizada + Calendly Realizada contam; Faltou e Calendly sem presença não; Reunião realizada = 2 |
| CA-S4-05 | automática | `tests/visao-reuniao.test.js` | 10 leads contra 8 mostram 10 e +25%, e os oito quadros têm comparação |
| CA-S4-06 | automática | `tests/visao-reuniao.test.js` | com o filtro num funil, cada quadro usa só os números dele |
| CA-S4-07 | automática | `tests/visao-reuniao.test.js` | CRM fora do ar: MQLs e SQL com "sem dados do CRM", os outros seis com número |

## Banco de Dados

Sem mudança de tabela. Lê `calendly_consultorias.presenca` (migration 0066) e `agenda_reunioes.situacao`.

## Arquivos

- **Modificar:** `functions/api/_feedback-marketing-mql.js` — `CAMPO_SQL` (emoji "🏆 SQL", id `b68130e0-204c-417f-b554-3b9f3782b941`) e `ehSql(card)`, ao lado de `ehMql`, lendo com `lerCampo`.
- **Modificar:** `functions/api/feedback-marketing.js` — opção `contarSql` em `montarFeedback`: cada bloco de lead ganha `sqls` (cards do bloco com `ehSql`). O endpoint do relatório não liga.
- **Modificar:** `functions/api/agenda/taxas.js` — `lerCrm` pede `contarSql` e guarda `sqls` por funil; cada recorte da resposta ganha `crm` (`{ funil: { leads_novos, mqls, sqls } }`) e `crm_total`.
- **Modificar:** `functions/api/_reunioes-agendadas.js` — `reunioesRealizadas(DB, de, ate)`: agenda própria com situação realizada + consultorias do Calendly com presença realizada (desde `CORTE_CALENDLY`), pela data da reunião, funil por `funisDasReunioes`.
- **Modificar:** `functions/api/cpl.js` — `reunioes.realizadas` passa a vir de `reunioesRealizadas` (some a consulta só da agenda própria).
- **Modificar:** `public/dash/visao-reuniao.js` — `montarNumeros(respostas, fSel)` (escolhe total ou funil e monta `numeros`/`manchete`/`crm_lido` a partir das respostas, sem conta nova) e o protótipo sai.
- **Modificar:** `public/dash/index.html` — `R.visao` busca `/api/leads`, `/api/cpl`, `/api/attribution` (atual e anterior) e `/api/agenda/taxas`, desenha em duas etapas (sem CRM e com CRM); some o modo `proto=1` (`visaoProto`).
- **Criar:** `tests/visao-reuniao.test.js` — testes CA-S4-01 a 07 (SQLite real + CRM simulado + desenho do `visao-reuniao.js` com contexto falso).

Reaproveitados: `ehMql`/`lerCampo`, `montarFeedback`, `lerCrm`, `funisDasReunioes`, `CORTE_CALENDLY`, `tile`/`comparar`/`delta` do index.

## Dependências Externas

Nenhuma.

## Checklist

- [x] `ehSql` e `sqls` no relatório (opção `contarSql`)
- [x] `crm` e `crm_total` na resposta de `/api/agenda/taxas`
- [x] `reunioesRealizadas` com Calendly, usada no `/api/cpl`
- [x] `montarNumeros` + `R.visao` real em duas etapas; protótipo removido
- [x] Testes CA-S4-01 a 07
- [x] Conferir no navegador com dados reais
