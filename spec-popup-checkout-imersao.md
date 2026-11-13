# Spec: Pop-up de cadastro e webhook de compras da Imersão

> série: S10
> estado: aprovada em 13/11/2026

## Visão Geral

Hoje os botões "Garantir meu ingresso" da página `/imersao-planejamento-atacado` só rolam
até a seção de preço, porque não havia link de checkout. Com o checkout da Zouti pronto
(`https://pay.zouti.com.br/checkout?product_offer_id=prod_offer_iflx36w3lb48e111fap57z`),
a usuária quer saber quem clicou para comprar antes de a pessoa sair do site.

A mudança coloca uma janela de cadastro (nome, e-mail e WhatsApp) entre o clique no botão
e o checkout. Quem preenche vai para o checkout; os dados ficam numa planilha com as UTMs
e viram card no CRM, com o funil IMERSÃO. Serve para o time comercial e de marketing falar
com quem começou a compra e não terminou, e para saber de qual anúncio veio cada pessoa.

A segunda parte (pedido da usuária em 13/11) é o caminho de volta: um endereço para a
Zouti avisar o site de cada compra. Com ele, a aba Imersão 2027 do dash, que hoje mostra
dados de exemplo, passa a mostrar as vendas de verdade do ingresso e do bump. A Mentoria fica de fora
(decisão da usuária em 13/11).

A regra que manda em tudo: **a venda vem antes do cadastro**. Nenhuma falha ao gravar pode
impedir a ida ao checkout.

## Páginas / Módulos

### Página do ingresso: botões de compra

**Descrição:** os botões de compra passam a levar ao checkout de verdade, passando antes
pela janela de cadastro.

**Componentes:**
- Botão do topo: continua rolando até a seção de preço, como hoje.
- Demais botões de compra (identificação, plano, cartão de preço, garantia e fechamento):
  abrem a janela de cadastro.

**Comportamentos:**
- Tocar no botão do topo: a página rola até a seção de preço; a janela não abre.
- Tocar em qualquer outro botão de compra: a janela de cadastro abre por cima da página.
- Tocar em um botão de compra depois de já ter preenchido o cadastro na mesma visita: vai
  direto ao checkout, sem abrir a janela de novo.
- Abrir a página com as vendas encerradas: os botões de compra não aparecem, como hoje.

**Critérios de aceite:**

#### CA-S10-01 — Botão do topo não abre o cadastro · prova: automática

- **Dado** a página do ingresso com vendas abertas
- **Quando** a pessoa toca no botão do topo
- **Então** a página rola até a seção de preço e a janela de cadastro continua fechada

#### CA-S10-02 — Os outros botões abrem o cadastro · prova: automática

- **Dado** a página do ingresso com vendas abertas e uma pessoa que ainda não se cadastrou
- **Quando** ela toca em qualquer botão de compra que não seja o do topo
- **Então** a janela de cadastro abre e a pessoa continua na página (não vai ao checkout ainda)

#### CA-S10-03 — Quem já se cadastrou na visita vai direto · prova: automática

- **Dado** uma pessoa que já enviou o cadastro nesta visita e voltou para a página
- **Quando** ela toca em um botão de compra
- **Então** vai para o checkout sem ver a janela de novo

### Janela de cadastro

**Descrição:** janela por cima da página, com três campos e um botão que leva ao checkout.

**Componentes:**
- Campo Nome.
- Campo E-mail.
- Campo WhatsApp (com DDD).
- Botão de confirmar, que leva ao checkout.
- Botão de fechar.
- Mensagem de erro junto do campo com problema.

**Comportamentos:**
- Preencher os três campos e confirmar: os dados são enviados e a pessoa vai ao checkout.
- Confirmar com campo vazio ou inválido: a janela aponta o campo e não envia.
- Fechar a janela (botão de fechar, tecla Esc ou toque fora): a janela some e a pessoa
  continua na página, no mesmo ponto.
- Confirmar duas vezes seguidas: só um cadastro é gravado.
- Confirmar quando a gravação falha ou demora: a pessoa vai ao checkout do mesmo jeito.

**Critérios de aceite:**

#### CA-S10-04 — Cadastro completo leva ao checkout · prova: automática

- **Dado** a janela aberta
- **Quando** a pessoa preenche nome, e-mail e WhatsApp válidos e confirma
- **Então** ela é levada ao checkout da Zouti do ingresso

#### CA-S10-05 — Campo vazio ou inválido não envia · prova: automática

- **Dado** a janela aberta
- **Quando** a pessoa confirma sem nome, com e-mail sem formato de e-mail ou com WhatsApp
  sem DDD e número
- **Então** a janela mostra qual campo corrigir, nada é gravado e a pessoa não sai da página

#### CA-S10-06 — Fechar a janela mantém a pessoa na página · prova: automática

- **Dado** a janela aberta
- **Quando** a pessoa fecha pelo botão, pela tecla Esc ou tocando fora
- **Então** a janela some, nada é gravado e a página fica onde estava

#### CA-S10-07 — Falha ao gravar não impede a compra · prova: automática

- **Dado** a janela preenchida com dados válidos e o serviço de gravação fora do ar
- **Quando** a pessoa confirma
- **Então** ela vai ao checkout em até 3 segundos

#### CA-S10-08 — Dois toques gravam um cadastro só · prova: automática

- **Dado** a janela preenchida com dados válidos
- **Quando** a pessoa toca duas vezes seguidas em confirmar
- **Então** existe uma linha na planilha e um card no CRM para aquele cadastro, não dois

#### CA-S10-09 — Janela legível e utilizável no celular · prova: manual

- **Dado** um celular com a página do ingresso aberta
- **Quando** a usuária abre a janela e preenche os três campos
- **Então** os campos, o botão e a mensagem de erro aparecem inteiros, sem cortar com o
  teclado aberto, e o visual acompanha o da página

### Ida ao checkout

**Descrição:** o endereço para onde a pessoa é levada depois do cadastro.

**Comportamentos:**
- Ir ao checkout: a pessoa cai na oferta do ingresso na Zouti, levando as UTMs da visita.

**Critérios de aceite:**

#### CA-S10-10 — UTMs da visita seguem para o checkout · prova: automática

- **Dado** uma visita que chegou com UTMs de origem, mídia, campanha, conteúdo e termo
- **Quando** a pessoa confirma o cadastro
- **Então** o endereço do checkout leva essas cinco UTMs com os mesmos valores

#### CA-S10-11 — Dado pessoal não aparece no endereço do checkout · prova: automática

- **Dado** um cadastro confirmado
- **Quando** a pessoa é levada ao checkout
- **Então** o endereço não contém o nome, o e-mail nem o WhatsApp dela

### Checkout já preenchido

**Descrição:** pedido da usuária na aprovação (13/11): quem preencheu o pop-up não deve
digitar de novo no checkout. Depende de a Zouti oferecer um jeito de receber os dados que
não os exponha no endereço do link (ver PER-S10-12).

**Comportamentos:**
- Confirmar o cadastro: o checkout abre com nome, e-mail e WhatsApp já preenchidos.

**Critérios de aceite:**

#### CA-S10-36 — Checkout abre com os dados do pop-up · prova: manual

- **Dado** a página no ar e a forma de envio dos dados confirmada com a Zouti
- **Quando** a usuária preenche o pop-up e é levada ao checkout
- **Então** nome, e-mail e WhatsApp aparecem preenchidos no checkout, e o endereço do
  checkout não contém nenhum dos três (mesma regra do critério CA-S10-11)

### Aviso ao Meta

**Descrição:** o cadastro confirmado conta como lead no Meta. Início de checkout e compra
ficam por conta da Zouti.

**Comportamentos:**
- Confirmar um cadastro: o Meta recebe um lead daquela pessoa.

**Critérios de aceite:**

#### CA-S10-31 — Cadastro confirmado vira lead no Meta · prova: automática

- **Dado** um cadastro confirmado que não é de teste
- **Quando** a gravação termina
- **Então** o Meta recebe um evento de lead com os dados protegidos da pessoa, uma vez só

#### CA-S10-32 — A página não manda início de checkout em dobro · prova: automática

- **Dado** um cadastro confirmado
- **Quando** a pessoa é levada ao checkout
- **Então** a página não envia ao Meta um início de checkout próprio (o da Zouti é o único)

### Planilha de cadastros

**Descrição:** planilha nova, só da Imersão, com uma linha por cadastro.

**Componentes:**
- Colunas: data e hora (Brasília), nome, e-mail, WhatsApp, origem, mídia, campanha,
  conteúdo, termo, lote e preço vigentes na hora do cadastro, página de onde veio.

**Comportamentos:**
- Confirmar um cadastro: uma linha nova entra na planilha.

**Critérios de aceite:**

#### CA-S10-12 — Cadastro vira linha com UTM completa · prova: automática

- **Dado** uma visita com as cinco UTMs e um cadastro confirmado
- **Quando** a gravação termina
- **Então** a planilha ganha uma linha com data e hora de Brasília, nome, e-mail, WhatsApp
  no padrão com DDI e DDD, as cinco UTMs, o lote e o preço daquele momento

#### CA-S10-13 — Visita sem UTM também é gravada · prova: automática

- **Dado** uma visita sem nenhuma UTM e um cadastro confirmado
- **Quando** a gravação termina
- **Então** a linha entra na planilha com as colunas de UTM vazias

#### CA-S10-14 — Cadastro de verdade aparece na planilha · prova: manual

- **Dado** a página no ar
- **Quando** a usuária faz um cadastro pelo celular vindo de um link com UTMs
- **Então** ela encontra a linha na planilha com os dados e as UTMs daquele link

### Card no CRM

**Descrição:** cada cadastro vira card no CRM, com o funil IMERSÃO.

**Comportamentos:**
- Confirmar um cadastro de pessoa que não está no CRM: nasce um card novo.
- Confirmar um cadastro de pessoa que já tem card (mesmo telefone ou e-mail): o card
  existente recebe um comentário; não nasce um segundo card.

**Critérios de aceite:**

#### CA-S10-15 — Cadastro novo vira card com funil IMERSÃO · prova: automática

- **Dado** um cadastro confirmado de alguém que não está no CRM
- **Quando** a gravação termina
- **Então** existe um card com nome, e-mail, WhatsApp e UTMs, com o campo Funil em IMERSÃO

#### CA-S10-16 — Quem já tem card não ganha um segundo · prova: automática

- **Dado** um cadastro confirmado de alguém que já tem card no CRM
- **Quando** a gravação termina
- **Então** o card existente recebe um comentário dizendo que a pessoa se cadastrou para a
  Imersão, e nenhum card novo é criado

#### CA-S10-17 — Card de verdade aparece no CRM · prova: manual

- **Dado** a página no ar
- **Quando** a usuária faz um cadastro com um contato que não está no CRM
- **Então** ela encontra o card no CRM com o funil IMERSÃO

### Números do dash

**Descrição:** os cadastros do pop-up ficam separados dos leads dos outros funis e
aparecem na aba Imersão 2027, junto das vendas.

**Comportamentos:**
- Abrir a aba Imersão 2027: a usuária vê quantas pessoas se cadastraram no pop-up e quantas
  delas compraram.
- Olhar o total de leads, o CPL e o funil de leads novos nas outras telas do dash: os
  cadastros da Imersão não entram.

**Critérios de aceite:**

#### CA-S10-18 — Cadastros aparecem na aba Imersão 2027 · prova: automática

- **Dado** três cadastros confirmados, dos quais um comprou o ingresso
- **Quando** a usuária abre a aba Imersão 2027
- **Então** a aba mostra três cadastros e um comprador entre eles (33,3%)

#### CA-S10-19 — Cadastro da Imersão não entra no total nem no CPL · prova: automática

- **Dado** um período com dez leads de outros funis e três cadastros da Imersão
- **Quando** a usuária olha o total de leads, o CPL e o funil de leads novos nas outras telas do dash
- **Então** as contas usam dez leads, não treze

### Mensagens automáticas

**Descrição:** a usuária escolheu que quem se cadastra receba WhatsApp e e-mail. O
conteúdo e o momento ainda não foram definidos (ver perguntas em aberto).

**Comportamentos:**
- Confirmar um cadastro: a pessoa entra na lista de e-mail com a marca do funil Imersão.
- Confirmar um cadastro: a pessoa segue para o envio de WhatsApp definido para a Imersão.

**Critérios de aceite:**

#### CA-S10-20 — Cadastro entra na lista de e-mail com a marca da Imersão · prova: automática

- **Dado** um cadastro confirmado
- **Quando** a gravação termina
- **Então** o contato existe na lista de e-mail marcado com o funil Imersão

#### CA-S10-21 — Quem se cadastra não recebe mensagem de outro funil · prova: automática

- **Dado** um cadastro confirmado da Imersão
- **Quando** as mensagens automáticas rodam
- **Então** a pessoa não recebe o WhatsApp nem o e-mail da consultoria, do workshop gratuito
  ou das lives

### Webhook de compras da Zouti

**Descrição:** endereço do site que recebe os avisos de compra da Zouti e grava cada venda
de ingresso e de bump para a aba Imersão 2027 do dash.

**Componentes:**
- Endereço de recebimento, protegido por um segredo combinado com a Zouti.
- Registro de cada aviso recebido (para conferir depois o que chegou).

**Comportamentos:**
- Receber um aviso de compra paga do ingresso: a venda entra como ingresso.
- Receber um aviso de compra paga do bump: a venda entra como bump.
- Receber um aviso de compra da Mentoria: é ignorado, como qualquer produto de fora.
- Receber um aviso de cancelamento ou reembolso: a venda correspondente muda de situação.
- Receber o mesmo aviso duas vezes: nada é duplicado.
- Receber um aviso sem o segredo ou com o segredo errado: é recusado.
- Receber um aviso de produto que não é da Imersão: é ignorado e fica registrado.
- Abrir a aba Imersão 2027 depois da primeira venda real: os dados de exemplo somem.

**Critérios de aceite:**

#### CA-S10-22 — Compra paga do ingresso entra nas vendas · prova: automática

- **Dado** nenhuma venda registrada
- **Quando** chega um aviso válido de compra paga do ingresso, com valor, data, e-mail e telefone
- **Então** a aba Imersão 2027 mostra um ingresso vendido com aquele valor e aquela data

#### CA-S10-23 — Bump entra como bump, mesmo no pedido do ingresso · prova: automática

- **Dado** os produtos da Imersão cadastrados (ingresso e bump)
- **Quando** chega um aviso de pedido pago com dois itens, o ingresso e o bump
- **Então** a aba Imersão 2027 mostra um ingresso e um bump, cada um com o seu valor

#### CA-S10-24 — Venda guarda a UTM de origem · prova: automática

- **Dado** uma compra feita por alguém que chegou com UTMs
- **Quando** o aviso da compra chega
- **Então** a venda fica com origem, mídia, campanha e conteúdo, e entra na origem certa
  (tráfego pago, orgânico, base ou outros) na aba Imersão 2027

#### CA-S10-25 — Cancelamento e reembolso tiram a venda dos números · prova: automática

- **Dado** uma venda paga já registrada
- **Quando** chega o aviso de cancelamento ou de reembolso dela
- **Então** a venda deixa de contar nos números da aba Imersão 2027

#### CA-S10-26 — Aviso repetido não duplica · prova: automática

- **Dado** uma venda paga já registrada
- **Quando** o mesmo aviso chega de novo
- **Então** continua existindo uma venda só

#### CA-S10-27 — Aviso sem o segredo é recusado · prova: automática

- **Dado** o endereço de recebimento no ar
- **Quando** chega um aviso sem o segredo ou com o segredo errado
- **Então** o aviso é recusado e nenhuma venda é gravada

#### CA-S10-28 — Produto de fora é ignorado · prova: automática

- **Dado** os produtos da Imersão cadastrados
- **Quando** chega um aviso válido de um produto que não é ingresso nem bump (a Mentoria
  Atacado Exponencial, por exemplo)
- **Então** nenhuma venda é gravada e o aviso fica registrado como ignorado

#### CA-S10-30 — Aviso que o site não usa é aceito sem erro · prova: automática

- **Dado** o endereço de recebimento no ar
- **Quando** chega um aviso válido de um tipo que o site não usa (pedido criado, Pix gerado,
  assinatura, carrinho abandonado)
- **Então** o site responde que recebeu, não grava venda e registra o aviso como ignorado
  (a Zouti desliga o webhook depois de 10 falhas seguidas e não reenvia à mão)

#### CA-S10-29 — Primeira venda real troca os dados de exemplo · prova: manual

- **Dado** a aba Imersão 2027 mostrando dados de exemplo
- **Quando** a usuária faz (ou recebe) a primeira compra de verdade do ingresso
- **Então** a faixa de dados de exemplo some e a aba mostra aquela venda

### Aba Imersão 2027 sem a Mentoria

**Descrição:** a Mentoria sai da aba Imersão 2027 (decisão da usuária em 13/11). A aba passa
a falar só de ingresso, bump e evento.

**Comportamentos:**
- Abrir a aba Imersão 2027: nenhum número, meta ou alerta de Mentoria aparece.
- Abrir as Metas da aba: o campo de meta da Mentoria não aparece.

**Critérios de aceite:**

#### CA-S10-33 — A aba não mostra mais números de Mentoria · prova: automática

- **Dado** a aba Imersão 2027, com dados reais ou de exemplo
- **Quando** a usuária passa por todas as subabas
- **Então** não aparecem a conversão na Mentoria, a comparação entre o dia do evento e os 14
  dias seguintes, a comparação de Mentoria com bump e sem bump, nem a meta de Mentoria

#### CA-S10-34 — Faturamento, ticket médio e ROAS contam só ingresso e bump · prova: automática

- **Dado** 100 ingressos a R$ 45 e 20 bumps a R$ 297, com R$ 6.000 investidos
- **Quando** a usuária olha o resultado na aba Imersão 2027
- **Então** o faturamento total é R$ 10.440, o ticket médio R$ 104,40 e o ROAS 1,74

#### CA-S10-35 — A aba sem Mentoria continua legível · prova: manual

- **Dado** a aba Imersão 2027 no ar depois da mudança
- **Quando** a usuária abre o Resumo e a subaba do evento
- **Então** não sobra espaço vazio, título sem conteúdo nem card quebrado onde a Mentoria ficava

## Fora de escopo

- Vendas da Mentoria Atacado Exponencial: não entram por este webhook e saem da aba
  Imersão 2027 (Marcelle, 13/11).
- Buscar na Zouti as vendas antigas, feitas antes de o webhook estar ligado.
- Trazer para o dash os inícios de checkout e os carrinhos abandonados da Zouti (a Zouti tem aviso de carrinho abandonado, fica para depois), o investimento do Meta e a presença no Meet (seguem como etapas futuras da série S8).
- Preencher o checkout da Zouti colocando nome, e-mail ou telefone no endereço do link.
- Marcar no card ou na planilha se a pessoa comprou.
- Mudar o que o botão do topo faz.
- Mudar textos, ordem ou visual das seções da página, fora a janela nova.
- O conteúdo das mensagens de WhatsApp e de e-mail enquanto a pergunta sobre elas (PER-S10-02
  e PER-S10-03) não for respondida: até lá só valem os critérios CA-S10-20 e CA-S10-21.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S10-01 | "Mesma visita" quer dizer a mesma aba do navegador: se a pessoa fechar a aba e voltar outro dia, a janela aparece de novo. | aberta | — |
| SUP-S10-02 | O card novo entra na primeira etapa da lista do CRM, como os leads dos outros funis, sem etapa própria. | aberta | — |
| SUP-S10-03 | Depois do cadastro a pessoa vai sempre ao checkout, nunca a página de obrigado, agenda ou grupo. | aberta | — |
| SUP-S10-04 | A planilha é nova, criada na conta marcelle@seteads.com, separada das outras. | aberta | — |
| SUP-S10-05 | O checkout da Zouti aceita receber as UTMs no endereço e não quebra com elas. Sem documentação da Zouti; a conferir com um clique de verdade. | aberta | — |
| SUP-S10-06 | O WhatsApp é aceito com ou sem o nono dígito e sem exigir +55, como nos outros formulários do site. | aberta | — |
| SUP-S10-08 | A Zouti consegue avisar um endereço externo a cada compra, cancelamento e reembolso, e assina cada aviso com um segredo. | confirmada | Documentação da Zouti enviada pela Marcelle em 13/11 (ajuda.zouti.com.br, "Como configurar Webhook"): eventos de pedido pago, estornado, cancelado e em chargeback, assinatura no cabeçalho. |
| SUP-S10-09 | O aviso de pedido da Zouti tem um bloco de UTMs (confirmado na documentação). O que a documentação não diz é se o checkout lê as UTMs do endereço; se não ler, a origem da venda vem do cadastro do pop-up, cruzando por e-mail ou telefone. | aberta | — |
| SUP-S10-11 | Chargeback (pedido contestado) tira a venda dos números, como o reembolso. | confirmada | Marcelle, 13/11. |
| SUP-S10-12 | O bump não tem campo próprio no aviso: ele chega como mais um item do mesmo pedido, e é reconhecido pelo produto do item. | aberta | — |
| SUP-S10-13 | A venda conta pelo aviso de pedido pago; o valor de cada produto é o do item, não o total do pedido. | confirmada | Marcelle, 13/11. |
| SUP-S10-10 | A venda é ligada ao cadastro do pop-up por e-mail ou telefone, como a aba Imersão 2027 já faz entre ingresso e Mentoria. | aberta | — |
| SUP-S10-14 | Como a Zouti já avisa o Meta do início de checkout e da compra, a página deixa de enviar o próprio início de checkout ao Meta, para não contar duas vezes. | aberta | — |
| SUP-S10-15 | "Conta como lead" vale para o Meta e para o CRM; no dash fica separado, fora do total e do CPL, e aparece na aba Imersão 2027. | confirmada | Marcelle, 13/11. |
| SUP-S10-16 | Sem a Mentoria, o comparecimento ao evento e o pico de pessoas no horário da oferta continuam na aba, e o campo "horário da oferta" continua nas Metas. | aberta | — |
| SUP-S10-17 | A assinatura do aviso é feita sobre o corpo do aviso com o segredo; a documentação tem o trecho do formato cortado, então o site aceita também a forma em que o horário do cabeçalho entra junto do corpo. Sem conferir a validade do horário. | confirmada | Confirmada pelo aviso de teste da Zouti em 13/11: o site aceitou a assinatura com o segredo gravado. |
| SUP-S10-18 | No aviso, o valor de cada item é o total daquele item; com mais de uma unidade, cada ingresso vale o total dividido pela quantidade e conta como um ingresso vendido. | aberta | — |
| SUP-S10-19 | O endereço do webhook é https://atacadoexponencial.com/api/webhooks/zouti e o segredo fica guardado no servidor (nunca no site). | confirmada | Marcelle, 13/11. |
| SUP-S10-20 | A documentação descreve o pedido, mas não o envelope do aviso: o site aceita o pedido na raiz do corpo ou dentro de um campo de dados, e usa o tipo do evento do cabeçalho (se faltar, tenta o do corpo). A conferir com o botão Testar Webhook da Zouti. | confirmada | Confirmada pelo aviso de teste da Zouti em 13/11: o pedido vem na raiz do corpo e o tipo do evento vem no cabeçalho. |
| SUP-S10-21 | O aviso de pedido pago não traz a data do pagamento num campo próprio na raiz (visto no aviso de teste de 13/11): o site usa a data do pagamento se ela vier, senão a data da última atualização do pedido, que no pedido pago é o momento do pagamento. | aberta | — |
| SUP-S10-07 | Cadastros de teste (e-mails @seteads.com e @teste.com) seguem a regra que já existe no site: não vão ao Meta nem ao Google. | aberta | — |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S10-01 | O que o Meta recebe quando alguém confirma o cadastro? | respondida | Marcelle, 13/11: conta como lead no Meta. No CRM entra como lead do funil IMERSÃO. Os eventos de checkout e de compra quem envia ao Meta é a Zouti (pixel e CAPI configurados nela). |
| PER-S10-02 | Qual mensagem de WhatsApp sai para quem se cadastra, por qual número e quando (na hora, ou só para quem não comprar depois de um tempo)? | aberta | — |
| PER-S10-03 | Qual e-mail sai para quem se cadastra e quando? Ou por enquanto a pessoa só entra na lista, sem envio? | aberta | — |
| PER-S10-09 | Como é o aviso de compra da Zouti (campos e eventos)? | respondida | Marcelle, 13/11: enviou a documentação (https://ajuda.zouti.com.br/pt-br/articles/9740997-como-configurar-webhook). |
| PER-S10-10 | Quais são os produtos do ingresso, do bump e da Mentoria na Zouti? | respondida | Marcelle, 13/11: ingresso prod_fe4nfgx9xgwjxmgife1sw5 (Imersão Planejamento Atacado 2027); bump prod_e52fldo7j7aqksthgah5n1 (Imersão em Formatos de Aulas). A Mentoria Atacado Exponencial (prod_bhq9jo4938vgpv2787rf6m) não entra. |
| PER-S10-12 | Como a Zouti recebe os dados do comprador para abrir o checkout preenchido, sem que eles apareçam no endereço do link? A usuária pediu o preenchimento na aprovação (13/11). A documentação não mostra o caminho; falta a resposta do suporte da Zouti. Sem um caminho assim, o critério CA-S10-36 não tem como ser entregue. | aberta | — |
| PER-S10-11 | Onde fica o segredo do webhook no painel da Zouti? A documentação diz que ele existe e pode ser trocado, mas não mostra onde copiar. Você cria o webhook no painel e me passa o segredo por um canal seguro, ou prefere que eu te guie na tela? | respondida | Marcelle, 13/11: ela mesma cria o webhook na Zouti e grava o segredo no servidor pelo terminal, sem passar pela conversa. |
| PER-S10-04 | Para onde vão os dados: planilha com UTM completa e CRM. | respondida | Marcelle, 13/11: "Quero planilha com UTM completa + CRM". |
| PER-S10-05 | Quais botões abrem a janela. | respondida | Marcelle, 13/11: todos menos o do topo. |
| PER-S10-06 | Qual opção do campo Funil no CRM. | respondida | Marcelle, 13/11: opção nova IMERSÃO. |
| PER-S10-07 | O cadastro conta como lead no dash. | respondida | Marcelle, 13/11: separado dos outros funis, fora do total e do CPL; os dados entram na aba Imersão 2027. |
| PER-S10-08 | A pessoa recebe mensagem automática. | respondida | Marcelle, 13/11: WhatsApp e e-mail (conteúdo em PER-S10-02 e PER-S10-03). |
