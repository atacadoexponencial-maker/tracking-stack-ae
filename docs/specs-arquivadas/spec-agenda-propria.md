# Spec: Agenda própria (substituir o Calendly)

## Visão Geral

Hoje todo agendamento do Atacado Exponencial passa pelo Calendly: o lead escolhe
um horário, o Calendly confere conflito na agenda do Felipe, cria a reunião com
Meet na agenda **SETE | COMERCIAL** (felipe@seteads.com). Isso tem três
problemas:

1. Quem agenda pelo link direto do Calendly (bio, WhatsApp, link antigo) não
   vira lead no dash nem card no CRM. Já houve dois casos confirmados de lead
   perdido (Vanessa em 25/06, Raquel em 18/07).
2. O dash não enxerga agendamentos, então CPL e conversão por funil ficam
   subestimados.
3. O lead que acabou de preencher o formulário da LP precisa digitar tudo de
   novo no Calendly.

A agenda própria faz o mesmo trabalho dentro da casa, para as reuniões
individuais (consultorias, RH e entrevistas): a equipe configura agendas
e tipos de reunião na central de marketing (dash), o lead agenda numa página do
site e a reunião entra no dash como **reunião agendada**.

O lead continua nascendo só no formulário da LP. Nos tipos comerciais não existe
link direto: a página de agendamento só abre depois do formulário, com os dados
do lead já preenchidos, e ele só escolhe o horário e confirma. Isso fecha o
furo do item 1 (não há mais como agendar sem passar pelo formulário).

**Para quem:** a equipe (configura e acompanha no dash) e os leads e
candidatos (agendam, remarcam e cancelam pelo site).

**O que a sonda de 01/10 já provou:** a credencial Google que a casa já usa
alcança a conta felipe@seteads.com, enxerga todas as agendas dele (SETE |
COMERCIAL, FELIPE SANTOS | CEO, FELIPE SANTOS | PESSOAL e outras), lê os horários
ocupados e cria evento com link do Meet. Também lê quem entrou em cada sala do
Meet das consultorias (o Google guarda esse registro por cerca de 30 dias).
Não precisa de credencial nova para a agenda.

**Ponto de partida (configuração atual do Calendly, lida em 01/10):**

| Tipo | Duração | Pergunta extra | Disponibilidade usada |
|---|---|---|---|
| Consultoria Individual | 45 min | nenhuma | a confirmar |
| Consultoria Individual - Live Semanal | 45 min | "Qual a sua média de faturamento mensal?" (escolha única, obrigatória) | a confirmar |
| Reunião Individual \| Tráfego Pago Atacado | 45 min | nenhuma | a confirmar |
| Entrevista \| Gestor de Tráfego | 30 min | campo livre opcional | a confirmar |
| RH - Entrevistas / RH - Entrevistas R2 | 30 min | campo livre opcional | a confirmar |

Grades de horário cadastradas no Calendly (fuso de São Paulo):
- **Horários de mentoria:** seg 14h–21h; ter a qui 9h30–12h e 13h–21h; sex 9h30–12h e 13h–18h.
- **Reunião de Negócios:** seg 15h–18h; ter 10h–11h e 15h–18h; qua 10h–12h e 17h–18h; qui 10h–12h; sex 9h–10h e 14h–16h; sáb 9h–11h.

Workshops: no Calendly eram eventos em grupo, um por data, usados como
confirmação de presença. Estão todos desativados desde o de 26/08 e ficam fora
desta spec (ver "Fora do escopo").

---

## Módulos

### 1. Agendas conectadas (dash)

**Descrição:** lista das agendas Google que o sistema enxerga e o papel de cada
uma: consultada para conflito, destino das reuniões, ou as duas coisas.

**Componentes:**
- Lista de agendas: nome da agenda, conta dona (ex.: felipe@seteads.com) e
  papel (consultar conflito / receber reuniões).
- Indicador de saúde por agenda: última leitura bem-sucedida e erro, se houver.
- Campo para adicionar uma conta do Workspace (@seteads.com).

**Comportamentos:**
- Adicionar conta: a equipe digita um e-mail @seteads.com e o sistema passa a
  listar as agendas daquela conta.
- Ver agendas da conta: o sistema mostra todas as agendas que a conta enxerga.
- Marcar agenda para conflito: a agenda passa a bloquear horários em todos os
  tipos de reunião que a usam. Ponto de partida: só SETE | COMERCIAL, que é
  também a agenda de destino (igual ao Calendly hoje).
- Desmarcar agenda de conflito: a agenda deixa de bloquear horários.
- Remover conta: as agendas dela somem da lista. Se alguma era destino de um
  tipo ativo, o sistema avisa antes e não deixa remover.
- Recusar conta de fora do Workspace: e-mail que não é @seteads.com mostra
  mensagem explicando que esse tipo de conta não é aceito nesta versão.
- Alerta de conexão quebrada: se a leitura de uma agenda falhar, a agenda
  aparece em vermelho e entra no aviso diário de credenciais, como as outras
  integrações.

---

### 2. Grades de disponibilidade (dash)

**Descrição:** grades de horário com nome, criadas livremente pela equipe e
reaproveitadas pelos tipos de reunião (ex.: "Horários de mentoria", "Reunião de
Negócios", "Entrevistas RH"). As duas grades atuais do Calendly entram como
ponto de partida.

**Componentes:**
- Lista de grades: nome, resumo dos horários e quantos tipos usam cada uma.
- Editor da grade: faixas de horário por dia da semana (mais de uma faixa por
  dia), datas bloqueadas e datas com horário diferente.

**Comportamentos:**
- Criar grade.
- Dar nome à grade.
- Adicionar faixa de horário num dia da semana.
- Remover faixa de horário.
- Copiar as faixas de um dia para outros dias.
- Bloquear uma data (feriado, viagem).
- Definir horário diferente numa data específica.
- Remover bloqueio ou exceção de data.
- Duplicar grade.
- Excluir grade: só permitido se nenhum tipo de reunião usa a grade.

---

### 3. Tipos de reunião 1:1 (dash)

**Descrição:** cadastro de cada tipo de reunião individual (Consultoria
Individual, Tráfego Pago Atacado, entrevistas...), equivalente aos "tipos de
evento" do Calendly.

**Componentes:**
- Lista de tipos: nome, duração, link público, situação (ativo/pausado) e
  quantidade de agendamentos futuros.
- Filtro da lista por situação: ativos (padrão ao abrir), pausados ou todos.
- Formulário do tipo com:
  - nome e endereço do link público (ex.: /agendar/consultoria-individual)
  - duração
  - agenda de destino (onde a reunião é criada)
  - agendas consultadas para conflito
  - grade de disponibilidade (escolhida entre as grades do módulo 2)
  - folga antes e depois de cada reunião
  - antecedência mínima para agendar (ex.: não aceitar para daqui a 2 horas)
  - até quantos dias no futuro o lead pode agendar
  - limite de reuniões por dia
  - de quanto em quanto tempo os horários começam (ex.: a cada 15, 30 ou 45 min)
  - perguntas extras (texto livre ou escolha única, obrigatória ou não)
  - título do evento na agenda (ex.: "{nome} e Atacado Exponencial")
  - se é reunião comercial (sim para consultorias; não para RH e
    entrevistas). Comercial: só abre depois do formulário da LP, conta em
    Reuniões agendadas, registra no card do CRM e manda conversão. Não
    comercial: link direto com formulário próprio, sem nada disso.
  - funil a que a reunião pertence (só quando é comercial)
  - página para onde o lead vai depois de confirmar

**Comportamentos:**
- Criar tipo de reunião.
- Editar tipo de reunião: mudanças valem para agendamentos novos; reuniões já
  marcadas não mudam.
- Duplicar tipo de reunião: copia toda a configuração com nome novo.
- Filtrar a lista por situação: ao abrir, só os ativos aparecem; os pausados
  ficam a um clique, sem poluir a visão.
- Pausar tipo: o link público passa a mostrar "agenda indisponível" com um
  contato alternativo; reuniões já marcadas continuam.
- Reativar tipo pausado.
- Excluir tipo: só permitido sem reuniões futuras.
- Copiar link público do tipo.
- Pré-visualizar a página pública como o lead vê.
- Adicionar pergunta extra.
- Remover pergunta extra.
- Reordenar perguntas extras.
- Ver horários livres dos próximos dias, para conferir a configuração antes de
  divulgar o link.

---

### 4. Página pública de agendamento (site)

**Descrição:** a página do site onde o lead escolhe dia e horário e confirma a
reunião. Segue a identidade visual do site.

**Componentes:**
- Cabeçalho com nome do tipo, duração e "Google Meet".
- Calendário do mês com os dias que têm horário livre destacados.
- Lista de horários livres do dia escolhido.
- Fuso horário do lead, com opção de trocar.
- Tipos comerciais: resumo com nome, e-mail e WhatsApp do lead já preenchidos,
  vindos do formulário da LP, mais as perguntas extras do tipo (se houver).
- Tipos não comerciais: formulário com nome, e-mail, WhatsApp e as perguntas
  extras do tipo.
- Botão de confirmar.
- Mensagem de "agenda indisponível" quando o tipo está pausado ou sem horários.

**Comportamentos:**
- Escolher dia: mostra os horários livres daquele dia.
- Navegar entre meses dentro da janela permitida.
- Trocar fuso: os horários são reexibidos no fuso escolhido.
- Escolher horário: abre o formulário.
- Voltar do formulário para a escolha de horário sem perder o que já digitou.
- Chegar do formulário da LP (tipos comerciais): o lead escolhe o horário e vê
  os próprios dados já preenchidos, só para conferir e confirmar. Pode
  corrigir um dado errado antes de confirmar.
- Abrir tipo comercial sem ter passado pelo formulário (link copiado,
  compartilhado ou expirado): não mostra a agenda; manda para a LP do funil
  do tipo.
- Confirmar agendamento: o sistema confere de novo se o horário continua livre
  em todas as agendas de conflito antes de reservar.
- Horário ocupado no meio do caminho: se alguém pegou o horário ou entrou um
  compromisso na agenda, o lead vê a mensagem e volta para escolher outro, com
  os dados do formulário preservados.
- Validar campos: e-mail inválido, WhatsApp inválido ou pergunta obrigatória em
  branco impedem a confirmação e mostram o erro no campo.
- Tipos não comerciais (RH, entrevistas): o candidato preenche o formulário
  da própria página; o agendamento não entra no tracking.
- Bloquear robô: agendamento vindo de robô ou de IP bloqueado não cria reunião,
  com as mesmas regras de bloqueio que os formulários do site já usam.

---

### 5. Confirmação do agendamento

**Descrição:** o que acontece logo depois que o lead confirma.

**Componentes:**
- Página de confirmação com dia, horário, link do Meet e botões "adicionar à
  minha agenda", "remarcar" e "cancelar".
- Convite na agenda do lead com o link do Meet.
- E-mail de confirmação: fica para uma entrega posterior (ver "Perguntas em
  aberto"). Até lá, o aviso ao lead é o convite do Google e a página de
  confirmação.

**Comportamentos:**
- Criar a reunião: o evento é criado na agenda de destino do tipo, com Meet, e o
  lead entra como convidado.
- Mandar o lead para a página definida no tipo (hoje /obrigado), levando os
  dados que essa página já espera.
- Contar em Reuniões agendadas: a reunião entra no dash como reunião agendada
  do funil do tipo, ligada ao lead que preencheu o formulário (mesmas UTMs e
  origem). Não cria lead novo nem conta de novo como lead. Só tipos comerciais.
- Registrar no card do CRM (ClickUp): o card já foi criado pelo formulário; a
  reunião é registrada nele (dia, horário, tipo). Só tipos comerciais.
- Enviar conversão `Schedule` para o Meta (pixel atual, navegador + servidor,
  sem duplicar) e para o GA4. É um evento separado do `Lead` do formulário.
  Só tipos comerciais.
- Não registrar nada no tracking, no CRM, no Meta nem no GA4 para tipos não
  comerciais (RH, entrevistas).

---

### 6. Remarcar e cancelar (lead)

**Descrição:** o lead muda ou desmarca a própria reunião pelo link do e-mail ou
da página de confirmação, sem falar com ninguém.

**Componentes:**
- Página de gerenciamento da reunião, acessada por link único do agendamento.
- Mesma escolha de dia e horário da página pública, para remarcar.
- Campo opcional de motivo do cancelamento.

**Comportamentos:**
- Abrir o link de gerenciamento: mostra a reunião marcada.
- Remarcar: o lead escolhe novo horário livre; o evento muda de horário na
  agenda (o link do Meet se mantém) e sai um e-mail novo.
- Cancelar: o evento é cancelado na agenda, o lead recebe a confirmação do
  cancelamento e o card do CRM registra o cancelamento.
- Informar motivo do cancelamento (opcional).
- Bloquear mudança em cima da hora: abaixo da antecedência mínima do tipo, a
  página não deixa remarcar nem cancelar e mostra um contato.
- Link de reunião que já passou ou já foi cancelada: mostra a situação e o link
  para agendar de novo.

---

### 7. Lembretes

**Descrição:** avisos automáticos antes da reunião, para reduzir falta. Saem
por e-mail de um endereço do nosso domínio, sem passar pelo GHL.

**Componentes:**
- Configuração por tipo de reunião: quando lembrar (ex.: 24h antes, 1h antes).
- Texto de cada e-mail (confirmação, lembrete, remarcação, cancelamento)
  editável por tipo.

**Comportamentos:**
- Enviar lembrete por e-mail no horário configurado.
- Não enviar lembrete de reunião cancelada ou remarcada para outro horário.
- Reprogramar lembretes quando a reunião é remarcada.
- Editar o texto de um e-mail do tipo.
- Mandar e-mail de teste para a própria equipe.
- Registrar falha de envio: e-mail que não saiu ou voltou aparece no detalhe
  do agendamento e entra no aviso diário de integrações.

---

### 8. Agendamentos (dash)

**Descrição:** a lista de reuniões marcadas, para a equipe acompanhar e agir.

**Componentes:**
- Lista com data, horário, nome, e-mail, WhatsApp, tipo, funil, origem (UTM) e
  situação (marcada, remarcada, cancelada, realizada, faltou).
- Filtros por período, tipo e situação.
- Detalhe do agendamento com as respostas das perguntas extras e o histórico
  (agendou, remarcou, cancelou).
- Números do período: agendados, cancelados, faltas e taxa de comparecimento.

**Comportamentos:**
- Filtrar por período.
- Filtrar por tipo de reunião.
- Filtrar por situação.
- Abrir o detalhe do agendamento.
- Abrir o card do lead no CRM a partir do agendamento.
- Cancelar pela equipe: cancela na agenda e avisa o lead por e-mail.
- Remarcar pela equipe: escolhe novo horário e avisa o lead.
- Marcar presença ou falta automaticamente: no dia seguinte, o sistema confere
  a sala do Meet da reunião. Se entrou alguém de fora da equipe, vira
  "realizada"; se não entrou ninguém de fora, vira "faltou".
- Corrigir presença ou falta à mão: para reunião que aconteceu fora do Meet
  (telefone, WhatsApp) ou leitura errada.
- Ver "sem informação de presença" quando a leitura do Meet não trouxe nada,
  em vez de marcar falta no escuro.
- Ver a reunião criada direto na agenda: um evento apagado ou movido à mão no
  Google aparece com a situação atualizada no dash.

---

### 9. Transição do Calendly

**Descrição:** trocar sem perder agendamento nem lead no meio do caminho.

**Comportamentos:**
- Trocar o destino dos formulários: os redirecionamentos que hoje mandam para o
  Calendly (formulários das LPs e o roteamento do tráfego por investimento)
  passam a mandar para o tipo de reunião equivalente da agenda própria.
- Conviver com reuniões antigas: reuniões já marcadas pelo Calendly continuam
  valendo e aparecem como compromisso ocupado (bloqueiam o horário), sem
  serem migradas.
- Redirecionar links antigos: o endereço antigo de cada tipo comercial no
  Calendly passa a apontar para a LP do funil (não existe mais link direto de
  agendamento); os de RH e entrevistas apontam para o tipo novo. Configuração
  feita pela equipe no próprio Calendly, até ele ser desligado.
- Desligar o Calendly: só depois que a última reunião marcada por ele tiver
  passado e os links antigos tiverem sido trocados.

---

## Fora do escopo desta versão

- Agendas de contas fora do Workspace (Gmail pessoal). Exigiria login do Google
  por pessoa; fica para depois, se um dia precisar.
- Rodízio de atendentes (distribuir reuniões entre várias pessoas). Hoje só o
  Felipe atende.
- Cobrança no agendamento.
- Migrar o histórico de reuniões antigas do Calendly para o dash.
- Sair do GHL por completo (e-mail de marketing, listas, campanhas). Aqui entra
  só o e-mail da própria agenda. Mas o jeito de enviar deve servir também para
  esse projeto depois, para não precisar refazer.
- Lembrete por WhatsApp.
- Workshop. A confirmação de presença pelo Calendly já não é usada desde a
  edição de 26/08; a inscrição continua pelo formulário da LP e pelo grupo.
  Consequência registrada à parte: a aba Workshops usa os inscritos do
  Calendly como denominador da taxa de presença e precisa de outro (decisão
  separada desta spec).

## Decisões tomadas (01/10)

1. **Conflito:** só SETE | COMERCIAL bloqueia horário, que é também a agenda de
   destino.
2. **RH e entrevistas** entram na agenda própria e **não** viram lead, card no
   CRM nem conversão.
3. **Sellflux** não é mais usado: a agenda não avisa o Sellflux.
4. **E-mail** da agenda sai do nosso domínio, sem GHL, por um serviço de envio
   que sirva depois para a saída do GHL (escolha do serviço fica para o /plan).
5. **Grades de horário** livres, com nome, quantas a equipe quiser.
6. **Falta** é marcada pela presença no Meet, com correção manual possível.
7. **Lista de tipos** abre só com os ativos; pausados ficam num filtro.
8. **Workshop** fica fora: a confirmação pelo Calendly já não era usada.

## Decisões tomadas (02/10)

9. **Agendar não vira lead.** O lead nasce só no formulário da LP; a reunião
   entra no dash como **Reuniões agendadas**.
10. **Sem link direto** nos tipos comerciais: a agenda só abre depois do
    formulário, com os dados do lead preenchidos para ele só confirmar.
11. **Conversão `Schedule`** vai para o Meta (pixel atual) e o GA4.
12. **E-mails (confirmação e lembretes) ficam para depois**, numa entrega
    separada. Serviço: Resend (conta ainda não criada).

## Perguntas em aberto

1. **E-mails (entrega posterior):** o endereço remetente ainda não existe e
   precisa ser definido, assim como a caixa que recebe as respostas do lead.
   Não trava as outras entregas.
