# 342: Sub-aba Stories

**Tipo:** Implementação
**Página:** Dash → Marketing → Instagram → Stories, bloco 7 da spec `spec-central-marketing-instagram.md`

## Descrição

Ligar a sub-aba Stories aos dados reais: totais e médias do período e a lista de
stories publicados no período, com miniatura, números, navegação, selos "no ar" e
"captura parcial", e o aviso de desde quando os stories são registrados.

## Pronto quando

- A sub-aba mostra os stories do período escolhido, inclusive os já expirados,
  com o último número capturado.
- Stories ainda no ar levam o selo "no ar"; os capturados muito antes de expirar
  levam "captura parcial".
- A navegação aparece como barra, com avançou, voltou, saiu e pulou ao passar o mouse.
- Dá para ordenar por data, alcance ou visualizações, e ver a hora da última
  captura de cada story.
- Escolher um período anterior ao início da coleta mostra o aviso de desde quando
  existe registro; período sem stories mostra "Nenhum story registrado neste período."

## Observações

- Depende de 338 (coleta de stories) e 340 (tela no ar).
