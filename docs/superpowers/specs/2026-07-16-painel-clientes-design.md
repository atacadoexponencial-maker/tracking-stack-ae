# Painel de Clientes da Agência — Design (em construção)

**Data:** 2026-07-16
**Status:** aprovada — piloto com 1 cliente (UP Semijoias)

## Objetivo

Substituir os relatórios de Looker Studio (Data Studio) por uma plataforma própria,
com a identidade visual do **Atacado Exponencial**, onde cada cliente acompanha seus resultados: Google Ads + Meta Ads + orgânico (GA4),
com metas mensais, acesso individual por cliente e **duplicação por cliente sem refazer conexões**.

Motivação: no Looker Studio a configuração é manual, as conexões quebram silenciosamente
(o painel de exemplo está com Meta Ads e Google Ads em "Não há dados") e duplicar por cliente
exige refazer fontes de dados uma a uma.

## Modelo de referência

Painel "QVestido | Painel do e-commerce" (Looker Studio, marca sete.), 8 páginas:

| Página | Conteúdo |
|---|---|
| Home | KPIs gerais (Receita Captada, Pedidos, Ticket, Tx Conversão, Sessões, Novos usuários) + Investimento/ROAS/CPA/CPS + tabelas Fontes de Receita (por canal) e Produtos |
| Funil | Sessões → Adições ao carrinho → Checkout → Pedidos, com % etapa a etapa e deltas |
| Receita | 3 colunas: Google Analytics (Receita, Pedidos, Ticket, Sessões, TxConv, ROAS) \| Meta Ads (CPM, CTR, CPC) \| Google Ads (Impressões, CPC, CPA) + Receita por dia |
| Conversão | KPIs de engajamento + tabelas Agrupamento de Canais e Origem/Mídia (usuários, novos, tx conv, pedidos, ticket, receita, com % Δ vs período anterior) |
| Produtos | Página GA4 (produtos por receita) |
| Meta | Metas de faturamento/investimento/taxa vs realizado, % atingimento, tabela de acompanhamento diário projetado (hoje alimentada por planilha) |
| Criativos | Tabela de criativos Meta Ads: imagem, nome, investimento, receita, pedidos, alcance, frequência, cliques, sessões, CTR |
| Navegação | Página GA4 (comportamento de navegação) |

Todos os elementos que exibem período mostram delta (▲▼ %) contra o período anterior.

## Decisões tomadas

| Decisão | Escolha |
|---|---|
| Escala | Poucos clientes hoje, crescendo — arquitetura deve prever crescimento |
| Conector de dados | **Windsor.ai** (já contratado; já puxa Google Ads, Meta Ads e GA4) |
| Camada visual | **Tela própria desde o início** (não usar Looker Studio nem na fase 1) |
| Consumo dos dados | **Banco próprio (D1)** — sync via cron salva resumos diários; dashboard lê do banco |
| Acesso do cliente | **Link secreto por cliente** (URL única não-listável, revogável) |
| Metas/planilha | **Cadastro de metas na própria plataforma** (formulário admin por cliente/mês); planilhas eliminadas do escopo; projeções calculadas automaticamente |
| Identidade visual | **Atacado Exponencial** (não a marca sete.) |
| Alertas de falha | **Só no painel admin** (status por conexão); sem notificação externa — Evolution/WhatsApp saiu da stack |
| Longo prazo | Fase 2 troca Windsor por APIs diretas (redução de custo), sem mexer no dashboard |

## Arquitetura

```
Google Ads ─┐
 Meta Ads ──┼─▶ Windsor ─▶ Sync (cron, 2-4x/dia) ─▶ Banco D1 ─▶ Dashboard do cliente
 GA4 ───────┘                      ▲                    ▲
                                   │                    └─ Painel admin (agência)
                     Fase 2: APIs diretas
                     substituem o Windsor aqui
```

- Volume estimado: ~60–100 linhas de resumo diário por cliente/dia (campanha × fonte);
  ~3 mil linhas/mês por cliente. 20 clientes × 5 anos ≈ 3,6 mi de linhas pequenas —
  folgado no limite de 10 GB do D1.
- Vantagens do banco próprio: dashboard instantâneo, histórico preservado mesmo se o
  Windsor for cancelado, e a fase 2 só troca quem alimenta o banco.

## Parte 1 — O que será construído

**Mesmo repositório** (tracking-avancado), em subpasta isolada `painel/` com app próprio —
decisão da usuária para manter tudo organizado num lugar só. No Cloudflare, um **segundo
projeto Pages** aponta para o mesmo repo com root directory = `painel/` e build watch paths,
garantindo builds, subdomínio (`painel.atacadoexponencial.com` — mesmo domínio do site, decisão confirmada) e banco D1 independentes
do site de produção. Mesma stack (Pages + Functions + D1 + Cron), custo ~zero.
As issues do painel vivem em `issues/74-*` a `issues/104-*` (prefixo `painel-`).

### 1. Sync (o robô)
- Cron 4x/dia (a cada 6h) puxa do endpoint JSON do Windsor os resumos diários de
  Google Ads, Meta Ads e GA4 de todas as contas conectadas e grava no D1
  (upsert dos últimos 3 dias para capturar ajustes retroativos de atribuição).
- Detecção de conexão quebrada (token expirado no Windsor / fonte sem dados):
  status vermelho no painel admin (decisão: sem notificação externa;
  Evolution/WhatsApp está saindo da stack).

### 2. Dashboard do cliente
- Espelha o modelo QVestido: Home, Funil, Receita, Conversão, Produtos, Metas, Criativos.
- Seletor de período + comparação com período anterior (deltas ▲▼).
- Visual com a identidade do Atacado Exponencial (não a da sete.).

### 3. Painel admin (só a agência)
- **Duplicação em 1 clique:** cadastrar cliente = nome + IDs das contas
  (conta Meta Ads, conta Google Ads, propriedade GA4) + metas do mês.
  O dashboard nasce pronto — a conexão é uma só (Windsor da agência);
  o que muda por cliente são os IDs.
- Cadastro/edição de metas mensais (faturamento, investimento, taxa projetada);
  projeção diária, % atingimento, CPS/pedidos projetados calculados pelo sistema.
- Gestão dos links secretos (gerar, revogar, regenerar).

### 4. Acesso do cliente
- Link secreto por cliente (ex.: `painel.atacadoexponencial.com/c/upsemijoias-x7k2m9`).
- Cliente enxerga apenas os próprios dados; link revogável no admin.

## Parte 2 — Requisitos e pendências (o que precisamos ter/verificar)

### Já temos ✅
- Windsor.ai contratado com Google Ads, Meta Ads e GA4 conectados
- Stack Cloudflare dominada (Pages, Functions, D1, cron) — mesma do tracking-avancado
- Modelo visual/métricas definido (painel QVestido)

> Nota: a Evolution API (WhatsApp na VPS) **não** será usada — está saindo da stack
> porque o WhatsApp derruba a conexão direto. Alertas precisarão de outro canal.

### Validação realizada em 2026-07-16 ✅

Windsor MCP conectado ao Claude Code e testado com a API key da conta
(seteadsagencia@gmail.com). Resultados:

- **Acesso à API confirmado** — leitura de dados funcionando nas 3 fontes.
- **Inventário de contas conectadas:**
  - Meta Ads (6): CA - Bruna Moura · Nara Design (Gabriela) · QVestido · Neffertari · Fabiola Molina - Oficial · Upbijuteria.com.br
  - Google Ads (4): Oficina da Costura · Sem Pelo Sem Dor · QVestido · ADRENALINA VIDROS
  - GA4 (7): QVestido Novo Site · Amorosa Fashion (Tray) · Kourus · Fabiola Molina (loja/GA4/Exterior) · Up Bijuteria
- **Histórico retroativo:** GA4 retornou dados de janeiro/2026 sem restrição —
  backfill de 6+ meses disponível (testar profundidade nas fontes de ads no plano).
- **Dados reais fluindo:** Meta Ads com gasto diário em 5 contas; Google Ads em 3 contas.
- ⚠️ **QVestido Meta Ads retorna vazio** (últimos 7 dias) — é exatamente a conexão
  "Não há dados" do painel Looker. Verificar no Windsor/Meta se a conta parou de
  veicular ou se a autorização caiu.
- ⚠️ **API reporta `is_paid: false` / sem plano** — conferir a assinatura do Windsor
  (pode ser só o endpoint que não expõe o plano, mas vale checar o billing para não
  descobrir um limite de dados/contas no meio do projeto).

### Precisamos verificar/obter 🔍
1. ~~API key do Windsor~~ ✅ **resolvido** — MCP oficial (`https://mcp.windsor.ai/`,
   `Authorization: Bearer <API key>`) conectado ao Claude Code; acesso validado nas
   3 fontes. Em produção o sync usa o endpoint JSON normal com a mesma chave;
   o MCP fica como ferramenta de desenvolvimento/validação.
2. **Limites do plano Windsor** — nº de contas incluídas e limite de requisições/dia
   (⚠️ reforçado: a API reporta `is_paid: false` — conferir billing).
3. **Backfill histórico** — GA4 confirmado com 6+ meses; falta testar a profundidade
   nas fontes de ads (Meta/Google).
4. ~~Domínio~~ ✅ **decidido** — subdomínio `painel.atacadoexponencial.com` (mesmo domínio
   do site, zona já no Cloudflare; criar o registro ao fazer o deploy).
5. **Contas por cliente** — inventário obtido via MCP (ver Validação acima); falta só
   confirmar o agrupamento cliente → contas (ex.: Fabiola Molina tem 3 propriedades GA4).
6. **Identidade visual** — logo/cores do **Atacado Exponencial** para o layout do dashboard
   (decisão: não usar a marca sete.).

### Fase 2 (futuro — redução de custo, sem pressa) 🔮
Trocar o Windsor por APIs diretas exige credenciais próprias:
- **Google Ads API:** developer token (pedido na conta MCC da agência; aprovação da
  Google leva dias/semanas) + OAuth. É o item mais burocrático — iniciar o pedido cedo.
- **Meta Marketing API:** app na Meta for Developers + permissão `ads_read`
  (App Review; ter Business Manager verificado ajuda).
- **GA4 Data API:** simples — service account com acesso às propriedades.

O dashboard e o banco não mudam na fase 2; apenas o sync passa a chamar as APIs diretas.

## Fora de escopo (por decisão)
- Planilhas como fonte de dados (substituídas pelo cadastro de metas na plataforma)
- Login com senha / magic link (acesso é por link secreto)
- Relatórios em PDF/e-mail automático (pode virar evolução futura)

## Parte 3 — Modelo de dados, falhas e validação

### Tabelas do banco (D1)

| Tabela | Guarda | Exemplo de linha |
|---|---|---|
| `clientes` | Cadastro de cada cliente + IDs das contas + slug do link secreto | QVestido · meta:act_123 · gads:456-789 · ga4:987 · slug:qvestido-x7k2m9 |
| `metas` | Metas mensais por cliente | QVestido · 2026-07 · faturamento R$ 80k · investimento R$ 8k · taxa 1,2% |
| `ads_diario` | Resumo diário por campanha (Meta e Google Ads) | 2026-07-15 · QVestido · meta · campanha X · gasto/impressões/cliques/conversões/receita |
| `criativos_diario` | Resumo diário por criativo (Meta Ads) | 2026-07-15 · QVestido · criativo Y · gasto/alcance/frequência/cliques/CTR/receita |
| `ga4_diario` | Resumo diário por canal e origem/mídia | 2026-07-15 · QVestido · google/organic · sessões/usuários/novos/pedidos/receita |
| `ga4_funil` | Etapas do funil por dia | 2026-07-15 · QVestido · sessões/carrinho/checkout/pedidos |
| `ga4_produtos` | Receita por produto por dia | 2026-07-15 · QVestido · "Vestido Chiffon" · receita/pedidos |
| `sync_log` | Cada execução do robô: o que puxou, quanto, erros | 2026-07-15 08:00 · QVestido · meta_ads · ok · 42 linhas |

Todos os números do dashboard (KPIs, deltas, ROAS, % de meta) são **calculados a partir
dessas tabelas** na hora da consulta — nada é digitado duas vezes.

### Tratamento de falhas
- O sync roda **por fonte e por cliente de forma independente** — se a conexão do Meta
  Ads de um cliente quebrar, o Google Ads e o GA4 dele (e todos os outros clientes)
  continuam atualizando normalmente.
- Cada conexão tem um status no admin: 🟢 ok · 🟡 sem dados novos há mais de 24h ·
  🔴 erro no último sync. Sem notificação externa (decisão).
- O dashboard do cliente **nunca mostra "Não há dados"** por falha de conexão: mostra os
  dados até a última data sincronizada, com um aviso discreto "atualizado até DD/MM".
- Falha em um ciclo não exige ação manual: o próximo ciclo do cron tenta de novo.

### Validação antes de liberar a clientes
1. Rodar o sync com backfill e conferir os números contra as plataformas nativas
   (Meta Ads Manager, interface do Google Ads e GA4) num período fechado —
   tolerância de pequenas diferenças de atribuição documentada.
2. **Piloto decidido: UP Semijoias** (Upbijuteria.com.br) — contas conectadas no Windsor:
   Meta Ads `628094463950329` (gasto diário ativo, ~R$ 900/dia nos testes) e
   GA4 `315016683` ("Up Bijuteria – GA4"). Sem conta Google Ads conectada — o
   dashboard deve tratar fonte ausente com naturalidade (seção some, não quebra).
   O sistema nasce multi-cliente (tabela `clientes` desde o início), mas só esse
   cliente é cadastrado por enquanto; duplicar = cadastrar o próximo no admin.

## Pendências de design
- Plano de implementação (via writing-plans/plan após aprovação desta spec)
