# S10-06: Checkout já preenchido

**Tipo:** Implementação
**Página:** Página do ingresso da Imersão e checkout da Zouti
**Spec:** `spec-popup-checkout-imersao.md`

## Descrição

Fazer o checkout da Zouti abrir com nome, e-mail e WhatsApp do pop-up, por um caminho que não exponha os dados no endereço do link. Só começa quando a pergunta sobre a forma de envio (PER-S10-12) estiver respondida.

## Pronto quando

A usuária preenche o pop-up, cai no checkout e encontra os três dados preenchidos, com o endereço do checkout sem nenhum deles.

## Critérios de aceite

- **CA-S10-36** (manual) — Checkout abre com os dados do pop-up. Dado a página no ar e a forma de envio dos dados confirmada com a Zouti, quando a usuária preenche o pop-up e é levada ao checkout, então nome, e-mail e WhatsApp aparecem preenchidos no checkout, e o endereço do checkout não contém nenhum dos três (mesma regra do critério CA-S10-11).

## Suposições

Nenhuma.

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S10-12 | Como a Zouti recebe os dados do comprador para abrir o checkout preenchido, sem que eles apareçam no endereço do link? A usuária pediu o preenchimento na aprovação (13/11). A documentação não mostra o caminho; falta a resposta do suporte da Zouti. Sem um caminho assim, o critério CA-S10-36 não tem como ser entregue. | aberta | — |

## Achado de 14/11/2026

Lido o código público do checkout (pay.zouti.com.br): do endereço ele só lê `product_offer_id`. Não existe parâmetro de nome, e-mail ou telefone, então o preenchimento pelo link não funciona, com ou sem dado pessoal na URL. A sessão de compra nasce no navegador da pessoa, dentro do site da Zouti, por uma API interna sem documentação; o nosso servidor não tem como criar essa sessão e entregá-la ao navegador. Continua dependendo de a Zouti oferecer um caminho oficial (PER-S10-12).
