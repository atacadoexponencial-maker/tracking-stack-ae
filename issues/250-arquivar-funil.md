# 250: Arquivar funil

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Implementar o arquivamento de um funil com confirmação, retirando-o da ordem e compactando as posições.

## Comportamentos cobertos

- Confirmação: "O bloco <nome> sai do relatório. O investimento e os leads dele passam a aparecer em 'sem funil', inclusive se um dia passado for consultado de novo."
- Confirmar: marcado como arquivado, sai da ordem e as posições seguintes sobem
- Arquivar o único ativo: permitido; a aba mostra o estado vazio
- Excluir definitivamente não existe

## Cenários

### Happy Path
1. A usuária clica em "Arquivar" numa linha ativa.
2. A tela manda `POST /api/funis-relatorio` com `{ acao: 'arquivar', id }`.
3. O servidor encontra o funil ativo e, sem `confirmado`, responde `200 { confirmar: "O bloco <nome> sai do relatório. O investimento e os leads dele passam a aparecer em 'sem funil', inclusive se um dia passado for consultado de novo." }` — nada é gravado.
4. A tela abre a confirmação com esse texto; "OK" reenvia com `confirmado: true`.
5. O servidor grava num `batch` (transação do D1): marca `situacao = 'arquivado'`, `posicao = NULL`, `versao + 1`, `alterado_em = agora`; e sobe em 1 as posições dos ativos que estavam abaixo.
6. Responde `{ ok: true, arquivado: true }`; a lista recarrega sem o funil (ou com ele marcado como arquivado em "Todos").

### Edge Cases
- Cancelar a confirmação → nada é gravado, a lista fica como está.
- Arquivar o único funil ativo → permitido; a aba mostra o estado vazio (`aviso_vazio` do servidor, issue 238).
- Funil já arquivado (duplo clique, outra aba) → `{ ok: true, arquivado: false }`, nada muda, lista recarrega.
- Posição mudou entre a leitura e a gravação (outra pessoa reordenou) → o primeiro UPDATE é protegido pela posição lida e não afeta nada; o segundo só roda se o primeiro arquivou → `arquivado: false`, lista recarrega; nunca abre buraco na ordem.
- Arquivar muda a `versao`: um formulário de edição aberto com a versão velha recebe "Este funil foi alterado por outra pessoa. Recarregue antes de salvar." (issue 247).
- Excluir definitivamente não existe: não há ação de apagar no endpoint, e o trigger da migration 0039 aborta qualquer DELETE.

### Cenário de Erro
- `id` ausente → 400 `id obrigatório`; id inexistente → 404 `Funil não encontrado.`; mensagens na área de erro da lista.
- Falha de rede → "Não foi possível arquivar. Tente de novo."

## Banco de Dados

`batch` em `funis_relatorio` (sem migration nova):

```sql
UPDATE funis_relatorio SET situacao = 'arquivado', posicao = NULL, versao = versao + 1, alterado_em = :agora
WHERE id = :id AND situacao = 'ativo' AND posicao = :pos;

UPDATE funis_relatorio SET posicao = posicao - 1
WHERE situacao = 'ativo' AND posicao > :pos
  AND EXISTS (SELECT 1 FROM funis_relatorio WHERE id = :id AND situacao = 'arquivado' AND alterado_em = :agora);
```

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio.js` — `confirmacaoArquivar(nome)` com o texto da spec.
- **Modificar:** `tests/funis-relatorio.test.js` — teste do texto.
- **Modificar:** `functions/api/funis-relatorio.js` — `acao: 'arquivar'` → `arquivarFunil` (confirmação do servidor + batch que arquiva e compacta a ordem).
- **Modificar:** `public/dash/index.html` — clique em `data-arquivar` chama o servidor; `acaoListaFunisRel` passa a tratar a resposta `confirmar` (confirmação com o texto do servidor e reenvio com `confirmado: true`).

## Reuso (pesquisado na base)

- Padrão "marcação, nunca DELETE" de `functions/api/links.js` e trigger `trg_funis_relatorio_sem_delete` (migration 0039).
- Confirmação vinda do servidor igual à da edição (issue 248); `acaoListaFunisRel` (issue 249).

## Checklist

- [x] Texto de confirmação da spec montado no servidor
- [x] Sem `confirmado` → `{ confirmar }` sem gravar
- [x] Batch arquiva (posição NULL, versão +1, data) e sobe as posições seguintes
- [x] Guardas: já arquivado ou posição mudada não gravam nada (conferido em SQLite)
- [x] Arquivar o único ativo deixa o estado vazio
- [x] Nenhuma ação de apagar
- [x] Tela pede confirmação e recarrega
- [x] `npm test` passando

## Ajustes pós-revisão

- **Corrida no arquivar (média):** a compactação ficava numa 2ª gravação que só conferia `situacao = 'arquivado' AND alterado_em = agora`; dois "arquivar" do mesmo funil no mesmo segundo compactavam duas vezes (posições 1, 2, 2). Agora arquivar + compactar é **um UPDATE só** em `functions/api/funis-relatorio.js`, condicionado por `EXISTS (id ainda ativo na posição lida)` — a segunda requisição não toca em nada.
- Teste em `tests/funis-relatorio.test.js` com SQLite em memória (migrations 0039/0040) e as duas requisições lendo o mesmo estado antes de gravar; conferido que o código antigo falha nesse teste.
