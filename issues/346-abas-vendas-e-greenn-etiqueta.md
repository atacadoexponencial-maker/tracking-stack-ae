# 346: Abas Vendas e Greenn na direção "Etiqueta"

**Tipo:** Implementação
**Página:** Dash, abas Vendas e Greenn
**Spec:** `spec.md` (Módulos 3 e 4)

## Descrição

Reestilizar as duas abas de receita com os componentes da fundação: Vendas com etiquetas de receita bruta, líquida e quantidade, gráfico "Receita por dia", tabelas-grade de produtos e compras e modal de detalhe; Greenn com aviso `explica` do período fixo, aviso `alerta` quando o sync falhou, etiquetas de receita, vendas, investimento e ROAS e tabelas de campanhas e vendas com selos `pago`/`parcial`.

## Pronto quando

- Na preview, Vendas e Greenn aparecem no mundo claro com os mesmos números de produção.
- Ordenar produtos e campanhas por qualquer coluna funciona.
- Clicar numa compra ou numa venda abre o detalhe no modal.
- Greenn continua ignorando o filtro de datas e diz isso no aviso `explica`; quando o sync falhou o aviso `alerta` aparece em âmbar.

## Resultado (30/09/2026)

Implementada no branch `design/dash-etiqueta` junto com as demais abas (commit "18 abas no mundo Etiqueta"): o CSS específico da aba foi reescrito nos tokens do papel (sem gradiente, sem canto grande, rótulos apagados, acentos em tinta), `.card` virou `.bloco`, grades de KPI viraram grades de etiqueta, e os apelidos dos tokens antigos foram removidos. Nenhum dado, cálculo ou chamada mudou. Verificação: preview com respostas simuladas (Playwright) e leitura do CSS; a conferência com dados reais é dela, em produção.

Vendas conferida na preview com dados simulados (etiquetas, gráfico com valor na ponta, tabelas, selo de GAds). Greenn: só CSS, avisos `explica`/`alerta` e selos `pago`/`parcial` já vinham da fundação.
