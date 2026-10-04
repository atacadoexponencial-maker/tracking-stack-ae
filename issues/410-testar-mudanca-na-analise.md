# 410: Testar mudança na análise nas semanas passadas

**Tipo:** Implementação
**Página:** Aba Argo › Relatório da semana (spec `spec-relatorio-semanal-argo.md`, módulo 7, "testar mudança na análise")

## Descrição

Antes de mudar as instruções da IA ou o modelo, a mudança roda nos pacotes das semanas anteriores e mostra quantas análises passariam na checagem e quantos trechos marcados como errado pela gestora se repetiriam, comparado com a versão atual. A mudança só entra se não piorar.

## Pronto quando

Uma mudança de instrução é rodada contra as semanas guardadas e o resultado aparece lado a lado com a versão atual (taxa de aprovação na checagem e trechos errados repetidos); uma mudança que piora fica registrada como recusada e não passa a valer.
