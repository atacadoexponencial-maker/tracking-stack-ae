# 251: Reativar funil arquivado

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Implementar a reativação de um funil arquivado, revalidando as regras de unicidade contra os ativos.

## Comportamentos cobertos

- "Reativar": revalida nome, funil do tracking, opção do CRM × origem, trecho e venda na Greenn única; se passar, volta ativo na última posição
- Conflito com um ativo: recusado com a mesma mensagem de conflito da criação

## Cenários

### Happy Path
1. Com o filtro em "Todos", a usuária clica em "Reativar" numa linha arquivada.
2. A tela manda `POST /api/funis-relatorio` com `{ acao: 'reativar', id }`.
3. O servidor lê as linhas e `validarReativacao(linha, outros)` revalida, **contra os ativos**, as regras de unicidade com os valores gravados do funil: nome (239), funil do tracking (241), opção do CRM × origem (242), trecho (243) e venda na Greenn única (244).
4. Passou: `UPDATE` volta o funil a `ativo` na **última posição** (`COALESCE(MAX(posicao), 0) + 1` calculado no próprio comando), `versao + 1`, `alterado_em = agora`.
5. Responde `{ ok: true, reativado: true }`; a lista recarrega com o funil no fim da ordem.

### Edge Cases
- Nome igual ao de **outro arquivado** → não impede (a regra "reative em vez de criar" só vale na criação; a reativação confere só os ativos).
- Funil do tracking que não tem mais lead no tracking, ou opção que sumiu do CRM → não impede a reativação: a spec revalida só unicidade. A opção sumida continua marcada "não existe mais no CRM" na lista, e o relatório avisa (módulo 2).
- Nenhum ativo → volta na posição 1.
- Funil já ativo (duplo clique, outra aba) → `{ ok: true, reativado: false }`, nada muda.

### Cenário de Erro
- Conflito com um ativo → `400` com a mesma mensagem da criação (ex.: "Já existe um funil com esse nome.", "Esse funil do tracking já pertence ao bloco SE.", "A opção WO PAGO com essa origem já pertence ao bloco WO PAGO.", "Esse trecho se sobrepõe ao do bloco WO PAGO.", "Já existe um funil de venda na Greenn (WO PAGO). Hoje as vendas da Greenn não são separadas por produto."); exibida em `#funisrel-lista-erro`; nada é gravado.
- `id` ausente → 400; inexistente → 404 `Funil não encontrado.`
- Falha de rede → "Não foi possível reativar. Tente de novo."

## Banco de Dados

```sql
UPDATE funis_relatorio
SET situacao = 'ativo',
    posicao = (SELECT COALESCE(MAX(posicao), 0) + 1 FROM funis_relatorio WHERE situacao = 'ativo'),
    versao = versao + 1, alterado_em = :agora
WHERE id = :id AND situacao = 'arquivado';
```

Sem migration nova.

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio-validacao.js` — `validarReativacao(linha, outros)` reaproveitando as validações 239, 241–244 só contra os ativos.
- **Modificar:** `tests/funis-relatorio-validacao.test.js` — testes de reativação (passa, cada tipo de conflito, arquivado homônimo não impede).
- **Modificar:** `functions/api/funis-relatorio.js` — `acao: 'reativar'` → `reativarFunil`.
- **Modificar:** `public/dash/index.html` — clique em `data-reativar` chama o servidor via `acaoListaFunisRel`.

## Reuso (pesquisado na base)

- `validarNome` (`contraArquivados: false`), `validarFunilTracking` (sem lista de conhecidos), `validarOpcoesCrm` (sem opções do CRM), `validarTrecho`, `validarVendaGreennUnica`; `lerOpcoesCrmGravadas`.
- Posição `MAX + 1` no próprio comando, como na criação (issue 245); `acaoListaFunisRel` (issue 249).

## Checklist

- [x] `validarReativacao` confere nome, funil do tracking, opção × origem, trecho e venda na Greenn única só contra ativos
- [x] Testes de reativação
- [x] Conflito → 400 com a mesma mensagem da criação
- [x] Volta ativo na última posição, versão +1 e data atualizada (conferido em SQLite)
- [x] Já ativo não muda nada
- [x] Tela chama o servidor e mostra o erro na área da lista
- [x] `npm test` passando
