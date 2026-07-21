# Design — Aba de Email no dashboard (stats por campanha do GHL)

**Data:** 2026-07-21
**Status:** aprovado no brainstorming, aguardando revisão do spec

## Contexto

O dashboard de tracking (`public/dash/index.html`) tem abas (Visão geral, Leads,
Vendas, Atribuição, Meta Ads, Jornada, Eventos). Falta visibilidade do email
marketing (GoHighLevel), hoje só olhável dentro do próprio GHL.

Verificado nesta sessão: a **API v3 do GHL** expõe estatística por campanha —
`GET /emails/locations/{loc}/campaigns/stats/email-campaigns/{sourceId}` (header
`Version: v3`, scope `emails/stats.readonly`), e o token atual (`TOKEN_GHL`) já
tem acesso. Retorna, por campanha: `sent, delivered, opened, clicked,
permanentFail, temporaryFail, unsubscribed, complained` + taxas. A lista vem de
`GET /emails/locations/{loc}/campaigns/emails` (scope `emails/campaigns.readonly`).

Esta é a **feature 3 de 3** (email/GHL). É viável porque trabalha com dados
**por campanha** (agregado). O detalhe "qual campanha um lead específico abriu"
(por-lead) NÃO é alcançável sem um Marketplace App (bloqueado — usuária não tem
conta de dev); isso fica fora de escopo.

## Objetivo

Uma aba "Email" no dash mostrando o desempenho por campanha (enviados, entregues,
aberturas, cliques, bounces), respeitando o filtro de data global, lendo de um
cache no D1 alimentado por um sync agendado — mesmo padrão do investimento do Meta
(`ad_spend`: cron da VPS → endpoint de sync → D1 → dash).

## Arquitetura (4 peças + 1 passo de ops)

### 1. Tabela `email_campaign_stats` (D1)

Snapshot por campanha; a chave `source_id` deduplica (upsert a cada sync).

- `source_id` TEXT PRIMARY KEY — o `sourceId` da campanha (usado no endpoint de stats)
- `campaign_id` TEXT — o `id` da campanha
- `name` TEXT, `subject` TEXT, `from_email` TEXT, `status` TEXT
- `sent_at` TEXT — ISO do `updatedAt` da campanha enviada (data de envio; é o campo
  usado pelo filtro de data)
- `sent`, `delivered`, `opened`, `clicked`, `bounced`, `unsubscribed`, `complained`,
  `failed` INTEGER — contagens cruas (bounced = permanentFail + temporaryFail)
- `synced_at` INTEGER — unix da última sincronização

Taxas NÃO são armazenadas — calculadas na leitura (abertura = opened/delivered, etc.),
pra manter o denominador transparente.

### 2. Endpoint de sync `/api/sync/ghl-email`

- Auth: header `x-sync-secret` = `env.SYNC_SECRET` (mesmo padrão de `meta-ads.js` e
  `crm-retry.js`).
- Usa `env.TOKEN_GHL` e `env.LOCAL_ID`.
- Lista campanhas com `status=sent` (v3, paginando), e pra cada uma chama o endpoint
  de stats; faz upsert na tabela.
- Único ponto que toca o GHL. Cuidado com rate limit (burst 100/10s): pausa curta a
  cada N campanhas se necessário.
- Responde `{ ok, sincronizadas: <n> }`.

### 3. Endpoint de leitura `/api/email-campaigns`

- Auth: `?key=` = `env.DASH_KEY` (igual aos demais endpoints do dash).
- Params: `from`/`to` (unix) — filtra `sent_at` no intervalo (mesmo helper de período
  dos outros endpoints). Sem from/to → últimos 30 dias.
- Lê só do D1 (rápido, sem tocar o GHL). Devolve array ordenado por `sent_at` desc, com
  contagens + taxas calculadas.

### 4. Aba "Email" no dash (`public/dash/index.html`)

- Link na nav + seção nova, no mesmo padrão das abas existentes (`R.email = async …`,
  espelhando `R.leads`).
- Tabela: **Campanha · Data · Enviados · Entregues · Abertura · Clique · Bounce**.
- Usa o período global já selecionado (o filtro que foi corrigido no início desta
  sessão). Reaproveita os componentes de tabela/formatadores já existentes.

### 5. Ops (passo da usuária)

Adicionar um cron na VPS que chama `POST/GET /api/sync/ghl-email` com o header
`x-sync-secret`, na mesma cadência do `ad_spend` (ex.: 6/6h). Comando documentado ao
final (espelha `docs/ad-spend-sync.md`).

## Cenários

### Happy Path
1. Cron da VPS chama `/api/sync/ghl-email` de 6/6h.
2. O sync lista as campanhas enviadas, puxa o stats de cada e faz upsert no D1.
3. Usuária abre a aba "Email" no dash → chama `/api/email-campaigns?key=&from=&to=`.
4. Dash renderiza a tabela por campanha, no período selecionado.

### Edge Cases
- **Nenhuma campanha no período:** tabela mostra "Sem campanhas no período."
- **`delivered = 0`:** taxa exibida como "—" (evita divisão por zero).
- **Campanha nova ainda não sincronizada:** aparece só após o próximo sync (aceitável;
  igual ao atraso do `ad_spend`).
- **Rate limit do GHL no sync:** pausa curta entre chamadas; o sync é idempotente
  (upsert), então re-rodar não duplica.

### Cenário de Erro
- **Sync sem `TOKEN_GHL`/`LOCAL_ID`:** loga `console.error` e responde erro; não quebra
  o dash (que lê do D1).
- **Stats de uma campanha falha (`!res.ok`):** loga e segue pras próximas — uma campanha
  não derruba o sync inteiro.
- **Leitura sem `DASH_KEY` válida:** 401 (igual aos outros endpoints).

## Banco de Dados

- Tabela nova: `email_campaign_stats` (ver estrutura acima). Migration nova
  (`migrations/0023_email_campaign_stats.sql`), aplicada no D1 remoto antes do deploy do
  código que a lê (lição das migrations anteriores).

## Arquivos

- **Criar:** `migrations/0023_email_campaign_stats.sql` — tabela + índice em `sent_at`.
- **Criar:** `functions/api/sync/ghl-email.js` — sync GHL → D1.
- **Criar:** `functions/api/email-campaigns.js` — leitura D1 → dash.
- **Modificar:** `public/dash/index.html` — aba "Email" (nav + seção + render).
- **Criar/atualizar:** `docs/ghl-email-sync.md` — comando do cron da VPS.

## Fora de escopo

- Detalhe por-lead ("qual campanha o lead X abriu") — precisa de Marketplace App.
- Melhorar entrega/abertura (a usuária disse que não é prioridade agora).
- Captura de eventos em tempo real por webhook (a sonda `/webhook/ghl-probe` é temporária
  e será removida).

## Como testar

1. Aplicar a migration no D1 remoto.
2. Chamar `/api/sync/ghl-email` com o `x-sync-secret` manualmente e conferir linhas na
   tabela (`SELECT count(*) FROM email_campaign_stats`).
3. Chamar `/api/email-campaigns?key=…&days=30` e conferir o JSON.
4. Abrir a aba "Email" no dash e conferir a tabela e o filtro de data.
