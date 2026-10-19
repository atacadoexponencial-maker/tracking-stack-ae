# Spec: Funil do lead pela UTM, não pelo formulário

> série: S3
> estado: aprovada em 19/10/2026

## Visão Geral

Hoje o dash decide o funil de um lead pelo formulário que ele preencheu. Por isso
`aplicacao-mentoria` e `iscas-manychat` aparecem como funis próprios, e Aquisição
(posts impulsionados) aparece com investimento e zero leads: nenhum formulário se
declara "aquisição". Na aba Meta Ads de 12–18/10: aquisição R$ 2.885,93 com 0 leads,
aplicacao-mentoria com 9 leads como funil à parte.

A mudança separa **porta** de **funil**. As páginas de captação da sessão estratégica
(home, /se-*, /consultoria-gratuita-atacado, /aplicacao-mentoria, iscas do ManyChat)
são só portas: o formulário de uma pode substituir o de outra amanhã. Nelas, quem
decide o funil é a origem do lead, ou seja, o dinheiro que trouxe a pessoa. Os
formulários de produto próprio (workshop, lives semanais, tráfego atacado,
calculadora) continuam no funil deles.

Regra, na ordem (a primeira que casar vence), **só para leads de porta da SE**:

1. Chegou pelo ManyChat (isca ou UTM de ManyChat) → **aquisição**
2. Campanha da UTM começa com `bioperfil` (felipe, barbara, atacadoexponencial...) → **aquisição**
3. Campanha da UTM é uma campanha do Meta classificada num funil (a mesma
   classificação da tabela de campanhas da aba Meta Ads, com o ajuste manual valendo
   mais) → **esse funil**
4. Nenhuma das anteriores (sem UTM, UTM quebrada, campanha desconhecida) → **sessão estratégica**

Vale para tudo que o tracking calcula no dash: leads, leads novos, CPL, conversão por
funil, reuniões por funil e o seletor de funil. Vale também para o histórico, porque
a regra é aplicada na leitura.

A aba Meta Ads também passa a mostrar os **leads novos** (pessoas que viraram card
novo no CRM) ao lado dos leads, com o CPL de cada um.

Dados de 30 dias (até 19/10) que motivam os casos: 7 leads da /aplicacao-mentoria
com `bioperfil-felipe`, 1 com `bioperfil-barbara`, 1 com anúncio de SE; 2 leads do
formulário de SE com `bioperfil`; 6 leads com a UTM quebrada `{{campaign.name}}`;
4 inscritos no workshop vindos de anúncio de SE.

## Páginas / Módulos

### Regra do funil do lead

**Descrição:** decide a que funil cada lead pertence. É a mesma decisão em todas as
telas do dash.

**Comportamentos:**
- Lead de porta da SE vindo do link da bio conta como aquisição.
- Lead de porta da SE vindo do ManyChat conta como aquisição.
- Lead de porta da SE vindo de anúncio conta no funil daquela campanha.
- Lead de porta da SE sem origem reconhecível conta como sessão estratégica.
- Lead de formulário de produto próprio fica no funil do produto, venha de onde vier.
- Mudar o funil de uma campanha na aba Meta Ads muda o funil dos leads dela.

**Critérios de aceite:**

#### CA-S3-01 — Aplicação vinda da bio conta como aquisição · prova: automática

- **Dado** um lead da /aplicacao-mentoria com campanha `bioperfil-felipe`
- **Quando** o dash calcula o funil dele
- **Então** ele aparece em aquisição, e `aplicacao-mentoria` não aparece como funil

#### CA-S3-02 — Qualquer porta da SE vinda da bio conta como aquisição · prova: automática

- **Dado** um lead do formulário da home (sessão estratégica) com campanha `bioperfil-atacadoexponencial`
- **Quando** o dash calcula o funil dele
- **Então** ele aparece em aquisição

#### CA-S3-03 — Isca do ManyChat conta como aquisição · prova: automática

- **Dado** um lead de /materiais/icp (isca do ManyChat), com ou sem UTM
- **Quando** o dash calcula o funil dele
- **Então** ele aparece em aquisição, e `iscas-manychat` não aparece como funil

#### CA-S3-04 — Aplicação vinda de anúncio de SE conta como sessão estratégica · prova: automática

- **Dado** um lead da /aplicacao-mentoria com campanha `ae_leads_publico-frio_evento-ra_sessao-estrategica`
- **Quando** o dash calcula o funil dele
- **Então** ele aparece em sessão estratégica

#### CA-S3-05 — Porta da SE vinda de anúncio de outro funil conta nesse funil · prova: automática

- **Dado** um lead do formulário de SE com campanha `ae_leads_publico-frio_evento-lead_lives-semanais`
- **Quando** o dash calcula o funil dele
- **Então** ele aparece no funil das lives semanais

#### CA-S3-06 — O ajuste manual da campanha vale para o lead · prova: automática

- **Dado** a campanha `ae_leads_publico-frio_evento-lead_workshops-gratuitos`, que a regra automática não reconhece, classificada manualmente como workshop na aba Meta Ads
- **E** um lead de porta da SE vindo dessa campanha
- **Quando** o dash calcula o funil dele
- **Então** ele aparece em workshop

#### CA-S3-07 — Sem origem reconhecível, sessão estratégica · prova: automática

- **Dado** três leads da /aplicacao-mentoria: um sem UTM, um com campanha `{{campaign.name}}` e um com campanha que não existe no Meta
- **Quando** o dash calcula o funil deles
- **Então** os três aparecem em sessão estratégica

#### CA-S3-08 — Workshop fica no workshop · prova: automática

- **Dado** um inscrito no formulário do workshop com campanha de sessão estratégica e outro com `bioperfil-felipe`
- **Quando** o dash calcula o funil deles
- **Então** os dois aparecem em workshop

#### CA-S3-09 — Os outros produtos ficam no próprio funil · prova: automática

- **Dado** leads de lives semanais, tráfego atacado e calculadora vindos de anúncio de SE e da bio
- **Quando** o dash calcula o funil deles
- **Então** cada um aparece no funil do próprio formulário

### Aba Meta Ads

**Descrição:** investimento e CPL por funil e por canal.

**Componentes:**
- Tabela "CPL por funil": funil, investimento, leads, leads novos, CPL, CPL lead novo, % do gasto
- KPIs do topo: hoje Investimento, CPL Meta (pago), CPA, ROAS; ganha "CPL lead novo (pago)"

**Comportamentos:**
- Ver aquisição com o investimento dos impulsionamentos e os leads de bio e ManyChat na mesma linha.
- Ver, por funil, quantos leads são novos e quanto custou cada lead novo.
- Ver o CPL do lead novo vindo de anúncio no topo da aba.

**Critérios de aceite:**

#### CA-S3-10 — Aquisição com investimento e leads na mesma linha · prova: automática

- **Dado** um período com R$ 100 em posts impulsionados, 3 leads da /aplicacao-mentoria vindos da bio e 1 isca do ManyChat
- **Quando** a aba Meta Ads calcula o CPL por funil
- **Então** a linha aquisição mostra R$ 100, 4 leads e CPL de R$ 25

#### CA-S3-11 — Tabela mostra leads novos e CPL lead novo · prova: automática

- **Dado** um funil com R$ 300, 6 leads, dos quais 3 viraram card novo no CRM
- **Quando** a aba Meta Ads mostra a tabela CPL por funil
- **Então** a linha mostra 6 leads, 3 leads novos, CPL R$ 50 e CPL lead novo R$ 100

#### CA-S3-12 — KPI do CPL lead novo pago · prova: automática

- **Dado** R$ 400 em anúncios (fora impulsionamento) e 8 leads vindos de anúncio, dos quais 4 viraram card novo
- **Quando** a aba Meta Ads mostra os KPIs
- **Então** aparece "CPL lead novo (pago)" de R$ 100 ao lado do "CPL Meta (pago)" de R$ 50

#### CA-S3-13 — Aba Meta Ads no ar com dado real · prova: manual

- **Dado** a semana 12–18/10 no dash em produção
- **Quando** a usuária abre a aba Meta Ads
- **Então** aquisição tem leads, aplicacao-mentoria e iscas-manychat não aparecem como funil, e as colunas e o KPI de lead novo aparecem

### Visão geral e aba Leads

**Descrição:** painel por funil, tabela de leads por funil, seletor de funil e lista de leads.

**Comportamentos:**
- Ver o painel por funil com aquisição como funil e sem aplicacao-mentoria nem iscas-manychat.
- Filtrar o dash por aquisição.
- Ver na lista de leads o funil pela regra e, separado, a página por onde a pessoa entrou.

**Critérios de aceite:**

#### CA-S3-14 — Leads por funil seguem a regra · prova: automática

- **Dado** os leads dos critérios CA-S3-01 a CA-S3-08 num mesmo período
- **Quando** a Visão geral conta leads e leads novos por funil
- **Então** as contagens batem com o funil que a regra deu a cada lead, e a soma é igual ao total de leads

#### CA-S3-15 — Seletor de funil lista funis, não formulários · prova: automática

- **Dado** leads de /aplicacao-mentoria, isca do ManyChat, home e workshop
- **Quando** o dash monta a lista do seletor de funil
- **Então** a lista tem aquisição, sessão estratégica e workshop, e não tem aplicacao-mentoria nem iscas-manychat

#### CA-S3-16 — Filtrar por aquisição · prova: automática

- **Dado** os leads do critério CA-S3-15
- **Quando** a pessoa filtra o dash por aquisição
- **Então** só aparecem os leads da bio e do ManyChat

#### CA-S3-17 — Lista de leads mostra funil e página de entrada · prova: automática

- **Dado** um lead da /aplicacao-mentoria vindo da bio
- **Quando** a aba Leads lista esse lead
- **Então** a coluna de funil diz aquisição e a página de entrada continua visível como /aplicacao-mentoria

### Conversão por funil

**Descrição:** visitas que viraram lead, por funil.

**Critérios de aceite:**

#### CA-S3-18 — Visita conta no funil pela mesma regra · prova: automática

- **Dado** uma visita à /aplicacao-mentoria vinda da bio que não virou lead, e outra vinda de anúncio de SE que virou lead
- **Quando** o dash calcula a conversão por funil
- **Então** a primeira conta como visita de aquisição sem lead, e a segunda como visita e lead de sessão estratégica

### Reuniões por funil

**Descrição:** reuniões agendadas e custo por reunião, por funil.

**Critérios de aceite:**

#### CA-S3-19 — Reunião herda o funil do lead pela regra · prova: automática

- **Dado** um lead da /aplicacao-mentoria vindo da bio que agendou consultoria
- **Quando** o dash conta reuniões por funil
- **Então** a reunião conta em aquisição

## Fora de escopo

- O campo 🔻 Funil do ClickUp, as tags do GHL e do ManyChat, os e-mails, o redirecionamento depois do formulário e o bloqueio de lead continuam com o funil do formulário. Decisão da usuária em 19/10.
- Taxas de passagem (Lead→MQL→RA), metas por funil e o relatório do Argo continuam lendo o campo do ClickUp. No mesmo funil, eles podem divergir das contagens do tracking (ver SUP-S3-04).
- Gravar a campanha junto do lead. A UTM continua sendo a da sessão (último clique): quem clicar depois em outro anúncio muda de funil no dash.
- Corrigir a UTM `{{campaign.name}}` nos anúncios (é configuração no Meta).
- Mudar o que é "lead novo".

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S3-01 | Lead com UTM quebrada `{{campaign.name}}` (anúncio do Meta sem nome) vai para sessão estratégica, e não tenta adivinhar a campanha | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |
| SUP-S3-02 | `diagnostico` (nome antigo da SE) é tratado como porta da SE | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |
| SUP-S3-03 | Na conversão por funil, a visita a uma porta da SE segue a mesma regra pela UTM da visita (CA-S3-18). Visita a página de produto continua no funil da página | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |
| SUP-S3-04 | Aceita-se que taxas, metas e Argo (pelo ClickUp) mostrem números diferentes das contagens do tracking no mesmo funil, sobretudo em aquisição, que não existe no ClickUp | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |
| SUP-S3-05 | A tabela "Funil × canal" da aba Meta Ads passa a usar o funil pela regra, e o quadro separado "estimativa de aquisição" sai, porque a linha aquisição da tabela por funil passa a fazer essa conta | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |
| SUP-S3-06 | Formulário de produto próprio = workshop (todas as variantes), lives semanais, tráfego atacado e calculadora. Uma página de captação nova é porta da SE até alguém dizer o contrário | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S3-01 | Inscrito no workshop vindo de anúncio de SE: conta como SE ou workshop? | respondida | Workshop é exceção: fica no workshop (usuária, 19/10) |
| PER-S3-02 | Taxas, metas e Argo (campo do ClickUp) também seguem a UTM? | respondida | Não. Só o que o tracking calcula (usuária, 19/10) |
| PER-S3-03 | O que manda para aquisição? | respondida | Campanha `bioperfil*` e todo lead do ManyChat (usuária, 19/10) |
| PER-S3-04 | Como ver leads novos na aba Meta Ads? | respondida | Colunas na tabela CPL por funil + KPI "CPL lead novo (pago)" (usuária, 19/10) |
| PER-S3-05 | Os outros produtos (lives, tráfego atacado, calculadora) também ficam no próprio funil? | respondida | Sim. A UTM só decide nas portas da SE (usuária, 19/10) |
