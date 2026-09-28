# 333: Cadastro de metas por funil, editável em Funis do relatório

**Tipo:** Implementação
**Página:** Dash → Funis do relatório + backend — spec `spec-metas-funil.md`, módulo 3 (D1, D2, D3, D5)

## Descrição

Guardar as quatro metas por funil com vigência por mês e histórico de alterações, e ligar o bloco "Metas" do protótipo 332 ao backend, com só a Sessão Estratégica editável.

## Pronto quando

Na aba Funis do relatório, a gestora digita as metas da Sessão Estratégica, salva, recarrega e vê os valores de volta, com data e autor da alteração e a linha nova no histórico. A meta passa a valer no mês corrente e nos seguintes; mudar de novo não reescreve o valor que valeu em meses anteriores. Valor inválido e salvamento concorrente são recusados com o motivo. Os outros funis aparecem com os campos desabilitados.

## Checklist

- [x] Migration D1 `0046_metas_funil.sql`, aplicada no remoto em 28/09 com `d1 execute --file` (tabela, índice e 2 gatilhos conferidos).
- [x] Endpoint `functions/api/metas/index.js` (GET/POST), `DASH_KEY`, validação e concorrência no servidor (checada de novo dentro do INSERT).
- [x] Bloco do protótipo ligado ao endpoint — o contrato da 332 foi seguido à risca; nenhuma mudança na tela.
- [x] Testes: `tests/metas.test.js` (7 casos, SQLite real com 0039 e 0046).

## Plano (28/09)

### Banco — `migrations/0046_metas_funil.sql` (aplicar no remoto com `wrangler d1 execute --remote --file`, NUNCA `migrations apply`)

- Tabela `metas_funil`, uma linha por salvamento (histórico por construção):
  - `id` INTEGER PK AUTOINCREMENT — também é a `versao` do contrato.
  - `funil_id` INTEGER NOT NULL REFERENCES `funis_relatorio(id)`.
  - `mes_inicio` TEXT NOT NULL, `YYYY-MM` em Brasília: o mês em que foi salva; vale dele em diante.
  - `cpl_max_centavos`, `leads_novos`, `mqls`, `custo_mql_max_centavos` INTEGER NULL (NULL = sem meta), CHECK ≥ 0.
  - `alterada_em` INTEGER (unix), `alterada_por` TEXT (`painel`: sem login por pessoa).
- Índice `(funil_id, mes_inicio DESC, id DESC)`.
- Meta vigente no mês M = linha de maior (`mes_inicio`, `id`) com `mes_inicio ≤ M`. Salvar de novo no mesmo mês gera outra linha com o mesmo `mes_inicio`, que passa a valer para o mês inteiro; meses anteriores continuam lendo a linha deles (D5).
- Trigger anti-UPDATE e anti-DELETE (histórico imutável), como na 0039.

### Regras (`functions/api/_metas.js`, puro)

- `FUNIS_COM_META = ['sessao-estrategica']` (D3): editável = funil ativo, `tipo = lead_mql` e `funil_tracking` na lista. Os outros `lead_mql` ativos aparecem com `motivo_bloqueio`.
- `validarMeta(corpo)`: quatro chaves presentes; cada uma `null` ou inteiro ≥ 0; dinheiro até 10.000.000 centavos; volume até 100.000. Erro por campo em `campos`.
- `metaVigente(linhas, mes)`, `montarCadastro({ funis, linhas, mes })` → contrato da issue 332; `historico` do funil = todas as linhas, mais recente primeiro, com `antes` = a linha anterior.

### Endpoint `functions/api/metas/index.js`

- `GET /api/metas?key=` → `montarCadastro` (só D1).
- `POST /api/metas?key=` `{ funil_id, meta, versao }`: 401 sem chave; 400 com `campos`; 403 funil não editável; 409 se `versao` ≠ id da linha mais recente do funil; grava e devolve o funil montado.
- Auth: a mesma checagem de `DASH_KEY` dos outros endpoints do dash.

### Testes — `tests/metas.test.js` (node:sqlite com `0039` + `0046` reais)

Validação, vigência por mês, salvar duas vezes no mesmo mês, meses passados intactos, concorrência, funil bloqueado, histórico com antes/depois, trigger imutável, 401.
