# 408: Testes propostos no relatório

**Tipo:** Implementação
**Página:** Aba Argo › Relatório da semana (spec `spec-relatorio-semanal-argo.md`, módulo 5 e a regra de restrição do módulo 7)

## Descrição

O relatório passa a trazer de zero a 3 testes propostos com a ficha completa, consultando o registro para não repetir teste já feito sem dizer o que muda e o contexto para não contrariar restrição (conferido pela checagem). Aceitar cria um teste planejado no registro com origem "sugerido pelo relatório"; descartar pede um motivo que entra no pacote da semana seguinte.

## Pronto quando

Ela vê as sugestões no relatório com todos os campos, aceita uma e a encontra no registro como "planejado", descarta outra com motivo e, na semana seguinte, a sugestão descartada não volta sem tratar do motivo. Sem base para sugerir, o relatório diz isso. Uma sugestão forçada contra uma restrição ativa é barrada pela checagem.

## Cenários

### Happy Path
As sugestões vêm na análise em formato fixo; a checagem confere os campos, os números e a restrição. "Virar teste" (`POST acao=decidir, decisao=aceita`) cria um teste `planejado` no registro com origem "sugerido pelo relatório", sem os lados (a gestora escolhe ao editar; iniciar sem lados dá 409). "Descartar" pede o motivo, que entra no pacote da semana seguinte.

### Edge Cases
- Decidir duas vezes a mesma sugestão: 409.
- Sem base para sugerir: a análise explica em `sem_sugestao_motivo` (vazio sem explicação reprova).
- Sugestão que contraria restrição ativa: bloco removido pela checagem.

### Cenário de Erro
Falha ao gravar: aviso na tela, nada muda.

## Banco de Dados

- `argo.sugestoes_decisoes` (migration 0010); `argo.testes.relatorio_id`, `sugestao_chave`, `origem` (0009).

## Arquivos

- **Criar:** `functions/api/_argo-relatorio-leitura.js` (validação da decisão e montagem do teste).
- **Modificar:** `functions/api/argo/relatorio.js`, `functions/api/argo/testes.js` (iniciar exige os lados).

## Checklist

- [x] Sugestões com ficha completa e checagem
- [x] Aceitar cria teste planejado; descartar exige motivo e vai para a semana seguinte
- [x] Conferido na tela com dados reais (descarte gravado; decisão repetida dá 409)
