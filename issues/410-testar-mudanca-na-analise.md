# 410: Testar mudança na análise nas semanas passadas

**Tipo:** Implementação
**Página:** Aba Argo › Relatório da semana (spec `spec-relatorio-semanal-argo.md`, módulo 7, "testar mudança na análise")

## Descrição

Antes de mudar as instruções da IA ou o modelo, a mudança roda nos pacotes das semanas anteriores e mostra quantas análises passariam na checagem e quantos trechos marcados como errado pela gestora se repetiriam, comparado com a versão atual. A mudança só entra se não piorar.

## Pronto quando

Uma mudança de instrução é rodada contra as semanas guardadas e o resultado aparece lado a lado com a versão atual (taxa de aprovação na checagem e trechos errados repetidos); uma mudança que piora fica registrada como recusada e não passa a valer.

## Cenários

### Happy Path
A tela mostra a versão das instruções que vale e as versões disponíveis. "Testar nas semanas passadas" (`POST /api/argo/relatorio-instrucoes acao=testar`) escreve de novo as últimas 4 semanas guardadas com a versão nova e passa pela mesma checagem; o resultado (aprovação na checagem antes e depois, erros repetidos) fica na tabela. "Ativar" só aceita versão com teste aprovado.

### Edge Cases
- Testar a versão que já vale: 409. Sem semanas guardadas com análise: recusada com o motivo.
- "Repetir um erro": o bloco da versão nova diz praticamente o mesmo que o trecho marcado como errado (semelhança de 60% ou mais).

### Cenário de Erro
Sem `ANTHROPIC_API_KEY`: 409 com o motivo.

## Banco de Dados

- `argo.relatorio_config` e `argo.instrucoes_avaliacoes` (migration 0010).

## Arquivos

- **Criar:** `functions/api/_argo-relatorio-avaliacao.js`, `functions/api/argo/relatorio-instrucoes.js`, `tests/argo-relatorio-avaliacao.test.js`.
- **Modificar:** `public/dash/argo-relatorio.js` (bloco "Instruções da análise").

## Checklist

- [x] Comparação pura e testada (4 testes)
- [x] Testar e ativar, com ativar travado sem teste aprovado
- [x] Bloco na tela
- [ ] Rodar um teste de verdade: depende da chave da API e de uma segunda versão das instruções (hoje só existe a v1)
