# 379: E-mails da agenda: confirmação e lembretes

**Tipo:** Implementação
**Página:** Agenda (dash e site) + E-mail (spec `spec-email-proprio.md`, módulo 3)

## Descrição

A agenda passa a enviar confirmação e lembretes pelo canal transacional, configuráveis por tipo de reunião (ligar/desligar, modelo, horários de lembrete), sem lembrete de reunião cancelada, remarcada ou já passada. Remarcação e cancelamento ficam configuráveis e saem quando a agenda tiver esses fluxos. Histórico no detalhe do agendamento e falha no aviso diário. Depende da agenda própria (branch `agenda-propria`) estar na base.

## Pronto quando

A usuária agenda uma reunião de teste na prévia, recebe a confirmação, recebe o lembrete no horário configurado, e vê os dois no detalhe do agendamento com a situação de cada um. Um tipo com o e-mail desligado não envia.

> **Nota do plano (decisão para a usuária):** a spec diz que remarcação e cancelamento "só passam a sair quando a agenda tiver os fluxos de remarcar e cancelar". A pesquisa mostrou que esses fluxos **já existem**: a equipe remarca e cancela pelo dash (`functions/api/agenda/reunioes.js`), o lead pela página `/reuniao/<token>` (`functions/api/agenda/publico/reuniao.js`), e mudança feita direto no Google é lida pela rodada `functions/api/sync/agenda.js`. Por isso, este plano já liga os quatro e-mails (confirmação, lembretes, remarcação e cancelamento) e tira o selo "espera a agenda" do protótipo.

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Montagem e envio:** `montarEmail()` de `functions/api/_email-render.js` (378), `enviar()` de `functions/api/_postmark.js`, `lerConfig()` e `remetente()` de `functions/api/_email-config.js`. O registro em `email_envios` (a linha nasce, ganha o `MessageID`, e o webhook atualiza entregue, aberto e voltou) hoje vive dentro de `enviarTeste()` em `functions/api/email/config.js`. O núcleo sai para um helper comum e passa a servir o teste e a agenda.
- **Modelos:** `email_modelos` (378). O `{{link_remarcar}}` é o `linkGestao(token_gestao)` de `functions/api/_agenda.js`; o `{{link_reuniao}}` é o `meet_link` da reunião. Trava de "em uso": acrescentar a consulta da agenda em `consultasDeUso` de `functions/api/_email-modelos.js`.
- **Agenda:** `lerReuniao`, `lerTipo` e `linkGestao` de `functions/api/_agenda.js`; `SITUACOES_ATIVAS` de `functions/api/_agenda-regras.js`. Pontos onde a reunião nasce ou muda: `publico/confirmar.js` (agendou, já usa `waitUntil`), `reunioes.js` e `publico/reuniao.js` (cancelar, remarcar), `sync/agenda.js` (apagada ou movida no Google).
- **Rodada periódica:** padrão de `functions/api/sync/agenda.js` (POST com `x-sync-secret`, teto por rodada, cron na VPS). O Pages não tem Cron Triggers.
- **Aviso de integrações:** `condicoesDasProtecoes()` em `functions/api/_saude-alertas.js` + `TITULOS_CONDICAO` (`_meta-envio.js`) + `CONDICOES_COM_ITENS` (`_meta-alerta.js`), o mesmo caminho do `agenda_problema`. Sem dado pessoal na mensagem do Slack.
- **Tela:** protótipo aprovado em `public/dash/email-mkt.js` (`renderAgenda`): tabela por tipo com modelo, chave de ligado/desligado, mandar teste, adicionar e tirar lembrete; e o detalhe com "E-mails desta reunião" e os selos de situação. O detalhe real do agendamento fica em `public/dash/agenda.js` (`detalhe(id)`).
- **Teste de um e-mail da agenda:** reusa `POST /api/email/modelos { acao: 'enviar_teste', id, para }` (378) com o modelo escolhido. Nada novo no backend.
- **Testes:** padrão de `tests/agenda-fluxo.test.js` (SQLite real, Google simulado) e `tests/email-modelos.test.js` (Postmark simulado).

### Pesquisa externa

- Nenhuma API nova. O stream transacional (`outbound`) do Postmark já está em uso, e o `ErrorCode 406` (endereço inativo) já é traduzido em `_postmark.js`.

## Cenários

### Happy Path

1. Na primeira leitura de um tipo de reunião, o backend cria a configuração padrão: confirmação, lembrete 24 h antes, lembrete 1 h antes, remarcação e cancelamento, todos ligados, com os modelos semeados ("Confirmação de reunião", "Lembrete 24h antes", "Lembrete 1h antes", "Reunião remarcada", "Reunião cancelada").
2. O lead confirma um horário. Logo depois da resposta (`waitUntil`), o backend programa os e-mails da reunião numa fila: a confirmação para agora e um lembrete para cada horário configurado (início menos a antecedência). A confirmação sai na hora pelo canal transacional, com os campos da reunião preenchidos.
3. A rodada `/api/sync/email-agenda` (cron na VPS a cada 5 minutos) manda os lembretes cujo horário chegou. Antes de cada envio, ela reconfere que a reunião segue marcada, no mesmo horário, que ainda não começou e que aquele e-mail continua ligado.
4. Cada envio fica em `email_envios` (origem `agenda`, `ref_id` = id da reunião), e o webhook da 377 atualiza entregue, aberto, clicado e voltou.
5. No dash, o detalhe do agendamento mostra "E-mails desta reunião": o nome do e-mail, quando saiu ou vai sair, e a situação (Agendado, Entregue, Aberto, Voltou, Falhou, ou Não enviado com o motivo).
6. Em Agenda › E-mails, a usuária escolhe o tipo, liga ou desliga cada e-mail, troca o modelo (só modelos transacionais não arquivados), adiciona ou tira um lembrete (48 h, 24 h, 12 h, 3 h, 2 h, 1 h, 30 min ou 15 min antes) e manda teste do modelo escolhido.

### Edge Cases

- **Reunião marcada em cima da hora** (daqui a 30 min): a confirmação sai; os lembretes de 1 h e de 24 h viram "Não enviado: o horário do lembrete já tinha passado".
- **Remarcada** (pela equipe, pelo lead ou movida no Google): os lembretes ainda não enviados do horário antigo viram "Não enviado: reunião remarcada"; os lembretes do horário novo são programados; o e-mail de remarcação sai na hora, com a data nova.
- **Cancelada** (pela equipe, pelo lead ou apagada no Google): os lembretes pendentes viram "Não enviado: reunião cancelada"; o e-mail de cancelamento sai na hora.
- **E-mail desligado no tipo:** não é programado. Se for desligado depois de programado, na hora do envio vira "Não enviado: desligado em Agenda › E-mails".
- **Lembrete adicionado ou tirado** vale para as reuniões marcadas dali em diante. As já programadas seguem como estavam; o lembrete tirado vira "Não enviado: lembrete tirado" na hora do envio.
- **Modelo editado** depois da programação: vale o texto do modelo na hora do envio.
- **Cron atrasado:** o lembrete atrasado sai se a reunião ainda não começou; se já começou, vira "Não enviado: a reunião já tinha começado".
- **Duas rodadas ao mesmo tempo** (cron e `waitUntil`): cada linha da fila é reservada com um UPDATE condicional, e só quem reservou envia. Reserva parada há mais de 10 minutos volta para a fila.
- **Tipo não comercial** (RH, entrevistas): recebe confirmação e lembretes do mesmo jeito; nada vai para contatos de marketing (isso é da 380).
- **Reunião de teste** (`is_teste`): recebe os e-mails normalmente. É assim que a usuária confere.
- **Modelo em uso na agenda:** arquivar ou trocar de canal é recusado com "Este modelo está em uso em: confirmação da agenda (Sessão estratégica)".
- **Lembrete repetido no mesmo tipo** (dois de 24 h): recusado com "Este lembrete já existe neste tipo".
- **Link de remarcar na prévia:** `linkGestao()` aponta para `atacadoexponencial.com/reuniao/...`, que só funciona depois do merge da agenda (o mesmo link que já vai na descrição do evento do Google). Na prévia, o botão de remarcar do e-mail abre uma página que ainda não existe em produção.

### Cenário de Erro

- **Postmark recusa** (`ErrorCode` diferente de 0, por exemplo 406, endereço inativo): a linha vira "Falhou" com o motivo traduzido e não tenta de novo.
- **Postmark sem resposta:** a linha volta para a fila e tenta de novo na rodada seguinte; depois de 3 tentativas vira "Falhou: o serviço de envio não respondeu em três tentativas".
- **Voltou** (aviso do webhook): aparece como "Voltou" no detalhe.
- **Aviso de integrações:** falha ou "voltou" de e-mail da agenda nas últimas 24 h vira a condição "E-mail da agenda com problema" no aviso do Slack, com itens sem dado pessoal (exemplo: "Lembrete 24 h antes · Sessão estratégica · 07/10 15:00: Endereço inativo").
- **Falha ao programar** (D1): fica no log e não derruba o agendamento, a remarcação nem o cancelamento. O agendamento do lead nunca falha por causa do e-mail.
- **Chave do Postmark ausente:** nada sai; as linhas viram "Falhou: serviço de envio sem acesso" e entram no aviso.
- **Configuração inválida no dash** (modelo de marketing, arquivado ou inexistente; antecedência fora da lista): 400 com a mensagem do servidor.

## Banco de Dados

Migration `migrations/0052_email_agenda.sql` (só adição):

- Tabela: `agenda_emails` (configuração por tipo)
  - `id` (INTEGER, PK)
  - `tipo_id` (INTEGER) — tipo de reunião
  - `evento` (TEXT) — `confirmacao` | `lembrete` | `remarcacao` | `cancelamento`
  - `antes_min` (INTEGER) — antecedência do lembrete em minutos (0 nos outros)
  - `modelo_id` (INTEGER) — modelo transacional usado
  - `ligado` (INTEGER, 0/1)
  - `criado_em`, `atualizado_em` (INTEGER)
  - Único: `(tipo_id, evento, antes_min)`
- Tabela: `agenda_emails_fila` (cada e-mail programado de cada reunião)
  - `id` (INTEGER, PK)
  - `reuniao_id` (TEXT)
  - `agenda_email_id` (INTEGER) — linha da configuração que gerou
  - `evento` (TEXT), `antes_min` (INTEGER) — cópia, para o histórico não depender da configuração
  - `inicio_ref` (INTEGER) — horário da reunião para o qual foi programado
  - `enviar_em` (INTEGER)
  - `situacao` (TEXT) — `pendente` | `enviando` | `enviado` | `pulado` | `falhou`
  - `motivo` (TEXT) — por que foi pulado ou falhou
  - `tentativas` (INTEGER)
  - `envio_id` (INTEGER) — linha em `email_envios` (a situação de entrega vem de lá)
  - `criado_em`, `atualizado_em` (INTEGER)
  - Único: `(reuniao_id, agenda_email_id, inicio_ref)`; índice `(situacao, enviar_em)`
- Sementes: os 5 modelos transacionais da agenda em `email_modelos` (`INSERT OR IGNORE`, textos do protótipo aprovado).
- Aplicação no remoto com `wrangler d1 execute tracking-ae-db --remote --file migrations/0052_email_agenda.sql`.

## Arquivos

- **Criar:** `migrations/0052_email_agenda.sql` — tabelas `agenda_emails` e `agenda_emails_fila` + modelos semeados.
- **Criar:** `functions/api/_email-envio.js` — `enviarERegistrar(env, { canal, origem, refId, para, assunto, html, texto, tag })`: o núcleo que hoje está em `enviarTeste()` (linha em `email_envios`, envio, `MessageID` ou erro), separando "sem resposta" de "recusado".
- **Criar:** `functions/api/_email-agenda.js` — regras dos e-mails da agenda: configuração padrão por tipo; `programarEmails(env, reuniao, motivo)` (agendou, remarcou, cancelou); `processarFila(env, { reuniaoId?, limite })` (reserva, reconfere, monta com `montarEmail`, envia com `enviarERegistrar`, conta tentativas); `valoresDaReuniao(reuniao, tipo)`; `emailsDaReuniao(env, id)` (histórico para o detalhe); `usosNaAgenda(env, modeloId)`; e `falhasRecentes(env, agora)` (itens do aviso).
- **Criar:** `functions/api/agenda/emails.js` — `GET` (tipos, configuração do tipo, modelos transacionais disponíveis, remetente) e `POST { acao: 'salvar' | 'adicionar_lembrete' | 'tirar_lembrete' }`, protegido por `DASH_KEY`.
- **Criar:** `functions/api/sync/email-agenda.js` — rodada periódica: `processarFila` com teto por rodada, auth `x-sync-secret`.
- **Modificar:** `functions/api/email/config.js` — `enviarTeste()` passa a usar `enviarERegistrar()`, com o mesmo comportamento.
- **Modificar:** `functions/api/_email-modelos.js` — `consultasDeUso` ganha `usosNaAgenda`.
- **Modificar:** `functions/api/agenda/publico/confirmar.js` — no `waitUntil`, programar e mandar a confirmação.
- **Modificar:** `functions/api/agenda/publico/reuniao.js` — depois de cancelar ou remarcar pelo lead, reprogramar e mandar o e-mail (`waitUntil`).
- **Modificar:** `functions/api/agenda/reunioes.js` — depois de cancelar ou remarcar pela equipe, reprogramar e mandar; o detalhe (`GET ?id=`) devolve também `emails`.
- **Modificar:** `functions/api/sync/agenda.js` — reunião apagada ou movida no Google reprograma os e-mails.
- **Modificar:** `functions/api/_saude-alertas.js` — condição `email_agenda_falha` com os itens de `falhasRecentes`.
- **Modificar:** `functions/api/_meta-envio.js` — título "E-mail da agenda com problema" em `TITULOS_CONDICAO`.
- **Modificar:** `functions/api/_meta-alerta.js` — `email_agenda_falha` em `CONDICOES_COM_ITENS`.
- **Modificar:** `public/dash/email-mkt.js` — `renderAgenda` ligada ao backend (tipos e modelos reais, chave, troca de modelo, adicionar e tirar lembrete, mandar teste), sem selo de protótipo, sem "espera a agenda" e sem o bloco de exemplo. `TIPOS_REUNIAO`, `EMAILS_AGENDA` e `D.agenda` saem se nada mais usar.
- **Modificar:** `public/dash/agenda.js` — no `detalhe(id)`, a seção "E-mails desta reunião" com nome, horário e situação de cada e-mail.
- **Modificar:** `tests/agenda-fluxo.test.js` — carregar as migrations 0050–0052 para os ganchos de e-mail rodarem de verdade.
- **Criar:** `tests/email-agenda.test.js` — programação (padrão, em cima da hora, desligado), envio da confirmação, lembrete na hora certa, remarcação e cancelamento (pula os antigos, programa os novos, manda o aviso), reconferência na hora do envio, reserva contra envio duplo, recusa, sem resposta com 3 tentativas, histórico do detalhe, trava de uso do modelo, itens do aviso, rotas `agenda/emails` e `sync/email-agenda`.
- **VPS (fora do repositório):** linha nova no crontab chamando `POST /api/sync/email-agenda` a cada 5 minutos, no mesmo endereço para onde aponta o cron da agenda (hoje a prévia).

> Não toca: `functions/tracker.js`, `functions/api/sync/ghl-email.js`, nada do GHL, nem contatos de marketing (380).

## Dependências Externas

- Nenhuma nova. Postmark pelo `_postmark.js` (377).

## Checklist

- [x] Migration `0052_email_agenda.sql` aplicada no D1 remoto com `d1 execute --file`
- [x] `_email-envio.js` com o núcleo do envio registrado, usado pelo teste da Configuração
- [x] `_email-agenda.js` com configuração padrão, programação, fila, histórico, uso do modelo e falhas
- [x] Ganchos em confirmar, reunião do lead, reuniões da equipe e rodada do Google
- [x] `GET/POST /api/agenda/emails`
- [ ] `POST /api/sync/email-agenda` + cron de 5 minutos na VPS
- [x] Condição `email_agenda_falha` no aviso de integrações
- [x] Trava "em uso" dos modelos ligada à agenda
- [x] Agenda › E-mails ligada ao backend
- [x] "E-mails desta reunião" no detalhe do agendamento
- [x] Testes `email-agenda` e `agenda-fluxo` passando (`npm test`)
- [ ] Usuária agenda uma reunião de teste na prévia, recebe a confirmação e o lembrete, vê os dois no detalhe, e um tipo com o e-mail desligado não envia
