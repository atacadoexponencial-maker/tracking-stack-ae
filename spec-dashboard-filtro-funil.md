# Spec: Filtro de funil no dashboard de leads (Fase 0 — Live semanal)

## Visão Geral

**O que faz:** adiciona ao dashboard de leads já existente (`public/dash/index.html`,
seção "Leads recentes" + KPI "Leads") a capacidade de **segmentar/filtrar os leads por
funil**, para que a operação consiga enxergar isoladamente as inscrições da live semanal
(funil `lives-semanais-v1`) sem que elas fiquem misturadas com os leads do diagnóstico,
do workshop e da calculadora.

**Para quem:** a usuária/operação que acompanha as inscrições da live e precisa responder
"quantas inscrições a live teve nesta semana?" sem exportar dados nem contar à mão.

**Problema que resolve:** hoje o dashboard mostra todos os leads juntos. Cada funil envia
um identificador próprio (`body.lead_data.funnel`) ao CRM, mas o dashboard não consegue
filtrar por ele. A live é só mais um nome na lista; não dá para ver a contagem isolada.

**Escopo Fase 0 (mínimo):** apenas (a) um seletor de funil no topo do dashboard, (b) a
lista "Leads recentes" e o KPI "Leads" passando a respeitar esse filtro combinado com o
filtro de datas já existente. Nada além disso.

### Restrição de arquitetura — fonte do filtro de funil (decisão central)

O dado "funil" precisa existir de forma consultável no backend para o `/api/leads` poder
filtrar. Hoje ele **não** está persistido. Duas opções:

- **Opção A — derivar de `sessions.landing_url` (sem migração).**
  `/api/leads` (que já faz `event_log LEFT JOIN sessions` e já retorna `s.landing_url`)
  ganha um parâmetro `funnel`. Quando presente, filtra por
  `sessions.landing_url LIKE '%/lives-semanais-v1%'` (mapa slug→funil no backend).
  - Prós: zero mudança de schema; funciona **retroativamente** para todos os leads já
    capturados (a live já está no ar e gravando `landing_url`); entrega valor imediato,
    objetivo da Fase 0.
  - Contras: acoplado ao slug da URL; se a página mudar de slug, ou se o mesmo funil
    tiver várias páginas, o filtro quebra ou dispersa. Não é a fonte canônica de verdade
    (o `body.lead_data.funnel` é).

- **Opção B — coluna `funnel` no `event_log` (com migração D1).**
  Nova migração `ALTER TABLE event_log ADD COLUMN funnel TEXT`, `tracker.js` passa a
  gravar `body.lead_data.funnel` no INSERT do `event_log`, e `/api/leads` filtra por
  `e.funnel = ?`.
  - Prós: fonte de verdade canônica, à prova de mudança de slug, alinhada ao identificador
    que já é enviado ao CRM por cada funil.
  - Contras: exige migração + alteração no `tracker.js`; o dado só passa a existir **dali
    pra frente** — todos os leads antigos ficam com `funnel = NULL` e exigiriam backfill
    (derivando justamente de `landing_url`) para não sumirem do filtro.

**Recomendação (Fase 0): Opção A.** A live já está no ar e o middleware já grava a URL
completa em `sessions.landing_url`, então a Opção A entrega o filtro **funcionando para os
leads que já existem**, sem migração e sem tocar no caminho crítico de captura
(`tracker.js`). A Opção B fica registrada como evolução natural: quando houver mais de uma
página por funil ou risco de troca de slug, adota-se a coluna `funnel` no `event_log` (com
backfill via `landing_url` para os registros antigos). O mapeamento slug→funil deve viver
no backend (`/api/leads`), nunca no frontend, mantendo o thin client.

---

## Páginas / Módulos

### Módulo: Endpoint `/api/leads` (backend) — novo parâmetro `funnel`

**Descrição:** o endpoint que já devolve os leads (`event_log LEFT JOIN sessions`, com
`key`/`days`/`from`/`to`/`limit`/`include_bots`) passa a aceitar um parâmetro opcional
`funnel`. Quando informado, restringe os leads e a contagem ao funil pedido, derivando-o
de `sessions.landing_url` (Opção A). Continua sendo a única peça com a regra de negócio
(mapa funil→slug); o frontend só envia o nome do funil.

**Componentes:**
- Parâmetro `funnel` (querystring): nome do funil pedido (ex.: `lives-semanais-v1`). Ausente ou vazio = todos os funis (comportamento atual inalterado).
- Mapa funil→critério (no backend): traduz o nome do funil para o critério em `landing_url` (ex.: `lives-semanais-v1` → `landing_url LIKE '%/lives-semanais-v1%'`).
- Cláusula de filtro aplicada tanto na query de linhas quanto na de contagem do período, junto às cláusulas de período/bot já existentes.
- Lista de funis disponíveis: valores que o seletor do frontend pode oferecer (ver módulo abaixo).

**Comportamentos:**
- Receber `funnel` válido e conhecido: retornar apenas leads cuja sessão de origem casa com o critério daquele funil, dentro do período/bot já aplicados.
- Receber `funnel` ausente/vazio: retornar todos os leads (comportamento atual, sem regressão).
- Receber `funnel` desconhecido (sem mapeamento): retornar conjunto vazio de leads para aquele filtro (não derrubar a request, não cair para "todos").
- Aplicar o filtro de funil em conjunto (AND) com o período (`days` ou `from`/`to`) e com o filtro de bots já existentes.
- Manter a autorização por `key`/`DASH_KEY` inalterada (regra continua no backend).
- A contagem de leads do período retornada/derivada deve refletir o mesmo filtro de funil aplicado às linhas (contagem isolada por funil).

### Módulo: Dashboard de leads (`public/dash/index.html`) — seletor de funil

**Descrição:** o dashboard existente ganha um seletor de funil no cabeçalho (ao lado do
seletor de período já presente). A seção "Leads recentes" e o KPI "Leads" passam a refletir
o funil selecionado, combinado com o período. Thin client: o seletor apenas captura a
escolha e a repassa ao `/api/leads`; nenhuma regra de mapeamento no frontend.

**Componentes:**
- Seletor de funil (no `header`, junto ao `#range-picker`): lista de opções com **"Todos os funis"** como padrão, mais ao menos a opção **"Live semanal (`lives-semanais-v1`)"**.
- Estado do funil selecionado: incorporado à query enviada ao `/api/leads` (junto de `periodQuery` e `limit`), exatamente como o período já é hoje.
- KPI "Leads" (`#kpi-leads`): passa a contar apenas os leads do funil selecionado no período.
- Tabela "Leads recentes" (`#leads-tbody`): passa a listar apenas os leads do funil selecionado no período.
- Estado vazio da tabela: mensagem quando não há leads para o funil/período escolhidos.

**Comportamentos:**
- Selecionar um funil no seletor: recarregar a lista de leads e o KPI "Leads" filtrando por aquele funil, mantendo o período atual.
- Padrão "Todos os funis": ao abrir o dashboard, nenhum funil está filtrado e o comportamento é idêntico ao atual (sem regressão).
- Selecionar "Todos os funis" após ter filtrado: voltar a mostrar todos os leads do período.
- Combinar com o filtro de datas existente: trocar o período (7/30/90 dias ou intervalo personalizado) mantém o funil selecionado, e vice-versa; ambos os filtros aplicados juntos.
- Refletir a contagem isolada: o KPI "Leads" mostra a quantidade de leads **apenas daquele funil** no período (não o total geral).
- Estado vazio: quando não há leads do funil escolhido no período, exibir mensagem clara (ex.: "Nenhum lead deste funil no período.") em vez de tabela vazia/erro.
- Persistência leve (opcional, mesmo padrão do período): o funil selecionado pode ser refletido na sessão/URL de modo análogo ao período, mas não é requisito da Fase 0.
- A seleção de funil afeta **somente** "Leads recentes" e o KPI "Leads"; as demais seções (receita, produtos, atribuição, UTM, compras, saúde) permanecem inalteradas nesta fase.

---

## Fora de escopo (fases futuras)

- Métricas de show-up rate / comparecimento à live.
- Conversão pós-live (inscritos → compradores) e coortes por edição da live.
- Gráficos de evolução de inscrições por funil ao longo do tempo.
- Persistência canônica via coluna `funnel` no `event_log` + backfill (Opção B) — registrada acima como evolução, não implementada na Fase 0.
- Filtro de funil nas seções de compras/UTM/atribuição.
