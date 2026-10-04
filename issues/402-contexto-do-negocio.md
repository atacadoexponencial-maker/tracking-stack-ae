# 402: Contexto do negócio funcionando

**Tipo:** Implementação
**Página:** Aba Argo › Contexto do negócio (spec `spec-relatorio-semanal-argo.md`, módulo 1)

## Descrição

Tornar real o contexto do negócio aprovado no protótipo 400: itens gravados de verdade, com os cinco tipos, prazo de validade, revisão, arquivamento e saída automática de eventos terminados, prontos para o relatório consultar.

## Pronto quando

Ela cria, edita, marca como revisado e arquiva itens na aba e eles continuam lá ao recarregar; um item que passou do prazo aparece como "revisar"; um evento com data de fim passada sai do contexto atual e continua consultável; os arquivados aparecem no filtro. Todos os comportamentos do módulo 1 da spec funcionam.
