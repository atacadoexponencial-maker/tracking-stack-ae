# Spec: Tela Imersão 2027 (acompanhamento do lançamento)

> série: S8
> estado: aprovada em 09/11/2026

## Visão Geral

Tela nova no dash, exclusiva do lançamento pago da **Imersão Planejamento Atacado 2027**
(sábado 05/12/2026, 9h30–17h30, ao vivo no Google Meet). É para a usuária e a equipe
acompanharem, na ordem do funil, se o lançamento vai bater a **meta de 100 ingressos**
e quanto ele rende depois do evento (bump e Mentoria Atacado Exponencial).

Produtos do funil:
- Ingresso em 7 lotes: R$ 29 / 35 / 39 / 45 / 49 / 55 / 59, com virada por data.
- Order bump no checkout: Imersão em formato de aulas, R$ 297.
- Mentoria Atacado Exponencial, vendida no pitch do evento e nos dias seguintes.

As vendas (ingresso, bump e Mentoria) e os inícios de checkout vêm da **Zouti**. O
investimento, as impressões e os cliques vêm do Meta. As visualizações da página vêm do
tracking do site. Comparecimento e pico ao vivo vêm do Meet.

Cada indicador mostra o realizado, a meta (quando houver) e, ao lado, a **faixa de
referência** tirada de um especialista em lançamento pago de outros nichos. A faixa
aparece sempre rotulada como "referência", nunca como meta.

A primeira entrega é um **protótipo com dados de exemplo**: a tela inteira funciona com
números fictícios, mas coerentes entre si, até a primeira venda real chegar da Zouti.

## Páginas / Módulos

### 1. Entrada e subabas

**Descrição:** aba "Imersão 2027" no menu do dash, com duas subabas no topo.

**Componentes:**
- Item "Imersão 2027" no menu de abas do dash.
- Subabas no topo da tela: "Resumo", "Ingressos", "Tráfego e página", "Bump", "Evento e pós",
  "Simulação" e "Metas" (revisão de 10/11; antes eram "Visão geral do lançamento" e "Simulação").
- Faixa "dados de exemplo" no topo, enquanto não houver venda real.

**Comportamentos:**
- Abrir a tela: a pessoa clica em "Imersão 2027" e cai na subaba "Resumo".
- Trocar de subaba: a pessoa clica em qualquer subaba e volta para o "Resumo".
- Ver se os números são de exemplo: enquanto a Zouti não registrar nenhuma venda de
  ingresso, a faixa "dados de exemplo" fica visível; com a primeira venda real, ela some
  e a tela passa a mostrar só dados reais.

**Critérios de aceite:**

#### CA-S8-01 — A aba Imersão 2027 abre no Resumo · prova: manual

- **Dado** que a pessoa está logada no dash
- **Quando** clica em "Imersão 2027" no menu
- **Então** a tela abre com as subabas no topo, com a primeira ("Resumo") selecionada

#### CA-S8-02 — Trocar de subaba mostra o conteúdo certo · prova: manual

- **Dado** que a tela Imersão 2027 está aberta
- **Quando** a pessoa clica em "Simulação" e depois em "Resumo"
- **Então** cada clique mostra o conteúdo da subaba clicada e marca a subaba como selecionada

#### CA-S8-03 — Sem venda real, a tela mostra dados de exemplo com aviso · prova: automática

- **Dado** que não há nenhuma venda de ingresso da Zouti registrada
- **Quando** a tela pede os dados do lançamento
- **Então** recebe os dados de exemplo marcados como exemplo, e a faixa "dados de
  exemplo" aparece no topo

#### CA-S8-04 — Com a primeira venda real, o aviso some e só entram dados reais · prova: automática

- **Dado** que existe ao menos uma venda de ingresso da Zouti registrada
- **Quando** a tela pede os dados do lançamento
- **Então** recebe só dados reais, sem a marca de exemplo, e a faixa não aparece

### 2. Metas editáveis

**Descrição:** campos onde a usuária grava as metas internas que o briefing ainda não
definiu. Ficam salvos no servidor: quem editar, todos veem o mesmo valor.

**Componentes:**
- Campos editáveis: verba de anúncios de ingresso, % de ingressos esperado do tráfego
  pago (começa em 75%), meta de conversão do bump, meta de conversão na Mentoria e
  horário da oferta (pitch) no dia 05/12.
- Meta de ingressos fixa em 100 (exibida, não editável nesta mudança).

**Comportamentos:**
- Editar uma meta: a pessoa troca o valor e salva; os indicadores que dependem dela são
  recalculados.
- Ver meta não preenchida: indicador que depende de uma meta vazia mostra "defina a meta"
  no lugar do número.
- Valor inválido: a tela recusa número negativo e porcentagem acima de 100%, explicando o motivo.

**Critérios de aceite:**

#### CA-S8-05 — Meta salva vale para todo mundo · prova: automática

- **Dado** que a pessoa grava a verba de anúncios de ingresso em R$ 5.000
- **Quando** outra pessoa abre a tela
- **Então** vê R$ 5.000 na verba, e o CPA teto é calculado com esse valor

#### CA-S8-06 — Indicador sem meta pede a meta · prova: automática

- **Dado** que a verba de anúncios de ingresso está vazia
- **Quando** a tela calcula o CPA teto
- **Então** o card do CPA teto mostra "defina a meta" em vez de um número

#### CA-S8-07 — Valor inválido é recusado com motivo · prova: automática

- **Dado** que a pessoa digita -10 na verba ou 120% numa meta de conversão
- **Quando** tenta salvar
- **Então** o valor não é gravado e a tela diz o motivo (ex.: "a porcentagem vai de 0 a 100")

### 3. Visão geral — bloco 1: Venda de ingressos

**Descrição:** primeiro bloco da Visão geral; responde se a venda de ingressos está no
ritmo da meta.

**Componentes:**
- Ingressos vendidos x meta: total de ingressos pagos, sobre 100, com barra de progresso.
- Pacing: quantos ingressos por dia faltam vender, em duas leituras: por dia corrido e por
  dia útil; ao lado, o ritmo médio realizado até agora para comparar.
- Faturamento por dia, previsto x realizado: um dia por linha/barra, com o realizado
  (ingressos + bump do dia) colorido contra o previsto.
- Vendas por lote: ingressos vendidos em cada um dos 7 lotes, com o lote atual destacado.
- Vendas por origem: ingressos por tráfego pago, orgânico/conteúdo, base antiga e outros,
  em quantidade e %, com a referência "~75% do tráfego" ao lado.

**Comportamentos:**
- Ver o quanto falta para a meta.
- Ver o pacing necessário por dia corrido e por dia útil.
- Ver o faturamento de cada dia com a cor do resultado.
- Ver quanto cada lote vendeu.
- Ver de onde vieram as vendas.

**Critérios de aceite:**

#### CA-S8-08 — Ingressos vendidos sobre a meta · prova: automática

- **Dado** 37 ingressos pagos
- **Quando** a tela calcula o bloco 1
- **Então** mostra "37 de 100" e 37% na barra

#### CA-S8-09 — Pacing por dia corrido e por dia útil · prova: automática

- **Dado** 37 ingressos pagos e a venda encerrando em 05/12 às 9h30
- **Quando** a tela calcula o pacing num dia com 10 dias corridos e 8 dias úteis de venda pela frente (contando hoje)
- **Então** mostra 6,3 ingressos/dia corrido (63 ÷ 10) e 7,9 ingressos/dia útil (63 ÷ 8)

#### CA-S8-10 — Pacing com a meta já batida · prova: automática

- **Dado** 104 ingressos pagos
- **Quando** a tela calcula o pacing
- **Então** mostra que a meta foi batida, sem pacing negativo

#### CA-S8-11 — Previsto do dia calculado pela meta · prova: automática

- **Dado** que faltam 63 ingressos e 10 dias corridos, o lote do dia custa R$ 39 e a meta de conversão do bump é 10%
- **Quando** a tela calcula o previsto do dia
- **Então** o previsto é 6,3 × R$ 39 + 6,3 × 10% × R$ 297 = R$ 432,81
- (sem meta de conversão do bump preenchida, o previsto conta só os ingressos)

#### CA-S8-12 — Cor do faturamento do dia · prova: automática

- **Dado** um previsto de R$ 400 para o dia
- **Quando** o realizado é R$ 480 (20% acima), R$ 410 (até 20% acima) ou R$ 390 (abaixo)
- **Então** a cor é verde forte, verde claro e vermelho, respectivamente
- (realizado igual ao previsto conta como verde claro)

#### CA-S8-13 — Vendas por lote · prova: automática

- **Dado** ingressos vendidos em datas dos lotes 01, 02 e 03
- **Quando** a tela calcula as vendas por lote
- **Então** cada ingresso conta no lote vigente no momento da compra, os 7 lotes aparecem
  (os sem venda com zero) e o lote atual vem destacado

#### CA-S8-14 — Vendas por origem pela UTM · prova: automática

- **Dado** vendas com UTM de anúncio, de bio/conteúdo, de disparo para a base e sem UTM
- **Quando** a tela calcula as vendas por origem
- **Então** cada venda cai em tráfego pago, orgânico/conteúdo, base antiga ou outros, com
  quantidade e %, e a referência "~75% do tráfego" aparece ao lado como referência

### 4. Visão geral — bloco 2: Tráfego e página

**Descrição:** custo e conversão do anúncio até a compra do ingresso.

**Componentes:**
- CAC do ingresso: investimento em anúncios de ingresso ÷ ingressos vindos do tráfego pago.
- CPA teto: verba de ingresso ÷ ingressos que devem vir do tráfego (100 × % esperado do
  tráfego), com a referência "manter abaixo do teto até 60–70% dos ingressos vendidos".
- CPM, CTR (ref. 0,95%–1,06%), connect rate (ref. 75%–94%), page to checkout (ref. ~15%),
  checkout to compra (ref. ~40%).
- Ranking de criativos: anúncios ordenados por volume de vendas e por custo por venda.

**Comportamentos:**
- Comparar o CAC com o CPA teto.
- Ver cada taxa do funil ao lado da faixa de referência.
- Ordenar o ranking de criativos por vendas ou por custo por venda.

**Critérios de aceite:**

#### CA-S8-15 — CAC do ingresso e CPA teto · prova: automática

- **Dado** R$ 1.500 investidos em anúncios de ingresso, 30 ingressos vindos do tráfego pago, verba de R$ 5.000 e 75% esperado do tráfego
- **Quando** a tela calcula o bloco 2
- **Então** o CAC é R$ 50,00 e o CPA teto é R$ 66,67 (5.000 ÷ 75)

#### CA-S8-16 — Aviso do CAC acima do teto antes da reta final · prova: automática

- **Dado** CAC acima do CPA teto
- **Quando** os ingressos vendidos estão abaixo de 60% da meta
- **Então** o card do CAC fica em alerta; acima de 70% da meta, o mesmo CAC não fica em alerta (reta final)
- (entre 60% e 70%, ver SUP-S8-07)

#### CA-S8-17 — Taxas do funil com referência · prova: automática

- **Dado** 200 mil impressões, R$ 4.000 investidos, 2.000 cliques no link, 1.600 visualizações da página, 240 inícios de checkout e 96 compras de ingresso
- **Quando** a tela calcula o bloco 2
- **Então** CPM = R$ 20,00, CTR = 1,00%, connect rate = 80%, page to checkout = 15%,
  checkout to compra = 40%, cada uma com a faixa de referência ao lado marcada como referência

#### CA-S8-18 — Taxa com denominador zero · prova: automática

- **Dado** zero cliques no link
- **Quando** a tela calcula o connect rate
- **Então** mostra "—" em vez de erro ou infinito

#### CA-S8-19 — Ranking de criativos · prova: automática

- **Dado** três anúncios com 10, 4 e 0 vendas e custos de R$ 300, R$ 80 e R$ 50
- **Quando** a pessoa ordena por vendas e depois por custo por venda
- **Então** a primeira ordem é 10, 4, 0; a segunda é R$ 20 (4 vendas), R$ 30 (10 vendas)
  e o anúncio sem venda vai para o fim com "—"

### 5. Visão geral — bloco 3: Order bump

**Descrição:** quanto o bump converte e se ele puxa a venda da Mentoria.

**Componentes:**
- Conversão do bump por dia: compras do bump ÷ compras de ingresso, dia a dia, com a meta
  interna editável ao lado.
- Conversão na Mentoria com bump x sem bump, com a referência "quem compra o bump costuma
  converter 30% a 100% mais".

**Comportamentos:**
- Ver a conversão do bump de cada dia contra a meta.
- Comparar a conversão na Mentoria de quem comprou o bump com a de quem só tem ingresso.

**Critérios de aceite:**

#### CA-S8-20 — Conversão do bump por dia · prova: automática

- **Dado** um dia com 8 ingressos e 2 bumps
- **Quando** a tela calcula a conversão do bump
- **Então** mostra 25% naquele dia; dia sem ingresso mostra "—"

#### CA-S8-21 — Mentoria com bump x sem bump · prova: automática

- **Dado** 20 compradores do bump com 6 mentorias e 80 compradores só de ingresso com 12 mentorias
- **Quando** a tela calcula a comparação
- **Então** mostra 30% com bump, 15% sem bump e "+100%" de diferença, com a referência 30%–100% ao lado

### 6. Visão geral — bloco 4: Evento (05/12)

**Descrição:** presença no dia do evento.

**Componentes:**
- Comparecimento: pessoas que entraram no Meet ÷ ingressos vendidos (ref. 70%–80%,
  marcado como indicador secundário).
- Pessoas ao vivo no pitch: pico de pessoas na sala no horário da oferta, tirado do Meet.

**Comportamentos:**
- Ver o comparecimento contra a referência.
- Ver quantas pessoas estavam na sala na hora da oferta.
- Antes de 05/12 (com dados reais), o bloco mostra "disponível a partir de 05/12".

**Critérios de aceite:**

#### CA-S8-22 — Comparecimento pelo Meet · prova: automática

- **Dado** 100 ingressos vendidos e 74 pessoas distintas que entraram no Meet do evento (equipe excluída)
- **Quando** a tela calcula o bloco 4
- **Então** mostra 74% com a referência 70%–80%

#### CA-S8-23 — Pico ao vivo no horário da oferta · prova: automática

- **Dado** entradas e saídas do Meet e o horário da oferta gravado como 16h
- **Quando** a tela calcula o pico no pitch
- **Então** mostra o maior número de pessoas presentes ao mesmo tempo na janela da oferta (ver SUP-S8-09)

#### CA-S8-24 — Bloco do evento antes da data · prova: automática

- **Dado** dados reais e a data de hoje antes de 05/12
- **Quando** a tela monta o bloco 4
- **Então** mostra "disponível a partir de 05/12" no lugar dos números

### 7. Visão geral — bloco 5: Venda depois do evento (resultado)

**Descrição:** resultado final do lançamento. No topo do bloco, três cards grandes:
**pessoas ao vivo**, **ticket médio** e **conversão na Mentoria**.

**Componentes:**
- Cards grandes: pessoas ao vivo no pitch, ticket médio, conversão do ingresso na Mentoria.
- Conversão do ingresso na Mentoria: mentorias ÷ ingressos (ref. 15%–30%, indicador primário).
- Conversão no dia do pitch x dias seguintes: mentorias de 05/12 e dos 14 dias seguintes,
  cada uma sobre os ingressos (ref. 9% no dia + 11% nos 14 dias seguintes).
- Ticket médio: faturamento total ÷ compradores.
- Faturamento total: ingressos + bump + Mentoria.
- ROAS: faturamento total ÷ investimento total em anúncios.

**Comportamentos:**
- Ver os três indicadores principais em destaque.
- Ver quanto da Mentoria foi vendido no dia e depois.
- Ver faturamento, ticket médio e ROAS do lançamento.

**Critérios de aceite:**

#### CA-S8-25 — Três cards grandes no topo do bloco 5 · prova: manual

- **Dado** a subaba "Evento e pós" aberta
- **Quando** a pessoa chega ao bloco 5
- **Então** vê, antes de qualquer outro número do bloco, três cards grandes: pessoas ao
  vivo, ticket médio e conversão na Mentoria

#### CA-S8-26 — Conversão na Mentoria no dia x 14 dias seguintes · prova: automática

- **Dado** 100 ingressos, 9 mentorias em 05/12, 11 entre 06/12 e 19/12 e 2 depois de 19/12
- **Quando** a tela calcula o bloco 5
- **Então** mostra 9% no dia, 11% nos 14 dias seguintes e conversão total de 22% (todas as mentorias de compradores do ingresso)

#### CA-S8-27 — Faturamento total, ticket médio e ROAS · prova: automática

- **Dado** R$ 4.500 em ingressos, R$ 5.940 em bump, R$ 60.000 em Mentoria, 100 compradores e R$ 6.000 investidos em anúncios
- **Quando** a tela calcula o bloco 5
- **Então** o faturamento total é R$ 70.440, o ticket médio é R$ 704,40 e o ROAS é 11,74

### 8. Simulação — projeção até o fim

**Descrição:** projeta onde o lançamento termina se o ritmo atual continuar, com um ajuste
de ritmo para testar cenários.

**Componentes:**
- Ritmo atual: ingressos por dia (ver SUP-S8-10).
- Campo de ajuste de ritmo (ex.: +20%, −10%), que não é salvo.
- Projeção: ingressos no fim da venda (05/12 às 9h30), se bate a meta de 100 e em que dia,
  e faturamento projetado de ingressos + bump (lote de cada dia futuro × ingressos
  projetados + bump pela conversão atual).
- Ritmo necessário para bater a meta, ao lado do ritmo projetado.

**Comportamentos:**
- Ver a projeção pelo ritmo atual.
- Ajustar o ritmo e ver a projeção mudar na hora.
- Voltar ao ritmo atual (zerar o ajuste).

**Critérios de aceite:**

#### CA-S8-28 — Projeção pelo ritmo atual · prova: automática

- **Dado** 37 ingressos, ritmo atual de 4 ingressos/dia e 10 dias corridos de venda pela frente
- **Quando** a Simulação calcula a projeção
- **Então** projeta 77 ingressos no fim, diz que a meta não é batida e mostra o ritmo necessário de 6,3/dia

#### CA-S8-29 — Ajuste de ritmo · prova: automática

- **Dado** o mesmo cenário do CA-S8-28
- **Quando** a pessoa aplica +60% no ritmo
- **Então** a projeção vira 101 ingressos, diz que a meta é batida e em que dia, e o ajuste não é gravado para outras pessoas

#### CA-S8-30 — Faturamento projetado com o preço de cada lote · prova: automática

- **Dado** ritmo de 4 ingressos/dia, 2 dias restantes no lote de R$ 45 e 3 no de R$ 49, conversão atual do bump de 10%
- **Quando** a Simulação calcula o faturamento projetado dos próximos 5 dias
- **Então** soma 8 × R$ 45 + 12 × R$ 49 + 20 × 10% × R$ 297 = R$ 1.542, mais o já realizado

### 9. Dados de exemplo (protótipo)

**Descrição:** conjunto fictício usado enquanto não há venda real, para a usuária ver a
tela inteira funcionando.

**Comportamentos:**
- Os dados de exemplo cobrem os 5 blocos e a Simulação, como se o lançamento já estivesse
  em andamento (inclusive evento e pós-evento, para os blocos 4 e 5 não ficarem vazios).
- Os números de exemplo são coerentes entre si (ex.: compras ≤ inícios de checkout ≤
  visualizações ≤ cliques; mentorias ≤ ingressos).

**Critérios de aceite:**

#### CA-S8-31 — Dados de exemplo coerentes · prova: automática

- **Dado** o conjunto de dados de exemplo
- **Quando** a tela calcula todos os blocos com ele
- **Então** nenhuma taxa passa de 100%, compras ≤ inícios de checkout ≤ visualizações ≤
  cliques ≤ impressões, e mentorias ≤ compradores de ingresso

#### CA-S8-32 — Protótipo aprovado no ar · prova: manual

- **Dado** a tela no ar com os dados de exemplo
- **Quando** a usuária abre a Visão geral e a Simulação
- **Então** ela aprova o layout e a ordem dos blocos

### 10. Resumo e telas de detalhe (revisão de 10/11)

**Descrição:** a primeira subaba vira um **Resumo** para bater o olho e saber o estado do
lançamento. Cada bloco do briefing ganha a sua subaba de detalhe, e as metas ganham uma
subaba própria. Pedido da usuária em 10/11/2026, depois de ver a primeira versão no ar.

**Componentes:**
- Subabas, nesta ordem: Resumo · Ingressos (bloco 1) · Tráfego e página (bloco 2) ·
  Bump (bloco 3) · Evento e pós (blocos 4 e 5) · Simulação · Metas.
- Resumo, de cima para baixo:
  - Cards de estado: ingressos vendidos × meta, faturamento até agora (ingressos + bump),
    quanto precisa vender por dia, CAC × CPA teto, conversão do bump × meta.
  - Projeção em uma linha: "no ritmo atual termina com N ingressos", se bate a meta e em
    que dia (a mesma conta da Simulação, sem ajuste).
  - Alertas: lista curta do que está fora (ver SUP-S8-14); sem nada fora, "nada fora do
    previsto".
  - Venda por dia: gráfico com a quantidade de ingressos vendidos em cada dia e a meta de
    ingressos do dia; embaixo, por dia, ingressos, faturamento, conversão (visitas da
    página → compra) e atingimento da meta diária.
- As subabas de detalhe mostram os blocos de antes, sem mudança nas contas.

**Comportamentos:**
- Bater o olho no Resumo e saber se o lançamento está no ritmo.
- Abrir a subaba de um bloco para ver o detalhe dele.
- Gravar as metas na subaba "Metas".

**Critérios de aceite:**

#### CA-S8-33 — Venda por dia no Resumo · prova: automática

- **Dado** um dia com 5 ingressos, R$ 240 faturados (ingressos + bump), 80 visitas na
  página, previsto de R$ 200 e meta de 4 ingressos para o dia
- **Quando** a tela monta o Resumo
- **Então** a linha do dia mostra 5 ingressos, R$ 240, conversão de 6,25%, meta do dia de
  4 ingressos e atingimento de 120% (com a cor do dia)

#### CA-S8-34 — Conversão do dia sem visitas · prova: automática

- **Dado** um dia sem visitas registradas na página (ou visitas ainda não ligadas)
- **Quando** a tela monta o Resumo
- **Então** a conversão do dia aparece como "—", sem erro e sem 0%

#### CA-S8-35 — Cards de estado do Resumo · prova: automática

- **Dado** 40 ingressos a R$ 39 e 8 bumps (R$ 3.936 em ingressos + bump), R$ 2.080
  investidos (CAC de R$ 52), verba de R$ 3.500 com 75% do tráfego (CPA teto de R$ 46,67),
  meta do bump de 25%, em 20/11 com 15 dias de venda pela frente
- **Quando** a tela monta o Resumo
- **Então** os cards mostram 40 de 100, R$ 3.936, 4/dia para bater a meta, o CAC de R$ 52
  ao lado do teto de R$ 46,67 marcado em alerta e o bump de 20% ao lado da meta de 25%

#### CA-S8-36 — Projeção em uma linha igual à Simulação · prova: automática

- **Dado** qualquer conjunto de vendas
- **Quando** a tela monta o Resumo
- **Então** a linha de projeção traz os mesmos ingressos no fim, o mesmo "bate / não bate"
  e o mesmo dia que a Simulação mostra com ajuste 0

#### CA-S8-37 — Alertas do Resumo · prova: automática

- **Dado** o último dia fechado abaixo do previsto, CAC acima do teto antes da reta final,
  bump abaixo da meta e projeção sem bater a meta
- **Quando** a tela monta o Resumo
- **Então** aparecem os quatro alertas; e, sem nenhuma dessas situações, aparece "nada
  fora do previsto"

#### CA-S8-38 — Cada subaba mostra o seu bloco · prova: automática

- **Dado** a tela aberta
- **Quando** a pessoa abre "Ingressos", "Tráfego e página", "Bump", "Evento e pós" e "Metas"
- **Então** cada uma mostra só o seu conteúdo (bloco 1; bloco 2; bloco 3; blocos 4 e 5;
  campos das metas), e o Resumo não mostra o formulário das metas

#### CA-S8-39 — Resumo e telas de detalhe aprovados no ar · prova: manual

- **Dado** a tela no ar com os dados de exemplo
- **Quando** a usuária abre o Resumo e passa pelas subabas
- **Então** ela consegue dizer o estado do lançamento só pelo Resumo e aprova o layout

## Fora de escopo

- Ligar a Zouti de verdade (receber vendas, bump, Mentoria e inícios de checkout) fica para
  depois do protótipo; nesta spec só a tela, as contas e os dados de exemplo. A ligação
  vira issue própria quando a forma de acesso da Zouti for conhecida (PER-S8-01).
- Mexer na página de vendas /imersao-planejamento-atacado ou no checkout.
- Enviar as vendas da Zouti ao Meta/GA4 como conversão.
- Alertas por WhatsApp/Slack/e-mail.
- Metas editáveis para outros lançamentos; a tela é só deste.
- Meta de ingressos editável (fica fixa em 100).
- Filtro de período: a tela sempre mostra o lançamento inteiro.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S8-01 | As datas de virada dos lotes são as da tabela já usada pela página (`lotes-imersao`): lote 01 até 15/11, …, lote 07 até 05/12 9h30; quando as datas forem confirmadas, a tela segue a mesma tabela | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-02 | A venda de ingressos encerra em 05/12 às 9h30; o pacing conta os dias de venda até lá, incluindo o dia de hoje | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-03 | Dia útil = segunda a sexta, sem descontar feriados | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-04 | Regras de origem pela UTM: tráfego pago = UTM de anúncio (Meta/Google); base antiga = UTM de disparo (WhatsApp, e-mail, ManyChat para a base); orgânico/conteúdo = UTM de bio, stories, posts; outros = sem UTM ou não reconhecida | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-05 | Investimento "de ingresso" = campanhas do Meta cujo nome identifica a Imersão (ex.: contém "imersao"); investimento total para o ROAS = essas mesmas campanhas | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-06 | Ranking de criativos atribui a venda ao anúncio pela UTM do link (utm_content = anúncio); a tela é atualizada uma vez por dia, o que atende o "a cada 2 ou 3 dias" | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-07 | Entre 60% e 70% dos ingressos vendidos, o CAC acima do teto continua em alerta (o relaxamento começa em 70%) | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-08 | Comprador do ingresso e da Mentoria são cruzados por e-mail ou telefone; mentoria de quem não comprou ingresso não entra nas conversões | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-09 | A coleta do Meet traz entrada e saída de cada pessoa; "pico no pitch" = maior número de presentes simultâneos entre o horário da oferta e 30 min depois | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-10 | Ritmo atual da Simulação = média de ingressos por dia dos últimos 3 dias de venda (ou de todos os dias, se houver menos de 3) | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-12 | Dias de venda do pacing e da Simulação vão de hoje até sexta 04/12; o sábado 05/12 (venda até 9h30) só conta quando hoje é 05/12 | confirmada | usuária, 09/11/2026 |
| SUP-S8-13 | No gráfico, a meta de ingressos do dia = ingressos que faltavam no começo do dia ÷ dias de venda que restavam (a mesma conta do previsto); o atingimento = faturamento realizado ÷ previsto do dia, a mesma base das cores | confirmada | usuária, 10/11/2026 |
| SUP-S8-14 | Alertas do Resumo: (a) o último dia de venda já fechado ficou abaixo do previsto; (b) CAC acima do teto antes da reta final; (c) conversão do bump abaixo da meta; (d) a projeção pelo ritmo atual não bate a meta | confirmada | usuária, 10/11/2026 |
| SUP-S8-15 | Visitas por dia = visualizações da página da Imersão no dia; no modo real ficam "—" até a ligação da página (como as visualizações hoje) | confirmada | usuária, 10/11/2026 |
| SUP-S8-11 | Compras canceladas ou reembolsadas na Zouti saem de todos os números | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S8-01 | Como a Zouti entrega os dados (API, webhook ou exportação) e ela traz as UTMs da venda, o bump separado e os inícios de checkout? Decide a issue de ligação; não trava o protótipo | respondida | Fora desta spec: é a pergunta inicial da futura spec de ligação da Zouti, como aprovado junto com a spec (usuária, 09/11) |
| PER-S8-02 | O que a Simulação simula? | respondida | Projeção até o fim pelo ritmo atual (usuária, 09/11) |
| PER-S8-03 | A Zouti é o checkout do ingresso? | respondida | Sim; ingresso, bump e Mentoria vêm da Zouti (usuária, 09/11) |
| PER-S8-04 | De onde vem o previsto de cada dia? | respondida | Calculado pela meta: faltam ÷ dias restantes × lote do dia, + bump pela meta (usuária, 09/11) |
| PER-S8-05 | Metas editáveis ficam salvas para todos? | respondida | Sim, no servidor (usuária, 09/11) |
| PER-S8-06 | Limite do verde forte? | respondida | 20% ou mais acima do previsto (usuária, 09/11) |
| PER-S8-07 | Comparecimento e pico ao vivo: como entram? | respondida | Os dois pelo Meet (usuária, 09/11) |
| PER-S8-08 | Como marcar dados fictícios? | respondida | Faixa "dados de exemplo" que some com a primeira venda real (usuária, 09/11) |
