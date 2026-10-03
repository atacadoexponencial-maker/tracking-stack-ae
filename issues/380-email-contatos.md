# 380: Contatos de marketing

**Tipo:** Implementação
**Página:** Dash › E-mail › Contatos (spec `spec-email-proprio.md`, módulo 4)

## Descrição

Base de contatos vinda dos leads do tracking: primeira carga dos leads existentes, entrada automática de lead novo, um contato por e-mail, endereço inválido marcado, situação atualizada pelos resultados (descadastrou, voltou, denunciou), descadastro manual, reativação só de "voltou". Lista com busca, filtros e detalhe com histórico de e-mails.

## Pronto quando

A usuária abre Contatos e vê os leads do tracking; um lead novo de teste aparece sozinho; buscar e filtrar funcionam; o detalhe mostra o e-mail de teste recebido; descadastrar manualmente muda a situação.

> **Decisão da usuária (03/10):** o tracking não guardava o nome do lead no banco (só e-mail, funil e origem). Ela escolheu **gravar o contato no `functions/tracker.js`**, com o nome, na hora em que o lead chega. É uma linha a mais no caminho do Lead, em segundo plano, sem mexer no envio ao GHL, ClickUp, ManyChat nem no resto do fan-out. Os leads antigos pegam o nome do card do ClickUp.

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Onde está o lead:** `event_log` com `event_name = 'Lead'`: `raw_email`, `funnel`, `material`, `is_bot`, `is_junk`, `event_id`, `session_id`. A sessão (`sessions`) tem `utm_source` e `utm_campaign`. Hoje: 532 leads com e-mail, 480 e-mails diferentes (sem robô e sem teste). O nome não fica no D1: vai só para ClickUp, GHL e ManyChat (`leadData.nome` no `tracker.js`).
- **Origem do contato:** `canalDeLead()` de `functions/api/_canal.js` (meta-ads, bio, manychat, email, outro, direto), a mesma regra de canal do dash.
- **Robô e bloqueado:** `isBot` já calculado no `tracker.js`; lead bloqueado vai para `leads_bloqueados` e não segue para destino nenhum. Na carga dos antigos: `is_bot = 0`, fora de `leads_bloqueados`, e `clausulasBotIpSql('s')` de `functions/_bots.js` (mesma limpeza da aba Leads).
- **Nome dos leads antigos:** `lead_dispatch.task_id` (ponte com o ClickUp) + `clickupFetch()` e `CU_FIELD.nome` de `functions/api/_clickup.js`. 84% dos e-mails antigos têm card.
- **Validação de e-mail:** `emailValido()` de `functions/api/_email-config.js`.
- **Resultados do Postmark:** `functions/api/webhooks/postmark.js` já grava `voltou`, `spam` e `descadastrou` por envio; falta levar ao contato (pelo `destinatario` do envio).
- **Histórico de e-mails:** `email_envios` (teste, agenda e, depois, campanhas) por `destinatario`.
- **Rodada periódica:** padrão de `functions/api/sync/email-agenda.js` (379) + script e cron na VPS.
- **Cursor:** tabela `config_kv` (já existe) para guardar até onde a rodada leu o `event_log`.
- **Tela:** protótipo aprovado em `public/dash/email-mkt.js` (vista `contatos` e `detalheContato`): lista com busca, filtros de situação, origem e funil, totais, gaveta de detalhe com histórico, descadastrar e reativar.

### Pesquisa externa (Postmark, Suppressions API)

- `POST /message-streams/{stream}/suppressions` cria supressão (`{ Suppressions: [{ EmailAddress }] }`, até 50).
- `POST /message-streams/{stream}/suppressions/delete` apaga. "SpamComplaint suppressions cannot be deleted." Apagar uma `HardBounce` "is the equivalent of reactivating the associated Bounce".
- Uso aqui: descadastro manual cria supressão no stream de marketing (`broadcast`), para o próprio Postmark também barrar. Reativar "voltou" apaga a supressão nos dois streams. "Denunciou" nunca é reativado (o Postmark também não deixa).

## Cenários

### Happy Path

1. **Primeira carga:** na primeira rodada de `/api/sync/email-contatos`, o backend lê os leads do `event_log` do mais antigo ao mais novo e cria um contato por e-mail, com funil, origem e data da primeira entrada. Cada lead também vira uma "entrada" do contato (funil, origem, data). O cursor fica em `config_kv`, e a rodada continua de onde parou.
2. **Nome dos antigos:** nas rodadas seguintes, contatos sem nome que têm card no ClickUp ganham o nome do card (campo "Nome"), até 20 por rodada.
3. **Lead novo:** quando um lead chega pelo `/tracker` (não robô, não bloqueado), o contato é criado ou atualizado na hora, já com o nome do formulário. Se essa gravação falhar, a rodada de 5 minutos pega o lead pelo cursor.
4. A usuária abre Marketing › E-mail › Contatos: totais (ativos e geral), lista com nome, e-mail, origem, funil, entrada e situação, busca por nome ou e-mail, filtros de situação, origem e funil, 50 por página.
5. Abre um contato: dados, entradas (cada formulário que a pessoa preencheu) e histórico de e-mails recebidos (teste, agenda e, depois, campanhas) com a situação de cada um (entregue, aberto, clicado, voltou...).
6. **Descadastrar à mão** (a pedido da pessoa): confirma na linha, o contato vira "descadastrado" e o endereço entra na lista de supressão do marketing no Postmark.
7. **Resultados automáticos:** aviso de descadastro vira "descadastrado"; devolução definitiva vira "voltou"; spam vira "denunciou".

### Edge Cases

- **Mesmo e-mail em funis ou origens diferentes:** um contato só (e-mail em minúsculas, sem espaços); cada formulário vira uma entrada. Funil e origem da lista são os da primeira entrada; o filtro por funil acha o contato por qualquer entrada.
- **E-mail malformado:** entra como "inválido" (fora de qualquer envio), sem derrubar nada.
- **Lead de teste interno** (`@seteads.com`, `@teste.com`): o lead novo entra como contato normal, para dar para testar ponta a ponta. Na primeira carga, os testes antigos ficam de fora (o `is_junk` antigo não separa teste de bloqueado).
- **Robô e lead bloqueado:** nunca viram contato.
- **Quem se descadastrou e preenche um formulário de novo:** volta a "ativo" (é a própria pessoa cadastrando de novo), e a supressão de marketing no Postmark é apagada.
- **Quem denunciou e preenche de novo:** continua "denunciou" (o Postmark não deixa reativar).
- **Quem voltou e preenche de novo:** continua "voltou". Só a equipe reativa, à mão.
- **Reativar "voltou"** (caixa cheia corrigida): só a partir de "voltou", com aviso de risco na confirmação ("se voltar de novo, a reputação do domínio cai"); apaga a supressão no Postmark.
- **Tentar reativar descadastrado ou denunciou:** recusado ("Só a própria pessoa reativa, preenchendo um formulário de novo.").
- **Ordem dos resultados:** denunciou não é rebaixado por descadastro ou devolução; descadastrado não vira "voltou".
- **Resultado de envio da agenda** (canal transacional): devolução definitiva e spam também marcam o contato, se existir. Pessoa da agenda que não é lead não vira contato (tipos não comerciais incluídos).
- **Lead sem card no ClickUp:** fica sem nome; a lista mostra só o e-mail. O preenchimento de `{{primeiro_nome}}` vazio nas campanhas é assunto da 382.
- **Nome que mudou:** o formulário novo atualiza o nome do contato; o ClickUp só preenche nome vazio.

### Cenário de Erro

- **Postmark sem resposta ao descadastrar:** o contato fica descadastrado aqui (é o que barra os envios do dash) e a tela avisa "Descadastrado no dash; o serviço de envio não confirmou a supressão. Tente de novo." (com botão para tentar de novo).
- **Postmark sem resposta ao reativar:** nada muda; "Não foi possível falar com o serviço de envio agora. Tente de novo."
- **ClickUp fora do ar ou sem chave na rodada:** o nome fica para a próxima rodada; nada mais trava.
- **Falha ao gravar o contato no `/tracker`:** só fica no log; o lead segue para todos os destinos como hoje, e a rodada pega depois.
- **Contato inexistente:** 404 "Contato não encontrado."

## Banco de Dados

Migration `migrations/0053_email_contatos.sql` (só adição):

- Tabela: `email_contatos`
  - `id` (INTEGER, PK)
  - `email` (TEXT, único) — minúsculas, sem espaços
  - `nome` (TEXT)
  - `funil` (TEXT), `origem` (TEXT) — da primeira entrada
  - `situacao` (TEXT) — `ativo` | `invalido` | `descadastrado` | `voltou` | `denunciou`
  - `situacao_em` (INTEGER), `situacao_por` (TEXT) — `lead` | `equipe` | `servico` | `sistema`
  - `nome_buscado` (INTEGER, 0/1) — o ClickUp já foi consultado
  - `entrou_em`, `atualizado_em` (INTEGER)
  - Índices: `situacao`, `entrou_em`
- Tabela: `email_contatos_entradas`
  - `id` (INTEGER, PK)
  - `contato_id` (INTEGER)
  - `event_id` (TEXT, único) — o Lead do `event_log`
  - `funil` (TEXT), `origem` (TEXT), `material` (TEXT)
  - `entrou_em` (INTEGER)
  - Índice: `(contato_id)`, `(funil)`
- Cursor da carga em `config_kv` (`email_contatos_cursor` = último `event_log.id` lido).
- Aplicação no remoto com `wrangler d1 execute tracking-ae-db --remote --file migrations/0053_email_contatos.sql`.

## Arquivos

- **Criar:** `migrations/0053_email_contatos.sql` — tabelas `email_contatos` e `email_contatos_entradas`.
- **Criar:** `functions/api/_email-contatos.js` — regras: `registrarLead(env, { email, nome, funil, material, origem, eventId, quando })` (cria ou junta, inválido, volta de descadastrado, entrada); `carregarDoTracking(env, { limite })` (cursor no `event_log`); `preencherNomes(env, { limite })` (ClickUp); `aplicarResultado(env, email, tipo, quando)` (voltou, spam, descadastrou, com a ordem de gravidade); `descadastrar` e `reativar` (com Postmark); `listar(env, filtros)` e `detalhe(env, id)`.
- **Criar:** `functions/api/email/contatos.js` — `GET` (lista com busca, filtros, página e totais; `?id=` para o detalhe) e `POST { acao: 'descadastrar' | 'reativar', id }`, protegido por `DASH_KEY`.
- **Criar:** `functions/api/sync/email-contatos.js` — rodada periódica: carga pelo cursor + nomes do ClickUp, auth `x-sync-secret`.
- **Modificar:** `functions/tracker.js` — no bloco do Lead não bloqueado e não robô, `context.waitUntil(registrarLead(...))` com nome, e-mail, funil, material, origem (`canalDeLead` sobre a sessão) e `event_id`. Nada mais muda no arquivo.
- **Modificar:** `functions/api/_postmark.js` — `criarSupressao(env, stream, email)` e `apagarSupressao(env, stream, email)`.
- **Modificar:** `functions/api/webhooks/postmark.js` — depois de atualizar o envio, `voltou`, `spam` e `descadastrou` atualizam o contato do `destinatario`.
- **Modificar:** `public/dash/email-mkt.js` — vista `contatos` ligada ao backend (totais, busca, filtros, página, gaveta de detalhe com entradas e histórico, descadastrar, reativar com aviso de risco), sem selo de protótipo. O `detalheContato` do protótipo continua só para as vistas que ainda são protótipo (campanhas, relatório, fluxos).
- **Criar:** `tests/email-contatos.test.js` — carga pelo cursor (junta duplicado, inválido, ignora robô e bloqueado, continua de onde parou), lead novo pelo `registrarLead`, volta de descadastrado, denunciou e voltou não voltam sozinhos, nomes pelo ClickUp simulado, resultados do webhook com a ordem de gravidade, descadastrar e reativar com Postmark simulado (ok e sem resposta), lista com busca, filtros e totais, detalhe com histórico.
- **Modificar:** `tests/email-config.test.js` — o teste do webhook passa a carregar a migration 0053 e confere que "voltou" chega ao contato.
- **VPS (fora do repositório):** script `/root/scripts/email-contatos-sync/sync.sh` + linha no crontab a cada 5 minutos, apontando para a prévia `email-proprio` até o merge.

> Não toca: o envio ao GHL, ClickUp, ManyChat e Supabase dentro do `tracker.js`; `functions/api/sync/ghl-email.js`; segmentos (381) e campanhas (382).

## Dependências Externas

- Nenhuma nova. Postmark pelo `_postmark.js`; ClickUp pelo `_clickup.js`.

## Checklist

- [x] Migration `0053_email_contatos.sql` aplicada no D1 remoto com `d1 execute --file`
- [x] `_email-contatos.js` com entrada, carga, nomes, resultados, descadastro, reativação, lista e detalhe
- [x] Gravação do contato no `tracker.js` (segundo plano, só lead não bloqueado e não robô)
- [x] Supressão no Postmark (`criarSupressao`, `apagarSupressao`)
- [x] Webhook atualiza o contato
- [x] `GET/POST /api/email/contatos`
- [ ] `POST /api/sync/email-contatos` + cron de 5 minutos na VPS
- [x] Vista Contatos ligada ao backend
- [x] Testes `email-contatos` e `email-config` passando (`npm test`)
- [ ] Primeira carga rodada na prévia: contatos antigos aparecem, nomes chegando do ClickUp
- [ ] Usuária abre Contatos, vê os leads, um lead novo de teste aparece sozinho, busca e filtros funcionam, o detalhe mostra o e-mail de teste e descadastrar muda a situação
