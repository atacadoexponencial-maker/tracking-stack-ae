# Design — Dashboard com abas (Leads em foco, Vendas disponível)

**Data:** 2026-06-26
**Status:** Aprovado (aguardando revisão final do spec)

## Objetivo

Reorientar o dashboard de leads (`public/dash/index.html`) para que o **foco seja leads**, sem perder os dados de venda direta. Hoje o dash é majoritariamente de venda (receita, vendas, produtos, atribuição/ROAS, compras). A operação passou a focar em leads (funis de live/WhatsApp), então a venda direta deve sair da visão principal — mas continuar **acessível**, não removida.

## Contexto atual

- Dash é um único arquivo estático: `public/dash/index.html` (HTML + JS inline, Chart.js, Tailwind). Servido pelo Cloudflare Pages.
- Dados vêm de endpoints existentes (`/api/leads` etc.). Autenticação por `DASH_KEY`.
- Seções de hoje:
  - **KPIs:** Receita bruta · Vendas · Ticket médio · **Leads**
  - **Venda:** Receita ao longo do tempo · Produtos + Vendas por produto · Atribuição (Meta/Google/Orgânico, ROAS, CPA) · UTM (vendas/receita) · Compras recentes
  - **Lead:** Leads recentes (tabela) + filtro de funil (`&funnel=`)
  - **Infra:** Saúde do tracking (eventos reais, ITP, adblock, bots)
- `sessions.funnel` agora é populado a cada Lead (ver [[feature-barramento-leads-whatsapp]] / fix `d002b92`). `/api/leads` já devolve a lista de funis distintos (`funnels`).

## Arquitetura

Mudança **100% frontend** no `public/dash/index.html`, **mais uma adição pequena de backend** em `functions/api/leads.js` (contagem de leads por funil). Nenhuma seção/endpoint de venda é removido — só sai da visão padrão.

### Abas (Leads | Vendas)

- Controle de abas no topo, logo abaixo do header de período. Padrão: **Leads**.
- Trocar de aba **mostra/esconde** blocos no cliente. Os dados das duas abas continuam carregando como hoje (sem mudança de fetch / sem lazy-load nesta fase).

### Aba Leads (padrão)

- KPI **Leads** em destaque.
- 🆕 **Leads por funil** (bloco no topo): cards/mini-tabela, uma linha por funil com a contagem no período.
- **Filtro de funil** (já existe) — afeta esta aba (KPI Leads + tabela).
- **Leads recentes** (tabela existente).
- **Saúde do tracking** (infra; fica na aba padrão por ser a mais visível).

### Aba Vendas (guarda tudo de venda)

- KPIs: Receita bruta · Vendas · Ticket médio.
- Receita ao longo do tempo.
- Produtos + Vendas por produto.
- Atribuição (Meta/Google/Orgânico, ROAS, CPA).
- UTM (vendas/receita).
- Compras recentes.

### Controles globais

- **Período (datas):** continua valendo para as duas abas (comportamento atual).
- **Seletor de funil:** aparece na aba Leads (só afeta leads).

## Componente novo — "Leads por funil"

### Backend (`functions/api/leads.js`)

Estende a resposta JSON com `funnelCounts`: `COUNT(*)` de eventos `Lead` agrupado por `s.funnel`, no período pedido, bots excluídos. Reusa o padrão da query `funnels` (distinct) que já existe no arquivo. A regra de contagem fica no backend (thin client).

- Respeita o **filtro de datas** (`since`/`until`, igual às outras queries).
- **Ignora** o filtro de funil (`&funnel=`) — o objetivo é a distribuição entre todos os funis, não só o selecionado.
- Inclui leads **sem funil** como bucket `''` → o frontend rotula como **"(sem funil)"**, para a soma fechar com o KPI total e mostrar quantos leads antigos (pré-fix) ainda caem no período.
- Formato: `funnelCounts: [{ funnel: 'lives-semanais-v1', count: 42 }, ...]`, ordenado por contagem desc.

### Frontend (`public/dash/index.html`)

Renderiza `data.funnelCounts` num bloco no topo da aba Leads (cards ou mini-tabela). Thin client: só exibe o que o backend mandou; sem regra de negócio.

## Fluxo de dados

1. Dash carrega → fetch dos endpoints (como hoje) → `/api/leads` agora também devolve `funnelCounts`.
2. Aba ativa (Leads por padrão) controla quais blocos ficam visíveis; troca de aba é só CSS/JS (sem novo fetch).
3. Trocar período recarrega os dados (como hoje); `funnelCounts` reflete o novo período.

## Tratamento de erro / regressão

- Se `funnelCounts` vier ausente/vazio (ex.: deploy do backend ainda não publicado): o bloco "Leads por funil" mostra estado vazio, sem quebrar o resto do dash.
- Abas: estado inicial sempre "Leads"; se o JS de abas falhar, o conteúdo não some (degrada para tudo visível, não para tela branca).
- Autenticação por `DASH_KEY` inalterada.

## Fora de escopo (evolução futura)

- Métricas de lead mais ricas: custo por lead (CPL), evolução de inscrições no tempo, coortes por edição da live, jornada multi-toque ([[ideia-jornada-multitoque-lead]]).
- Lazy-load dos dados de venda só quando a aba Vendas é aberta (otimização).
- Remoção definitiva da venda direta (decisão foi **manter disponível**, não remover).

## Critérios de sucesso

1. Dash abre na aba **Leads** por padrão; venda não aparece até clicar em "Vendas".
2. Aba Leads mostra: KPI Leads, **Leads por funil** (contagem por funil no período), filtro de funil, Leads recentes, Saúde.
3. Aba Vendas reúne todas as seções de venda, funcionando como hoje.
4. `funnelCounts` respeita o período, ignora o filtro de funil e inclui "(sem funil)".
5. Nenhuma seção/endpoint de venda é removido; nada quebra na troca de abas.
