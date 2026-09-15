# 239: Validação do nome no relatório

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Implementar no servidor a validação do nome do funil, usada na criação, edição e reativação.

## Comportamentos cobertos

- Sem nome ou só espaços: "Informe o nome no relatório."
- Espaços nas pontas: gravado sem eles
- Acima de 40 caracteres: "Nome no relatório deve ter até 40 caracteres."
- Igual a outro ativo (sem diferenciar maiúsculas, minúsculas e acentos): "Já existe um funil com esse nome."
- Igual a um arquivado: "Existe um funil arquivado com esse nome — reative-o em vez de criar outro."
- "sem funil" em qualquer grafia: "Esse nome é reservado para o bloco do que não foi classificado."

## Cenários

### Happy Path
1. Quem grava (criação na issue 245, edição na 247, reativação na 251) chama `validarNome(nome, outros)` com o nome digitado e as demais linhas de `funis_relatorio`.
2. O nome é aparado (`"  SE  "` → `"SE"`) e comparado, já normalizado, com os outros funis.
3. Sem conflito, a função devolve `{ valor: 'SE' }` — é esse valor aparado que vai para o banco.

### Edge Cases
- `null`, `undefined`, `""` ou só espaços → "Informe o nome no relatório."
- 40 caracteres exatos → aceito; 41 → "Nome no relatório deve ter até 40 caracteres." (conta caracteres, não bytes: `AQUISIÇÃO` tem 9).
- `"Aquisicao"`, `"AQUISIÇÃO"`, `"aquisição"` são o mesmo nome (sem caixa e sem acento; espaços internos repetidos contam como um).
- `"sem funil"`, `"SEM FUNIL"`, `"Sem  Funil"`, `"sem-funil"`, `"sem_funil"` → "Esse nome é reservado para o bloco do que não foi classificado." (reservado vence as demais checagens de unicidade).
- Igual a um ativo → "Já existe um funil com esse nome."
- Igual só a um arquivado → "Existe um funil arquivado com esse nome — reative-o em vez de criar outro."
- Na edição, a própria linha vem fora de `outros` (não conflita consigo mesma).
- Na reativação, `{ contraArquivados: false }`: a spec só revalida contra os ativos.

### Cenário de Erro
- Cada recusa devolve `{ erro: '<mensagem da spec>' }`; o endpoint responde 400 com `{ error }` (issue 245) e a tela exibe o texto do servidor.

## Banco de Dados

Não se aplica (só leitura das linhas que o endpoint já passa; nenhuma migration).

## Arquivos

- **Criar:** `functions/api/_funis-relatorio-validacao.js` — módulo puro de validação do cadastro; nesta issue: `normalizarNome` e `validarNome(nome, outros, { contraArquivados })`.
- **Criar:** `tests/funis-relatorio-validacao.test.js` — testes de `validarNome`.

## Reuso (pesquisado na base)

- Convenção de módulo puro com prefixo `_` e testes `node --test` de `_funis-relatorio.js` / `_cpl-calculo.js`.
- Normalização sem acento via `normalize('NFD')` + remoção de diacríticos (não havia helper pronto em `functions/`).

## Checklist

- [x] `normalizarNome`: sem caixa, sem acento, espaços internos colapsados
- [x] Vazio / só espaços → "Informe o nome no relatório."
- [x] Nome aparado no valor devolvido
- [x] Mais de 40 caracteres → mensagem da spec
- [x] "sem funil" em qualquer grafia → reservado
- [x] Igual a ativo → "Já existe um funil com esse nome."
- [x] Igual a arquivado → mensagem de reativar (desligável para a reativação)
- [x] Testes cobrindo todos os casos
- [x] `npm test` passando
