# 204: Excluir as vendas de teste interno

**Tipo:** Implementação
**Página:** Módulo 1 — Origem dos dados de venda

## Descrição

Remover do conjunto toda venda feita pela própria equipe, identificada por uma lista explícita de endereços de e-mail mantida num único lugar. Não pode ser por domínio: os testes saíram de um endereço pessoal comum e excluir o domínio apagaria clientes reais.

## Spec

`spec-greenn-aba-dashboard.md`

## Arquivos

- **Modificar:** `functions/api/_greenn-metricas.js` — constante `EMAILS_TESTE_INTERNO` e o filtro

## Checklist

- [ ] Lista explícita de endereços, num único lugar, comentada
- [ ] Comparação normalizada (minúsculas, sem espaços)
- [ ] Regra é por ENDEREÇO, não por domínio — comentário explicando por quê
- [ ] Comentário apontando a regra irmã em `functions/tracker.js:378`
- [ ] Vendas de teste somem de todos os números e de todas as listas
- [ ] Teste garantindo que um Gmail de cliente real NÃO é excluído
