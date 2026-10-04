# 386: Fluxos: publicar e rodar

**Tipo:** Implementação
**Página:** Dash › E-mail › Fluxos (spec `spec-email-proprio.md`, módulo 9)

## Descrição

Publicar o fluxo e fazê-lo rodar: entrada pelos gatilhos (todos os acontecimentos da lista, com filtros, e contagem dos últimos 30 dias ao montar), sem puxar o passado, sem entrar duas vezes; e-mails, esperas nos 3 modos com janela, desvios, objetivo, ir para outro fluxo e fim; saída automática por descadastro/devolução/spam e manual; pausar e retomar sem rajada de acumulados.

## Pronto quando

A usuária publica um fluxo com gatilho "preencheu formulário" filtrado, envia um lead de teste, ele entra, recebe o e-mail 1, segue pelo desvio certo conforme abriu ou não, pula para o objetivo quando a condição acontece, e pausar segura quem está dentro.

> **Notas do plano (decisões para a usuária):**
> - **Como os acontecimentos chegam ao fluxo, sem mexer em quem já funciona:** uma rodada a cada minuto lê as tabelas que o dash já grava (leads e eventos do site, vendas da Greenn, histórico da agenda, entrada e saída dos grupos, estágios do CRM, aberturas e cliques das campanhas). Ela usa um cursor para cada fonte e grava cada acontecimento, já com o e-mail da pessoa, numa tabela única. Nada muda no `tracker.js`, no webhook da Greenn, na agenda, nos grupos nem no webhook do ClickUp. O custo é um atraso de até 1 minuto entre o acontecimento e a entrada no fluxo.
> - **Quem pode entrar:** só **contatos de marketing ativos** (380): os leads do tracking, que aceitaram receber marketing. Comprador da Greenn, pessoa de grupo ou de reunião que **não** é lead não entra, mesmo disparando o gatilho, porque não deu consentimento de marketing. Exemplo: o fluxo "pós-compra" só pega quem comprou e também é lead.
> - **Ligar a pessoa ao e-mail:** lead, comprador da Greenn, agenda e campanha trazem o e-mail. O grupo de WhatsApp traz o telefone, ligado ao e-mail pelo telefone do lead (`variantesTelefone`, a mesma regra única de telefone do dash). O estágio do CRM traz o card, ligado ao e-mail pela ponte do ClickUp. O evento do site traz a sessão, ligada ao e-mail pelo lead da mesma sessão.
> - **Sem puxar o passado:** na primeira rodada, o histórico inteiro das fontes entra na tabela de acontecimentos, para os desvios ("já comprou o produto X?") e para a contagem dos últimos 30 dias. Mas só entra no fluxo quem disparou o gatilho **depois** de publicar.
> - **Pausar e retomar:** ao retomar, as esperas que estavam correndo são empurradas pelo tempo da pausa. Ninguém recebe de uma vez o que teria recebido durante a pausa.
> - **O que fica para depois:** editar um fluxo ativo e publicar mudanças é da 387; enquanto isso, mudanças num fluxo ativo ficam guardadas no rascunho, sem afetar quem está dentro. Os números nos cartões e a lista de quem está dentro são da 388. Aqui a saída manual fica no detalhe do contato ("Fluxos em que está" → "Tirar do fluxo").

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Fluxo salvo:** `email_fluxos` e `functions/api/_email-fluxos.js` (385): catálogo `TIPOS` (saídas por tipo), `EVENTOS` (filtros por acontecimento), `normalizarGrafo`, `problemas` (impede publicar).
- **Envio:** `enviarERegistrar()` de `functions/api/_email-envio.js` (canal marketing, origem `fluxo`), `montarEmail()` de `_email-render.js`, `lerConfig()` (marketing liberado), `usoDoMes()` de `_email-campanhas.js` (limite do mês). Webhook da 377 grava entregue, aberto e clicado por envio.
- **Contatos:** `email_contatos` (situação `ativo`), `normalizarEmail()` de `_email-contatos.js`, `canalDeLead()` de `_canal.js`.
- **Segmentos:** `sqlDasRegras()` de `_email-segmentos.js` (condição "está no segmento" e gatilho "entrou no segmento").
- **Fontes dos acontecimentos (só leitura):**
  - `event_log` + `sessions`: `Lead` com `raw_email`, funil efetivo, material, UTMs e `landing_url`; eventos internos `CTAClick`, `FormStart`, `FormStep`, `StoryOpen`. Fora: robô, bloqueado e `leads_bloqueados`.
  - `greenn_webhook_event`: e-mail em `raw_json.client.email`, `product_id` e status (`paid` → aprovada, `refunded` → reembolsada, `canceled`/`chargedback` → cancelada).
  - `agenda_historico` + `agenda_reunioes`: agendou, cancelou, presença (realizada → compareceu, faltou).
  - `whatsapp_group_events`: entrou e saiu, com o telefone em `participant_jid`; `variantesTelefone()` de `functions/_telefone.js` contra `lead_dispatch.phone`.
  - `crm_status_log` + `lead_dispatch`: card → e-mail.
  - `email_eventos` + `email_envios`: aberto e clicado das campanhas (com o link).
  - `email_segmentos`: quem entrou no segmento (diferença entre duas leituras).
- **Rodada:** padrão de `functions/api/sync/email-campanhas.js` + script e cron na VPS.
- **Datas de Brasília:** `ymdBrt()` e `inicioDoDiaBrt()` de `_data-brt.js` (espera até dia e hora, janela de envio).
- **Tela:** a barra de situação do protótipo aprovado (`desenharSituacao` em `public/dash/email-fluxos.js`) tinha publicar, pausar e retomar; o painel do gatilho tinha "Nos últimos 30 dias, N pessoas teriam entrado".

### Pesquisa externa

- Nenhuma.

## Cenários

### Happy Path

1. No quadro, ao montar o gatilho, o painel mostra "Nos últimos 30 dias, N pessoas teriam entrado com essa combinação" (contatos ativos com o acontecimento nos últimos 30 dias). O número é calculado no servidor e atualiza ao mudar o filtro.
2. "Publicar" (sem problemas) pede confirmação, e o fluxo vira **ativo**: a versão publicada é a do rascunho, e a hora da publicação fica gravada.
3. A rodada (a cada minuto) lê as fontes novas e grava os acontecimentos.
4. Para cada acontecimento depois da publicação, com e-mail de um contato ativo que bate com um gatilho (e os filtros) de um fluxo ativo, a pessoa entra no fluxo. Só entra quem nunca esteve nele.
5. A pessoa anda pelos cartões:
   - **E-mail:** sai pelo canal de marketing, com o modelo preenchido com os dados do contato. Fica registrado em `email_envios` (origem `fluxo`).
   - **Espera por um tempo, ou até um dia e horário:** a pessoa para até a hora.
   - **Espera até algo acontecer:** a pessoa segue por "aconteceu" quando o acontecimento chega, ou por "não aconteceu" quando bate o prazo.
   - **Janela de envio:** se a hora de sair cai fora dela, passa para o começo da próxima janela.
   - **Desvio:** avalia as condições na hora (abriu ou clicou num e-mail anterior do fluxo, em qualquer link ou num link específico; qualquer acontecimento com o filtro; está no segmento), combinadas com "e" ou "ou", e segue por "sim" ou "não".
   - **Objetivo:** quando o acontecimento dele chega para alguém que está em qualquer ponto do fluxo, a pessoa pula para ele e segue dali.
   - **Ir para outro fluxo:** a pessoa sai deste ("foi para o fluxo X") e entra no início do outro, se ele estiver ativo e ela nunca tiver estado nele.
   - **Fim:** a pessoa conclui o fluxo.
6. **Pausar:** ninguém entra e ninguém anda. **Retomar:** as esperas são empurradas pelo tempo da pausa, e cada pessoa segue de onde parou.

### Edge Cases

- **Mesmo acontecimento duas vezes** (o lead preenche dois formulários): entra uma vez (único por fluxo e contato). Quem concluiu também não entra de novo.
- **Contato descadastrado, que voltou ou denunciou:** sai do fluxo na rodada seguinte, sem precisar configurar, com o motivo registrado. Contato inválido nunca entra.
- **Acontecimento sem e-mail ligado** (telefone de grupo sem lead, card sem ponte): fica registrado, mas ninguém entra.
- **Pessoa que não é contato** (comprou mas não é lead): não entra (sem consentimento de marketing).
- **Marketing marcado como não liberado:** os e-mails dos fluxos ficam segurando e saem quando liberar; a pessoa não pula o e-mail.
- **Limite do mês esgotado:** o mesmo, segura até renovar; a visão geral já mostra o uso.
- **Modelo arquivado depois de publicar:** a trava da 385 impede arquivar modelo usado em fluxo.
- **Serviço de envio sem resposta:** tenta de novo na rodada seguinte (até 3 vezes); recusado (ex.: endereço inativo) segue em frente, com a falha registrada no passo.
- **Desvio com e-mail anterior que a pessoa não recebeu** (passou por outro caminho): conta como "não".
- **Ir para um fluxo pausado ou arquivado:** a pessoa sai deste com o registro "o fluxo de destino não está ativo".
- **Objetivo que já ficou para trás** (a pessoa já passou dele): ela não volta.
- **Volta em círculo** (ligações que formam laço sem espera): a pessoa anda no máximo 50 cartões por rodada; o resto fica para a próxima.
- **Segmento como gatilho:** quem entra no segmento depois da publicação entra no fluxo; a primeira leitura só marca quem já estava, sem disparar.
- **Rascunho de fluxo ativo:** salvar mudanças não mexe na versão publicada (publicar mudanças é da 387).

### Cenário de Erro

- **Publicar com problemas:** recusado no servidor com a lista; o quadro aponta os cartões.
- **Fonte que falha na rodada:** só ela fica para a rodada seguinte (cursor não anda); as outras seguem.
- **Rodada interrompida no meio:** cada pessoa é reservada antes de andar (reserva de 10 minutos), e nada é mandado duas vezes.
- **Fluxo inexistente:** 404 "Fluxo não encontrado."

## Banco de Dados

Migration `migrations/0058_email_fluxos_rodando.sql` (só adição):

- Tabela: `email_fluxos` (colunas novas)
  - `publicado_em` (INTEGER) — hora da publicação (quem disparou antes não entra)
  - `pausado_em` (INTEGER) — início da pausa (para empurrar as esperas)
- Tabela: `email_acontecimentos`
  - `id` (INTEGER, PK)
  - `chave` (TEXT, única) — fonte + id na fonte (não grava duas vezes)
  - `tipo` (TEXT) — `formulario` | `aplicacao` | `material` | `compra` | `agendou` | `cancelou` | `faltou` | `compareceu` | `grupo_entrou` | `grupo_saiu` | `crm` | `site` | `segmento` | `campanha`
  - `email` (TEXT) — vazio quando não deu para ligar
  - `dados_json` (TEXT) — os valores dos filtros (funil, página, produto, grupo…)
  - `quando` (INTEGER)
  - Índices: `(tipo, quando)`, `(email, tipo)`
- Tabela: `email_fluxo_cursores`
  - `fonte` (TEXT, PK), `posicao` (INTEGER) — até onde a rodada leu cada fonte
- Tabela: `email_segmento_membros`
  - `segmento_id`, `contato_id` (PK composta), `desde` (INTEGER) — para descobrir quem entrou no segmento
- Tabela: `email_fluxo_pessoas`
  - `id` (INTEGER, PK)
  - `fluxo_id`, `contato_id` (único juntos: nunca entra duas vezes)
  - `no_atual` (TEXT)
  - `situacao` (TEXT) — `andando` | `esperando` | `concluiu` | `saiu`
  - `espera_ate` (INTEGER), `espera_json` (TEXT) — prazo e condição da espera
  - `reservado_em` (INTEGER) — reserva da rodada
  - `motivo_saida` (TEXT)
  - `entrou_em`, `atualizado_em` (INTEGER)
  - Índice: `(fluxo_id, situacao, espera_ate)`
- Tabela: `email_fluxo_passos` (o caminho de cada pessoa, base dos números e do histórico da 388)
  - `id` (INTEGER, PK)
  - `pessoa_id` (INTEGER), `fluxo_id` (INTEGER), `no_id` (TEXT)
  - `tipo` (TEXT) — `entrou` | `email` | `espera` | `desvio` | `objetivo` | `ir_fluxo` | `fim` | `saiu`
  - `saida` (TEXT) — por onde seguiu (sim, não, aconteceu…)
  - `envio_id` (INTEGER), `detalhe` (TEXT)
  - `em` (INTEGER)
  - Índices: `(pessoa_id)`, `(fluxo_id, no_id)`
- Aplicação no remoto com `wrangler d1 execute tracking-ae-db --remote --file migrations/0058_email_fluxos_rodando.sql`.

## Arquivos

- **Criar:** `migrations/0058_email_fluxos_rodando.sql` — colunas e tabelas acima.
- **Criar:** `functions/api/_email-acontecimentos.js` — coleta por fonte com cursor (lead e eventos do site, Greenn, agenda, grupos, CRM, campanhas, segmentos), ligando cada um ao e-mail; `casaFiltros(acontecimento, filtros)`; `contarUltimos30(env, gatilho)` (contatos ativos).
- **Criar:** `functions/api/_email-motor.js` — o motor: `entrar` (gatilhos), `andar` (cada tipo de cartão, com janela de envio), `soltarEsperas`, `pularParaObjetivo`, `sairInativos`, `tirarManual`, reserva contra rodada dupla, e `rodar(env, t)`, que junta tudo.
- **Criar:** `functions/api/sync/email-fluxos.js` — rodada periódica (coleta + motor), auth `x-sync-secret`.
- **Modificar:** `functions/api/_email-fluxos.js` — `publicar`, `pausar` e `retomar` (com o empurrão das esperas); situações `ativo` e `pausado`.
- **Modificar:** `functions/api/email/fluxos.js` — `POST { acao: 'publicar' | 'pausar' | 'retomar' | 'estimar' }`.
- **Modificar:** `functions/api/email/contatos.js` — o detalhe traz `fluxos` (em que fluxos a pessoa está) e `POST { acao: 'tirar_do_fluxo', id, fluxo_id }`.
- **Modificar:** `public/dash/email-fluxos.js` — botões Publicar, Pausar e Retomar na barra (com confirmação); contagem dos últimos 30 dias no painel do gatilho; na lista, situação ativa ou pausada e Pausar/Retomar na engrenagem.
- **Modificar:** `public/dash/email-mkt.js` — no detalhe do contato, "Fluxos em que está" com "Tirar do fluxo".
- **Criar:** `tests/email-acontecimentos.test.js` — cada fonte vira acontecimento com o e-mail certo (incluindo telefone de grupo, card do CRM e sessão do site), cursor não repete, fonte com erro não trava as outras, segmento sem disparo na primeira leitura, contagem dos últimos 30 dias.
- **Criar:** `tests/email-motor.test.js` — o "pronto quando" de ponta a ponta (lead filtrado entra, recebe o e-mail 1, segue pelo desvio conforme abriu, pula para o objetivo), não puxa o passado, não entra duas vezes, as três esperas com janela, "não aconteceu" no prazo, ir para outro fluxo, fim, saída por descadastro, saída manual, pausar segura e retomar empurra as esperas, marketing não liberado segura, sem resposta tenta de novo, reserva contra rodada dupla, laço com limite de passos.
- **VPS (fora do repositório):** script `/root/scripts/email-fluxos-sync/sync.sh` + linha no crontab a cada minuto, apontando para a prévia `email-proprio` até o merge.

> Não toca: `functions/tracker.js`, webhook da Greenn, agenda, grupos, webhook do ClickUp (só leitura das tabelas), editar ativo (387), números e lista de quem está dentro (388).

## Dependências Externas

- Nenhuma nova.

## Checklist

- [x] Migration `0058_email_fluxos_rodando.sql` aplicada no D1 remoto com `d1 execute --file`
- [x] Coleta de acontecimentos de todas as fontes, com cursor e ligação ao e-mail
- [x] Contagem dos últimos 30 dias no gatilho
- [x] Publicar, pausar e retomar
- [x] Motor: entrada, e-mail, as três esperas com janela, desvio, objetivo, ir para outro fluxo, fim
- [x] Saída automática (descadastro, voltou, spam) e manual
- [x] `POST /api/sync/email-fluxos` + cron a cada minuto na VPS
- [x] Barra com publicar/pausar/retomar, contagem no painel e "Fluxos em que está" no contato
- [x] Testes `email-acontecimentos` e `email-motor` passando (`npm test`)
- [ ] Usuária publica um fluxo com gatilho "preencheu formulário" filtrado, envia um lead de teste, ele entra, recebe o e-mail 1, segue pelo desvio certo conforme abriu ou não, pula para o objetivo quando a condição acontece, e pausar segura quem está dentro
