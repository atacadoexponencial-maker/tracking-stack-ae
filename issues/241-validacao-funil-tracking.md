# 241: Validação do funil do tracking

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Implementar no servidor a validação do funil do tracking escolhido, incluindo a unicidade entre funis ativos. O funil do tracking só existe nos tipos "Lead do formulário + MQL" e "Manual"; no tipo "Venda na Greenn" não se aplica e fica vazio (decisão 9 da spec).

## Comportamentos cobertos

- Tipo "Lead do formulário + MQL" ou "Manual" sem funil do tracking: "Escolha o funil do tracking."
- Tipo "Venda na Greenn": funil do tracking não é exigido nem validado (fica vazio)
- Fora da lista de reconhecidos: "Funil do tracking desconhecido."
- Já usado por outro funil ativo: "Esse funil do tracking já pertence ao bloco <nome>." (só entre funis com funil do tracking; o vazio do funil de venda na Greenn não conflita)

## Cenários

### Happy Path
1. Quem grava chama `validarFunilTracking(tipo, funil_tracking, outros, { funisConhecidos })`, com o tipo já validado (issue 240) e a lista de `listarFunisConhecidos(env.DB)`.
2. Funil reconhecido e livre → `{ valor: 'sessao-estrategica' }`.

### Edge Cases
- Tipo `venda_greenn` → `{ valor: null }` sem olhar o que veio (não exigido, não validado, descartado — decisão 9).
- `lead_mql` / `manual` com valor ausente, vazio ou só espaços → "Escolha o funil do tracking."
- Valor com espaços nas pontas → aparado.
- `aquisicao` é sempre aceito, mesmo sem lead no tracking (a função junta `CANAL_AQUISICAO` à lista, igual a `/api/campaign-funnel` e `/api/funis-relatorio-opcoes`).
- Fora da lista → "Funil do tracking desconhecido." (comparação exata de slug, como no POST de `/api/campaign-funnel`).
- `funisConhecidos: null` → pula a checagem de existência (usado pela reativação, issue 251, que só revalida unicidade).
- Outro funil **ativo** com o mesmo funil do tracking → "Esse funil do tracking já pertence ao bloco <nome>."
- Funil arquivado com o mesmo funil do tracking → não conflita.
- Funil de venda na Greenn (funil do tracking NULL) → não conflita com ninguém.

### Cenário de Erro
- Recusa devolve `{ erro }`; endpoint responde 400 (issue 245).

## Banco de Dados

Não se aplica (a lista de funis conhecidos é lida pelo endpoint via `listarFunisConhecidos`, já existente).

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio-validacao.js` — `validarFunilTracking`.
- **Modificar:** `tests/funis-relatorio-validacao.test.js` — testes do funil do tracking.

## Reuso (pesquisado na base)

- `campoAplica` (issue 240) para saber se o campo existe no tipo.
- `CANAL_AQUISICAO` de `functions/api/_canal.js`; mesma regra "só aceita funil que existe" do POST de `functions/api/campaign-funnel.js`.

## Checklist

- [x] `venda_greenn` devolve `null` sem validar
- [x] Vazio em `lead_mql`/`manual` → "Escolha o funil do tracking."
- [x] Desconhecido → "Funil do tracking desconhecido." (`aquisicao` sempre aceito; checagem desligável)
- [x] Já usado por outro ativo → "Esse funil do tracking já pertence ao bloco <nome>."
- [x] Arquivados e venda na Greenn não conflitam
- [x] Testes
- [x] `npm test` passando
