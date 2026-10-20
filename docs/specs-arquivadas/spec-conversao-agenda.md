# Spec: Conversão da agenda própria

## Visão Geral

A agenda própria (spec `spec-agenda-propria.md`) substitui o Calendly. Com a
página de agendamento dentro de casa, dá para enxergar o caminho inteiro do lead
comercial, do formulário da LP até a reunião acontecer. Com o Calendly isso era
impossível: o lead saía do site e só voltava a aparecer, quando aparecia, como
reunião marcada.

Hoje o sistema já registra três pontos: o **lead** (formulário da LP), a
**reunião agendada** (com a conversão `Schedule`) e a **presença** (lida no Meet
ou marcada à mão). Faltam as etapas do meio e a leitura em funil.

Esta spec cria:

1. O registro das etapas do lead dentro da agenda: abriu a agenda, escolheu um
   horário, confirmou.
2. Um **funil de conversão da agenda** na Visão geral do dash, por funil de
   marketing, por tipo de reunião e por origem (UTM), com a perda entre cada
   etapa.
3. A **reunião realizada como conversão** no Meta e no GA4.

**Para quem:** Marcelle (decide investimento e cobra o comercial).

**Vale só para tipos comerciais.** RH e entrevistas ficam fora de toda medição,
como já é hoje.

### As etapas do funil da agenda

| # | Etapa | O que conta | De onde vem |
|---|---|---|---|
| 1 | Lead | Enviou o formulário da LP e foi mandado para a agenda | Já existe (convite criado) |
| 2 | Abriu a agenda | Abriu a página de agendamento com o convite | Novo |
| 3 | Escolheu horário | Tocou num horário e chegou na confirmação | Novo |
| 4 | Agendou | Confirmou a reunião | Já existe |
| 5 | Compareceu | Reunião marcada como realizada | Já existe |

Ao lado do funil, sem fazer parte dele: **cancelou** e **faltou**, contados
entre os que agendaram.

**Coorte:** todas as etapas contam pela data em que o lead entrou na etapa 1. Um
lead de 30/09 que agendou em 02/10 conta no período que inclui 30/09. Assim a
taxa de cada etapa fala das mesmas pessoas (mesma regra da Conversão por LP).

---

## Módulos

### 1. Registro das etapas na agenda

**Descrição:** a página de agendamento passa a registrar, para tipos
comerciais, quando o lead abre a agenda e quando escolhe um horário. Tudo fica
dentro de casa: nenhuma dessas duas etapas vai para o Meta nem para o GA4
(mesma regra dos cliques e etapas de formulário de hoje, que não são conversão).

**Componentes:**
- Etapa "abriu a agenda", ligada ao convite do lead.
- Etapa "escolheu horário", ligada ao convite do lead, com o dia e o horário
  escolhidos.

**Comportamentos:**
- Registrar a abertura: a primeira vez que o lead abre a agenda com o convite,
  a etapa 2 é registrada. Abrir de novo não conta outra vez.
- Registrar a escolha: a primeira vez que o lead toca num horário e chega na
  confirmação, a etapa 3 é registrada. Trocar de horário não conta outra vez.
- Ligar ao lead: as duas etapas ficam ligadas ao mesmo lead e à mesma origem
  (UTM) do formulário.
- Ignorar o que não é lead real: abertura pela pré-visualização da equipe, por
  e-mail de teste ou por robô não entra no funil.
- Não registrar nada para tipos não comerciais.

---

### 2. Funil da agenda (Visão geral)

**Descrição:** um bloco novo na **Visão geral**, "Agenda: do lead à reunião",
logo depois do painel por funil. Segue o período e o filtro de funil do topo,
como o resto da Visão geral.

**Componentes:**
- Funil com as 5 etapas: quantidade em cada uma, passagem para a próxima (%) e
  a maior perda destacada.
- Números do período: leads mandados para a agenda, agendaram, compareceram,
  taxa lead → reunião realizada, cancelados e faltas, cada um com a comparação
  ao período anterior.
- Tabela por funil de marketing (sessão estratégica, aplicação mentoria,
  tráfego, calculadora) com as mesmas etapas em colunas. Some quando o filtro de
  funil do topo está ligado, como o painel por funil.
- Tabela por origem (canal e campanha, como a CPL por canal) com as mesmas
  etapas.
- Tabela por tipo de reunião com as mesmas etapas.
- Tempo até agendar: mediana entre o formulário e a confirmação.
- Aviso de período sem dado: antes da agenda própria entrar no ar, o funil não
  existe; o período anterior aparece como "sem dado", não como zero.

**Comportamentos:**
- Mudar o período pelo filtro do topo: o bloco acompanha.
- Filtrar por funil pelo filtro do topo: o bloco mostra só aquele funil.
- Ordenar as tabelas por qualquer coluna.
- Ver a perda entre duas etapas: passar o mouse ou tocar na passagem mostra
  quantas pessoas pararam ali.
- Ver o bloco vazio com explicação quando ainda não há lead mandado para a
  agenda no período.

---

### 3. Reunião realizada como conversão

**Descrição:** hoje o Meta e o GA4 recebem o `Lead` (formulário) e o
`Schedule` (agendou). O que importa para a venda é a reunião **acontecer**.
Este módulo manda a presença como conversão, para as campanhas poderem otimizar
por quem comparece e não só por quem agenda.

**Componentes:**
- Conversão "reunião realizada" no Meta (pixel atual) e no GA4, ligada ao mesmo
  lead.

**Comportamentos:**
- Enviar a conversão quando a reunião vira "realizada", seja pela leitura do
  Meet, seja à mão.
- Enviar uma vez só por reunião, mesmo que a presença seja corrigida várias
  vezes.
- Não enviar quando a presença é corrigida de realizada para faltou depois do
  envio (fica registrado no histórico; o Meta não aceita desfazer).
- Respeitar o prazo do Meta: presença marcada mais de 7 dias depois da reunião
  não é enviada (o Meta recusa) e fica registrada como "fora do prazo".
- Não enviar para e-mails de teste nem para tipos não comerciais.

---

### 4. Reuniões e custo por reunião (Visão geral)

**Descrição:** a Visão geral passa a mostrar, no painel geral e em cada funil,
quantas reuniões foram agendadas e realizadas e quanto custou cada uma. Pedido
de 02/10, depois da aprovação, pela própria usuária.

**Regra do custo (granular por funil):**
- **Custo por reunião agendada (custo por RA)** = investimento do funil no
  período ÷ reuniões agendadas daquele funil no período.
- **Custo por reunião realizada (custo por RR)** = investimento do funil no
  período ÷ reuniões realizadas daquele funil no período.
- O investimento do funil é o **mesmo do CPL** (mapa de campanha para funil da
  aba Campanhas). Lead de sessão estratégica usa o investimento de sessão
  estratégica, e assim por diante.
- O funil da reunião é o funil do **formulário de onde o lead veio** (não o do
  tipo de reunião).
- Reunião **agendada** conta pela data em que o lead agendou. Reunião
  **realizada** conta pela data em que a reunião aconteceu. É o mesmo jeito
  que o CPL conta lead pela data do lead.
- No painel geral, o custo divide o investimento **só dos funis que agendam
  reunião** pelo total de reuniões. Investimento de workshop ou de live não
  entra no custo por reunião.
- Só tipos comerciais, sem e-mail de teste.

**Componentes:**
- Painel geral: cartões Reuniões agendadas, Reuniões realizadas, Custo por
  reunião agendada e Custo por reunião realizada, com a comparação ao período
  anterior.
- Painel de cada funil: os mesmos quatro números.

**Comportamentos:**
- Mudar o período: os quatro números acompanham.
- Filtrar por funil no topo: o painel geral mostra os números daquele funil.
- Ver "sem investimento" no custo quando o funil não teve gasto no período.
- Ver "nenhuma reunião" no custo quando houve gasto e nenhuma reunião.
- Ver o custo subir como alerta (custo maior é pior), igual ao CPL.

---

## Fora do escopo

- Medir a etapa "viu a página de obrigado" ou qualquer etapa depois da reunião
  (proposta, venda). A venda continua no CRM.
- Comparar com o período do Calendly: não há dado das etapas do meio antes da
  agenda própria.
- Lista de quem abandonou a agenda (recebeu o convite e não agendou): decidido
  em 02/10 que não precisa.
- Reenviar por e-mail ou WhatsApp para quem abandonou (só a lista; o contato é
  do comercial).
- Teste A/B da página de agendamento.

## Decisões tomadas (02/10)

1. **Lista de quem abandonou:** não precisa.
2. **Reunião realizada** vai para o Meta (pixel atual) e o GA4 como conversão.
   Depois do envio, a conversão personalizada é criada no Meta pela equipe.
3. **O funil fica na Visão geral**, como bloco próprio depois do painel por
   funil.
4. **Reuniões e custo por reunião na Visão geral (módulo 4):** pedido dela em
   02/10. Custo granular por funil, com o mesmo investimento do CPL.
5. **Ativação junto com a agenda:** o registro das etapas e a conversão de
   reunião realizada só passam a valer de verdade quando a agenda própria for
   ativada nas LPs (issue 364). Até lá funcionam só na prévia.

## Perguntas em aberto

Nenhuma.
