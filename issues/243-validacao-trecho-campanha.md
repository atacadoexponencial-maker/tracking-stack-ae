# 243: Validação do trecho do nome da campanha

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Implementar no servidor a validação do trecho opcional do nome da campanha.

## Comportamentos cobertos

- Menos de 4 caracteres após remover espaços: "O trecho precisa ter ao menos 4 caracteres."
- Igual, contido ou que contém o trecho de outro ativo: "Esse trecho se sobrepõe ao do bloco <nome>."
- Trecho vazio: aceito (reconhecimento só pela regra automática e pela classificação manual)

## Cenários

### Happy Path
1. Quem grava chama `validarTrecho(trecho_campanha, outros)`.
2. Trecho com 4 ou mais caracteres e sem sobreposição com outro ativo → `{ valor: 'workshop-pago' }` (aparado).
3. Trecho vazio → `{ valor: null }`: o funil reconhece campanhas só pela regra automática e pela classificação manual.

### Edge Cases
- `null`, `undefined`, `""` ou só espaços → aceito como vazio (`null`).
- Menos de 4 caracteres depois de tirar os espaços (ex.: `"ws"`, `" a b c "`) → "O trecho precisa ter ao menos 4 caracteres." (acento conta como um caractere).
- Espaços nas pontas → aparados no valor gravado.
- Igual ao trecho de outro **ativo**, contido nele ou que o contém → "Esse trecho se sobrepõe ao do bloco <nome>." Comparação sem diferenciar maiúsculas e minúsculas, porque o reconhecimento na campanha também não diferencia (mesmo comportamento do `/workshop-pago/i` de hoje).
- Trecho de funil arquivado → não conflita.
- Outro ativo sem trecho → não conflita.

### Cenário de Erro
- Recusa devolve `{ erro }`; o endpoint responde 400 (issue 245).

## Banco de Dados

Não se aplica (`trecho_campanha` NULL quando vazio, como a migration 0039 já prevê).

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio-validacao.js` — `validarTrecho`.
- **Modificar:** `tests/funis-relatorio-validacao.test.js` — testes do trecho.

## Reuso (pesquisado na base)

- Reconhecimento sem caixa de `PADRAO_CAMPANHA_PRODUTO = /workshop-pago/i` em `functions/api/_greenn-metricas.js` (a validação usa o mesmo critério de comparação).

## Checklist

- [x] Vazio aceito como `null`
- [x] Menos de 4 caracteres sem espaços → "O trecho precisa ter ao menos 4 caracteres."
- [x] Igual/contido/que contém trecho de outro ativo (sem caixa) → "Esse trecho se sobrepõe ao do bloco <nome>."
- [x] Arquivados e funis sem trecho não conflitam
- [x] Testes
- [x] `npm test` passando
