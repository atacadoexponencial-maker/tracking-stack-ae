# 343: Sub-aba Público

**Tipo:** Implementação
**Página:** Dash → Marketing → Instagram → Público, bloco 8 da spec `spec-central-marketing-instagram.md`

## Descrição

Ligar a sub-aba Público aos dados reais: idade, gênero, top 10 cidades e top 5
países, alternando entre seguidores e quem interagiu, e o gráfico de seguidores
online por hora em horário de Brasília, com a data do retrato.

## Pronto quando

- A sub-aba mostra a foto mais recente do público, com a nota "Retrato de DD/MM,
  não muda com o filtro de datas", e não reage ao filtro de período.
- Alternar entre Seguidores e Quem interagiu troca todos os gráficos; quando a
  Meta não devolveu o público de quem interagiu, aparece o aviso em vez de
  gráficos zerados.
- Passar o mouse numa faixa mostra número absoluto e porcentagem.
- O gráfico de horários mostra 0h a 23h em horário de Brasília, com a hora de pico
  destacada e o número de seguidores online ao passar o mouse.

## Observações

- Depende de 337 (público e horários) e 340 (tela no ar).
- A conversão do fuso do Pacífico para Brasília é feita no backend.
