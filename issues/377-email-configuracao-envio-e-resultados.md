# 377: Configuração, envio de teste e recebimento dos resultados

**Tipo:** Implementação
**Página:** Dash › E-mail › Configuração (spec `spec-email-proprio.md`, módulos 1 e 8)

## Descrição

Ligar o dash ao serviço de envio: a tela de configuração salva remetentes, resposta e rodapé, mostra a situação da conta e dos domínios, manda um e-mail de teste e recebe de volta os resultados (entregue, voltou, spam, abriu, clicou, descadastrou) por um endereço protegido, sem contar aviso repetido. Credencial quebrada entra no aviso diário. Nada do GHL é tocado.

## Pronto quando

A usuária edita os remetentes, manda um teste para o próprio e-mail e vê, no dash, esse envio marcado como entregue e depois como aberto e clicado. Um aviso sem a senha correta é recusado.

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Endpoint autenticado do dash:** mesmo padrão de `functions/api/agenda/tipos.js` (`autorizado(url, env)` com `DASH_KEY`, `GET` lista e `POST { acao }`).
- **Webhook sem HMAC:** mesmo raciocínio de `functions/api/webhooks/greenn.js` (fator único de autenticação, responde 200 ao que não entende, 5xx só quando o D1 falha de verdade, nada de corpo cru em log).
- **Credenciais e aviso diário:** catálogo em `functions/api/_credenciais.js` e teste de aceitação em `_credenciais-checagem.js` (como `testarClickUp`). Credencial com problema já vira `credencial_problema` em `functions/api/_saude-alertas.js` e sai no aviso diário (Slack). Não precisa de alerta novo.
- **Ponte do dash:** `public/dash/email-mkt.js` (protótipo 373) já tem a vista `configuracao` e recebe utilitários do `index.html` (`fetchJson`, `postJson`, `pedirConfirmacao`, toast, gaveta). Troca-se o dado de exemplo dessa vista pelo backend; as outras vistas continuam protótipo.
- **Testes:** padrão de `tests/agenda-fluxo.test.js` (SQLite real via `node:sqlite` com o adaptador `d1(db)`, `fetch` simulado).
- **Migrations:** a última é `0049_agenda_etapas.sql`, então esta é a `0050`.

### Pesquisa externa (Postmark, documentação oficial)

- Envio: `POST https://api.postmarkapp.com/email` com `X-Postmark-Server-Token`; campos `From`, `To`, `Subject`, `HtmlBody`, `TextBody`, `ReplyTo`, `Tag`, `Metadata`, `MessageStream` (`outbound` = transacional, `broadcast` = marketing), `TrackOpens`, `TrackLinks`. Resposta: `ErrorCode` (0 = ok) e `MessageID`.
- Situação do servidor: `GET /server` (server token) responde 200 com token válido.
- Domínios: `GET /domains` e `GET /domains/{id}` exigem **`X-Postmark-Account-Token`** (dono da conta). Campos: `DKIMVerified`, `ReturnPathDomainVerified`.
- Webhooks: `GET/POST/PUT /webhooks` (server token), um por `MessageStream`, com `HttpAuth { Username, Password }` e `Triggers` (Open com `PostFirstOpenOnly`, Click, Delivery, Bounce, SpamComplaint, SubscriptionChange). O Postmark testa a URL antes de ativar. Sem HMAC. Reentrega em 5xx/408/429 por cerca de 1h; 4xx não reentrega.
- Payload: `RecordType` (`Delivery`, `Bounce`, `SpamComplaint`, `Open`, `Click`, `SubscriptionChange`), `MessageID`, `Recipient`, `Tag`, `Metadata`, `MessageStream`; datas em `DeliveredAt`, `BouncedAt`, `ReceivedAt`, `ChangedAt`; Click traz `OriginalLink`; Bounce traz `Type` e `Inactive`; SubscriptionChange traz `SuppressSending` e `SuppressionReason`.
- Não existe na API um indicador de "marketing liberado": vira um campo da configuração marcado pela equipe. A conta foi aprovada em 03/10 com broadcast funcionando, então começa ligado.

## Cenários

### Happy Path

1. A usuária abre Marketing › E-mail › Configuração. O dash busca `GET /api/email/config` e mostra remetentes, resposta, rodapé, "Conta: chave aceita", domínios `envio.` e `news.` verificados e "Marketing liberado".
2. Ela edita o nome do remetente do marketing e salva. O backend valida (endereço termina em `@envio.atacadoexponencial.com` no transacional e `@news.atacadoexponencial.com` no marketing), grava e responde; toast "Configuração salva".
3. Ela clica em "Conectar resultados" uma vez. O backend lista os webhooks dos streams `outbound` e `broadcast` e cria o que faltar, apontando para `/api/webhooks/postmark` com usuário e senha. A tela mostra "Resultados conectados" nos dois canais.
4. Ela digita o próprio e-mail em "Mandar teste", escolhe o canal e envia. O backend manda pelo Postmark com `Tag: teste`, `Metadata: { origem: 'teste', envio_id }`, `TrackOpens` e `TrackLinks` ligados e um link no corpo, e grava o envio como "enviado".
5. O Postmark avisa a entrega. `/api/webhooks/postmark` confere a senha, grava o evento e o envio passa a "entregue".
6. Ela abre o e-mail e clica no link. Chegam Open e Click, e o envio mostra "aberto" e "clicado" com horário. A lista "Últimos testes" mostra a linha do tempo de cada envio.

### Edge Cases

- **Aviso repetido** (o Postmark reenvia depois de um timeout): a chave do evento (`tipo + MessageID + data + link`) é única; o segundo não grava nada e responde 200.
- **Evento de mensagem que o dash não mandou** (envio pelo painel do Postmark, por exemplo): grava o evento sem envio ligado e responde 200.
- **Abertura repetida:** só a primeira marca `aberto_em`; as outras ficam como evento sem mudar a data.
- **Evento fora de ordem** (Open antes de Delivery): cada data só é preenchida se estiver vazia; a situação final segue a gravidade (voltou/spam > descadastrou > clicado > aberto > entregue > enviado).
- **Devolução de caixa cheia (soft bounce):** registra "voltou temporariamente", sem tratar como definitiva (a situação do contato é assunto da 380).
- **Remetente fora dos domínios verificados:** recusado ao salvar, com a mensagem do servidor.
- **Endereço de resposta vazio:** permitido; o envio sai sem `ReplyTo`.
- **Webhook já cadastrado:** "Conectar resultados" não duplica; se existir com URL ou gatilhos diferentes, atualiza.
- **Account token ausente:** a situação dos domínios aparece como "não consultada (falta a chave da conta)", sem bloquear o resto.
- **Duplo clique em "Mandar teste":** o botão trava enquanto envia.

### Cenário de Erro

- **Server token ausente ou recusado:** a tela mostra "Serviço de envio sem acesso. Confira a chave em Saúde das integrações"; teste e conexão ficam indisponíveis; a credencial aparece com problema na checagem diária e sai no aviso diário (Slack), como as outras.
- **Postmark recusa o envio** (`ErrorCode` diferente de 0, ex.: 406 endereço inativo, 300 e-mail inválido): o envio é gravado como "falhou" com o motivo traduzido; toast de erro com o motivo.
- **Postmark fora do ar ou sem resposta em 8 s:** "Não foi possível falar com o serviço de envio agora. Tente de novo."; nada gravado como enviado.
- **Webhook sem usuário e senha, ou com senha errada:** 401, nada gravado.
- **Corpo inválido no webhook:** 200 sem gravar (evita reentrega infinita de lixo).
- **Falha de escrita no D1 durante o webhook:** 500, para o Postmark reentregar.

## Banco de Dados

Migration `migrations/0050_email.sql`:

- Tabela: `email_config` (uma linha por campo)
  - `chave` (TEXT, PK) — `remetente_transacional_nome`, `remetente_transacional_email`, `remetente_marketing_nome`, `remetente_marketing_email`, `resposta_transacional`, `resposta_marketing`, `rodape`, `marketing_liberado`
  - `valor` (TEXT) — valor do campo
  - `atualizado_em` (INTEGER) — epoch
  - Sementes: remetentes iniciais da spec (decisão 6) e `marketing_liberado = '1'`.
- Tabela: `email_envios` (cada e-mail mandado pelo dash)
  - `id` (INTEGER, PK)
  - `message_id` (TEXT, UNIQUE, nulo quando o envio falhou) — ID do Postmark
  - `canal` (TEXT) — `transacional` | `marketing`
  - `origem` (TEXT) — `teste` nesta issue; depois `agenda`, `campanha`, `fluxo`
  - `ref_id` (TEXT) — id da reunião, campanha ou fluxo (nulo no teste)
  - `destinatario` (TEXT) — e-mail
  - `assunto` (TEXT)
  - `situacao` (TEXT) — `enviado` | `falhou` | `entregue` | `aberto` | `clicado` | `voltou` | `voltou_temporario` | `spam` | `descadastrou`
  - `erro` (TEXT) — motivo quando falhou
  - `enviado_em`, `entregue_em`, `aberto_em`, `clicado_em`, `voltou_em`, `spam_em`, `descadastrou_em` (INTEGER) — epoch da primeira ocorrência
  - Índices: `(origem, enviado_em)` e `(destinatario)`
- Tabela: `email_eventos` (cada aviso recebido do Postmark)
  - `id` (INTEGER, PK)
  - `chave` (TEXT, UNIQUE) — `tipo|MessageID|data|link`, para ignorar repetidos
  - `message_id` (TEXT)
  - `envio_id` (INTEGER, nulo quando a mensagem não é do dash)
  - `tipo` (TEXT) — `entregue` | `aberto` | `clicado` | `voltou` | `voltou_temporario` | `spam` | `descadastrou`
  - `stream` (TEXT) — `outbound` | `broadcast`
  - `ocorrido_em` (INTEGER) — data do evento no Postmark
  - `recebido_em` (INTEGER)
  - `detalhe_json` (TEXT) — só o necessário: link clicado, tipo de devolução, motivo de supressão. Sem corpo do e-mail e sem payload cru.
  - Índices: `(message_id)` e `(envio_id)`
- Aplicação no remoto: `wrangler d1 execute <db> --remote --file migrations/0050_email.sql` (NUNCA `d1 migrations apply --remote`).

## Arquivos

- **Criar:** `migrations/0050_email.sql` — as três tabelas, índices e sementes.
- **Criar:** `functions/api/_postmark.js` — cliente do Postmark: `enviar`, `consultarServidor`, `listarDominios` (account token), `listarWebhooks`, `criarWebhook`, `editarWebhook`. Tempo limite de 8 s, traduz `ErrorCode` para português, nunca loga token nem corpo.
- **Criar:** `functions/api/_email-config.js` — ler a configuração (com padrões), validar e salvar os campos (domínio do remetente por canal, formato de e-mail, tamanho do rodapé).
- **Criar:** `functions/api/_email-eventos.js` — funções puras: payload do Postmark para evento normalizado (tipo, data, chave, detalhe mínimo) e regra de qual data e situação do envio mudam.
- **Criar:** `functions/api/email/config.js` — `GET` (configuração, situação da conta, domínios, webhooks e últimos 20 testes) e `POST { acao: 'salvar' | 'enviar_teste' | 'conectar_resultados' }`, protegido por `DASH_KEY`.
- **Criar:** `functions/api/webhooks/postmark.js` — recebe os avisos; Basic Auth contra `POSTMARK_WEBHOOK_USER` e `POSTMARK_WEBHOOK_PASS`; grava o evento (ignorando repetido) e atualiza `email_envios`.
- **Modificar:** `functions/api/_credenciais.js` — catálogo ganha `POSTMARK_SERVER_TOKEN` (teste `postmark`), `POSTMARK_ACCOUNT_TOKEN`, `POSTMARK_WEBHOOK_USER` e `POSTMARK_WEBHOOK_PASS`, na integração "E-mail (Postmark)".
- **Modificar:** `functions/api/_credenciais-checagem.js` — `testarPostmark` (`GET /server`, sem efeito colateral), ligado ao `teste: 'postmark'`.
- **Modificar:** `public/dash/email-mkt.js` — a vista `configuracao` passa a ler e gravar pelo backend (sem selo de protótipo nela), com "Conectar resultados", "Mandar teste" e "Últimos testes" (linha do tempo de cada envio). As demais vistas ficam intactas.
- **Criar:** `tests/email-eventos.test.js` — regras puras de normalização e de situação.
- **Criar:** `tests/email-config.test.js` — fluxo contra SQLite real e Postmark simulado: salvar e validar, enviar teste (ok e recusa), conectar resultados sem duplicar, webhook com senha certa e errada, repetido, fora de ordem e mensagem desconhecida.

> Não toca: `functions/tracker.js`, `functions/api/sync/ghl-email.js`, a aba `email` do GHL e `public/dash/agenda.js`.

## Dependências Externas

- Nenhum pacote novo. O Postmark é chamado por `fetch`.
- Secrets novos no Cloudflare Pages (prévia e produção), gravados com `printf '%s' | wrangler pages secret put` (sem BOM): `POSTMARK_SERVER_TOKEN` (**gerar um novo** no Postmark, porque o atual apareceu na conversa), `POSTMARK_ACCOUNT_TOKEN`, `POSTMARK_WEBHOOK_USER` e `POSTMARK_WEBHOOK_PASS` (gerados por nós, aleatórios).

## Checklist

- [x] Migration `0050_email.sql` com as três tabelas, índices e sementes dos remetentes
- [x] `_postmark.js` com envio, servidor, domínios e webhooks (tempo limite e erros traduzidos)
- [x] `_email-config.js` com leitura com padrões e validação por canal
- [x] `_email-eventos.js` com normalização, chave de repetido e regra de situação
- [x] `GET/POST /api/email/config` (salvar, enviar teste, conectar resultados)
- [x] `POST /api/webhooks/postmark` com Basic Auth, repetido ignorado e 500 quando o D1 falha
- [x] Credenciais do Postmark no catálogo e `testarPostmark`
- [x] Vista Configuração do dash ligada ao backend, com "Últimos testes"
- [x] Testes `email-eventos` e `email-config` passando (`npm test`)
- [x] Usuária gera server token novo e account token; secrets gravados na prévia sem BOM (conferir sha256)
- [x] Migration aplicada no D1 remoto com `d1 execute --file`
- [x] "Conectar resultados" na prévia; teste para o e-mail dela: entregue, aberto e clicado no dash
- [x] Chamada ao webhook sem senha devolve 401

## Implementação (03/10/2026)

- Migration `0050_email.sql` (tabelas `email_config`, `email_envios`, `email_eventos`, índices e sementes) aplicada no D1 remoto `tracking-ae-db` com `d1 execute --file`; conferido `sqlite_master` e as 8 linhas de `email_config`.
- `_postmark.js`: `enviar`, `consultarServidor`, `listarDominios` (account token), `listarWebhooks`, `criarWebhook`, `editarWebhook`; 8 s de tempo limite, `ErrorCode` traduzido, nada de token ou corpo em log. Falha de rede, tempo esgotado e 5xx viram "sem resposta".
- `_email-config.js`: leitura com padrões, validação por canal (domínio do remetente, formato de e-mail, nome sem aspas nem quebra de linha, rodapé até 1.000 caracteres) e gravação parcial.
- `_email-eventos.js`: normalização dos avisos (Delivery, Bounce, SpamComplaint, Open, Click, SubscriptionChange), chave `tipo|MessageID|data|link`, gravidade da situação e `UPDATE` atômico (data só se vazia, situação só sobe). SubscriptionChange só conta como descadastro quando é `ManualSuppression`; reativação e supressão por bounce/spam são ignoradas (já chegam no aviso próprio). Soft bounce marca `voltou_temporario` sem preencher `voltou_em`.
- `GET/POST /api/email/config`: GET devolve configuração, situação da chave, domínios, resultados conectados por canal e os 20 últimos testes com a linha do tempo. POST `salvar`, `enviar_teste` (o envio nasce como `falhou` para ter `envio_id` no Metadata e vira `enviado` com a confirmação; sem resposta apaga a linha) e `conectar_resultados` (um webhook por stream com a URL da origem do pedido; se existe, atualiza; nunca duplica).
- `POST /api/webhooks/postmark`: Basic Auth em tempo constante, 401 sem gravar, 200 para corpo inválido e repetido, 500 só em falha do D1. Atualiza o envio antes de gravar o evento, para a reentrega refazer tudo se o D1 cair no meio.
- Credenciais: as 4 do Postmark entram no catálogo em "E-mail (Postmark)" como **opcionais** por enquanto (produção ainda não tem as chaves; obrigatória geraria alerta falso depois do merge). `testarPostmark` (`GET /server`) ligado ao `teste: 'postmark'`. Ao gravar as chaves em produção, passar `POSTMARK_SERVER_TOKEN` e as do webhook para obrigatórias.
- Dash: a vista Configuração lê e grava pelo backend, sem selo de protótipo, com "Conectar resultados", "Mandar teste" (botão trava enquanto envia), "Últimos testes" e a chave "Marketing liberado". As outras vistas seguem protótipo, agora mostrando os remetentes reais. Ponte mínima no `public/dash/index.html`: `postJson` saiu do `R.agenda` para uma constante compartilhada e passou também ao `emailCtx` junto com `fetchJson`.
- Testes: `tests/email-eventos.test.js` e `tests/email-config.test.js` (SQLite real, Postmark simulado); `npm test` com 944 passando.
