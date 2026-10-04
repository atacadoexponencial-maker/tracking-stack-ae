# 382: Campanhas: criar, testar e disparar agora

**Tipo:** Implementação
**Página:** Dash › E-mail › Campanhas (spec `spec-email-proprio.md`, módulo 6)

## Descrição

Campanha em rascunho com modelo e segmentos, resumo de quem recebe e quem fica de fora (e por quê), teste, disparo agora com confirmação, andamento, sem disparo duplo nem destinatário em dobro, falha registrada com motivo, aviso de limite do mês e bloqueio enquanto o marketing não estiver liberado. Duplicar campanha.

## Pronto quando

A usuária cria uma campanha para um segmento pequeno da equipe, vê o resumo, dispara, acompanha o percentual e vê "enviada"; clicar de novo não dispara outra vez; quem está em dois segmentos recebe uma vez.

> **Notas do plano:**
> - **Como o disparo sai:** pela API de lote do Postmark (`/email/batch`, até 500 por chamada), com o e-mail de cada pessoa montado pelo dash. A outra opção, a Bulk API, não devolve o identificador de cada mensagem. Com o lote, cada destinatário vira uma linha em `email_envios`, e o webhook da 377 já liga entregue, aberto, clicado, voltou e descadastrou a cada pessoa, sem mudança. Isso alimenta o histórico do contato (380), as condições "abriu/clicou" dos segmentos (381) e o relatório (384).
> - **Limite do mês:** 10.000 e-mails (plano Basic do Postmark), contando tudo o que saiu no mês de Brasília (agenda, testes e campanhas). Disparo que passa do que resta é barrado com o aviso. O valor fica numa constante no código; se o plano mudar, muda ali.
> - **Contato sem nome:** o resumo avisa quantos destinatários estão sem nome quando o modelo usa `{{nome}}` ou `{{primeiro_nome}}` (esses campos saem vazios para eles). Na prévia, isso vale para quase todos, porque os nomes do ClickUp só chegam depois do merge (380).
> - **Só "agora" nesta issue:** agendar, editar e cancelar agendada ficam para a 383. Aqui o formulário só tem "Disparar agora".

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Montagem:** `montarEmail()` de `functions/api/_email-render.js` com os valores do contato (nome, primeiro nome, e-mail, funil). No marketing, o rodapé já leva `{{{ pm:unsubscribe }}}`, que o Postmark troca pelo link de descadastro de cada pessoa.
- **Envio e registro:** `chamar()`, `erroDe()`, `traduzirErro()` e `SemResposta` de `functions/api/_postmark.js` (falta só a chamada de lote). Registro em `email_envios` com o mesmo desenho de `enviarERegistrar()` (`functions/api/_email-envio.js`): a linha nasce antes, o `envio_id` vai no `Metadata`, e o `MessageID` entra depois.
- **Configuração:** `lerConfig()` e `remetente()` de `functions/api/_email-config.js`; regra "marketing não liberado" igual à da 377.
- **Público:** `sqlDasRegras()` de `functions/api/_email-segmentos.js` (381). Para o resumo, os segmentos são somados sem repetir pessoa, com todas as situações (para contar quem fica de fora e por quê). No disparo, só os ativos.
- **Trava de uso e opções:** `fontesDeCampanhas` em `_email-segmentos.js` (campanhas enviadas para "abriu/clicou") recebe a consulta das campanhas.
- **Teste:** o "Mandar teste" da campanha reusa `POST /api/email/modelos { acao: 'enviar_teste' }` (378) com o modelo da campanha. Nada novo no backend.
- **Rodada periódica:** padrão de `functions/api/sync/email-agenda.js` (379) + script e cron na VPS. A 383 aproveita a mesma rodada para as agendadas.
- **Tela:** protótipo aprovado em `public/dash/email-mkt.js` (`campanhas`, `abrirCampanha`, `formCampanha`, `publicoCampanha`, `avisoLimite`, `avisoMarketing`): lista com filtro por situação, régua do limite do mês, formulário, resumo com quem fica de fora, confirmação com o número, andamento com percentual. O relatório (`relatorio`) segue protótipo até a 384.

### Pesquisa externa (Postmark)

- `POST /email/batch`: "accepts up to 500 messages per API call, and up to 50 MB payload". Responde 200 mesmo com mensagem recusada: cada item volta com `ErrorCode`, `MessageID`, `To` e `Message`, na mesma ordem do pedido.
- Bulk API (`/email/bulk`): preenche os campos por destinatário, mas devolve só um identificador do lote, sem o `MessageID` de cada pessoa. Por isso não foi escolhida.

## Cenários

### Happy Path

1. A usuária abre Marketing › E-mail › Campanhas: régua do limite do mês ("N de 10.000 usados em outubro · restam X"), filtro por situação e a lista (nome, situação, segmentos, envio, destinatários, enviados, falhas).
2. Clica em "Nova campanha": nome interno, modelo (só marketing, não arquivado, com assunto e corpo), um ou mais segmentos (com os ativos de cada um) e o remetente da configuração (só leitura). "Salvar rascunho" grava.
3. "Mandar teste": manda o modelo da campanha para o e-mail informado, com os dados de exemplo.
4. "Revisar e disparar": o servidor devolve o resumo. Quantos recebem (sem repetir quem está em dois segmentos), quantos estão em mais de um, quem fica de fora por situação (descadastrado, voltou, denunciou, inválido), quantos estão sem nome (se o modelo usa nome) e o limite do mês.
5. "Disparar para N pessoas" pede confirmação. O servidor troca a campanha de rascunho para enviando (uma vez só), recalcula a lista de ativos e grava os destinatários. Em seguida, manda em lotes de até 500 pela API de lote.
6. O andamento aparece na lista e no detalhe ("72% enviado · 3 falhas"), atualizado a cada 3 segundos enquanto a campanha está "enviando".
7. Ao terminar, a campanha fica "enviada", com total, enviados e falhas. Cada pessoa tem a sua linha em `email_envios` (origem `campanha`), e o webhook preenche entregue, aberto e clicado.
8. "Duplicar" cria um rascunho "Cópia de …" com o mesmo modelo e segmentos.

### Edge Cases

- **Clicar em disparar duas vezes** (ou em duas abas): só a primeira troca rascunho para enviando; a segunda recebe "Esta campanha já foi disparada."
- **Pessoa em dois segmentos:** recebe uma vez (um destinatário por e-mail na campanha).
- **Lista vazia** (ninguém ativo): disparo recusado ("Nenhum contato ativo nesses segmentos.").
- **Passa do limite do mês:** resumo mostra o bloqueio e o servidor recusa o disparo ("Este envio tem N pessoas e restam X e-mails no mês.").
- **Marketing não liberado na configuração:** resumo mostra o bloqueio; disparo recusado com a mesma regra da 377.
- **Modelo arquivado, de transacional, sem assunto ou com campo desconhecido no marketing:** recusado ao salvar e de novo na hora do disparo.
- **Destinatário recusado pelo Postmark** (ex.: 406, endereço inativo): só aquela pessoa vira falha com o motivo; o resto segue.
- **Lote inteiro recusado** (chave recusada, conta sem crédito, 401/405): a campanha para, fica "falhou" com o motivo, e os destinatários que não saíram ficam "não enviado" (nunca sai pela metade sem aviso).
- **Sem resposta do Postmark no meio de um lote:** não dá para saber se saiu. Aquele lote fica "não confirmado" (não é reenviado, para não duplicar), a campanha segue com os próximos e termina como "falhou" com o aviso de quantos ficaram sem confirmação.
- **Rodada interrompida** (função encerrada no meio): a rodada de 5 minutos continua os lotes pendentes; lote reservado há mais de 10 minutos sem resposta é tratado como "não confirmado".
- **Contato descadastra entre o resumo e o disparo:** a lista é recalculada no disparo; ele não recebe.
- **Excluir rascunho:** pode; campanha disparada não se exclui.
- **Modelo editado depois do disparo:** não muda o que já saiu (assunto guardado na campanha).
- **"Abriu/clicou" nos segmentos:** campanhas enviadas passam a aparecer nas opções do montador.

### Cenário de Erro

- **Falha ao salvar ou disparar** (validação): 400/409 com a mensagem do servidor na gaveta.
- **Postmark sem chave:** disparo recusado com "Serviço de envio sem acesso. Confira a chave em Saúde das integrações."
- **Falha no banco no meio do envio:** a rodada seguinte retoma pelos destinatários pendentes; o que estava reservado vira "não confirmado".
- **Campanha inexistente:** 404 "Campanha não encontrada."

## Banco de Dados

Migration `migrations/0055_email_campanhas.sql` (só adição):

- Tabela: `email_campanhas`
  - `id` (INTEGER, PK)
  - `nome` (TEXT)
  - `modelo_id` (INTEGER)
  - `segmentos_json` (TEXT) — ids dos segmentos
  - `situacao` (TEXT) — `rascunho` | `enviando` | `enviada` | `falhou` (a 383 acrescenta `agendada` e `cancelada`)
  - `motivo` (TEXT) — por que falhou
  - `assunto` (TEXT) — assunto que saiu (guardado no disparo)
  - `total`, `enviados`, `falhas` (INTEGER)
  - `disparada_em`, `concluida_em`, `criado_em`, `atualizado_em` (INTEGER)
- Tabela: `email_campanha_destinatarios`
  - `id` (INTEGER, PK)
  - `campanha_id` (INTEGER)
  - `contato_id` (INTEGER)
  - `email` (TEXT)
  - `situacao` (TEXT) — `pendente` | `enviando` | `enviado` | `falhou` | `nao_confirmado` | `nao_enviado`
  - `lote` (TEXT) — reserva do lote em andamento
  - `envio_id` (INTEGER) — linha em `email_envios`
  - `motivo` (TEXT)
  - `atualizado_em` (INTEGER)
  - Único: `(campanha_id, email)`; índice `(campanha_id, situacao)`
- Aplicação no remoto com `wrangler d1 execute tracking-ae-db --remote --file migrations/0055_email_campanhas.sql`.

## Arquivos

- **Criar:** `migrations/0055_email_campanhas.sql` — tabelas `email_campanhas` e `email_campanha_destinatarios`.
- **Criar:** `functions/api/_email-campanhas.js` — regras: salvar e validar rascunho, duplicar, excluir rascunho; `publico(env, segmentoIds)` (soma sem repetir, fora por situação, sem nome); `usoDoMes(env)` e `LIMITE_MES`; `resumo(env, id)`; `disparar(env, id)` (troca única rascunho → enviando, lista recalculada, destinatários); `processarEnvio(env, { campanhaId?, lotes })` (reserva lote, monta cada e-mail, `email_envios`, chamada de lote, grava resultado, conclui a campanha); `campanhasEnviadas(env)` (para os segmentos); lista e detalhe com andamento.
- **Criar:** `functions/api/email/campanhas.js` — `GET` (lista com filtro, uso do mês, opções: modelos de marketing e segmentos com ativos; `?id=` para o detalhe) e `POST { acao: 'salvar' | 'resumo' | 'disparar' | 'duplicar' | 'excluir' }`, protegido por `DASH_KEY`. O disparo responde na hora e manda os lotes em `waitUntil`.
- **Criar:** `functions/api/sync/email-campanhas.js` — rodada periódica: continua as campanhas "enviando" (lotes pendentes e reservas paradas), auth `x-sync-secret`.
- **Modificar:** `functions/api/_postmark.js` — `enviarLote(env, mensagens)`: `POST /email/batch`, resultado por mensagem, `SemResposta` quando não respondeu.
- **Modificar:** `functions/api/_email-segmentos.js` — `fontesDeCampanhas` ganha `campanhasEnviadas`.
- **Modificar:** `public/dash/email-mkt.js` — vista `campanhas` ligada ao backend: régua do limite, aviso de marketing não liberado, filtro por situação, lista, formulário (nome, modelo, segmentos, remetente), mandar teste, resumo com quem fica de fora, disparo com confirmação, andamento atualizado a cada 3 s enquanto envia, detalhe, duplicar e excluir rascunho; sem selo de protótipo. A opção "Agendar" fica fora até a 383. O relatório segue protótipo (384).
- **Criar:** `tests/email-campanhas.test.js` — rascunho e validação, resumo (soma sem repetir, fora por situação, sem nome, limite), bloqueios (marketing, limite, lista vazia, modelo inválido), disparo único, lotes de 500 com Postmark simulado (ok, recusa por pessoa, lote recusado, sem resposta), retomada pela rodada, reserva parada, `email_envios` por pessoa, webhook ligando aberto à pessoa, campanhas enviadas nas opções dos segmentos, duplicar e excluir.
- **VPS (fora do repositório):** script `/root/scripts/email-campanhas-sync/sync.sh` + linha no crontab a cada 5 minutos, apontando para a prévia `email-proprio` até o merge.

> Não toca: agendamento (383), relatório (384), fluxos (385+), `functions/tracker.js`, GHL.

## Dependências Externas

- Nenhuma nova. Postmark pelo `_postmark.js`.

## Checklist

- [x] Migration `0055_email_campanhas.sql` aplicada no D1 remoto com `d1 execute --file`
- [x] `enviarLote` no `_postmark.js`
- [x] `_email-campanhas.js` com rascunho, público, limite, resumo, disparo único, envio em lotes, retomada e lista
- [x] `GET/POST /api/email/campanhas`
- [x] `POST /api/sync/email-campanhas` + cron de 5 minutos na VPS
- [x] Campanhas enviadas nas opções de "abriu/clicou" dos segmentos
- [x] Vista Campanhas ligada ao backend
- [x] Testes `email-campanhas` passando (`npm test`)
- [ ] Usuária cria uma campanha para um segmento pequeno da equipe, vê o resumo, dispara, acompanha o percentual e vê "enviada"; clicar de novo não dispara; quem está em dois segmentos recebe uma vez
