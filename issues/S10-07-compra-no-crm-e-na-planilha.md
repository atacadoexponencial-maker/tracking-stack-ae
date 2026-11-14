# S10-07: Compra vai para o CRM, a planilha e a lista de e-mail

**Tipo:** Implementação
**Página:** Webhook de compras da Zouti
**Spec:** `spec-popup-checkout-imersao.md`

## Descrição

A cada aviso de pedido pago do ingresso ou do bump, além de gravar a venda, o site acrescenta a linha na aba Compras da planilha, cria o card do funil IMERSÃO no CRM (ou comenta no card que a pessoa já tem) e põe o comprador na lista de e-mail. Reembolso, cancelamento e chargeback viram linha nova e comentário no card.

## Pronto quando

A usuária faz uma compra de verdade do ingresso e encontra o card do funil IMERSÃO no CRM e a linha na aba Compras da planilha.

## Critérios de aceite

- **CA-S10-38** (automática) — Compra paga vira linha na aba Compras. Dado um aviso válido de pedido pago com o ingresso e o bump, quando o site processa o aviso, então a aba Compras ganha duas linhas, uma do Ingresso e uma do Bump, cada uma com data e hora de Brasília, valor do produto, nome, e-mail, WhatsApp, as UTMs do pedido, o código do pedido e a situação "Paga".
- **CA-S10-39** (automática) — Reembolso, cancelamento e chargeback viram linha nova. Dado uma compra já registrada na aba Compras, quando chega o aviso de reembolso, de cancelamento ou de chargeback daquele pedido, então a aba ganha uma linha nova daquele pedido com a situação "Reembolsada" ou "Cancelada", e a linha da compra continua lá.
- **CA-S10-40** (automática) — Falha na planilha, no CRM ou na lista não derruba o aviso. Dado a planilha, o CRM ou a lista de e-mail fora do ar, quando chega um aviso válido de pedido pago, então a venda é gravada para a aba Imersão 2027 e o site responde à Zouti que recebeu (a Zouti desliga o webhook depois de 10 falhas seguidas).
- **CA-S10-41** (automática) — Compra de quem não está no CRM vira card com funil IMERSÃO. Dado um aviso válido de pedido pago de alguém que não está no CRM, quando o site processa o aviso, então existe um card com nome, e-mail, WhatsApp e as UTMs do pedido, com o campo Funil em IMERSÃO, dizendo o que a pessoa comprou (ingresso, bump ou os dois) e quanto pagou.
- **CA-S10-42** (automática) — Comprador que já tem card não ganha um segundo. Dado um aviso válido de pedido pago de alguém que já tem card no CRM, quando o site processa o aviso, então o card existente recebe um comentário dizendo que a pessoa comprou a Imersão (o que comprou e quanto pagou), e nenhum card novo é criado.
- **CA-S10-43** (automática) — Aviso repetido não repete card nem comentário. Dado uma compra que já virou card ou comentário no CRM, quando o mesmo aviso de pedido pago chega de novo, então continua existindo um card e um comentário só daquela compra, e a aba Compras não ganha linha repetida.
- **CA-S10-44** (automática) — Reembolso, cancelamento e chargeback viram comentário no card. Dado uma compra que já virou card ou comentário no CRM, quando chega o aviso de reembolso, de cancelamento ou de chargeback daquele pedido, então o card recebe um comentário dizendo o que aconteceu, e a etapa do card não muda.
- **CA-S10-45** (automática) — Comprador entra na lista de e-mail com a marca da Imersão. Dado um aviso válido de pedido pago, quando o site processa o aviso, então o contato existe na lista de e-mail marcado com Imersão, e nenhum WhatsApp ou e-mail da consultoria, do workshop gratuito ou das lives é disparado para ele.
- **CA-S10-46** (automática) — Comprador da Imersão não entra no total nem no CPL. Dado um período com dez leads de outros funis e três cards novos do funil IMERSÃO, quando a usuária olha o total de leads, o CPL e o funil de leads novos nas outras telas do dash, então as contas usam dez leads, não treze.
- **CA-S10-47** (manual) — Compra de verdade aparece no CRM e na planilha. Dado o webhook no ar, quando a usuária faz (ou recebe) uma compra de verdade do ingresso, então ela encontra o card no CRM com o funil IMERSÃO (ou o comentário, se a pessoa já tinha card) e a linha na aba Compras da planilha.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S10-02 | O card do comprador entra na primeira etapa da lista do CRM, como os leads dos outros funis, sem etapa própria. | aberta | — |
| SUP-S10-09 | O aviso de pedido da Zouti tem um bloco de UTMs (confirmado na documentação). O que a documentação não diz é se o checkout lê as UTMs do endereço; se não ler, a origem da venda vem do cadastro do pop-up, cruzando por e-mail ou telefone. | aberta | — |
| SUP-S10-12 | O bump não tem campo próprio no aviso: ele chega como mais um item do mesmo pedido, e é reconhecido pelo produto do item. | aberta | — |
| SUP-S10-24 | Um pedido vira um card (ou um comentário) só, mesmo com ingresso e bump: o card diz os dois produtos e o valor de cada um. | aberta | — |
| SUP-S10-25 | A pessoa "já tem card" quando existe no CRM um card com o mesmo telefone ou o mesmo e-mail, em qualquer funil e em qualquer etapa. | aberta | — |
| SUP-S10-26 | O nome do comprador vai para a planilha e para o CRM, mas não é guardado no banco do site (que continua só com e-mail e telefone da venda). | aberta | — |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S10-06 | Qual opção do campo Funil no CRM. | respondida | Marcelle, 13/11: opção nova IMERSÃO. |
| PER-S10-07 | O cadastro conta como lead no dash. | respondida | Marcelle, 13/11: separado dos outros funis, fora do total e do CPL; os dados entram na aba Imersão 2027. |
| PER-S10-13 | O que muda com a decisão de 14/11. | respondida | Marcelle, 14/11/2026: "quem preenche o pop vai apenas para a planilha. Quem preenche e paga vai para o CRM tbm com o que a Zouti enviar. Não quero mais enviar ao meta como lead". Comprador que já tem card recebe comentário; reembolso vira comentário; a aba Imersão 2027 mostra cadastros e compradores; comprador entra na lista de e-mail. |
