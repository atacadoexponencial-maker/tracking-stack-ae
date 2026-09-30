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
