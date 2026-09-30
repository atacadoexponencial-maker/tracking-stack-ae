# 352: Aba Saúde das integrações na direção "Etiqueta"

**Tipo:** Implementação
**Página:** Dash, aba Saúde das integrações
**Spec:** `spec.md` (Módulo 17)

## Descrição

Reestilizar a aba de saúde com os componentes da fundação: faixa de estado no topo (saudável, atenção, incidente) como etiqueta larga com selo e frase; tabelas-grade de aceitação por tipo, pendentes de reenvio, falhas definitivas, credenciais, horário das integrações, últimas rodadas e alertas enviados; "Evolução diária" em gráfico de duas séries (tinta e coral) com legenda; etiquetas de captura de identificadores de clique; filtros e "reenviar agora" em botões.

## Pronto quando

- Na preview, a aba aparece no mundo claro com os mesmos dados de produção.
- A faixa de estado muda de cor e texto conforme a saúde (verde, âmbar, coral) e traz o sinal além da cor.
- Disparar um reenvio manual coloca a rodada na tabela.
- Mouse na evolução mostra as duas séries no tooltip.

## Resultado (30/09/2026)

Implementada no branch `design/dash-etiqueta` junto com as demais abas (commit "18 abas no mundo Etiqueta"): o CSS específico da aba foi reescrito nos tokens do papel (sem gradiente, sem canto grande, rótulos apagados, acentos em tinta), `.card` virou `.bloco`, grades de KPI viraram grades de etiqueta, e os apelidos dos tokens antigos foram removidos. Nenhum dado, cálculo ou chamada mudou. Verificação: preview com respostas simuladas (Playwright) e leitura do CSS; a conferência com dados reais é dela, em produção.

Faixa de estado com fio forte no topo, selo em carimbo reto (moldura 1.5px), incidente marca o fio em coral. Gráfico de duas séries em tinta e coral.
