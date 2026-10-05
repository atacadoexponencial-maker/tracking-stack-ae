# 402: Contexto do negócio funcionando

**Tipo:** Implementação
**Página:** Aba Argo › Contexto do negócio (spec `spec-relatorio-semanal-argo.md`, módulo 1)

## Descrição

Tornar real o contexto do negócio aprovado no protótipo 400: itens gravados de verdade, com os cinco tipos, prazo de validade, revisão, arquivamento e saída automática de eventos terminados, prontos para o relatório consultar.

## Pronto quando

Ela cria, edita, marca como revisado e arquiva itens na aba e eles continuam lá ao recarregar; um item que passou do prazo aparece como "revisar"; um evento com data de fim passada sai do contexto atual e continua consultável; os arquivados aparecem no filtro. Todos os comportamentos do módulo 1 da spec funcionam.

## Cenários

### Happy Path
A aba Contexto lê `GET /api/argo/contexto` (itens valendo, arquivados e eventos terminados, já com a situação `em_dia`/`revisar` calculada no servidor) e grava por `POST /api/argo/contexto` com `acao` = `criar`, `editar`, `revisar` ou `arquivar`. Cada gravação devolve a lista inteira de novo; a tela só redesenha.

### Edge Cases
- Evento sem as duas datas ou com fim antes do início: 400 com a mensagem do campo (a tabela também recusa).
- Editar ou revisar item arquivado: 409 "Este item já foi arquivado."
- Item inexistente: 404.
- Evento cuja data de fim já passou: sai de "valendo" e aparece em "terminados" sem ninguém mexer.
- Lista vazia: a tela mostra o estado vazio.

### Cenário de Erro
Neon fora: 500 com "Não foi possível ler o contexto agora." e a tela mostra o aviso no lugar da lista, sem apagar o que já estava desenhado na gaveta.

## Banco de Dados

- Tabela `argo.contexto_itens` (migration `gestor-ae/migrations/argo/0008_contexto_negocio.sql`, aplicada em 04/10): `id`, `conta`, `tipo` (prioridade, oferta, evento, restricao, observacao), `titulo`, `texto`, `funil`, `inicio`, `fim`, `validade_dias`, `revisado_em`, `criado_em`, `arquivado_em`, `atualizado_por`.

## Arquivos

- **Criar:** `gestor-ae/migrations/argo/0008_contexto_negocio.sql`: a tabela.
- **Criar:** `functions/api/_argo-contexto.js`: regra pura (validar o corpo, montar a lista com situação, dias desde a revisão e eventos terminados). Também usada pelo pacote de fatos (405).
- **Criar:** `functions/api/argo/contexto.js`: GET e POST, guarda `recusarSemChave` na primeira linha.
- **Criar:** `tests/argo-contexto.test.js`.
- **Modificar:** `public/dash/argo-contexto.js`: deixa de ser protótipo e passa a ler e gravar pela API (recebe `argoApi` do index); a regra de situação sai da tela.
- **Modificar:** `public/dash/index.html`: passa `{ argoApi }` ao abrir a vista.

## Checklist

- [x] Migration 0008 aplicada no Neon
- [x] `_argo-contexto.js` com validação e montagem, testado
- [x] `GET/POST /api/argo/contexto` com guarda de chave
- [x] Tela ligada à API, sem selo de protótipo e sem regra de negócio
- [x] Conferido com o Neon real (criar, editar, revisar, arquivar e apagar o item de teste)

## Implementação (04/10/2026)

Migration 0008 aplicada no Neon (VPS, `aplicar.py`). `_argo-contexto.js` (10 testes), `argo/contexto.js` e a tela `argo-contexto.js` ligada à API (sem selo de protótipo). Conferido localmente contra o Neon real: criar, editar, revisar, arquivar, 400 de datas, 409 de arquivado, 404; item de teste apagado.
