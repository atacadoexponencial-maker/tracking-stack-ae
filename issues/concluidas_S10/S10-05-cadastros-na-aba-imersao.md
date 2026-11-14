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
| SUP-S10-10 | Na aba Imersão 2027, o cadastro conta como "comprou" quando existe venda paga de ingresso com o mesmo e-mail ou o mesmo telefone. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-27 | A cópia do cadastro que o site guarda para a aba Imersão 2027 tem data, e-mail, telefone e UTMs (sem o nome), e a mesma pessoa que se cadastra duas vezes conta uma vez só. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-28 | Enquanto não houver ingresso pago de verdade, a aba Imersão 2027 é toda de exemplo, e os cadastros mostrados também são de exemplo. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-29 | Os cadastros aparecem em um card "Cadastros na janela" na subaba Tráfego e página, com o total de pessoas e quantas compraram; os cards Page to checkout e Checkout to compra não mudam. | confirmada | Marcelle, 14/11/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S10-13 | O que muda com a decisão de 14/11. | respondida | Marcelle, 14/11/2026: "quem preenche o pop vai apenas para a planilha. Quem preenche e paga vai para o CRM tbm com o que a Zouti enviar. Não quero mais enviar ao meta como lead". Comprador que já tem card recebe comentário; reembolso vira comentário; a aba Imersão 2027 mostra cadastros e compradores; comprador entra na lista de e-mail. |

## Cenários

### Happy Path
1. A pessoa confirma o cadastro na janela. O site grava a linha na planilha, como já fazia, e guarda uma cópia sem o nome (data, e-mail, telefone e UTMs).
2. A usuária abre a aba Imersão 2027, subaba Tráfego e página. O card "Cadastros na janela" mostra quantas pessoas se cadastraram e, embaixo, quantas compraram o ingresso e a porcentagem.

### Edge Cases
- A mesma pessoa se cadastra duas vezes (mesmo e-mail ou mesmo telefone): conta uma vez.
- Cadastro com um e-mail e ingresso pago com outro, mas o mesmo telefone: conta como comprou.
- Ingresso reembolsado ou cancelado: a pessoa deixa de contar como compradora.
- Nenhum ingresso pago de verdade: a aba inteira é de exemplo, cadastros inclusive.
- Nenhum cadastro: o card mostra zero e avisa que ninguém preencheu a janela ainda.

### Cenário de Erro
- Falha ao guardar a cópia: fica no log, sem dado da pessoa, e a linha da planilha é gravada do mesmo jeito.
- Falha ao ler os cadastros: a aba abre com zero cadastros em vez de quebrar.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S10-18 | automática | `tests/imersao.test.js` | com três pessoas cadastradas (uma delas duas vezes) e um ingresso pago, a aba mostra 3 cadastros e 1 comprador (33,3%) |
| CA-S10-37 | automática | `tests/imersao-cadastro.test.js` | o cadastro vira linha na planilha e não gera chamada ao CRM, ao Meta nem a serviço de e-mail, nem contato na lista |

## Banco de Dados

- Tabela: `imersao_cadastros` (migration 0072)
  - `criado_em` (inteiro) — quando o cadastro foi confirmado
  - `email`, `telefone` (texto) — para contar a pessoa uma vez e cruzar com o ingresso pago
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` (texto) — UTMs da visita
  - Sem o nome (SUP-S10-27).

## Arquivos

- **Criar:** `migrations/0072_imersao_cadastros.sql` — tabela da cópia dos cadastros
- **Modificar:** `functions/api/imersao-cadastro.js` — guarda a cópia sem o nome
- **Modificar:** `functions/api/_imersao.js` — conta pessoas cadastradas e quantas compraram
- **Modificar:** `functions/api/imersao/index.js` — lê os cadastros para a aba
- **Modificar:** `functions/api/_imersao-exemplo.js` — cadastros de exemplo
- **Modificar:** `public/dash/imersao.js` — card "Cadastros na janela"
- **Modificar:** `public/dash/index.html` — versão nova do script da aba
- **Modificar:** `tests/imersao.test.js` — teste do CA-S10-18
- **Modificar:** `tests/imersao-cadastro.test.js` — teste do CA-S10-37

Reuso: as chaves de pessoa (e-mail e variantes do telefone) e o conjunto de compradores que `_imersao.js` já usa.

## Checklist

- [x] Tabela criada no banco de produção antes do deploy
- [x] Cadastros que já estavam na planilha copiados para a tabela
- [x] Cadastro novo guarda a cópia sem o nome
- [x] Contagem por pessoa e cruzamento com o ingresso pago
- [x] Card na subaba Tráfego e página
- [x] Testes dos dois critérios passando
