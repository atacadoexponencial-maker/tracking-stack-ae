# 309: Reativar o que ele pausou (desligado por padrão)

**Tipo:** Implementação
**Página:** Monitores e executor na VPS + régua — spec `spec-argo-regua-editavel.md`, módulo 4

## Descrição

Regra desligada por padrão: um alvo pausado pelo Argo é reativado (ou proposto, conforme a grade) se os resultados que chegaram depois da pausa deixarem o custo dele dentro da média mais a tolerância; lead caro não reativa; no máximo uma reativação por alvo.

## Pronto quando

Com a regra desligada nada muda; ligada, um alvo pausado cujo custo voltou para dentro da média aparece como proposta de reativar, e um com lead novo mas caro aparece no relatório como "não reativa: custo acima da média".
