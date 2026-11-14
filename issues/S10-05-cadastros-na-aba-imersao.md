# S10-05: Cadastros da janela na aba Imersão 2027

**Tipo:** Implementação
**Página:** Dash, aba Imersão 2027, e janela de cadastro da página do ingresso
**Spec:** `spec-popup-checkout-imersao.md`

## Descrição

O site guarda uma cópia de cada cadastro da janela (além da planilha) para a aba Imersão 2027 mostrar quantas pessoas se cadastraram e quantas delas compraram. O cadastro continua sem ir ao CRM, à lista de e-mail e ao Meta.

## Pronto quando

A usuária abre a aba Imersão 2027 e vê o número de cadastros da janela e a parte deles que comprou o ingresso.

## Critérios de aceite

- **CA-S10-18** (automática) — Cadastros aparecem na aba Imersão 2027. Dado três cadastros confirmados, dos quais um comprou o ingresso, quando a usuária abre a aba Imersão 2027, então a aba mostra três cadastros e um comprador entre eles (33,3%).
- **CA-S10-37** (automática) — Cadastro fica só na planilha. Dado um cadastro confirmado na janela, quando a gravação termina, então a linha existe na planilha, e não existe card novo no CRM, comentário em card, contato novo na lista de e-mail nem evento enviado ao Meta por causa desse cadastro.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S10-10 | Na aba Imersão 2027, o cadastro conta como "comprou" quando existe venda paga de ingresso com o mesmo e-mail ou o mesmo telefone. | aberta | — |
| SUP-S10-27 | A cópia do cadastro que o site guarda para a aba Imersão 2027 tem data, e-mail, telefone e UTMs (sem o nome), e a mesma pessoa que se cadastra duas vezes conta uma vez só. | aberta | — |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S10-13 | O que muda com a decisão de 14/11. | respondida | Marcelle, 14/11/2026: "quem preenche o pop vai apenas para a planilha. Quem preenche e paga vai para o CRM tbm com o que a Zouti enviar. Não quero mais enviar ao meta como lead". Comprador que já tem card recebe comentário; reembolso vira comentário; a aba Imersão 2027 mostra cadastros e compradores; comprador entra na lista de e-mail. |
