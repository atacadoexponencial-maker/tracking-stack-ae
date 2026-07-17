# Redesign do Dash de Tracking (/dash) — Design

**Data:** 2026-07-17
**Status:** aprovada em conversa — aguardando revisão da spec

## Objetivo

Reconstruir o dashboard interno de tracking (`atacadoexponencial.com/dash`) no mesmo
padrão visual e estrutural do painel de clientes (aprovado e elogiado pela usuária):
menu lateral por seções, seletor de período com comparação (deltas ▲▼), tiles de KPI
com hierarquia e tabelas ordenáveis, identidade Satoshi/escuro.

## Decisões tomadas

| Decisão | Escolha |
|---|---|
| Direção | Mesma estrutura do painel de clientes (sidebar + período + deltas + tabelas ordenáveis) |
| Seções | Proposta padrão + seção Meta Ads (ad_spend) |
| KPIs-herói (Visão geral) | **Leads, Conversão geral, CPL** (investimento ÷ leads) |
| Receita/ROAS | Tiles já presentes no layout, exibem "—" até o CRM (Supabase) enviar conversões offline — quando ligar, acendem sozinhos |
| APIs de produção | **Existentes intocadas.** Deltas = duas chamadas por seção (período atual + anterior, via `from`/`to` unix que as APIs já aceitam). Única adição: novo endpoint de leitura `GET /api/ad-spend?key=&from=&to=` (quebra por campanha da tabela ad_spend, mesmo gate DASH_KEY) |
| Auth | Mecanismo atual mantido: `?key=<DASH_KEY>` em toda chamada (a chave fica no localStorage como hoje) |
| URL | Mesma: `/dash` — `public/dash/index.html` é substituído |

## Estrutura (sidebar)

| Seção | Conteúdo | APIs |
|---|---|---|
| Visão geral | 3 tiles-herói (Leads, Conversão geral, CPL) + tiles normais (Receita —, ROAS —, Sessões, Investimento) + gráfico de leads por dia + resumo por LP | leads, conversion, revenue, ad-spend (via attribution/revenue existentes) |
| Leads | Conversão por LP (filtro de funil como hoje), leads por dia, tabela de leads recentes (ordenável) | conversion, leads |
| Vendas | Compras registradas, produtos — pronto para o CRM ligar | purchases, revenue, products |
| Atribuição | UTM breakdown (ordenável), primeiro/último toque | utm-breakdown, attribution |
| Meta Ads | Tiles: Investimento, CPL geral, CPA, ROAS (agregados que o attribution já entrega) + tabela por campanha (gasto, impressões, cliques, CPC, CPM) | attribution + **novo** `GET /api/ad-spend` |
| Jornada | Busca de lead + timeline (funcionalidade atual preservada) | lead-journey |
| Eventos | Feed de eventos recentes | events |

## Componentes (reuso do painel)

- CSS: portar `painel/src/styles/dash.css` (tokens AE, tiles, tabelas, gráfico, funil não necessário) para `public/dash/` adaptado
- JS: mesmos padrões — `tabela()` ordenável, `kpiTile()`, `deltaChip()` (invertido para métricas de custo: CPL, Investimento), `grafico()` SVG com tooltip
- Período: mesmo seletor do painel; comparação = intervalo anterior de mesma duração
- Deltas: front chama cada API 2× (`from/to` atual e anterior) e calcula a variação — matemática de apresentação; agregação continua toda no backend

## Tratamento de erros

- `key` ausente/errada → modal pedindo a chave (comportamento atual preservado)
- API que falhar → aviso "não foi possível carregar" só naquela seção; demais seguem
- Tile sem dado (Receita/ROAS sem CRM) → "—" com rótulo normal, sem quebrar layout

## Testes / validação

- Comparar os números do dash novo com o antigo no mesmo período (leads, conversão por LP, UTMs) antes de substituir
- Verificar visualmente todas as seções em produção (Playwright), incluindo filtro de funil e busca de jornada
- Confirmar que nenhuma API foi modificada (`git diff` vazio em `functions/`)

## Fora de escopo

- Ponte CRM→tracking (conversões offline) — projeto próprio, já no radar
- Modificar endpoints existentes ou mover cálculo de delta para o backend
- Alterar o painel de clientes

## Evolução futura registrada

- Quando a ponte CRM→tracking existir, Receita e ROAS passam a exibir valores reais
  sem mudança de layout (só os tiles deixam de mostrar "—").
