# Spec: Grupo da live semanal → ManyChat automático

> **Cortes aprovados pela usuária em 17/09, antes da implementação.** Saíram do
> escopo, para a entrega ser pequena: (1) a **tabela de registro** e a migration
> `0043` — a proteção contra mensagem repetida é o `meta.changes` do `INSERT OR
> IGNORE`, e "quem recebeu" é respondido pela tag de controle dentro do próprio
> ManyChat; (2) a **lista fixa de telefones da equipe** — só entradas novas
> disparam, então quem já está no grupo (inclusive os admins) não recebe nada;
> ficou só a regra de pular quem entra já com `admin` preenchido; (3) o **teto
> de 30 participantes por evento**. O módulo 4 abaixo está mantido como registro
> do que foi desenhado, mas **não foi implementado**.

## Visão Geral

**O que faz.** Quando alguém **entra** no grupo de WhatsApp da live semanal, essa pessoa passa a existir no ManyChat automaticamente: é inscrita pelo telefone, recebe a tag `grupo-live-semanal` e recebe, pelo WhatsApp, a mensagem de boas-vindas do fluxo "Boas-vindas Live Semanal". Quando alguém **sai** do grupo, o contato dela no ManyChat ganha a tag `saiu-grupo-live` — sem mensagem nenhuma.

**Por que agora.** Hoje a entrada no grupo já é gravada no D1 (`whatsapp_group_events`, alimentada por `POST /api/webhooks/whatsapp-grupo`) e já vira conversão `EntrouGrupo` no Meta, mas a pessoa **não vira contato**. Em 09/09/2026 a base do grupo foi levada ao ManyChat **à mão** (tag `grupolive-manual`, 176 de 193 pessoas, 6 admins excluídos manualmente) — trabalho que se repete toda semana e que não escala. Esta feature substitui o trabalho manual do ciclo em diante.

**Quem usa.** Ninguém opera nada: é automação de servidor pendurada num webhook que já existe. Quem observa é quem mantém o tracking (logs do Pages + resposta do endpoint) e quem dispara campanhas no ManyChat (as tags são o filtro).

**Escopo — o que está DECIDIDO e não se discute aqui:**

1. **Só o grupo `120363427499061913@g.us`** (label `Lives Semanais` em `whatsapp_groups_tracked`). Os outros grupos monitorados (Workshops) e os ~119 grupos de terceiros continuam exatamente como estão: gravados no D1, nada de ManyChat.
2. **Entrou** → inscrever no ManyChat pelo telefone; aplicar a tag `grupo-live-semanal` (id **96802043**); disparar o fluxo `content20260917172557_668685` ("Boas-vindas Live Semanal"); **só depois de o fluxo ser aceito**, aplicar a tag de controle `boas-vindas-enviada-live` (id **96802947**). Se a pessoa estiver com a tag `saiu-grupo-live`, essa tag é **removida** (caso "voltou").
3. **Saiu** → achar o inscrito pelo telefone, **manter** `grupo-live-semanal` e aplicar `saiu-grupo-live` (id **96802046**). Sem fluxo, sem mensagem, sem criar contato novo.
4. **Só daqui para frente.** Nada retroativo: nenhum evento já gravado é reprocessado, não existe backfill. A tag `grupolive-manual` (id **96185696**) fica **intocada** — não é lida, não é aplicada, não é removida.
5. **Sem telefone** (participante que chega só com `@lid`) → não inscreve, não tagueia; só registra no log.
6. **Best-effort absoluto.** Falha no ManyChat **nunca** pode quebrar a gravação no D1 nem a resposta 200 ao n8n.
7. **Nenhum evento dispara o fluxo duas vezes.** Reentrega do n8n é inofensiva.

**Princípios que valem para a feature inteira:**

- **O D1 primeiro, o ManyChat depois.** A gravação do evento acontece e a resposta 200 sai antes de qualquer chamada ao ManyChat. A ponte roda fora do caminho da resposta (`waitUntil`), como já fazem as três pontes da Greenn.
- **Reuso, não reinvenção.** A ponte usa `inscreverComTag` de `functions/api/_manychat.js` (que já faz criar → preencher `phone` → taguear → disparar fluxo → tag de controle, exatamente a sequência pedida) e `telefoneDoJid` de `functions/api/_grupo-conversao.js`. O que falta hoje naquele helper — achar alguém sem criar, e **remover** uma tag — entra lá, não em cópia nova.
- **Nada de dado pessoal no log.** Telefone só **mascarado** (últimos 4 dígitos). Nome de participante, JID inteiro e payload cru nunca vão para o log — regra que o endpoint já segue.
- **Identidade estável.** Nenhuma mudança aqui altera `whatsapp_group_events`, `day_local`, a dedup existente ou a conversão `EntrouGrupo`. A feature só **lê** o que o webhook acabou de gravar.

**Limites conhecidos da API do ManyChat que a feature precisa respeitar** (comprovados contra a conta real e documentados em `functions/api/_manychat.js`):

- O telefone vai em **dígitos com DDI e sem `+`** (`5511987654321`) — o formato do `normalizePhone`/`padronizarTelefone` do projeto.
- `createSubscriber` **falha** quando o WhatsApp já existe ("This WhatsApp ID already exists") e **não** devolve o id do existente.
- `findBySystemField` só aceita **`phone` ou `email`**; `whatsapp_phone` é recusado. Quem nasceu só com WhatsApp e sem o campo `phone` preenchido é **inencontrável** pela API — por isso a criação preenche `phone` logo em seguida.
- `findBySystemField` responde `success` com `data: []` quando não acha.
- Tag aplicada **pela API não aciona automação** no ManyChat — por isso o fluxo é disparado explicitamente (`sendFlow`), e não esperado do gatilho "Tag aplicada".
- `sendFlow` pode responder **200 com `status: "error"` no corpo** — o corpo precisa ser conferido.
- A API é chamada **um contato por vez**; não há operação em lote. Um único evento da Evolution pode trazer vários participantes.

---

## Páginas / Módulos

### 1. Gatilho no webhook dos grupos (`functions/api/webhooks/whatsapp-grupo.js`)

**Descrição:** O endpoint que já recebe e grava entradas/saídas passa a decidir, **depois de gravar**, se chama a ponte do ManyChat. É a única alteração no arquivo existente: nada do que ele faz hoje (auth, classificação, registro de horário, `whatsapp_groups_seen`, `INSERT OR IGNORE` em `whatsapp_group_events`, resposta) muda de comportamento.

**Componentes:**

- **Filtro de grupo:** compara o `group_jid` do evento com o JID da live semanal (`120363427499061913@g.us`), constante nomeada no módulo 2.
- **Detector de linha nova:** lê, do resultado do `batch` do D1, o `meta.changes` de **cada** `INSERT OR IGNORE` — os resultados voltam na mesma ordem em que os comandos foram enfileirados, então cada linha de `evento.linhas` sabe se entrou agora (`changes = 1`) ou se era reentrega (`changes = 0`).
- **Despacho da ponte:** uma chamada `waitUntil` própria para a ponte do ManyChat, separada do `waitUntil` que já registra horário.
- **Contadores da resposta:** quantas linhas novas, quantas foram encaminhadas à ponte, quantas sem telefone, quantas puladas por serem da equipe.

**Comportamentos:**

- **Evento de grupo que não é a live semanal:** grava como hoje e responde como hoje; a ponte do ManyChat **não é chamada** e nada aparece no log sobre ManyChat.
- **Evento da live semanal com linhas novas:** grava, responde 200 e **só então** chama a ponte, uma vez, com a lista das linhas novas (ação, JID do participante, instante do evento).
- **Reentrega do mesmo evento pelo n8n:** o `INSERT OR IGNORE` não insere nada (`changes = 0` em todas as linhas), a ponte **não é chamada** e a resposta diz `manychat: 'reentrega'`. É este o mecanismo que garante "o fluxo nunca é disparado duas vezes para o mesmo evento".
- **Evento misto (algumas linhas novas, outras já existentes):** só as linhas novas vão para a ponte.
- **Ação `removido`:** tratada como saída para efeito do ManyChat — a pessoa não está mais no grupo, e o contato precisa refletir isso. (Continua gravada como `removido` no D1; a distinção "saiu × removido" não muda no banco.)
- **Falha ao ler `meta.changes`** (resposta do D1 em formato inesperado): a ponte **não** é chamada e o log registra `manychat: 'sem_confirmacao_de_linha_nova'`. Preferir não mandar a arriscar mensagem duplicada.
- **Falha na gravação do D1:** o comportamento atual manda — a ponte nunca chega a ser chamada.
- **A ponte demora, falha ou lança exceção:** a resposta 200 já saiu; nada disso altera status, corpo ou latência da resposta ao n8n.

---

### 2. Ponte grupo da live → ManyChat (arquivo novo: `functions/api/_grupo-live-manychat.js`)

**Descrição:** Módulo novo, com prefixo `_` (o Pages não o transforma em rota), no mesmo lugar dos outros helpers de integração (`_manychat.js`, `_clickup.js`, `_grupo-conversao.js`). Concentra **toda** a regra desta feature: os identificadores da live semanal, quem é pulado, a ordem das chamadas ao ManyChat e o registro do resultado. Nunca lança: quem chama está num caminho best-effort.

**Componentes:**

- **Identificadores da live semanal** (constantes nomeadas e comentadas, no topo do arquivo, com a data em que foram criadas na conta e como descobrir as novas — `GET /fb/page/getTags` e `GET /fb/page/getFlows`):
  - grupo: `120363427499061913@g.us`;
  - tag de pertencimento: `grupo-live-semanal` = **96802043**;
  - fluxo de boas-vindas: `content20260917172557_668685`;
  - tag de controle: `boas-vindas-enviada-live` = **96802947**;
  - tag de saída: `saiu-grupo-live` = **96802046**;
  - tag **intocável**: `grupolive-manual` = **96185696** — citada só para deixar registrado que não é lida nem escrita.
- **Lista de exclusão da equipe:** telefones (dígitos com DDI) das pessoas da casa que administram o grupo — os **6 admins** que foram excluídos à mão na importação de 09/09/2026. Mora neste arquivo, comentada com a origem, porque o payload **não** permite deduzir isso (ver Decisões, item 2).
- **Extração do telefone:** `telefoneDoJid` (de `_grupo-conversao.js`) para tirar o número do JID, seguido de `padronizarTelefone`/`comNonoDigito` (regra única de telefone da casa, `spec-protecoes-integracoes.md`) para chegar ao formato que o ManyChat aceita.
- **Mascaramento para log:** função que devolve só os 4 últimos dígitos (`•••••7857`).
- **Teto de lote:** número máximo de participantes tratados num mesmo evento (padrão **30**). Acima disso os excedentes só aparecem no log.
- **Registro do desfecho:** grava o resultado de cada tentativa na tabela do módulo 4.

**Comportamentos (entrada):**

- **Entrou, com telefone, não é da equipe, ainda não registrada:** inscreve no ManyChat pelo telefone, aplica `grupo-live-semanal`, dispara o fluxo de boas-vindas e, **só se o fluxo for aceito**, aplica `boas-vindas-enviada-live`. Desfecho `inscrito`.
- **Entrou e o WhatsApp já existe na conta** (pessoa que já era contato, inclusive quem tem `grupolive-manual`): o contato existente é procurado pelo `phone`; achado, recebe a tag, o fluxo e a tag de controle no contato que já existe — nenhum contato duplicado é criado. Desfecho `ja_existia_tagueado`.
- **Entrou, o WhatsApp já existe, mas o contato é inencontrável** (nasceu só com WhatsApp, `phone` vazio): nada é aplicado, e o log registra `ja_existia` com o telefone mascarado — é a única forma de saber que isso aconteceu, em vez de a pessoa sumir calada.
- **Entrou e a pessoa está com `saiu-grupo-live` ("voltou"):** a tag de saída é **removida** do contato. A remoção acontece no mesmo tratamento da entrada, depois de a tag de pertencimento ter sido aplicada; falhar na remoção **não** cancela nem repete o fluxo — só vira log.
- **Entrou sem telefone (`@lid` puro):** não inscreve, não tagueia, não dispara fluxo. Registra no log com ação, grupo e o motivo `sem_telefone`, e conta no contador da resposta.
- **Entrou e é da equipe:** pulado por inteiro, com log `equipe`. Nenhuma chamada ao ManyChat é feita.
- **Participante que chega com o campo `admin` preenchido** (`admin`/`superadmin`): também pulado, mesmo motivo `equipe`. É barato e correto, embora raro numa adição.
- **Tag aplicada mas fluxo recusado:** a pessoa fica com `grupo-live-semanal` e **sem** `boas-vindas-enviada-live`. Desfecho `fluxo_falhou`, com o começo da resposta do ManyChat no log. Não há retentativa automática — a tag de controle ausente é o que permite reenviar à mão depois.
- **Fluxo aceito mas tag de controle recusada:** a mensagem foi entregue; desfecho `controle_falhou`, registrado no log. Não se reenvia o fluxo por causa disso.

**Comportamentos (saída):**

- **Saiu (ou foi removido), com telefone, não é da equipe:** procura o inscrito pelo `phone`; achado, aplica `saiu-grupo-live` e **não mexe** em `grupo-live-semanal` nem em `boas-vindas-enviada-live`. Nenhum fluxo é disparado. Desfecho `saida_tagueada`.
- **Saiu e a pessoa não existe no ManyChat** (nunca foi inscrita, ou é inencontrável pela API): **não cria contato nenhum**. Desfecho `saida_sem_inscrito`, no log com telefone mascarado.
- **Saiu sem telefone (`@lid` puro):** só log, motivo `sem_telefone`.
- **Saiu e é da equipe:** pulado, log `equipe`.

**Comportamentos (gerais e de erro):**

- **`MANYCHAT_API` ausente ou vazia:** a ponte desiste de imediato, com um único log `sem_config`, sem tentar nenhuma chamada.
- **Vários participantes no mesmo evento:** tratados **um a um, em sequência** (a API não tem operação em lote e o disparo em série evita estourar a taxa da conta). O resultado de cada um é independente: o erro de um não interrompe os demais.
- **Evento com mais participantes que o teto de lote:** os primeiros 30 são tratados normalmente; os excedentes ficam registrados no log como `lote_grande_nao_processado`, com a contagem — sinal de que houve importação em massa no grupo e de que aquilo precisa de decisão humana, não de 200 mensagens automáticas.
- **Erro de rede ou 5xx do ManyChat:** desfecho `erro`, com o motivo e os primeiros 200 caracteres da resposta no log. Sem retentativa automática, sem fila.
- **Exceção inesperada em qualquer ponto:** capturada dentro da ponte; a ponte termina em silêncio no que diz respeito ao chamador e ruidosa no log.
- **A ponte nunca escreve em `whatsapp_group_events`** nem em `whatsapp_group_conversions`: as duas tabelas seguem sendo assunto do webhook e do sync `EntrouGrupo`.

---

### 3. Novas capacidades no helper do ManyChat (`functions/api/_manychat.js`)

**Descrição:** O helper já cobre "inscrever + taguear + fluxo + tag de controle" (é exatamente o caminho da entrada). Faltam duas operações que a saída e o caso "voltou" exigem. Elas entram **aqui**, com os mesmos contratos do arquivo (nunca lançam, devolvem motivo legível), e passam a estar disponíveis para outras pontes.

**Componentes:**

- **Busca pública de inscrito:** o `buscarInscrito` que hoje é interno passa a ser exportado (ou ganha uma função irmã com nome próprio), para achar alguém pelo `phone` **sem criar contato**.
- **Remoção de tag:** operação que remove uma tag de um contato existente (`/fb/subscriber/removeTag`, mesmo par `subscriber_id` + `tag_id` do `addTag`).
- **Aplicação de tag em contato existente:** taguear alguém já encontrado, sem passar pelo caminho de criação.

**Comportamentos:**

- **Buscar por telefone que existe:** devolve o id do inscrito.
- **Buscar por telefone que não existe** (resposta `success` com `data: []`): devolve vazio — ausência, não erro.
- **Buscar com a API fora do ar:** devolve vazio e o chamador trata como "não achei"; nunca lança.
- **Remover tag de quem tem a tag:** o ManyChat aceita e a operação devolve sucesso.
- **Remover tag de quem não tem a tag:** tratado como sucesso silencioso — o estado desejado ("sem a tag") é o que importa.
- **Remover tag com id inválido ou API recusando:** devolve a descrição da falha para o chamador logar; não lança.
- **Nada do comportamento atual de `inscreverComTag` muda** — a ponte da Greenn continua funcionando igual, com os mesmos desfechos (`inscrito`, `ja_existia_tagueado`, `ja_existia`, `sem_config`, `sem_telefone`, `erro`).
- **O texto de consentimento gravado na criação** deixa de ser fixo em "compra do Workshop Black Exponencial" quando quem chama é o grupo da live: cada ponte informa o seu (aqui, entrada no grupo da live semanal). É o registro de origem do opt-in.

---

### 4. Registro dos envios (tabela nova, migration `0043`)

**Descrição:** Uma tabela pequena que guarda **o que a ponte fez** para cada linha tratada. Não é a dedup principal (essa é o `meta.changes` do módulo 1) — é a segunda trava e, principalmente, a memória: sem ela, "esta pessoa recebeu boas-vindas?" só é respondível abrindo o ManyChat contato por contato.

**Componentes:**

- **Uma linha por tentativa**, com: grupo, telefone padronizado, ação (`entrou`/`saiu`), instante do evento (`occurred_at`, o mesmo gravado em `whatsapp_group_events`), desfecho, detalhe curto do erro (sem dado pessoal), id do inscrito no ManyChat quando houver, e o horário da tentativa.
- **Chave natural única:** grupo + telefone + ação + instante do evento. É a mesma chave de dedup de `whatsapp_group_events` (que também já arredonda o instante ao minuto), então uma reentrega que escapasse do `meta.changes` ainda colidiria aqui.
- **Índice por telefone**, para responder "o que já aconteceu com esta pessoa" sem varrer a tabela (a casa já estourou o limite de leitura do D1 duas vezes por varredura).

**Comportamentos:**

- **Antes de chamar o ManyChat**, a ponte confere se já existe registro para aquela chave natural; se existir, **não chama nada** e encerra com `ja_registrado`.
- **Depois de cada tentativa**, grava o desfecho — inclusive os desfechos ruins (`sem_telefone`, `equipe`, `ja_existia`, `fluxo_falhou`, `erro`). O que não foi feito é tão importante quanto o que foi.
- **Falha ao gravar o registro:** vira log e nada mais; a mensagem já foi enviada e não se desfaz.
- **Falha ao consultar o registro:** a ponte **não** prossegue para o disparo da entrada (o risco é mensagem duplicada) e registra `sem_confirmacao_de_registro`; para a **saída**, prossegue (aplicar duas vezes a mesma tag é inofensivo).
- **A tabela não é lida por nenhuma tela do dash** nesta entrega. É consulta de diagnóstico.
- **A migration não mexe em nenhuma tabela existente** — só cria a nova. (Lembrete da casa: `d1 migrations apply --remote` não roda neste projeto; a migration é aplicada pelo caminho já usado nas últimas.)

---

### 5. Observabilidade

**Descrição:** O que fica visível sem abrir o ManyChat: o corpo da resposta do webhook (que o n8n guarda na execução) e os `console.error` dos logs do Pages. Nenhuma tela nova.

**Componentes:**

- **Resposta do endpoint** (a de hoje, acrescida dos contadores da ponte).
- **Linhas de log**, todas prefixadas `grupo-live-manychat —`, para serem filtráveis nos logs do Pages.

**Comportamentos:**

- **Resposta em evento gravado da live semanal:** mantém `ok`, `status`, `linhas` e `sem_telefone` como hoje, e acrescenta: `linhas_novas` (quantas entraram agora), `manychat` (`'despachado'`, `'reentrega'`, `'nao_e_o_grupo'`, `'sem_config'` ou `'sem_confirmacao_de_linha_nova'`), `equipe` (quantas foram puladas). Os contadores descrevem o **despacho**, não o resultado — a ponte roda depois da resposta, e prometer resultado ali seria mentira.
- **Resposta em qualquer outro grupo:** idêntica à de hoje, com `manychat: 'nao_e_o_grupo'`.
- **Log por desfecho não-feliz:** uma linha com grupo, ação, telefone **mascarado**, desfecho e detalhe curto. `sem_telefone`, `equipe`, `ja_existia`, `saida_sem_inscrito`, `fluxo_falhou`, `controle_falhou`, `erro`, `lote_grande_nao_processado` e `sem_config` todos aparecem.
- **Log do caminho feliz:** uma linha de resumo por evento (quantos inscritos, quantos já existiam, quantas saídas tagueadas, quantos pulados) — resumo, não uma linha por pessoa, para o log não virar lista de telefones.
- **Nunca no log:** telefone inteiro, JID inteiro, nome do participante, payload cru, valor de segredo.

---

## Decisões tomadas (os quatro pontos em aberto)

1. **Como evitar disparo duplicado em reentrega.** Sim, dá para saber se a linha é nova: o `batch` do D1 devolve um resultado por comando, na ordem em que foram enfileirados, e o `meta.changes` de cada `INSERT OR IGNORE` diz se aquela linha entrou (`1`) ou foi ignorada (`0`) — é o mesmo mecanismo que a ponte da Greenn já usa (`gravou?.meta?.changes ? ... : null`). Esse é o **gate principal**, e ele é gratuito. Ele funciona porque `occurred_at` é arredondado ao minuto desde a revisão de 13/09, então a reentrega do n8n colide de propósito. Ainda assim a feature cria a **tabela de registro** do módulo 4: o `meta.changes` protege contra reentrega, mas não responde "quem já recebeu boas-vindas" nem protege um reprocessamento manual futuro. Consequência aceita de propósito: quem **sai e volta em outro minuto** gera linha nova e **recebe boas-vindas de novo** — isso é reentrada de verdade, não reentrega, e é o comportamento pedido (a regra "voltou" existe justamente para esse caso).
2. **Equipe/admins de fora.** Ficam de fora, por **lista fixa de telefones** no arquivo novo, semeada com os 6 admins excluídos à mão em 09/09. **Não** dá para deduzir isso do que existe hoje: o campo `admin` do participante vem `null` justamente para quem está entrando (ninguém entra já admin), `whatsapp_group_events` não guarda papel, `actor_jid` identifica quem **adicionou**, não quem entrou, e não existe no projeto nenhuma lista de telefones da equipe para reusar (a exclusão de equipe dos Workshops é por `google_user_id`, e a da Greenn é por endereço de e-mail — nenhuma serve aqui). Inventar heurística arriscaria pular lead real, que é o erro caro. Como rede extra e de graça, o participante que chegar com `admin` preenchido também é pulado.
3. **Observabilidade.** Módulo 5: a resposta ganha `linhas_novas`, `manychat` e `equipe` (descrevendo o **despacho**, já que a ponte roda depois da resposta); o log ganha uma linha por desfecho não-feliz e um resumo por evento, sempre com telefone mascarado nos 4 últimos dígitos e sem nome, JID inteiro ou payload.
4. **Arquivos.** Um arquivo novo: **`functions/api/_grupo-live-manychat.js`** (ponte + constantes + lista da equipe), no padrão `_nome.js` de `functions/api/`. Além dele: alterações pontuais em `functions/api/webhooks/whatsapp-grupo.js` (gatilho) e em `functions/api/_manychat.js` (buscar sem criar, remover tag, taguear existente), e a migration nova `migrations/0043_manychat_grupo_live.sql`.

---

## Fora de escopo (explicitamente)

- Backfill ou reprocessamento de qualquer entrada anterior ao deploy.
- Grupo de Workshops e qualquer outro grupo monitorado.
- Tela, aba ou relatório no dashboard sobre estes envios.
- Retentativa automática, fila ou cron de recuperação de falhas do ManyChat.
- Qualquer alteração na conversão `EntrouGrupo`, na aba Grupos ou na tag `grupolive-manual`.
- Mensagem de despedida para quem sai.
