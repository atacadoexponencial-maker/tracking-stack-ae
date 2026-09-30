# 347: Abas Atribuição, Meta Ads e Email na direção "Etiqueta"

**Tipo:** Implementação
**Página:** Dash, abas Atribuição, Meta Ads e Email
**Spec:** `spec.md` (Módulos 5, 6 e 7)

## Descrição

Reestilizar as três abas de canal com os componentes da fundação: Atribuição com pílulas de dimensão, chips e quebra por UTM em tabela-grade com barra de proporção; Meta Ads com aviso `explica`, etiquetas de investimento, leads pagos e CPL pago e as tabelas "CPL por funil", "CPL por canal", "Funil × canal" e "Campanhas" com nota de sync no título; Email com etiquetas de envios, entregas e taxa e a tabela de campanhas.

## Pronto quando

- Na preview, as três abas aparecem no mundo claro com os mesmos números de produção.
- Em Atribuição, trocar a dimensão recarrega a tabela e clicar num valor vira chip de filtro.
- Em Meta Ads, toda tabela ordena por coluna e o aviso de sync atrasado aparece em âmbar quando a última sincronização passou do prazo.
- Em Email, ordenar por envio ou entrega funciona.

## Resultado (30/09/2026)

Implementada no branch `design/dash-etiqueta` junto com as demais abas (commit "18 abas no mundo Etiqueta"): o CSS específico da aba foi reescrito nos tokens do papel (sem gradiente, sem canto grande, rótulos apagados, acentos em tinta), `.card` virou `.bloco`, grades de KPI viraram grades de etiqueta, e os apelidos dos tokens antigos foram removidos. Nenhum dado, cálculo ou chamada mudou. Verificação: preview com respostas simuladas (Playwright) e leitura do CSS; a conferência com dados reais é dela, em produção.

Específico: o `alert()` ao falhar o salvamento do funil de uma campanha (Meta Ads) virou um aviso `falha` na própria célula.
