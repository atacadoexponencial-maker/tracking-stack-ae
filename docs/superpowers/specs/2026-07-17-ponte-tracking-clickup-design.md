# Ponte Tracking ↔ ClickUp — Design

**Data:** 2026-07-17
**Status:** aprovada em conversa — aguardando revisão da spec

## Objetivo

Correlacionar cada lead do tracking com sua tarefa no ClickUp (🤑 CRM, lista 205126080)
e fechar o ciclo comercial: saber se o lead virou tarefa nova ou é retornante, em que
estágio está, e transformar "contrato assinado" em receita real no dash + conversão na Meta.

## Contexto (descobertas de 2026-07-17)

- O tracker já cria tarefas direto na API do ClickUp com dedup (busca por tel/email →
  cria nova OU comenta na existente), mas **joga fora o resultado** — não sabemos qual
  tarefa um lead virou, nem se foi criação ou retorno.
- A tarefa já nasce com UTMs origem/mídia/conteúdo + funil/produto/cargo (spec 2026-07-02);
  **falta utm_campaign** e um link para a jornada.
- O funil `workshop` aponta para o workflow n8n "LP Workshop Pago", que está **desativado**
  → leads de workshop se perdem (2 pessoas só ontem).
- CRM Supabase: fan-out continua como está; **não** é alvo desta ponte (não usado ainda).
- Divergência que motivou tudo: tracking registrou 10 pessoas ontem; o CRM "mostrou" 5
  (dedup invisível + workshop no buraco + testes).

## Decisões

| Decisão | Escolha |
|---|---|
| CRM fonte da verdade | **ClickUp** (🤑 CRM 205126080); Supabase intocado |
| Valor da venda | Campo existente **"💰 Arrecadado"** (currency BRL, id `85ef1a33-01f7-4ea4-9f24-f742b660a04e`), preenchido pelo comercial ao fechar |
| Sincronização de status | **Webhook oficial do ClickUp** (push, assinado) — sem polling, sem n8n |
| Registro de venda | Reusa o pipeline de compras existente (`purchase_log` + webhook/_core) — ClickUp vira "mais um gateway", e Receita/ROAS acendem no dash sem código novo de leitura |
| Workshop | Migra para o caminho direto do ClickUp (remove exceção no tracker) |

## As 5 peças

### 1. Vínculo lead → tarefa (`lead_dispatch`)
- Migração D1 (tracking): tabela `lead_dispatch` — event_id do lead, email, telefone,
  resultado (`criado` | `comentado` | `falha`), task_id, task_url, erro, criado_em.
- `sendToClickUp` grava a linha (ele já sabe o resultado; hoje descarta).
- **Novos × retornando** = `criado` × `comentado` por período/funil/origem.
- Dash: modal do lead ganha bloco "CRM" (link da tarefa, novo/retorno, falha);
  KPI "Novos × Retornando" na seção Leads.

### 2. Estágio comercial de volta (webhook)
- Endpoint novo `functions/webhook/clickup.js` (POST): valida assinatura HMAC do
  ClickUp (`X-Signature`), processa `taskStatusUpdated`.
- Tabela `crm_status_log` (task_id, status_novo, quando) + visão do estágio atual
  por tarefa.
- Webhook criado via API do ClickUp (team → webhook, filtrado na lista 205126080),
  apontando para `https://atacadoexponencial.com/webhook/clickup`.
- Dash: estágio atual no modal do lead + **funil comercial por origem/campanha**
  (novo endpoint `/api/crm-funnel`: leads → estágios, cruzando lead_dispatch × crm_status_log).

### 3. Venda fecha o ciclo
- No webhook, status novo = "contrato assinado" → GET task → lê campo
  "💰 Arrecadado" → registra em `purchase_log` via pipeline existente
  (`transaction_id = clickup:<task_id>` garante dedup; product = "Contrato <funil/produto>")
  → dispara Meta CAPI Purchase (mesmo fluxo dos webhooks Hotmart/Kiwify/Eduzz,
  com email/telefone do lead para match).
- Efeito imediato: tiles Receita/ROAS do /dash novo saem do "—" e passam a
  mostrar valores reais; Meta otimiza para compradores.
- Sem valor preenchido → registra com valor 0 + aviso no dash (linha destacada),
  para o comercial corrigir e o webhook reprocessar na próxima mudança.

### 4. Enriquecimento da tarefa
- Campo existente **"utm_campaing"** (sic — nome com typo na lista; id
  `78b59aa4-6e98-4555-bbbf-5a0259309eb0`) passa a ser preenchido junto com os demais.
- Descrição da tarefa ganha link "Ver jornada completa" →
  `https://atacadoexponencial.com/dash/#jornada` (seção Jornada aceita `?email=` pré-preenchido — ajuste pequeno no dash).

### 5. Workshop no caminho direto
- Remove a exceção `leadFunnel === 'workshop'` no tracker → `sendToClickUp` para todos.
- Opção existente **"WORKSHOP"** no dropdown 🔻 Funil (id
  `b5e04cdb-f62d-4159-b89b-751726a61831`) mapeada no `mapFunnelToOption`.
- `LEAD_WEBHOOK_URL_WORKSHOP` deixa de ser usado (env pode ser removida depois).

## Passos manuais

**Nenhum.** Os três campos já existiam na lista; IDs confirmados via API em 2026-07-17:
💰 Arrecadado `85ef1a33…`, utm_campaing `78b59aa4…`, opção WORKSHOP `b5e04cdb…`.

## Tratamento de erros

- Webhook com assinatura inválida → 401, nada gravado.
- Falha ao gravar lead_dispatch nunca afeta a resposta do /tracker (waitUntil, best-effort).
- Reprocessamento: mesma tarefa mudando de status repetidas vezes não duplica venda
  (unique em transaction_id) — atualiza valor se mudou.

## Validação

1. Lead de teste ponta a ponta: form → tarefa criada → lead_dispatch com task_id → modal do dash mostra o vínculo.
2. Segundo envio do mesmo lead → `comentado` → contadores novos×retornando conferem.
3. Mover tarefa de teste para "contrato assinado" com valor preenchido → purchase_log + Receita no dash + evento na Meta (Events Manager test).
4. Lead de workshop de teste → tarefa criada (buraco fechado).

## Fora de escopo

- CRM Supabase (fan-out permanece como está)
- Estatísticas históricas retroativas de novos×retornando (começa a contar do deploy)
- Alterações no painel de clientes (projeto separado)
