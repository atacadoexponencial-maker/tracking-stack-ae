| confirmada | Marcelle, 14/11/2026 || confirmada | Marcelle, 14/11/2026 || confirmada | Marcelle, 14/11/2026 || confirmada | Marcelle, 14/11/2026 || confirmada | Marcelle, 14/11/2026 |# Spec: Pop-up de cadastro e webhook de compras da Imersão

> série: S10
> estado: aprovada em 13/11/2026; revisão de 14/11/2026 (cadastro só na planilha, compra no CRM) aprovada em 14/11/2026

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

**Descrição:** decisão da usuária em 14/11: o site não envia nada ao Meta, nem no cadastro
nem na compra. Início de checkout e compra ficam por conta da Zouti (pixel e CAPI dela).

**Comportamentos:**
- Confirmar um cadastro: o cadastro fica só na planilha (e na contagem da aba Imersão 2027).
  Não vira card no CRM, não entra em lista de e-mail e não gera evento no Meta.

**Critérios de aceite:**

#### CA-S10-37 — Cadastro fica só na planilha · prova: automática

- **Dado** um cadastro confirmado na janela
- **Quando** a gravação termina
- **Então** a linha existe na planilha, e não existe card novo no CRM, comentário em card,
  contato novo na lista de e-mail nem evento enviado ao Meta por causa desse cadastro

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

### Planilha de compras

**Descrição:** as compras vão para a mesma planilha dos cadastros, em uma aba separada,
"Compras" (decisão da usuária em 14/11).

**Componentes:**
- Colunas: data e hora do pagamento (Brasília), produto (Ingresso ou Bump), valor, nome,
  e-mail, WhatsApp, origem, mídia, campanha, conteúdo, termo, código do pedido e situação.

**Comportamentos:**
- Receber um aviso de compra paga: entra uma linha por produto comprado.
- Receber um aviso de reembolso, cancelamento ou chargeback: entra uma linha nova com a
  situação; a linha da compra não é apagada.

**Critérios de aceite:**

#### CA-S10-38 — Compra paga vira linha na aba Compras · prova: automática

- **Dado** um aviso válido de pedido pago com o ingresso e o bump
- **Quando** o site processa o aviso
- **Então** a aba Compras ganha duas linhas, uma do Ingresso e uma do Bump, cada uma com data
  e hora de Brasília, valor do produto, nome, e-mail, WhatsApp, as UTMs do pedido, o código
  do pedido e a situação "Paga"

#### CA-S10-39 — Reembolso, cancelamento e chargeback viram linha nova · prova: automática

- **Dado** uma compra já registrada na aba Compras
- **Quando** chega o aviso de reembolso, de cancelamento ou de chargeback daquele pedido
- **Então** a aba ganha uma linha nova daquele pedido com a situação "Reembolsada" ou
  "Cancelada", e a linha da compra continua lá

#### CA-S10-40 — Falha na planilha, no CRM ou na lista não derruba o aviso · prova: automática

- **Dado** a planilha, o CRM ou a lista de e-mail fora do ar
- **Quando** chega um aviso válido de pedido pago
- **Então** a venda é gravada para a aba Imersão 2027 e o site responde à Zouti que recebeu
  (a Zouti desliga o webhook depois de 10 falhas seguidas)

### Card no CRM

**Descrição:** decisão da usuária em 14/11: quem compra vira card no CRM, com o funil
IMERSÃO e os dados que a Zouti enviar. Quem só preenche a janela não vai ao CRM.

**Comportamentos:**
- Receber a compra de uma pessoa que não está no CRM: nasce um card novo, do funil IMERSÃO.
- Receber a compra de uma pessoa que já tem card (mesmo telefone ou e-mail): o card
  existente recebe um comentário; não nasce um segundo card.
- Receber o reembolso, o cancelamento ou o chargeback de uma compra: o card recebe um
  comentário avisando. A etapa do card não muda.
- Receber o mesmo aviso duas vezes: nada é repetido no CRM.

**Critérios de aceite:**

#### CA-S10-41 — Compra de quem não está no CRM vira card com funil IMERSÃO · prova: automática

- **Dado** um aviso válido de pedido pago de alguém que não está no CRM
- **Quando** o site processa o aviso
- **Então** existe um card com nome, e-mail, WhatsApp e as UTMs do pedido, com o campo Funil
  em IMERSÃO, dizendo o que a pessoa comprou (ingresso, bump ou os dois) e quanto pagou

#### CA-S10-42 — Comprador que já tem card não ganha um segundo · prova: automática

- **Dado** um aviso válido de pedido pago de alguém que já tem card no CRM
- **Quando** o site processa o aviso
- **Então** o card existente recebe um comentário dizendo que a pessoa comprou a Imersão (o
  que comprou e quanto pagou), e nenhum card novo é criado

#### CA-S10-43 — Aviso repetido não repete card nem comentário · prova: automática

- **Dado** uma compra que já virou card ou comentário no CRM
- **Quando** o mesmo aviso de pedido pago chega de novo
- **Então** continua existindo um card e um comentário só daquela compra, e a aba Compras
  não ganha linha repetida

#### CA-S10-44 — Reembolso, cancelamento e chargeback viram comentário no card · prova: automática

- **Dado** uma compra que já virou card ou comentário no CRM
- **Quando** chega o aviso de reembolso, de cancelamento ou de chargeback daquele pedido
- **Então** o card recebe um comentário dizendo o que aconteceu, e a etapa do card não muda

#### CA-S10-47 — Compra de verdade aparece no CRM e na planilha · prova: manual

- **Dado** o webhook no ar
- **Quando** a usuária faz (ou recebe) uma compra de verdade do ingresso
- **Então** ela encontra o card no CRM com o funil IMERSÃO (ou o comentário, se a pessoa já
  tinha card) e a linha na aba Compras da planilha

### Números do dash

**Descrição:** a aba Imersão 2027 mostra quantas pessoas se cadastraram na janela e quantas
delas compraram (decisão da usuária em 14/11: o site guarda uma cópia do cadastro só para
essa conta). Os cards do funil IMERSÃO ficam fora dos números dos outros funis.

**Comportamentos:**
- Abrir a aba Imersão 2027: a usuária vê quantas pessoas se cadastraram no pop-up e quantas
  delas compraram.
- Olhar o total de leads, o CPL e o funil de leads novos nas outras telas do dash: os
  compradores da Imersão não entram.

**Critérios de aceite:**

#### CA-S10-18 — Cadastros aparecem na aba Imersão 2027 · prova: automática

- **Dado** três cadastros confirmados, dos quais um comprou o ingresso
- **Quando** a usuária abre a aba Imersão 2027
- **Então** a aba mostra três cadastros e um comprador entre eles (33,3%)

#### CA-S10-46 — Comprador da Imersão não entra no total nem no CPL · prova: automática

- **Dado** um período com dez leads de outros funis e três cards novos do funil IMERSÃO
- **Quando** a usuária olha o total de leads, o CPL e o funil de leads novos nas outras telas do dash
- **Então** as contas usam dez leads, não treze

### Lista de e-mail

**Descrição:** decisão da usuária em 14/11: quem compra entra na lista de e-mail com a marca
da Imersão. O e-mail em si fica para depois ("depois ajustamos o e-mail"). Quem só preenche
a janela não entra na lista e não recebe mensagem nossa.

**Comportamentos:**
- Receber uma compra paga: o comprador entra na lista de e-mail marcado com Imersão, sem
  disparar nenhum envio automático.

**Critérios de aceite:**

#### CA-S10-45 — Comprador entra na lista de e-mail com a marca da Imersão · prova: automática

- **Dado** um aviso válido de pedido pago
- **Quando** o site processa o aviso
- **Então** o contato existe na lista de e-mail marcado com Imersão, e nenhum WhatsApp ou
  e-mail da consultoria, do workshop gratuito ou das lives é disparado para ele

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
- Enviar qualquer evento ao Meta pelo nosso site (cadastro ou compra): fica só o que a Zouti envia.
- Mandar WhatsApp ou e-mail nosso a quem se cadastra ou compra: o e-mail do comprador fica para depois.
- Marcar na aba Cadastros da planilha se a pessoa comprou.
- Mudar o que o botão do topo faz.
- Mudar textos, ordem ou visual das seções da página, fora a janela nova.

## Critérios retirados na revisão de 14/11/2026

A usuária mudou a decisão em 14/11: o cadastro da janela fica só na planilha, e o CRM, a
lista de e-mail e os avisos passam a acontecer na compra. Saíram, sem reaproveitar o código:
os critérios 15, 16 e 17 (cadastro virava card), 19 (cadastro fora do total, trocado pelo 46),
20 e 21 (cadastro entrava na lista e nas mensagens) e 31 (cadastro virava lead no Meta).

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S10-01 | "Mesma visita" quer dizer a mesma aba do navegador: se a pessoa fechar a aba e voltar outro dia, a janela aparece de novo. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-02 | O card do comprador entra na primeira etapa da lista do CRM, como os leads dos outros funis, sem etapa própria. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-03 | Depois do cadastro a pessoa vai sempre ao checkout, nunca a página de obrigado, agenda ou grupo. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-04 | A planilha é nova, criada na conta marcelle@seteads.com, separada das outras. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-05 | O checkout da Zouti aceita receber as UTMs no endereço e não quebra com elas. Sem documentação da Zouti; a conferir com um clique de verdade. | confirmada | Conferido em 14/11/2026: o checkout abriu normalmente com as cinco UTMs no endereço. Se a Zouti as repassa no pedido é a SUP-S10-09. |
| SUP-S10-06 | O WhatsApp é aceito com ou sem o nono dígito e sem exigir +55, como nos outros formulários do site. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-08 | A Zouti consegue avisar um endereço externo a cada compra, cancelamento e reembolso, e assina cada aviso com um segredo. | confirmada | Documentação da Zouti enviada pela Marcelle em 13/11 (ajuda.zouti.com.br, "Como configurar Webhook"): eventos de pedido pago, estornado, cancelado e em chargeback, assinatura no cabeçalho. |
| SUP-S10-09 | O aviso de pedido da Zouti tem um bloco de UTMs (confirmado na documentação). O que a documentação não diz é se o checkout lê as UTMs do endereço; se não ler, a origem da venda vem do cadastro do pop-up, cruzando por e-mail ou telefone. | aberta | — |
| SUP-S10-11 | Chargeback (pedido contestado) tira a venda dos números, como o reembolso. | confirmada | Marcelle, 13/11. |
| SUP-S10-12 | O bump não tem campo próprio no aviso: ele chega como mais um item do mesmo pedido, e é reconhecido pelo produto do item. | aberta | — |
| SUP-S10-13 | A venda conta pelo aviso de pedido pago; o valor de cada produto é o do item, não o total do pedido. | confirmada | Marcelle, 13/11. |
| SUP-S10-10 | Na aba Imersão 2027, o cadastro conta como "comprou" quando existe venda paga de ingresso com o mesmo e-mail ou o mesmo telefone. | aberta | — |
| SUP-S10-14 | Como a Zouti já avisa o Meta do início de checkout e da compra, a página deixa de enviar o próprio início de checkout ao Meta, para não contar duas vezes. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-15 | "Conta como lead" vale para o Meta e para o CRM; no dash fica separado, fora do total e do CPL, e aparece na aba Imersão 2027. | invalidada | Marcelle, 14/11/2026: o cadastro não vai ao Meta nem ao CRM; quem vai ao CRM é o comprador. |
| SUP-S10-16 | Sem a Mentoria, o comparecimento ao evento e o pico de pessoas no horário da oferta continuam na aba, e o campo "horário da oferta" continua nas Metas. | aberta | — |
| SUP-S10-17 | A assinatura do aviso é feita sobre o corpo do aviso com o segredo; a documentação tem o trecho do formato cortado, então o site aceita também a forma em que o horário do cabeçalho entra junto do corpo. Sem conferir a validade do horário. | confirmada | Confirmada pelo aviso de teste da Zouti em 13/11: o site aceitou a assinatura com o segredo gravado. |
| SUP-S10-18 | No aviso, o valor de cada item é o total daquele item; com mais de uma unidade, cada ingresso vale o total dividido pela quantidade e conta como um ingresso vendido. | aberta | — |
| SUP-S10-19 | O endereço do webhook é https://atacadoexponencial.com/api/webhooks/zouti e o segredo fica guardado no servidor (nunca no site). | confirmada | Marcelle, 13/11. |
| SUP-S10-20 | A documentação descreve o pedido, mas não o envelope do aviso: o site aceita o pedido na raiz do corpo ou dentro de um campo de dados, e usa o tipo do evento do cabeçalho (se faltar, tenta o do corpo). A conferir com o botão Testar Webhook da Zouti. | confirmada | Confirmada pelo aviso de teste da Zouti em 13/11: o pedido vem na raiz do corpo e o tipo do evento vem no cabeçalho. |
| SUP-S10-21 | O aviso de pedido pago não traz a data do pagamento num campo próprio na raiz (visto no aviso de teste de 13/11): o site usa a data do pagamento se ela vier, senão a data da última atualização do pedido, que no pedido pago é o momento do pagamento. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-22 | A janela é simples, só o formulário e o botão (sem título, lote ou preço): campos "Nome", "E-mail" e "WhatsApp com DDD"; botão "Garantir ingresso"; erros "Digite o seu nome.", "Digite um e-mail válido, como nome@exemplo.com." e "Digite o WhatsApp com DDD. Número de fora do Brasil começa com +.". | confirmada | Marcelle, 14/11/2026: "O pop deve ser bem simples, apenas o form e o botão garantir ingresso". |
| SUP-S10-23 | As UTMs da chegada ficam guardadas na aba: se a pessoa recarregar a página ou voltar do checkout sem elas no endereço, as da chegada continuam valendo para a planilha e para o link do checkout. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-24 | Um pedido vira um card (ou um comentário) só, mesmo com ingresso e bump: o card diz os dois produtos e o valor de cada um. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-25 | A pessoa "já tem card" quando existe no CRM um card com o mesmo telefone ou o mesmo e-mail, em qualquer funil e em qualquer etapa. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-26 | O nome do comprador vai para a planilha e para o CRM, mas não é guardado no banco do site (que continua só com e-mail e telefone da venda). | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-27 | A cópia do cadastro que o site guarda para a aba Imersão 2027 tem data, e-mail, telefone e UTMs (sem o nome), e a mesma pessoa que se cadastra duas vezes conta uma vez só. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-07 | Cadastros de teste (e-mails @seteads.com e @teste.com) seguem a regra que já existe no site: não vão ao Meta nem ao Google. | invalidada | Sem efeito desde 14/11/2026: o site não envia mais nada ao Meta nem ao Google por causa do cadastro. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S10-01 | O que o Meta recebe quando alguém confirma o cadastro? | respondida | Marcelle, 13/11: conta como lead no Meta. No CRM entra como lead do funil IMERSÃO. Os eventos de checkout e de compra quem envia ao Meta é a Zouti (pixel e CAPI configurados nela). |
| PER-S10-02 | Qual mensagem de WhatsApp sai para quem se cadastra, por qual número e quando (na hora, ou só para quem não comprar depois de um tempo)? | respondida | Marcelle, 14/11/2026: não sai WhatsApp nosso; o cadastro fica só na planilha. |
| PER-S10-03 | Qual e-mail sai para quem se cadastra e quando? Ou por enquanto a pessoa só entra na lista, sem envio? | respondida | Marcelle, 14/11/2026: o comprador entra na lista; "depois ajustamos o email". Quem só se cadastra não entra. |
| PER-S10-09 | Como é o aviso de compra da Zouti (campos e eventos)? | respondida | Marcelle, 13/11: enviou a documentação (https://ajuda.zouti.com.br/pt-br/articles/9740997-como-configurar-webhook). |
| PER-S10-10 | Quais são os produtos do ingresso, do bump e da Mentoria na Zouti? | respondida | Marcelle, 13/11: ingresso prod_fe4nfgx9xgwjxmgife1sw5 (Imersão Planejamento Atacado 2027); bump prod_e52fldo7j7aqksthgah5n1 (Imersão em Formatos de Aulas). A Mentoria Atacado Exponencial (prod_bhq9jo4938vgpv2787rf6m) não entra. |
| PER-S10-12 | Como a Zouti recebe os dados do comprador para abrir o checkout preenchido, sem que eles apareçam no endereço do link? A usuária pediu o preenchimento na aprovação (13/11). A documentação não mostra o caminho; falta a resposta do suporte da Zouti. Sem um caminho assim, o critério CA-S10-36 não tem como ser entregue. | aberta | — |
| PER-S10-11 | Onde fica o segredo do webhook no painel da Zouti? A documentação diz que ele existe e pode ser trocado, mas não mostra onde copiar. Você cria o webhook no painel e me passa o segredo por um canal seguro, ou prefere que eu te guie na tela? | respondida | Marcelle, 13/11: ela mesma cria o webhook na Zouti e grava o segredo no servidor pelo terminal, sem passar pela conversa. |
| PER-S10-04 | Para onde vão os dados: planilha com UTM completa e CRM. | respondida | Marcelle, 13/11: "Quero planilha com UTM completa + CRM". |
| PER-S10-05 | Quais botões abrem a janela. | respondida | Marcelle, 13/11: todos menos o do topo. |
| PER-S10-06 | Qual opção do campo Funil no CRM. | respondida | Marcelle, 13/11: opção nova IMERSÃO. |
| PER-S10-07 | O cadastro conta como lead no dash. | respondida | Marcelle, 13/11: separado dos outros funis, fora do total e do CPL; os dados entram na aba Imersão 2027. |
| PER-S10-08 | A pessoa recebe mensagem automática. | respondida | Marcelle, 13/11: WhatsApp e e-mail (conteúdo em PER-S10-02 e PER-S10-03). |
| PER-S10-13 | O que muda com a decisão de 14/11. | respondida | Marcelle, 14/11/2026: "quem preenche o pop vai apenas para a planilha. Quem preenche e paga vai para o CRM tbm com o que a Zouti enviar. Não quero mais enviar ao meta como lead". Comprador que já tem card recebe comentário; reembolso vira comentário; a aba Imersão 2027 mostra cadastros e compradores; comprador entra na lista de e-mail. |
