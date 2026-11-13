# S10-03: Aba Imersão 2027 sem a Mentoria

**Tipo:** Implementação
**Página:** Aba Imersão 2027 do dash
**Spec:** `spec-popup-checkout-imersao.md`

## Descrição

Tirar da aba Imersão 2027 os números, a meta e os alertas de Mentoria; faturamento, ticket médio e ROAS passam a contar só ingresso e bump.

## Pronto quando

A usuária abre a aba Imersão 2027 e não encontra nada de Mentoria em nenhuma subaba, sem buraco no lugar.

## Critérios de aceite

- **CA-S10-33** (automática) — A aba não mostra mais números de Mentoria. Dado a aba Imersão 2027, com dados reais ou de exemplo, quando a usuária passa por todas as subabas, então não aparecem a conversão na Mentoria, a comparação entre o dia do evento e os 14 dias seguintes, a comparação de Mentoria com bump e sem bump, nem a meta de Mentoria.
- **CA-S10-34** (automática) — Faturamento, ticket médio e ROAS contam só ingresso e bump. Dado 100 ingressos a R$ 45 e 20 bumps a R$ 297, com R$ 6.000 investidos, quando a usuária olha o resultado na aba Imersão 2027, então o faturamento total é R$ 10.440, o ticket médio R$ 104,40 e o ROAS 1,74.
- **CA-S10-35** (manual) — A aba sem Mentoria continua legível. Dado a aba Imersão 2027 no ar depois da mudança, quando a usuária abre o Resumo e a subaba do evento, então não sobra espaço vazio, título sem conteúdo nem card quebrado onde a Mentoria ficava.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S10-16 | Sem a Mentoria, o comparecimento ao evento e o pico de pessoas no horário da oferta continuam na aba, e o campo "horário da oferta" continua nas Metas. | aberta | — |

## Perguntas em aberto

Nenhuma.
