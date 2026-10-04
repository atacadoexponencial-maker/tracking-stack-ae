# 408: Testes propostos no relatório

**Tipo:** Implementação
**Página:** Aba Argo › Relatório da semana (spec `spec-relatorio-semanal-argo.md`, módulo 5 e a regra de restrição do módulo 7)

## Descrição

O relatório passa a trazer de zero a 3 testes propostos com a ficha completa, consultando o registro para não repetir teste já feito sem dizer o que muda e o contexto para não contrariar restrição (conferido pela checagem). Aceitar cria um teste planejado no registro com origem "sugerido pelo relatório"; descartar pede um motivo que entra no pacote da semana seguinte.

## Pronto quando

Ela vê as sugestões no relatório com todos os campos, aceita uma e a encontra no registro como "planejado", descarta outra com motivo e, na semana seguinte, a sugestão descartada não volta sem tratar do motivo. Sem base para sugerir, o relatório diz isso. Uma sugestão forçada contra uma restrição ativa é barrada pela checagem.
