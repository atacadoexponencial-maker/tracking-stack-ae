# Spec: Serviço de e-mail próprio (agenda + marketing)

## Visão Geral

Hoje o e-mail de marketing do Atacado Exponencial sai pelo GoHighLevel, que a
casa paga só para isso. A entrega caiu para cerca de 50% e não há controle sobre
listas, campanhas nem resultados dentro do dash. A agenda própria, por sua vez,
ficou sem e-mail: confirmação e lembretes foram adiados até existir um serviço
de envio no nosso domínio (spec-agenda-propria.md, módulo 7).

Este projeto cria o serviço de e-mail da casa, dentro da central de marketing
(dash), com dois canais separados para não dividir reputação:

- **Transacional** (`envio.atacadoexponencial.com`): e-mails que uma pessoa
  recebe por causa de algo que ela fez. Nesta entrega, os da agenda.
- **Marketing** (`news.atacadoexponencial.com`): disparos de uma mesma mensagem
  para um grupo de contatos (convite de workshop, novidade, campanha).

A equipe monta os modelos, escolhe para quem vai, dispara ou agenda e acompanha
o resultado (entregues, voltaram, spam, aberturas, cliques, descadastros) no
próprio dash.

**Para quem:** a equipe de marketing (monta e acompanha no dash) e os leads e
clientes (recebem os e-mails e podem se descadastrar do marketing).

**Convivência com o GHL:** o GHL continua funcionando em paralelo, sem nenhuma
mudança. O envio de leads para o GHL e a leitura das métricas de e-mail do GHL
seguem exatamente como estão. Desligar o GHL é uma etapa futura, fora desta
spec, que só começa quando a equipe confirmar que o serviço novo está bom.

**Estado do serviço de envio (03/10):** conta criada, os dois domínios
verificados (assinatura e endereço de retorno). Falta a aprovação da conta e a
liberação dos disparos de marketing, que são pedidas ao serviço e correm em
paralelo à construção.

---

## Páginas / Módulos

### 1. Configuração de e-mail

**Descrição:** onde a equipe define remetentes, endereço de resposta e o
rodapé comum, e confere se o serviço de envio está saudável.

**Componentes:**
- Remetente do transacional: nome e endereço (inicial: "Atacado Exponencial"
  <notify@envio.atacadoexponencial.com>).
- Remetente do marketing: nome e endereço (inicial: "Felipe Santos | Atacado
  Exponencial" <felipe@news.atacadoexponencial.com>).
- Endereço de resposta de cada canal (para onde vai a resposta do lead).
- Rodapé comum: dados da empresa e endereço físico, que entram em todo e-mail.
- Situação da conta: aprovada ou pendente; marketing liberado ou pendente.
- Situação dos domínios: verificado ou com problema.

**Comportamentos:**
- Editar o nome do remetente de um canal.
- Editar o endereço do remetente de um canal (só endereços dos domínios
  verificados são aceitos).
- Editar o endereço de resposta de um canal.
- Editar o rodapé comum.
- Ver a situação da conta e dos domínios.
- Bloquear disparo de marketing enquanto o marketing não estiver liberado: o
  botão de disparo fica indisponível com o motivo escrito.
- Alerta de credencial quebrada: se a chave do serviço de envio parar de
  funcionar, o problema entra no aviso diário de credenciais, como as outras
  integrações.

---

### 2. Modelos de e-mail

**Descrição:** biblioteca de modelos reutilizáveis, com campos que são
preenchidos por pessoa (nome, data da reunião, link).

**Componentes:**
- Lista de modelos com nome, canal (transacional ou marketing), assunto e data
  da última edição.
- Editor do modelo: assunto, texto de pré-visualização (a linha que aparece
  depois do assunto na caixa de entrada) e corpo.
- Lista dos campos disponíveis para o canal (ex.: {{nome}}, {{data_reuniao}},
  {{link_reuniao}}).
- Pré-visualização com dados de exemplo, em tamanho de computador e de celular.
- Layout comum (cabeçalho e rodapé) aplicado a todos os modelos.

**Comportamentos:**
- Criar modelo novo, escolhendo o canal.
- Editar assunto, pré-visualização e corpo de um modelo.
- Inserir um campo personalizado no texto.
- Pré-visualizar o modelo com dados de exemplo.
- Alternar a pré-visualização entre computador e celular.
- Mandar e-mail de teste do modelo para um endereço da equipe.
- Duplicar um modelo.
- Arquivar um modelo (some da lista principal, fica num filtro).
- Impedir arquivar modelo em uso: modelo ligado a um e-mail da agenda ou a uma
  campanha agendada mostra o aviso e não é arquivado.
- Avisar campo desconhecido: campo escrito errado (ex.: {{nmoe}}) é apontado
  antes de salvar.

---

### 3. E-mails da agenda (transacional)

**Descrição:** os e-mails automáticos da agenda própria, que fecham o módulo 7
da spec da agenda. Saem pelo canal transacional.

**Componentes:**
- Lista dos e-mails da agenda por tipo de reunião: confirmação, lembretes,
  remarcação e cancelamento, cada um com o modelo usado e se está ligado.
- Configuração dos lembretes por tipo de reunião: quando lembrar (ex.: 24h
  antes, 1h antes).
- No detalhe de cada agendamento (lista de agendamentos da agenda): histórico
  dos e-mails enviados para aquela reunião, com a situação de cada um.

**Comportamentos:**
- Enviar e-mail de confirmação quando o lead confirma um horário.
- Enviar lembrete no horário configurado do tipo.
- Não enviar lembrete de reunião cancelada.
- Não enviar lembrete do horário antigo de reunião remarcada.
- Reprogramar os lembretes quando a reunião é remarcada.
- Enviar e-mail de remarcação quando a reunião muda de horário.
- Enviar e-mail de cancelamento quando a reunião é cancelada.
- Remarcação e cancelamento ficam prontos e configuráveis desde já, mas só
  passam a sair quando a agenda tiver os fluxos de remarcar e cancelar
  (módulo 6 da spec da agenda, ainda não construído). Confirmação e lembretes
  funcionam desde o primeiro dia.
- Não enviar lembrete cujo horário já passou (ex.: reunião marcada para daqui a
  30 minutos não recebe o lembrete de 1h antes).
- Ligar ou desligar um e-mail da agenda por tipo de reunião.
- Trocar o modelo usado por um e-mail da agenda.
- Adicionar ou remover um horário de lembrete num tipo de reunião.
- Mandar teste de um e-mail da agenda para a equipe.
- Registrar falha: e-mail que não saiu ou voltou aparece no detalhe do
  agendamento e entra no aviso diário de integrações.
- Tipos não comerciais (RH, entrevistas) também recebem confirmação e
  lembretes, mas não viram contato de marketing.

---

### 4. Contatos

**Descrição:** a base de quem pode receber marketing, com a situação de cada
pessoa. Os contatos vêm dos leads do tracking (formulários das LPs), que já
aceitaram receber marketing.

**Componentes:**
- Lista de contatos com nome, e-mail, origem, funil, data de entrada e situação
  (ativo, descadastrado, voltou, denunciou spam).
- Busca por nome ou e-mail.
- Filtros por situação, origem e funil.
- Total de contatos ativos e total geral.
- Detalhe do contato: dados, segmentos em que está e histórico de e-mails
  recebidos (campanha, data, abriu, clicou).

**Comportamentos:**
- Buscar contato por nome ou e-mail.
- Filtrar contatos por situação.
- Filtrar contatos por origem.
- Filtrar contatos por funil.
- Abrir o detalhe de um contato.
- Ver o histórico de e-mails de um contato.
- Trazer os leads que já existem no tracking como contatos, uma vez, na
  primeira carga.
- Entrar contato novo automaticamente quando um lead novo chega pelo tracking.
- Juntar duplicados: mesmo e-mail é sempre um contato só, mesmo vindo de
  origens diferentes.
- Recusar e-mail inválido: endereço malformado não entra como contato ativo e
  fica marcado como inválido, para não derrubar um disparo inteiro.
- Descadastrar contato manualmente (a pedido da pessoa).
- Marcar automaticamente como descadastrado quem clicou em descadastrar.
- Marcar automaticamente como "voltou" o endereço que não existe (devolução
  definitiva).
- Marcar automaticamente como "denunciou" quem marcou o e-mail como spam.
- Nunca mandar marketing para descadastrado, "voltou" ou "denunciou".
- Reativar contato que voltou por engano (ex.: caixa cheia corrigida), com
  aviso de risco.
- Não reativar quem se descadastrou ou denunciou spam (só a própria pessoa,
  cadastrando de novo).

---

### 5. Segmentos

**Descrição:** grupos de contatos que recebem um disparo, montados por regra.

**Componentes:**
- Lista de segmentos com nome, regra resumida e quantos contatos ativos tem
  agora.
- Montador de regra: funil, origem, data de entrada, estágio no CRM, abriu ou
  clicou em campanha anterior (combinações com "e").
- Contagem ao vivo de quantos contatos a regra pega enquanto é montada.
- Amostra dos primeiros contatos do segmento.

**Comportamentos:**
- Criar segmento por regra.
- Editar a regra de um segmento.
- Ver quantos contatos ativos o segmento tem.
- Ver a amostra de contatos do segmento.
- Duplicar segmento.
- Excluir segmento (só se não estiver ligado a campanha agendada).
- Recalcular o segmento na hora do disparo: quem entrou depois de criada a
  campanha também recebe; quem se descadastrou nesse meio tempo não recebe.

---

### 6. Campanhas (marketing)

**Descrição:** criar, testar, disparar ou agendar um e-mail para um ou mais
segmentos.

**Componentes:**
- Lista de campanhas com nome, situação (rascunho, agendada, enviando,
  enviada, cancelada, falhou), segmento, data de envio e números principais.
- Filtro por situação.
- Formulário da campanha: nome interno, modelo, segmento(s), remetente
  (pré-preenchido pela configuração) e quando enviar (agora ou data e hora).
- Resumo antes de disparar: quantos vão receber, quantos ficam de fora e por
  quê (descadastrado, voltou, inválido).
- Andamento durante o envio: percentual enviado e falhas.

**Comportamentos:**
- Criar campanha como rascunho.
- Escolher o modelo da campanha.
- Escolher um ou mais segmentos.
- Ver o resumo de quem recebe e quem fica de fora antes de disparar.
- Mandar teste da campanha para um endereço da equipe.
- Disparar agora (pede confirmação com o número de destinatários).
- Agendar para data e hora.
- Editar campanha agendada antes do horário.
- Cancelar campanha agendada antes do horário.
- Enviar automaticamente no horário agendado.
- Ver o andamento enquanto envia.
- Impedir disparo duplo: a mesma campanha não pode ser disparada duas vezes.
- Impedir destinatário em dobro: quem está em dois segmentos escolhidos recebe
  uma vez só.
- Duplicar campanha (para reaproveitar num próximo disparo).
- Avisar falha: se o disparo for recusado pelo serviço de envio, a campanha
  fica como "falhou" com o motivo, e nada é enviado pela metade sem aviso.
- Bloquear disparo acima do limite do plano: se o disparo passar do que resta
  de e-mails no mês, o sistema avisa antes de enviar.

---

### 7. Relatório de campanha

**Descrição:** o resultado de cada disparo e a visão geral do canal.

**Componentes:**
- Números da campanha: destinatários, entregues, voltaram, spam, aberturas
  (pessoas únicas), cliques (pessoas únicas), descadastros.
- Taxas: entrega, abertura, clique e descadastro.
- Links clicados, com quantas pessoas clicaram em cada um.
- Lista de quem abriu, clicou, voltou ou se descadastrou, com filtro.
- Visão geral do canal por período: e-mails enviados no mês contra o limite do
  plano, taxa de entrega, de spam e de descadastro.
- Alerta de reputação: spam ou devolução acima do limite aceito pelo serviço.

**Comportamentos:**
- Abrir o relatório de uma campanha.
- Ver os links clicados da campanha.
- Filtrar quem abriu, clicou, voltou ou se descadastrou.
- Abrir o contato a partir do relatório.
- Ver a visão geral do canal por período.
- Ver quanto do limite de e-mails do mês já foi usado.
- Atualizar os números conforme os resultados chegam (sem precisar
  reenviar nada).
- Alertar a equipe quando a taxa de spam ou de devolução passar do limite,
  pelo mesmo caminho do aviso diário de integrações.

---

### 8. Recebimento dos resultados

**Descrição:** o serviço de envio avisa o dash sobre cada acontecimento
(entregue, voltou, spam, abriu, clicou, descadastrou). Não tem tela própria;
alimenta contatos, relatórios e o histórico da agenda.

**Comportamentos:**
- Registrar cada acontecimento ligado ao e-mail, à campanha ou ao agendamento
  certo.
- Aceitar só avisos que vêm do serviço de envio (acesso protegido); qualquer
  outro é recusado.
- Ignorar aviso repetido: o mesmo acontecimento chegando duas vezes conta uma
  vez.
- Atualizar a situação do contato quando o aviso for de devolução definitiva,
  spam ou descadastro.
- Não perder aviso quando o dash estiver fora do ar por pouco tempo (o
  serviço tenta de novo).

---

### 9. Fluxos automáticos

**Descrição:** fluxos de e-mails de marketing que a equipe monta num quadro
visual, no estilo do construtor de fluxos do ManyChat: caixas ligadas por
setas, com desvios conforme o que a pessoa fez. Começam sozinhos a partir de
algo que a pessoa fez (ex.: virou lead do workshop, comprou) e substituem os
"fluxos" usados hoje no GHL. Os fluxos são criados do zero pela equipe, não
copiados do GHL. Saem pelo canal de marketing. Referências pesquisadas: ManyChat
(quadro visual, números no próprio cartão), ActiveCampaign (esperas por
condição com prazo, objetivo que faz a pessoa pular etapas) e Customer.io
(vários gatilhos por fluxo).

**Componentes:**
- Lista de fluxos com nome, gatilhos, situação (rascunho, ativo, pausado),
  quantas pessoas estão dentro agora, quantas concluíram e taxa de clique.
- Quadro do fluxo: área livre com zoom, arrastar a tela, botão de centralizar
  e mapa em miniatura para fluxos grandes.
- Cartão de início: os gatilhos que colocam a pessoa no fluxo (um fluxo pode
  ter mais de um gatilho). Cada gatilho é um acontecimento que o dash já
  conhece, refinado por filtros:
  - preencheu formulário (virou lead): filtros por funil, página, canal e
    UTMs (origem, campanha, anúncio);
  - enviou aplicação (ex.: aplicação do plano ao vivo): filtro por formulário;
  - baixou material (iscas): filtro por material;
  - comprou na Greenn: filtros por produto e situação da compra (aprovada,
    reembolsada, cancelada);
  - agendou reunião: filtro por tipo de reunião (quando a agenda estiver no
    ar); também cancelou, faltou e compareceu;
  - entrou ou saiu de um grupo de WhatsApp monitorado: filtro por grupo;
  - mudou de estágio no CRM: filtro por estágio;
  - visitou uma página ou clicou num botão do site (micro-conversões já
    medidas): filtro por página e evento;
  - entrou num segmento (módulo 5): cobre qualquer combinação que o montador
    de segmentos consiga expressar;
  - abriu ou clicou numa campanha: filtro por campanha e link.
- Cartão de e-mail: mostra o assunto e a prévia do modelo escolhido.
- Cartão de espera, com três modos:
  - por um tempo (horas ou dias);
  - até um dia da semana e horário (ex.: próxima terça às 9h);
  - até algo acontecer (ex.: abrir o e-mail), com prazo máximo; quem bate o
    prazo segue pela saída "não aconteceu".
  Todos com opção de janela de envio (ex.: só entre 8h e 20h).
- Cartão de desvio: divide em saídas "sim" e "não" conforme uma ou mais
  condições, combinadas com "e" ou "ou":
  - abriu um e-mail anterior do fluxo;
  - clicou num e-mail anterior do fluxo (em qualquer link ou num link
    específico);
  - qualquer acontecimento da lista de gatilhos, com os mesmos filtros (ex.:
    comprou o produto X, agendou reunião, entrou no grupo, mudou de estágio
    no CRM);
  - está num segmento.
- Cartão de objetivo: um ponto do fluxo com uma condição (ex.: agendou
  reunião). Quando a condição acontece, a pessoa pula direto para ele, de onde
  estiver no fluxo, e segue dali.
- Cartão de ir para outro fluxo: tira a pessoa deste fluxo e coloca no
  início de outro.
- Cartão de fim.
- Nota: caixa de texto solta no quadro, para a equipe explicar uma parte do
  fluxo.
- Números no próprio cartão: em cada cartão de e-mail, quantos receberam,
  abriram e clicaram; em cada desvio, quantos foram por "sim" e por "não"; em
  cada espera, quantos estão esperando ali agora.
- Barra de situação do fluxo: rascunho com mudanças não publicadas, ativo ou
  pausado.
- Lista de quem está dentro do fluxo e em qual cartão.

**Comportamentos:**
- Criar fluxo novo (abre o quadro com o cartão de início).
- Adicionar gatilho ao cartão de início.
- Remover gatilho.
- Escolher o acontecimento do gatilho.
- Adicionar filtro a um gatilho (ex.: só leads do workshop gratuito vindos de
  anúncio).
- Remover filtro de um gatilho.
- Ver, ao montar o gatilho, quantas pessoas teriam entrado nos últimos 30
  dias com aquela combinação (para conferir se o filtro está certo).
- Adicionar cartão pelo botão "+" na saída de um cartão (escolhe o tipo numa
  lista).
- Adicionar cartão solto no quadro e ligar depois.
- Ligar dois cartões arrastando da saída de um até o outro.
- Desligar uma ligação.
- Arrastar cartão para outra posição no quadro.
- Organizar o quadro automaticamente (alinha os cartões).
- Abrir um cartão para editar (painel lateral com as opções do tipo).
- Escolher o modelo de um cartão de e-mail.
- Criar modelo novo a partir do cartão de e-mail, sem sair do fluxo.
- Configurar a espera (modo, tempo, condição, prazo, janela de envio).
- Configurar as condições de um desvio.
- Configurar a condição de um objetivo.
- Escolher o fluxo de destino num cartão de ir para outro fluxo.
- Duplicar cartão.
- Copiar e colar um grupo de cartões (dentro do mesmo fluxo ou para outro).
- Excluir cartão (as ligações dele somem e os cartões seguintes ficam soltos,
  apontados como problema).
- Desfazer e refazer.
- Adicionar, editar e remover nota.
- Dar zoom, arrastar a tela e centralizar.
- Salvar sozinho: o rascunho é salvo a cada mudança.
- Impedir fluxo quebrado: não deixa publicar com cartão solto, saída sem
  destino, desvio sem condição, e-mail sem modelo ou fluxo sem gatilho, e
  marca no quadro onde está o problema.
- Testar o fluxo com um endereço da equipe: a pessoa de teste percorre o
  fluxo pulando as esperas, e a equipe escolhe "sim" ou "não" em cada desvio.
- Publicar: o fluxo vira ativo e quem disparar o gatilho a partir daí entra.
- Não puxar o passado: publicar não coloca dentro quem disparou o gatilho
  antes.
- Editar fluxo ativo sem afetar ninguém até publicar: as mudanças ficam como
  rascunho, e o fluxo no ar continua rodando a versão anterior.
- Publicar mudanças num fluxo ativo: quem está dentro continua do cartão em
  que está, se ele ainda existir; se o cartão foi excluído, a pessoa sai do
  fluxo e isso fica registrado.
- Descartar mudanças não publicadas.
- Pausar fluxo: ninguém novo entra e quem está dentro para onde está.
- Retomar fluxo pausado: quem estava dentro continua de onde parou, sem
  receber de uma vez os e-mails acumulados da pausa.
- Duplicar fluxo inteiro.
- Arquivar fluxo.
- Entrar no fluxo quando a pessoa dispara um gatilho.
- Não entrar duas vezes: quem já está dentro ou já concluiu não entra de novo
  no mesmo fluxo.
- Pular para o objetivo quando a condição dele acontecer.
- Sair do fluxo ao se descadastrar, voltar (devolução definitiva) ou
  denunciar spam, sempre, sem precisar configurar.
- Tirar uma pessoa do fluxo manualmente.
- Ver os números em cada cartão.
- Filtrar os números por período.
- Ver quem está esperando num cartão (clicando no número).
- Abrir o contato a partir da lista de quem está dentro.
- Mostrar o fluxo no histórico do contato (entrou, cartões por onde passou,
  saiu e por quê).

---

## Fora do escopo desta versão

- Desligar o GHL, ou mudar qualquer coisa no envio de leads para o GHL e na
  leitura das métricas de e-mail do GHL.
- Editor de arrastar e soltar para o CORPO do e-mail (o modelo é editado como texto
  formatado). O quadro dos fluxos é visual; isto vale só para o conteúdo do e-mail.
- Teste A/B de assunto ou conteúdo (decidido: não precisa por enquanto).
- Cartões que não são e-mail dentro do fluxo (WhatsApp, tag no ManyChat,
  mexer no CRM). Ficam para depois, mas o fluxo deve ser montado de forma que
  novos tipos de etapa possam entrar sem refazer o que existe.
- Envio de e-mail pelo WhatsApp ou SMS.
- Receber e-mail no domínio (as respostas vão para o endereço de resposta
  configurado, fora do dash).
- Página própria de preferências de assinatura (o descadastro é o do serviço
  de envio, de um clique).
- E-mails transacionais além dos da agenda (ex.: compra na Greenn, área de
  membros). A área de membros continua no serviço dela.

## Decisões tomadas (03/10)

1. **Serviço de envio:** Postmark, com `envio.` para transacional e `news.` para
   marketing, já verificados.
2. **GHL em paralelo:** nada do que funciona hoje é tocado até a equipe
   confirmar que o serviço novo está bom.
3. **Primeira entrega com os dois canais:** transacional da agenda e marketing.
4. **Tudo no dash:** contatos, segmentos, modelos, campanhas e relatórios
   moram no dash; o serviço de envio só entrega e devolve os resultados.

5. **Contatos vêm do tracking:** os leads dos formulários das LPs, que já
   aceitaram receber marketing. Contatos do GHL anteriores a 20/07 (quando o
   tracking passou a alimentar o GHL) ou colocados lá à mão ficam fora; se um
   dia entrarem, é uma importação única, com limpeza antes.
6. **Remetentes iniciais:** agenda = "Atacado Exponencial"
   <notify@envio.atacadoexponencial.com>; marketing = "Felipe Santos | Atacado
   Exponencial" <felipe@news.atacadoexponencial.com>. Editáveis na
   configuração.
7. **Remarcação e cancelamento** ficam prontos e configuráveis agora e passam a
   sair quando a agenda tiver esses fluxos.

## Perguntas em aberto

1. **Endereço de resposta:** para qual caixa vão as respostas dos leads (o
   domínio não recebe e-mail). Não trava: é um campo da configuração,
   editável a qualquer hora (sugestão inicial: um endereço @seteads.com).
2. **Agenda ainda na prévia:** a agenda própria não foi para produção. Os
   e-mails da agenda dependem dela estar no ar; o marketing não depende.
3. **Gatilho de grupo de WhatsApp:** hoje a entrada e a saída dos grupos
   chegam pela Evolution, que está sendo descontinuada. O gatilho funciona
   enquanto ela estiver no ar; quando sair, ele depende do substituto.
