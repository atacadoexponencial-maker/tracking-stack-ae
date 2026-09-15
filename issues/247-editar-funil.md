# 247: Editar funil

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Implementar a edição de um funil existente, com preenchimento do formulário, cancelamento e gravação protegida contra alteração concorrente.

## Comportamentos cobertos

- "Editar": formulário preenchido com a linha e título "Editando: <nome>"
- "Cancelar edição": volta a "Novo funil", vazio, sem gravar
- Salvar edição válida: mantém a posição e atualiza a data da última alteração
- Outra pessoa alterou o mesmo funil: "Este funil foi alterado por outra pessoa. Recarregue antes de salvar." — nada é sobrescrito

## Cenários

### Happy Path
1. A usuária clica em "Editar" numa linha ativa.
2. A tela preenche o formulário com os valores da linha que o servidor mandou (nome, tipo, funil do tracking, opções do CRM marcadas, origem, trecho), guarda `id` e `versao` em campos escondidos e muda o título para "Editando: <nome>"; "Cancelar edição" aparece.
3. Ao salvar, a tela manda `POST /api/funis-relatorio` com `{ acao: 'editar', id, versao, ...campos }`.
4. O servidor lê as linhas, os funis conhecidos e o CRM; confere que a linha existe, está ativa e que a `versao` enviada é a atual; valida com `validarFunil` usando as **outras** linhas (a própria não conflita consigo mesma).
5. `UPDATE ... SET campos, versao = versao + 1, alterado_em = agora WHERE id = ? AND versao = ? AND situacao = 'ativo'` — a posição não é tocada.
6. Responde `{ ok: true, id }`; a tela limpa o formulário e recarrega a lista com a data de alteração nova.

### Edge Cases
- "Cancelar edição" → formulário volta a "Novo funil", vazio, sem chamar o servidor.
- Opção do CRM gravada que sumiu do CRM → aparece marcada no formulário com "(não existe mais no CRM)"; se continuar marcada, o servidor recusa com "Essa opção não existe no CRM." (spec).
- Funil do tracking gravado que não está mais na lista de opções → entra no `<select>` para não sumir em silêncio; o servidor decide se ainda é reconhecido.
- Trocar o filtro Ativos/Todos durante a edição redesenha as opções mantendo as marcadas.
- Editar o WO PAGO mantendo o tipo → não conflita com ele mesmo (venda na Greenn única, trecho, nome).

### Cenário de Erro
- `versao` diferente da gravada, linha arquivada no meio do caminho (arquivar muda a versão) ou `UPDATE` sem linha afetada → `409 { error: 'Este funil foi alterado por outra pessoa. Recarregue antes de salvar.' }`; nada é sobrescrito.
- `id` ausente → 400 `id obrigatório`; id inexistente → 404 `Funil não encontrado.`
- Regra recusada → 400 com a mensagem da validação; CRM fora → 503 (igual à criação).
- Mensagens exibidas na área de erro do formulário, que continua em modo edição.

## Banco de Dados

`UPDATE` em `funis_relatorio` usando a coluna `versao` (concorrência otimista, migration 0039). Sem migration nova.

## Arquivos

- **Modificar:** `functions/api/funis-relatorio.js` — `onRequestPost` despacha `acao: 'editar'` para `editarFunil` (checagem de versão, validação contra as outras linhas, UPDATE guardado por `versao`).
- **Modificar:** `tests/funis-relatorio-validacao.test.js` — teste de edição (a própria linha fora de `outros` não conflita; renomear para o nome de outro ativo recusa).
- **Modificar:** `public/dash/index.html` — campo escondido `#funisrel-versao`; clique em "Editar" preenche o formulário (`preencherFormFunisRel`); "Cancelar edição" limpa; `corpoFormFunisRel` manda `acao`, `id` e `versao`; `desenharOpcoesFunisRel` preserva as opções marcadas.

## Reuso (pesquisado na base)

- `preencherForm` / `limparForm` / listener no contêiner da tabela da aba Links.
- `validarFunil` (issue 245) e `lerLinhas` do próprio endpoint.

## Checklist

- [x] "Editar" preenche o formulário e muda o título para "Editando: <nome>"
- [x] "Cancelar edição" volta a "Novo funil" vazio, sem gravar
- [x] Servidor confere existência, situação e versão antes de validar
- [x] Validação contra as outras linhas
- [x] UPDATE mantém a posição, incrementa `versao` e atualiza `alterado_em`
- [x] Versão desatualizada → 409 "Este funil foi alterado por outra pessoa. Recarregue antes de salvar."
- [x] Opção sumida do CRM aparece marcada e identificada no formulário
- [x] Teste da validação em edição
- [x] `npm test` passando
