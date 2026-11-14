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
| SUP-S10-16 | Sem a Mentoria, o comparecimento ao evento e o pico de pessoas no horário da oferta continuam na aba, e o campo "horário da oferta" continua nas Metas. | confirmada | Marcelle, 14/11/2026 |

## Perguntas em aberto

Nenhuma.

## Cenários

### Happy Path
1. A usuária abre a aba Imersão 2027. Na subaba Bump, fica a conversão do bump e a tabela por dia, sem a comparação de Mentoria com e sem bump.
2. Na subaba Evento e resultado, o bloco do evento mostra o comparecimento e as pessoas ao vivo no pitch, e o bloco Resultado mostra faturamento total, ticket médio e ROAS, só com ingresso e bump.
3. Nas Metas, o campo da meta de Mentoria não existe mais; o horário da oferta continua.

### Edge Cases
- Venda de Mentoria que exista no banco: não entra em nenhum número da aba.
- Meta de Mentoria gravada antes da mudança: fica no banco, sem aparecer; envio novo com esse campo é ignorado.
- Antes de 12/12: os blocos do evento e do resultado seguem avisando que ficam disponíveis a partir de 12/12.

### Cenário de Erro
- Nenhum novo: a aba continua respondendo com a mensagem de erro que já tinha quando a leitura falha.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S10-33 | automática | `tests/imersao.test.js` | com dados de exemplo e com dados reais, nenhuma subaba nem a resposta da aba trazem Mentoria; comparecimento, pico e horário da oferta continuam |
| CA-S10-34 | automática | `tests/imersao.test.js` | 100 ingressos a R$ 45 e 20 bumps a R$ 297 com R$ 6.000 investidos dão R$ 10.440, R$ 104,40 e 1,74, mesmo com venda de Mentoria no banco |
| CA-S10-35 | manual | roteiro abaixo | a aba sem buraco onde a Mentoria ficava |

### Roteiro manual — CA-S10-35
1. Abrir o dash, aba Imersão 2027, e olhar o Resumo.
2. Abrir as subabas Bump e Evento e resultado.
3. Não deve sobrar espaço vazio, título sem conteúdo nem card quebrado onde a Mentoria ficava.

## Arquivos

- **Modificar:** `functions/api/_imersao.js` — tira os números, a meta e as referências de Mentoria; faturamento, ticket e ROAS só com ingresso e bump
- **Modificar:** `functions/api/_imersao-exemplo.js` — dados de exemplo sem Mentoria
- **Modificar:** `public/dash/imersao.js` — tira os cards e o campo de meta de Mentoria; o bloco do resultado passa a ter três cards
- **Modificar:** `public/dash/index.html` — versão nova do script da aba
- **Modificar:** `tests/imersao.test.js` — testes dos dois critérios automáticos; os testes de Mentoria da S8 (CA-S8-21 e CA-S8-26) saem com o comportamento, e o CA-S8-27 vira o CA-S10-34

## Checklist

- [x] Números, meta e referências de Mentoria fora das regras
- [x] Dados de exemplo sem Mentoria
- [x] Cards e campo de meta de Mentoria fora da tela
- [x] Faturamento, ticket médio e ROAS só com ingresso e bump
- [x] Testes dos dois critérios automáticos passando
