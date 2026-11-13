# S10-05: Cadastro vira lead do funil Imersão

**Tipo:** Implementação
**Página:** CRM, Meta e aba Imersão 2027 do dash
**Spec:** `spec-popup-checkout-imersao.md`

## Descrição

Fazer o cadastro confirmado virar card no CRM com o funil IMERSÃO, lead no Meta e contato na lista de e-mail com a marca da Imersão, aparecendo na aba Imersão 2027 e ficando fora do total de leads e do CPL das outras telas.

## Pronto quando

A usuária faz um cadastro de verdade, encontra o card no CRM com o funil IMERSÃO, vê o cadastro contado na aba Imersão 2027 e confere que o total de leads das outras telas não mudou.

## Critérios de aceite

- **CA-S10-15** (automática) — Cadastro novo vira card com funil IMERSÃO. Dado um cadastro confirmado de alguém que não está no CRM, quando a gravação termina, então existe um card com nome, e-mail, WhatsApp e UTMs, com o campo Funil em IMERSÃO.
- **CA-S10-16** (automática) — Quem já tem card não ganha um segundo. Dado um cadastro confirmado de alguém que já tem card no CRM, quando a gravação termina, então o card existente recebe um comentário dizendo que a pessoa se cadastrou para a Imersão, e nenhum card novo é criado.
- **CA-S10-18** (automática) — Cadastros aparecem na aba Imersão 2027. Dado três cadastros confirmados, dos quais um comprou o ingresso, quando a usuária abre a aba Imersão 2027, então a aba mostra três cadastros e um comprador entre eles (33,3%).
- **CA-S10-19** (automática) — Cadastro da Imersão não entra no total nem no CPL. Dado um período com dez leads de outros funis e três cadastros da Imersão, quando a usuária olha o total de leads, o CPL e o funil de leads novos nas outras telas do dash, então as contas usam dez leads, não treze.
- **CA-S10-20** (automática) — Cadastro entra na lista de e-mail com a marca da Imersão. Dado um cadastro confirmado, quando a gravação termina, então o contato existe na lista de e-mail marcado com o funil Imersão.
- **CA-S10-21** (automática) — Quem se cadastra não recebe mensagem de outro funil. Dado um cadastro confirmado da Imersão, quando as mensagens automáticas rodam, então a pessoa não recebe o WhatsApp nem o e-mail da consultoria, do workshop gratuito ou das lives.
- **CA-S10-31** (automática) — Cadastro confirmado vira lead no Meta. Dado um cadastro confirmado que não é de teste, quando a gravação termina, então o Meta recebe um evento de lead com os dados protegidos da pessoa, uma vez só.
- **CA-S10-17** (manual) — Card de verdade aparece no CRM. Dado a página no ar, quando a usuária faz um cadastro com um contato que não está no CRM, então ela encontra o card no CRM com o funil IMERSÃO.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S10-02 | O card novo entra na primeira etapa da lista do CRM, como os leads dos outros funis, sem etapa própria. | aberta | — |
| SUP-S10-07 | Cadastros de teste (e-mails @seteads.com e @teste.com) seguem a regra que já existe no site: não vão ao Meta nem ao Google. | aberta | — |
| SUP-S10-10 | A venda é ligada ao cadastro do pop-up por e-mail ou telefone, como a aba Imersão 2027 já faz entre ingresso e Mentoria. | aberta | — |
| SUP-S10-15 | "Conta como lead" vale para o Meta e para o CRM; no dash fica separado, fora do total e do CPL, e aparece na aba Imersão 2027. | confirmada | Marcelle, 13/11. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S10-01 | O que o Meta recebe quando alguém confirma o cadastro? | respondida | Marcelle, 13/11: conta como lead no Meta. No CRM entra como lead do funil IMERSÃO. Os eventos de checkout e de compra quem envia ao Meta é a Zouti (pixel e CAPI configurados nela). |
| PER-S10-02 | Qual mensagem de WhatsApp sai para quem se cadastra, por qual número e quando (na hora, ou só para quem não comprar depois de um tempo)? | aberta | — |
| PER-S10-03 | Qual e-mail sai para quem se cadastra e quando? Ou por enquanto a pessoa só entra na lista, sem envio? | aberta | — |
| PER-S10-04 | Para onde vão os dados: planilha com UTM completa e CRM. | respondida | Marcelle, 13/11: "Quero planilha com UTM completa + CRM". |
| PER-S10-06 | Qual opção do campo Funil no CRM. | respondida | Marcelle, 13/11: opção nova IMERSÃO. |
| PER-S10-07 | O cadastro conta como lead no dash. | respondida | Marcelle, 13/11: separado dos outros funis, fora do total e do CPL; os dados entram na aba Imersão 2027. |
| PER-S10-08 | A pessoa recebe mensagem automática. | respondida | Marcelle, 13/11: WhatsApp e e-mail (conteúdo em PER-S10-02 e PER-S10-03). |
