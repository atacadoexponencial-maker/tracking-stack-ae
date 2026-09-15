# 244: Validação de funil de venda na Greenn único

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Implementar no servidor a regra de no máximo um funil ativo do tipo "Venda na Greenn".

## Comportamentos cobertos

- Segundo funil ativo do tipo: "Já existe um funil de venda na Greenn (<nome>). Hoje as vendas da Greenn não são separadas por produto."

## Cenários

### Happy Path
1. Quem grava chama `validarVendaGreennUnica(tipo, outros)` com o tipo já validado (issue 240).
2. Tipo diferente de `venda_greenn`, ou nenhum outro funil ativo desse tipo → `{ valor: tipo }`.

### Edge Cases
- Já existe outro funil **ativo** `venda_greenn` → "Já existe um funil de venda na Greenn (<nome>). Hoje as vendas da Greenn não são separadas por produto."
- Funil `venda_greenn` arquivado → não conta (pode-se criar outro; reativar o arquivado depois é que é recusado, issue 251).
- Na edição, a própria linha vem fora de `outros` (editar o WO PAGO sem trocar o tipo não conflita consigo mesmo).
- Editar outro funil para o tipo `venda_greenn` enquanto já há um ativo → recusado com a mesma mensagem.

### Cenário de Erro
- Recusa devolve `{ erro }`; o endpoint responde 400 (issue 245).

## Banco de Dados

Não se aplica (a regra depende de "ativo", que muda com o arquivamento; fica no servidor em JS, como decidido na migration 0039).

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio-validacao.js` — `validarVendaGreennUnica`.
- **Modificar:** `tests/funis-relatorio-validacao.test.js` — testes da regra.

## Checklist

- [x] Segundo `venda_greenn` ativo → mensagem da spec com o nome do existente
- [x] Arquivado não conta; a própria linha (edição) não conta
- [x] Outros tipos passam direto
- [x] Testes
- [x] `npm test` passando

## Ajustes pós-revisão

- A regra agora também tem garantia no banco: índice único parcial na 0039 (ver issue 236), para duas gravações simultâneas não passarem juntas pela validação.
- Se criar, editar ou reativar esbarrar no índice, `functions/api/funis-relatorio.js` (`conflitoVendaGreenn`) devolve 400 com a MESMA mensagem de `validarVendaGreennUnica` (nome de quem ficou ativo) em vez de 500. Teste de corrida com dois "reativar" em `tests/funis-relatorio.test.js`.
