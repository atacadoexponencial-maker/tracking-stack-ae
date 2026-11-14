# S10-02: Webhook de compras da Zouti

**Tipo:** Implementação
**Página:** Aba Imersão 2027 do dash (recebimento das vendas)
**Spec:** `spec-popup-checkout-imersao.md`

## Descrição

Criar o endereço que recebe os avisos da Zouti, confere a assinatura e grava as vendas de ingresso e de bump para a aba Imersão 2027; cancelamento, reembolso e chargeback tiram a venda dos números.

## Pronto quando

A usuária cadastra o endereço no painel da Zouti, dispara o teste de lá e, com a primeira compra de verdade, a aba Imersão 2027 troca os dados de exemplo pela venda real.

## Critérios de aceite

- **CA-S10-22** (automática) — Compra paga do ingresso entra nas vendas. Dado nenhuma venda registrada, quando chega um aviso válido de compra paga do ingresso, com valor, data, e-mail e telefone, então a aba Imersão 2027 mostra um ingresso vendido com aquele valor e aquela data.
- **CA-S10-23** (automática) — Bump entra como bump, mesmo no pedido do ingresso. Dado os produtos da Imersão cadastrados (ingresso e bump), quando chega um aviso de pedido pago com dois itens, o ingresso e o bump, então a aba Imersão 2027 mostra um ingresso e um bump, cada um com o seu valor.
- **CA-S10-24** (automática) — Venda guarda a UTM de origem. Dado uma compra feita por alguém que chegou com UTMs, quando o aviso da compra chega, então a venda fica com origem, mídia, campanha e conteúdo, e entra na origem certa (tráfego pago, orgânico, base ou outros) na aba Imersão 2027.
- **CA-S10-25** (automática) — Cancelamento e reembolso tiram a venda dos números. Dado uma venda paga já registrada, quando chega o aviso de cancelamento ou de reembolso dela, então a venda deixa de contar nos números da aba Imersão 2027.
- **CA-S10-26** (automática) — Aviso repetido não duplica. Dado uma venda paga já registrada, quando o mesmo aviso chega de novo, então continua existindo uma venda só.
- **CA-S10-27** (automática) — Aviso sem o segredo é recusado. Dado o endereço de recebimento no ar, quando chega um aviso sem o segredo ou com o segredo errado, então o aviso é recusado e nenhuma venda é gravada.
- **CA-S10-28** (automática) — Produto de fora é ignorado. Dado os produtos da Imersão cadastrados, quando chega um aviso válido de um produto que não é ingresso nem bump (a Mentoria Atacado Exponencial, por exemplo), então nenhuma venda é gravada e o aviso fica registrado como ignorado.
- **CA-S10-30** (automática) — Aviso que o site não usa é aceito sem erro. Dado o endereço de recebimento no ar, quando chega um aviso válido de um tipo que o site não usa (pedido criado, Pix gerado, assinatura, carrinho abandonado), então o site responde que recebeu, não grava venda e registra o aviso como ignorado (a Zouti desliga o webhook depois de 10 falhas seguidas e não reenvia à mão).
- **CA-S10-29** (manual) — Primeira venda real troca os dados de exemplo. Dado a aba Imersão 2027 mostrando dados de exemplo, quando a usuária faz (ou recebe) a primeira compra de verdade do ingresso, então a faixa de dados de exemplo some e a aba mostra aquela venda.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S10-08 | A Zouti consegue avisar um endereço externo a cada compra, cancelamento e reembolso, e assina cada aviso com um segredo. | confirmada | Documentação da Zouti enviada pela Marcelle em 13/11 (ajuda.zouti.com.br, "Como configurar Webhook"): eventos de pedido pago, estornado, cancelado e em chargeback, assinatura no cabeçalho. |
| SUP-S10-09 | O aviso de pedido da Zouti tem um bloco de UTMs (confirmado na documentação). O que a documentação não diz é se o checkout lê as UTMs do endereço; se não ler, a origem da venda vem do cadastro do pop-up, cruzando por e-mail ou telefone. | aberta | — |
| SUP-S10-11 | Chargeback (pedido contestado) tira a venda dos números, como o reembolso. | confirmada | Marcelle, 13/11. |
| SUP-S10-12 | O bump não tem campo próprio no aviso: ele chega como mais um item do mesmo pedido, e é reconhecido pelo produto do item. | aberta | — |
| SUP-S10-13 | A venda conta pelo aviso de pedido pago; o valor de cada produto é o do item, não o total do pedido. | confirmada | Marcelle, 13/11. |
| SUP-S10-17 | A assinatura do aviso é feita sobre o corpo do aviso com o segredo; a documentação tem o trecho do formato cortado, então o site aceita também a forma em que o horário do cabeçalho entra junto do corpo. Sem conferir a validade do horário. | confirmada | Confirmada pelo aviso de teste da Zouti em 13/11: o site aceitou a assinatura com o segredo gravado. |
| SUP-S10-18 | No aviso, o valor de cada item é o total daquele item; com mais de uma unidade, cada ingresso vale o total dividido pela quantidade e conta como um ingresso vendido. | aberta | — |
| SUP-S10-19 | O endereço do webhook é https://atacadoexponencial.com/api/webhooks/zouti e o segredo fica guardado no servidor (nunca no site). | confirmada | Marcelle, 13/11. |
| SUP-S10-20 | A documentação descreve o pedido, mas não o envelope do aviso: o site aceita o pedido na raiz do corpo ou dentro de um campo de dados, e usa o tipo do evento do cabeçalho (se faltar, tenta o do corpo). A conferir com o botão Testar Webhook da Zouti. | confirmada | Confirmada pelo aviso de teste da Zouti em 13/11: o pedido vem na raiz do corpo e o tipo do evento vem no cabeçalho. |
| SUP-S10-21 | O aviso de pedido pago não traz a data do pagamento num campo próprio na raiz (visto no aviso de teste de 13/11): o site usa a data do pagamento se ela vier, senão a data da última atualização do pedido, que no pedido pago é o momento do pagamento. | confirmada | Marcelle, 14/11/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S10-09 | Como é o aviso de compra da Zouti (campos e eventos)? | respondida | Marcelle, 13/11: enviou a documentação (https://ajuda.zouti.com.br/pt-br/articles/9740997-como-configurar-webhook). |
| PER-S10-10 | Quais são os produtos do ingresso, do bump e da Mentoria na Zouti? | respondida | Marcelle, 13/11: ingresso prod_fe4nfgx9xgwjxmgife1sw5 (Imersão Planejamento Atacado 2027); bump prod_e52fldo7j7aqksthgah5n1 (Imersão em Formatos de Aulas). A Mentoria Atacado Exponencial (prod_bhq9jo4938vgpv2787rf6m) não entra. |
| PER-S10-11 | Onde fica o segredo do webhook no painel da Zouti? A documentação diz que ele existe e pode ser trocado, mas não mostra onde copiar. Você cria o webhook no painel e me passa o segredo por um canal seguro, ou prefere que eu te guie na tela? | respondida | Marcelle, 13/11: ela mesma cria o webhook na Zouti e grava o segredo no servidor pelo terminal, sem passar pela conversa. |

## Cenários

### Happy Path
1. A Zouti envia um aviso `ORDER_PAID` para `/api/webhooks/zouti`, assinado no cabeçalho `x-zouti-signature`.
2. O site lê o corpo bruto, confere a assinatura com o segredo guardado no servidor e só então interpreta o conteúdo.
3. Para cada item do pedido cujo produto é o ingresso (`prod_fe4nfgx9xgwjxmgife1sw5`) ou o bump (`prod_e52fldo7j7aqksthgah5n1`), grava uma venda em `imersao_vendas` com valor do item, data do pagamento, e-mail, telefone e UTMs do pedido.
4. Registra o aviso em `imersao_avisos` como `gravado` e responde 200.
5. A aba Imersão 2027, que já lê `imersao_vendas`, passa a mostrar a venda; com o primeiro ingresso pago, os dados de exemplo somem.

### Edge Cases
- Pedido com ingresso e bump: duas vendas, uma de cada produto, cada uma com o valor do seu item.
- Item com quantidade maior que 1: uma venda por unidade, com o valor do item dividido pela quantidade.
- Mesmo aviso entregue de novo (ou `ORDER_PAID` repetido do mesmo pedido): a venda tem identificador fixo (pedido + produto + unidade), então é regravada por cima, sem duplicar.
- `ORDER_REFUNDED` e `ORDER_DISPUTED`: as vendas daquele pedido viram `reembolsada`. `ORDER_CANCELED`: viram `cancelada`. Pedido que o site não conhece: nada muda, aviso registrado como `ignorado`.
- Pedido só com produto de fora (a Mentoria, por exemplo): nenhuma venda, aviso registrado como `ignorado`.
- Tipos que o site não usa (`ORDER_CREATED`, `ORDER_UPDATED`, `ORDER_UNPAID`, `PIX_CREATED`, `BOLETO_CREATED`, `PAYMENT_*`, `SUBSCRIPTION_*`, `ABANDONED_CART_CREATED`, `REFUND_REQUEST_*`, `SMART_INSTALLMENT_*`): 200, `ignorado`.
- Pedido sem UTMs: venda gravada com as UTMs vazias (cai em "outros" na origem).
- Data de pagamento ausente: usa a data de criação do pedido; sem nenhuma, o instante do recebimento.

### Cenário de Erro
- Sem o cabeçalho de assinatura, assinatura errada ou segredo não configurado no servidor: 401, nada gravado, nada registrado.
- Corpo que não é JSON válido (com assinatura certa): 200, aviso registrado como `ignorado` (não adianta a Zouti reenviar).
- Falha do banco ao gravar: 500, para a Zouti tentar de novo (ela reenvia por até 4 dias).

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S10-22 | automática | `tests/imersao-zouti.test.js` | aviso de ingresso pago faz a aba mostrar 1 ingresso com o valor e o dia do aviso |
| CA-S10-23 | automática | `tests/imersao-zouti.test.js` | pedido com ingresso e bump aparece como 1 ingresso e 1 bump, cada um com o seu valor |
| CA-S10-24 | automática | `tests/imersao-zouti.test.js` | venda guarda as UTMs do pedido e cai na origem "tráfego pago" da aba |
| CA-S10-25 | automática | `tests/imersao-zouti.test.js` | reembolso, cancelamento e chargeback tiram a venda da contagem da aba |
| CA-S10-26 | automática | `tests/imersao-zouti.test.js` | o mesmo aviso duas vezes deixa uma venda só |
| CA-S10-27 | automática | `tests/imersao-zouti.test.js` | sem assinatura ou com assinatura errada a resposta é recusa e nenhuma venda existe |
| CA-S10-28 | automática | `tests/imersao-zouti.test.js` | aviso da Mentoria não grava venda e fica registrado como ignorado |
| CA-S10-30 | automática | `tests/imersao-zouti.test.js` | aviso de tipo não usado recebe resposta de sucesso, sem venda, registrado como ignorado |
| CA-S10-29 | manual | roteiro abaixo | a faixa de dados de exemplo some e a venda real aparece |

### Roteiro manual — CA-S10-29
1. No painel da Zouti, em Integrações, Webhooks, criar o webhook com o endereço `https://atacadoexponencial.com/api/webhooks/zouti`, marcar os eventos de pedido (pago, estornado, cancelado, em chargeback) e passar o segredo para ser guardado no servidor.
2. Usar o botão Testar Webhook e conferir que a Zouti mostra o webhook como Ativo.
3. Fazer (ou esperar) a primeira compra de verdade do ingresso.
4. Abrir o dash, aba Imersão 2027: a faixa "Dados de exemplo" não aparece mais e o Resumo mostra 1 ingresso vendido com o valor pago.

## Banco de Dados

- Tabela: `imersao_vendas` (já existe, migration 0070; sem mudança de formato)
  - `id` (texto) — passa a ser `<pedido>:<produto>:<unidade>`, o que impede venda duplicada
- Tabela nova: `imersao_avisos` (migration 0071)
  - `entrega_id` (texto, chave) — identificador da entrega (`x-zouti-webhook-delivery-id`)
  - `evento_id` (texto) — identificador do evento (`x-zouti-event-id`)
  - `tipo` (texto) — tipo do evento (`x-zouti-event-type`)
  - `objeto_id` (texto) — pedido ou objeto do aviso
  - `resultado` (texto) — `gravado` ou `ignorado`
  - `motivo` (texto) — por que foi ignorado (tipo não usado, produto de fora, pedido desconhecido, corpo inválido)
  - `vendas` (inteiro) — quantas vendas o aviso gravou ou alterou
  - `recebido_em` (inteiro) — instante do recebimento

Aplicação no banco remoto (lição L-02): antes do commit, rodar `wrangler d1 execute tracking-ae-db --remote --file=migrations/0071_imersao_avisos.sql`. Nunca `migrations apply --remote` neste projeto.

## Arquivos

- **Criar:** `migrations/0071_imersao_avisos.sql` — tabela do registro de avisos
- **Criar:** `functions/api/_imersao-zouti.js` — regras: conferir a assinatura, traduzir o aviso em vendas, gravar e registrar
- **Criar:** `functions/api/webhooks/zouti.js` — endereço que recebe o POST e chama as regras
- **Criar:** `tests/imersao-zouti.test.js` — testes dos critérios CA-S10-22 a 28 e 30

Reuso: `d1` de `tests/_fluxos-banco.js` (banco de teste), `montarResposta` de `functions/api/imersao/index.js` (o que a aba mostra) e o padrão de `functions/api/webhooks/greenn.js` (rota sob `/api/`, fora do middleware de sessão).

## Checklist

- [x] Migration 0071 escrita e aplicada no banco remoto com `d1 execute --file`
- [x] Regras em `_imersao-zouti.js`: assinatura, tradução do aviso, gravação e registro
- [x] Endereço `/api/webhooks/zouti` respondendo 200, 401 e 500 nos casos planejados
- [x] Segredo lido de `ZOUTI_WEBHOOK_SECRET` no servidor, sem valor no código
- [x] Testes dos oito critérios automáticos passando

## Exceções

| Problema | Alvo | Motivo | Aprovado por | Dia |
|---|---|---|---|---|
| SUPOSICAO_ABERTA | SUP-S10-09 | Só se confirma com um aviso de teste da Zouti, que exige o webhook no ar | Marcelle | 13/11/2026 |
| SUPOSICAO_ABERTA | SUP-S10-12 | Só se confirma com um aviso de teste da Zouti, que exige o webhook no ar | Marcelle | 13/11/2026 |
| SUPOSICAO_ABERTA | SUP-S10-18 | Só se confirma com um aviso de teste da Zouti, que exige o webhook no ar | Marcelle | 13/11/2026 |
