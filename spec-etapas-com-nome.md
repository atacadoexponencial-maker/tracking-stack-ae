# Spec: Etapas do formulário com nome

> série: S6
> estado: aprovada em 05/11/2026

## Visão Geral

O funil de micro-conversões do dash (tabela "Conversão por LP", ao expandir uma
página) mostra quantas pessoas concluíram cada etapa do formulário. Hoje cada
etapa só é conhecida pela **posição** ("concluíram a etapa 6"). Quando uma
pergunta entra no meio do formulário, todas as seguintes mudam de número, e o
dash passa a somar perguntas diferentes debaixo do mesmo rótulo.

Foi o que aconteceu em 05/11, quando a pergunta do cargo entrou no chat antes
do principal desafio (commit 93078bd): a "etapa 7", que era o desafio, passou a
ser o cargo, e qualquer período que cruze essa data mistura as duas.

A mudança dá **nome** a cada etapa (ex.: faturamento, cargo, desafio). O dash
passa a mostrar o funil pelo nome da pergunta, e acrescentar, tirar ou trocar
uma pergunta de lugar não mistura mais os números. O histórico já gravado
ganha nome também, porque até 05/11 a ordem de cada formulário era fixa.

É para quem analisa o funil no dash (a usuária e o time de marketing).

## Páginas / Módulos

### Chat de inscrição (home, /se-v1, /se-v3, /se-v4, /consultoria-gratuita-atacado, /vsl)

**Descrição:** o chat que faz as perguntas uma a uma. Cada pergunta respondida
conta como uma etapa concluída, menos a última, que já é o envio do lead.

**Componentes:**
- Perguntas do chat: nome, WhatsApp, e-mail, Instagram, faturamento, cargo,
  desafio, objetivo.

**Comportamentos:**
- Responder uma pergunta registra a etapa concluída com o nome daquela pergunta.
- Toda pergunta do chat tem um nome; uma pergunta sem nome não chega ao ar.

**Critérios de aceite:**

#### CA-S6-01 — Responder uma pergunta do chat registra o nome dela · prova: automática

- **Dado** uma pessoa no chat de inscrição
- **Quando** ela responde a pergunta do cargo
- **Então** a etapa concluída fica registrada com o nome "cargo", e não só com a posição

#### CA-S6-02 — Pergunta nova sem nome é barrada antes de ir ao ar · prova: automática

- **Dado** alguém que acrescenta uma pergunta ao chat sem dar nome a ela
- **Quando** os testes do projeto rodam
- **Então** um teste falha dizendo qual pergunta está sem nome

#### CA-S6-03 — Nomes repetidos no mesmo formulário são barrados · prova: automática

- **Dado** duas perguntas do chat com o mesmo nome
- **Quando** os testes do projeto rodam
- **Então** um teste falha apontando o nome repetido

### Formulário de aplicação em cartão (/aplicacao-mentoria, /aplicacao-trafego-atacado, /materiais/...)

**Descrição:** o formulário de 3 cartões. Concluir o cartão 1 e o cartão 2
conta como etapa; o cartão 3 é o envio.

**Componentes:**
- Cartão 1 (nome, WhatsApp, Instagram) e cartão 2 (e-mail, faturamento,
  investimento quando existe, cargo).

**Comportamentos:**
- Avançar do cartão 1 registra a etapa com o nome do cartão 1.
- Avançar do cartão 2 registra a etapa com o nome do cartão 2.

**Critérios de aceite:**

#### CA-S6-04 — Avançar um cartão registra o nome dele · prova: automática

- **Dado** uma pessoa no formulário de aplicação
- **Quando** ela conclui o cartão 1 e depois o cartão 2
- **Então** as duas etapas ficam registradas com os nomes "contato" e "perfil", respectivamente

### Registro das etapas (backend)

**Descrição:** recebe as etapas concluídas enviadas pelas páginas e guarda.

**Comportamentos:**
- Guarda o nome da etapa junto com a posição.
- Recusa nome fora do formato esperado sem perder a etapa.

**Critérios de aceite:**

#### CA-S6-05 — O nome da etapa fica guardado · prova: automática

- **Dado** uma etapa concluída que chega com nome e posição
- **Quando** ela é registrada
- **Então** o registro guarda o nome e a posição

#### CA-S6-06 — Nome inválido não derruba a etapa · prova: automática

- **Dado** uma etapa que chega com nome vazio, longo demais (mais de 40 caracteres) ou com caracteres fora de letras minúsculas, números e hífen
- **Quando** ela é registrada
- **Então** a etapa é guardada com a posição e sem nome, como acontecia antes desta mudança

### Histórico já gravado (carga única)

**Descrição:** dá nome às etapas gravadas antes desta mudança, usando a ordem
que cada formulário tinha na época.

**Comportamentos:**
- Etapas do chat gravadas antes de 05/11 20h32 recebem o nome pela ordem antiga
  (1 nome, 2 WhatsApp, 3 e-mail, 4 Instagram, 5 faturamento, 6 desafio).
- Etapas do chat gravadas entre 05/11 20h32 e a entrada desta mudança no ar
  recebem o nome pela ordem nova (… 5 faturamento, 6 cargo, 7 desafio).
- Etapas do formulário em cartão recebem "contato" (1) e "perfil" (2), em
  qualquer data.

**Critérios de aceite:**

#### CA-S6-07 — Etapa antiga do chat ganha o nome certo · prova: automática

- **Dado** uma etapa 6 do chat gravada antes de 05/11 20h32
- **Quando** a carga do histórico roda
- **Então** ela passa a se chamar "desafio"

#### CA-S6-08 — Etapa do chat entre a pergunta nova e esta mudança ganha o nome certo · prova: automática

- **Dado** uma etapa 6 e uma etapa 7 do chat gravadas depois de 05/11 20h32 e antes desta mudança no ar
- **Quando** a carga do histórico roda
- **Então** elas passam a se chamar "cargo" e "desafio"

#### CA-S6-09 — Etapa antiga do cartão ganha o nome certo · prova: automática

- **Dado** etapas 1 e 2 do formulário em cartão gravadas antes desta mudança
- **Quando** a carga do histórico roda
- **Então** elas passam a se chamar "contato" e "perfil"

#### CA-S6-10 — Depois da carga, nenhuma etapa conhecida fica sem nome · prova: manual

- **Dado** o banco de produção depois da carga do histórico
- **Quando** se conta quantas etapas concluídas estão sem nome
- **Então** o número é zero, ou as que sobraram são explicadas uma a uma (ex.: página que não tem chat nem cartão)

### Funil no dash (Conversão por LP, ao expandir a página)

**Descrição:** mostra os degraus da página: acessaram, clicaram, tocaram no
formulário, etapas concluídas e viraram lead.

**Comportamentos:**
- Cada etapa aparece com o nome da pergunta, em linguagem de gente.
- As etapas aparecem na ordem atual do formulário.
- A mesma pergunta soma o período inteiro, mesmo que tenha mudado de posição.
- Uma etapa que passou a existir dentro do período aparece com aviso da data em
  que começou a ser medida, e a passagem dela não é comparada com as vizinhas.

**Critérios de aceite:**

#### CA-S6-11 — O funil mostra o nome da pergunta · prova: automática

- **Dado** etapas concluídas do chat com os nomes "faturamento" e "cargo"
- **Quando** o funil da página é montado
- **Então** os degraus aparecem como "responderam o faturamento" e "responderam o cargo", e não como "concluíram a etapa 5" e "concluíram a etapa 6"

#### CA-S6-12 — A mesma pergunta soma o período todo, mesmo mudando de posição · prova: automática

- **Dado** 10 pessoas que responderam o desafio quando ele era a etapa 6 e 5 que responderam quando ele passou a ser a etapa 7
- **Quando** o funil do período que cobre as duas fases é montado
- **Então** o degrau "responderam o desafio" mostra 15

#### CA-S6-13 — Os degraus seguem a ordem atual do formulário · prova: automática

- **Dado** um período com etapas do chat antes e depois da entrada do cargo
- **Quando** o funil é montado
- **Então** o cargo aparece entre o faturamento e o desafio

#### CA-S6-14 — Etapa nova no período aparece com aviso e sem comparação · prova: automática

- **Dado** um período que começa antes de 05/11 e termina depois
- **Quando** o funil do chat é montado
- **Então** o degrau do cargo aparece com o aviso "medida desde 05/11", não tem percentual de passagem, não é apontado como a maior queda e não altera os números dos degraus vizinhos

#### CA-S6-15 — Período todo depois da mudança mostra o cargo normalmente · prova: automática

- **Dado** um período que começa depois de 05/11 20h32
- **Quando** o funil do chat é montado
- **Então** o degrau do cargo aparece sem aviso e com percentual de passagem como os outros

#### CA-S6-16 — Etapa sem nome continua aparecendo · prova: automática

- **Dado** uma etapa concluída que ficou sem nome (CA-S6-06)
- **Quando** o funil é montado
- **Então** ela aparece como "concluíram a etapa N", como antes, e não some

#### CA-S6-17 — Conferência no ar · prova: manual

- **Dado** a mudança no ar e a carga do histórico feita
- **Quando** a usuária abre a Conversão por LP nos últimos 30 dias e expande a home
- **Então** vê as etapas com o nome das perguntas, o cargo entre o faturamento e o desafio com o aviso de data, e o número do desafio coerente com o período inteiro

## Fora de escopo

- Medir cada campo do formulário em cartão separadamente (o cartão continua sendo uma etapa só).
- Contar a última pergunta do chat (objetivo) como etapa: ela continua sendo o envio do lead.
- Outros formulários que hoje não registram etapas (modal de lead, aplicação do plano ao vivo).
- Linha do tempo do lead nos e-mails (`_email-acontecimentos`): ela só lê o nome do evento, não a etapa.
- Mudar quais perguntas o chat ou o cartão fazem.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S6-01 | Os nomes internos das etapas são: chat = nome, whatsapp, email, instagram, faturamento, cargo, desafio; cartão = contato, perfil. No dash aparecem como "responderam o …" (chat) e "preencheram o contato / o perfil" (cartão). | confirmada | Usuária, 05/11 (aprovação da spec) |
| SUP-S6-02 | A ordem do chat antes de 05/11 20h32 foi sempre a mesma desde que as etapas começaram a ser medidas (31/08). | confirmada | Histórico do Git (05/11): de 31/08 até 93078bd o chat só mudou o texto da pergunta do desafio (7a15faf, 16/10), não a ordem; o cartão ganhou a folha de rosto (470bee8), que não é etapa |
| SUP-S6-03 | O corte da carga do histórico é o horário do commit 93078bd (05/11 20h32 BRT). Quem abriu a página antes do deploy e respondeu depois pode cair do lado errado do corte; são poucos casos e ficam aceitos. | confirmada | Usuária, 05/11 (aprovação da spec) |
| SUP-S6-04 | A "data em que começou a ser medida" de cada etapa é a primeira vez que aquele nome aparece no banco para aquela página, e não uma data escrita à mão. | confirmada | Usuária, 05/11 (aprovação da spec) |
| SUP-S6-05 | Nome de etapa que o dash não conhece (pergunta nova sem rótulo cadastrado) aparece como "responderam: <nome>", em vez de sumir ou virar "etapa N". | confirmada | Usuária, 06/11 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S6-01 | Num período que cruza 05/11, como a etapa do cargo aparece? | respondida | Aparece com aviso "medida desde 05/11" e sem comparação com as vizinhas (usuária, 05/11) |
