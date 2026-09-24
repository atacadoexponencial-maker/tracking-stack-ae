# Spec: Argo — plano 3 (pausar conjunto, realocar verba, aumentar orçamento)

> **Status:** rascunho, 24/09/2026. Descreve a MUDANÇA. Quando entrar no ar,
> mover para `docs/specs-arquivadas/`.

## Visão Geral

A grade do Argo (aba Argo do dash, conta do Atacado Exponencial) tem três ações
num grupo chamado "Ainda não implementadas": **pausar conjunto**, **realocar
verba** e **aumentar orçamento**. Hoje marcá-las não muda nada — o Argo não tem
rotina para elas. Esta mudança dá a cada uma a sua rotina, com o mesmo
comportamento das ações que já existem (pausar anúncio, pausar campanha de
tráfego, reduzir orçamento, reativar anúncio):

- obedece à grade: **desligado** não faz nada, **propor** cria proposta para a
  gestora decidir no dash, **executar** age sozinho;
- respeita a **parada geral**, a **trava de aprendizado** (7 dias no ar) e o
  **intervalo mínimo por alvo** (quem quer que tenha mexido por último);
- grava a intenção e o **estado anterior antes** de agir, relê depois e grava o
  desfecho;
- pode ser **desfeita** pelo dash, e desfazer é um registro novo;
- aparece no relatório da rodada no Slack e no registro da aba.

É para a gestora (Marcelle), que hoje faz essas três coisas à mão no
Gerenciador. O problema: o Argo só sabe cortar. Ele reduz e pausa, mas nunca
move verba para o que está funcionando nem escala o que vai bem — então toda
economia que ele faz fica parada.

Estado inicial da grade: as três em **propor** (já trocado pela gestora em
24/09). Nenhuma nasce executando.

### Decisões da gestora (24/09)

| Tema | Decisão |
|---|---|
| Pausar conjunto | Só quando **todos os anúncios ativos** do conjunto já seriam pausados pela régua de anúncio. Um anúncio bom salva o conjunto. |
| Realocar verba | Só **dentro do mesmo funil** (SE→SE, tráfego→tráfego). Nunca entre funis. |
| Aumentar orçamento | Quando o resultado dos últimos 7 dias está **bem abaixo da média**: SE com CPL ≤ 70% do CPL médio do mês **e com MQL**; tráfego com CPV ≤ 70% da média das campanhas ativas. |
| Tamanho da mudança | **20% do orçamento diário por ação**, e nunca acima do "limite por ação" em reais da grade. |

### ✅ Confirmadas pela gestora (24/09, "pode seguir")

1. **Realocar = reduzir o pior + aumentar o melhor, juntos.** A origem é um alvo
   que a régua de reduzir já apontaria; o destino é um alvo que a régua de
   aumentar já aprovaria. Não nasce régua nova. O valor movido é 20% do
   orçamento da origem (e nunca mais que o limite por ação).
2. **Realocar vem antes de aumentar.** Se no mesmo funil existe um alvo ruim
   para ceder verba, o Argo realoca (não gasta a mais); só propõe aumentar
   quando não há de onde tirar.
3. **Pausar conjunto também reduz antes de pausar**, quando o conjunto tem
   orçamento próprio — como já vale para campanha de tráfego. A alternativa é
   pausar direto, já que todos os anúncios estão ruins.
4. **Checar o resultado depois de agir** fica no ciclo (Módulo 4), só
   relatando. No tráfego isso já existe (issue 316: CPV antes × depois de toda
   mudança); o que falta é a SE.

## Páginas / Módulos

### Módulo 1 — Pausar conjunto

**Descrição:** Detecta conjunto de anúncios em que nenhum anúncio ativo presta
mais, pela régua de anúncio que já existe, e pausa (ou propõe pausar) o
conjunto inteiro, em vez de pausar anúncio por anúncio.

**Componentes:**
- Avaliação do conjunto: lista os anúncios ativos do conjunto e o veredito de
  cada um pela régua de anúncio de lead (piso de 3× CPL médio e 3 mil
  impressões; MQL/CPL do funil).
- Linha de proposta "Pausar conjunto": nome do conjunto, campanha, funil,
  quantos anúncios ativos, gasto e leads/MQL somados no período, e o motivo
  ("os N anúncios ativos estão abaixo da régua").
- Registro da ação: estado anterior (status do conjunto e dos anúncios) e
  estado depois.

**Comportamentos:**
- Conjunto de funil julgável (hoje só SE) em que **todos** os anúncios ativos
  seriam pausados vira candidato a pausar conjunto.
- Conjunto com pelo menos um anúncio ativo que não seria pausado **não** vira
  candidato — nem por conjunto, e os anúncios ruins seguem pelo caminho do
  "pausar anúncio".
- Conjunto com anúncio que ainda não atingiu o piso para ser julgado não vira
  candidato ("ainda não dá para julgar" não é "ruim").
- Conjunto de funil não julgável (LIVE, WO PAGO, aquisição) nunca vira
  candidato; o relatório diz por quê.
- Quando o conjunto vira candidato, os anúncios dele **não** geram propostas
  individuais de pausa na mesma rodada (uma decisão, não N).
- Conjunto dentro da trava de aprendizado não é mexido; o relatório diz até
  quando.
- Conjunto (ou campanha dele) alterado dentro do intervalo mínimo não é
  mexido; o relatório diz a partir de quando reavalia.
- Com orçamento diário próprio e sem redução recente, a primeira ação é reduzir
  o orçamento; a pausa vem numa rodada seguinte, se continuar ruim (❓ 3).
- Em **propor**: cria proposta para decidir no dash.
- Em **executar**: pausa o conjunto sozinho e registra.
- Em **desligado**: não avalia conjunto; os anúncios seguem pela régua de
  anúncio.
- Conjunto que já está pausado quando a ação vai acontecer é registrado como
  "já estava", sem chamada de pausa.
- A gestora pode desfazer: o conjunto volta a ativo.
- O "máximo de pausas por rodada" continua informativo (hoje nenhum laço de
  pausa o aplica); aplicá-lo a todas as pausas é item à parte, fora deste ciclo.

### Módulo 2 — Realocar verba

**Descrição:** Move parte do orçamento diário de um alvo ruim para um alvo bom
do **mesmo funil**, sem mudar o total gasto por dia.

**Componentes:**
- Par origem → destino: nome, nível (campanha ou conjunto, onde o orçamento
  diário mora), funil, orçamento diário atual de cada um, resultado de cada um
  (CPL e MQL para SE; CPV para tráfego) e a média de referência.
- Valor movido: em reais por dia, com o orçamento de cada lado antes e depois.
- Linha de proposta "Realocar verba": origem, destino, valor e o motivo dos
  dois lados.
- Registro da ação: orçamento anterior e posterior **dos dois lados**.

**Comportamentos:**
- A origem é um alvo que a régua de reduzir orçamento apontaria (❓ 1).
- O destino é um alvo que a régua de aumentar aprovaria (Módulo 3), no mesmo
  funil da origem.
- Origem e destino de funis diferentes nunca formam par.
- Funil não julgável nunca é origem nem destino.
- O valor movido é 20% do orçamento diário da origem, arredondado para reais
  inteiros, e nunca acima do limite por ação da grade. Acima dele, vira
  proposta, mesmo em executar.
- Valor movido abaixo de R$ 5/dia não vira ação (não vale o reinício de
  aprendizado).
- A origem nunca fica abaixo de R$ 1/dia por realocação (abaixo disso é pausar,
  que é outra ação).
- Com vários candidatos, forma no máximo um par por funil por rodada: a pior
  origem com o melhor destino.
- Se qualquer um dos dois lados está na trava de aprendizado ou no intervalo
  mínimo, o par não se forma; o relatório diz qual lado e por quê.
- Antes de agir, relê o orçamento dos dois lados; se algum mudou desde a
  decisão, não mexe e registra "mudou".
- Os dois lados são aplicados em sequência: primeiro reduz a origem, depois
  aumenta o destino. Se o segundo falhar, a origem é devolvida ao valor
  anterior e a ação é registrada como "não completou" (nunca fica meia
  realocação sem aviso).
- Em **propor**: cria proposta com origem, destino e valor.
- Em **executar**: realoca sozinho e registra.
- Em **desligado**: não forma pares.
- Quando realocar é possível, tem precedência sobre aumentar no mesmo funil
  (❓ 2).
- A gestora pode desfazer: os dois lados voltam aos valores anteriores.

### Módulo 3 — Aumentar orçamento

**Descrição:** Aumenta o orçamento diário de um alvo que está indo bem acima da
média do próprio funil, sem nunca passar do teto mensal de Meta da conta.

**Componentes:**
- Avaliação do alvo: resultado dos últimos 7 dias (CPL e MQL para SE; CPV para
  tráfego), a média de referência e a razão entre os dois.
- Folga do mês: teto mensal de Meta da grade, gasto real do mês no Meta, dias
  restantes e quanto cabe por dia.
- Linha de proposta "Aumentar orçamento": alvo, orçamento atual → novo, o
  resultado contra a média e a folga do mês depois do aumento.
- Registro da ação: orçamento anterior e posterior.

**Comportamentos:**
- Alvo de SE vira candidato quando o CPL dos últimos 7 dias é ≤ 70% do CPL
  médio do mês do funil **e** teve pelo menos um MQL no período.
- Alvo de tráfego vira candidato quando o CPV dos últimos 7 dias é ≤ 70% da
  média das campanhas de tráfego ativas nos últimos 30 dias.
- O alvo precisa ter passado do piso de julgamento do seu funil (SE: gasto ≥ 3×
  CPL médio e ≥ 3 mil impressões); resultado bom com pouco dado não escala.
- Funil não julgável nunca vira candidato.
- O aumento é 20% do orçamento diário atual, arredondado para reais inteiros,
  e nunca acima do limite por ação da grade. Acima dele, vira proposta, mesmo
  em executar.
- **Sem teto mensal de Meta configurado na grade, nunca aumenta** — nem propõe.
- Só aumenta se a soma dos orçamentos diários ativos da conta, depois do
  aumento, couber no que resta do teto dividido pelos dias restantes do mês.
  Se não couber, não propõe e o relatório diz "sem folga no teto".
- Alvo dentro da trava de aprendizado não é mexido.
- Alvo alterado dentro do intervalo mínimo não é mexido — inclusive pela
  própria gestora (sem cabo de guerra).
- No máximo um aumento por funil por rodada: o de melhor resultado.
- Antes de agir, relê o orçamento; se mudou desde a decisão, não mexe e
  registra "mudou".
- Em **propor**: cria proposta.
- Em **executar**: aumenta sozinho e registra.
- Em **desligado**: não avalia.
- A gestora pode desfazer: o orçamento volta ao valor anterior.

### Módulo 4 — Checar o resultado depois de agir

**Descrição:** Depois do intervalo mínimo, o Argo olha de novo o alvo de SE que
teve o orçamento mudado e diz se deu certo — é a regra "avaliar o resultado do
que foi feito" (decisão de 23/09). No tráfego já existe (CPV antes × depois de
toda mudança recente, de quem for); este módulo leva o mesmo para a SE, com CPL
e MQL.

**Componentes:**
- Linha no relatório da rodada: alvo de SE, data da mudança, CPL e MQL nos 7
  dias antes × depois, veredito ("manteve", "piorou").

**Comportamentos:**
- Vale para toda mudança de orçamento recente num alvo de SE, de quem for
  (Argo ou gestora), como já é no tráfego.
- Aumento ou destino de realocação cujo resultado piorou além da média do
  funil vira candidato normal a reduzir na rodada seguinte (sem régua nova).
- A checagem só relata; não desfaz sozinha.

### Módulo 5 — Aba Argo (grade, propostas, registro)

**Descrição:** A tela passa a tratar as três ações como implementadas. A aba não
decide nada: mostra o que o Argo decidiu e captura a decisão da gestora.

**Componentes:**
- Grade: as três ações saem do grupo "Ainda não implementadas" e passam a ficar
  junto das demais, com os mesmos três estados. O grupo some quando ficar vazio.
- Campo "Teto mensal de Meta" com aviso visível quando vazio: "Sem teto, o
  Argo não aumenta orçamento".
- Proposta de pausar conjunto: conjunto, campanha, anúncios ativos avaliados e
  o motivo.
- Proposta de realocar: origem → destino, valor por dia, orçamento antes/depois
  dos dois lados.
- Proposta de aumentar: alvo, orçamento antes → depois, resultado × média,
  folga do mês.
- Registro: as ações executadas das três, com desfecho (conferida, não pegou,
  mudou, não completou, já estava) e botão de desfazer.

**Comportamentos:**
- A gestora troca o estado de cada uma das três ações na grade; vale a partir
  da próxima rodada.
- A gestora preenche ou altera o teto mensal de Meta.
- A gestora aprova uma proposta de qualquer das três.
- A gestora rejeita uma proposta de qualquer das três.
- A gestora desfaz uma ação executada de qualquer das três.
- A gestora vê, numa proposta de realocar, os dois lados antes de decidir.
- A gestora vê, numa proposta de aumentar, quanto do teto do mês sobra depois.
- Proposta cujo alvo mudou desde que foi criada aparece como vencida, sem botão
  de aprovar (aprovação presa à versão, como já é hoje).

### Módulo 6 — Relatório da rodada (Slack)

**Descrição:** O resumo que já sai em toda rodada passa a incluir as três
ações.

**Componentes:**
- Bloco por ação: o que executou, o que propôs, o que a trava segurou e por
  quê, e o que ficou de fora por regra do funil.

**Comportamentos:**
- Rodada sem nada das três não acrescenta linha nenhuma.
- Aumento barrado por falta de teto ou de folga aparece com o motivo.
- Realocação que não completou aparece em destaque, com o estado em que os
  dois lados ficaram.

## Fora de escopo

- Subir campanha, trocar criativo, mexer em público.
- Realocar entre funis diferentes.
- Aumentar orçamento de funil não julgável (LIVE, WO PAGO, aquisição por
  anúncio).
- Orçamento vitalício (lifetime): só orçamento diário é mexido.
- Contas da agência.
- Reativar conjunto sozinho (a reativação automática vale só para anúncio).
