# 106: Ajustes visuais (feedback da usuária)

**Tipo:** Implementação
**Página:** Dashboard (KPIs, Funil, gráficos)

## Descrição

1. Valores longos estouravam os cards de KPI (ex.: "R$ 100.825,64" na Home).
2. Funil deveria ter formato de funil (barras centralizadas afunilando, taxa entre etapas).
3. Cor laranja da série não combinava com a identidade — trocar pelo bege AE (#f5f0eb).

## Resultado

- [x] KPI: tiles maiores (minmax 185px), fonte com clamp + overflow-wrap — verificado sem estouros via DOM
- [x] Funil: barras centralizadas proporcionais com nome+valor acima e "% da etapa anterior" entre etapas
- [x] Série de dados em bege AE (linha do gráfico, área, funil, progresso); dot amarelo do admin ganhou cor própria (status ≠ série)
