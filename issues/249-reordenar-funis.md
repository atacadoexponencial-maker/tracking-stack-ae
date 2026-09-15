# 249: Reordenar funis (subir/descer)

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Implementar a troca de posição de um funil ativo com o vizinho pelo servidor.

## Comportamentos cobertos

- "subir"/"descer": servidor troca a posição com a linha vizinha e a lista recarrega
- "subir" na primeira / "descer" na última: botão desabilitado
- Nova ordem vale a partir da próxima consulta do relatório

## Cenários

### Happy Path
1. A usuária clica em "subir" (ou "descer") numa linha ativa.
2. A tela manda `POST /api/funis-relatorio` com `{ acao: 'subir' | 'descer', id }`.
3. O servidor lê os ativos e `trocaDePosicao(linhas, id, direcao)` acha o vizinho na ordem do relatório.
4. Um único `UPDATE` troca as duas posições, protegido: só grava se as duas linhas ainda estiverem ativas e nas posições lidas.
5. Responde `{ ok: true, movido: true }`; a tela recarrega a lista na nova ordem. O endpoint de feedback lê a posição na próxima consulta (nada fica em cache).

### Edge Cases
- "subir" na primeira linha / "descer" na última → o botão já vem desabilitado (issue 238, pela `posicao` e `total_ativos` do servidor); se a chamada chegar mesmo assim, o servidor responde `{ ok: true, movido: false }` e nada muda.
- Linha arquivada ou inexistente → `{ ok: true, movido: false }`.
- Ordem mudada por outra pessoa entre a leitura e o clique → o `UPDATE` protegido não afeta linha nenhuma (`movido: false`) e a lista recarrega mostrando a ordem real; nunca ficam duas linhas com a mesma posição.
- Trocar posição não altera `versao` nem `alterado_em`: reordenar não é editar o funil, e não pode fazer uma edição aberta em outra tela ser recusada como "alterado por outra pessoa".

### Cenário de Erro
- `id` ausente → 400 `id obrigatório`; mensagem exibida em `#funisrel-lista-erro`.
- Falha de rede → "Não foi possível alterar a ordem. Tente de novo." na área de erro da lista.
- Sem chave → 401.

## Banco de Dados

`UPDATE` em `funis_relatorio.posicao` (sem migration nova):

```sql
UPDATE funis_relatorio
SET posicao = CASE id WHEN :a THEN :posB ELSE :posA END
WHERE situacao = 'ativo' AND id IN (:a, :b)
  AND (SELECT COUNT(*) FROM funis_relatorio
       WHERE situacao = 'ativo' AND ((id = :a AND posicao = :posA) OR (id = :b AND posicao = :posB))) = 2;
```

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio.js` — `trocaDePosicao(linhas, id, direcao)` (puro).
- **Modificar:** `tests/funis-relatorio.test.js` — testes de `trocaDePosicao`.
- **Modificar:** `functions/api/funis-relatorio.js` — `acao: 'subir' | 'descer'` → `moverFunil` com o UPDATE protegido.
- **Modificar:** `public/dash/index.html` — cliques em `data-subir` / `data-descer` chamam o servidor, mostram erro em `#funisrel-lista-erro` e recarregam a aba.

## Reuso (pesquisado na base)

- Ordenação de ativos de `montarListaFunis` (`ordemNula`, desempate por id).
- `enviarFunisRel` (issue 245) e listener no contêiner da tabela (issue 247).

## Checklist

- [x] `trocaDePosicao` acha o vizinho na ordem; `null` na ponta, arquivado ou inexistente
- [x] Testes do módulo puro
- [x] UPDATE único e protegido (conferido em SQLite: troca as duas ou nenhuma)
- [x] `versao` e `alterado_em` intactos na troca
- [x] Tela chama o servidor e recarrega; erro na área da lista
- [x] Botões das pontas desabilitados pelo dado do servidor
- [x] `npm test` passando
