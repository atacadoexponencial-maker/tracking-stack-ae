# 159: Deduplicar por telefone e grupo, sem expiração

**Tipo:** Implementação
**Página:** Módulo 1 — Seleção das entradas que viram conversão

## Descrição

Descartar a entrada cujo telefone já gerou conversão naquele mesmo grupo, e registrar o telefone como convertido assim que a conversão é aceita. Reentrada nunca gera segunda conversão, sem prazo de validade. A dedup vale só para o envio ao Meta — a aba Grupos continua contando tudo.
