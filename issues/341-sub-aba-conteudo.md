# 341: Sub-aba Conteúdo (desempenho por formato e ranking)

**Tipo:** Implementação
**Página:** Dash → Marketing → Instagram → Conteúdo, blocos 6a e 6 da spec `spec-central-marketing-instagram.md`

## Descrição

Ligar a sub-aba Conteúdo aos dados reais: cartões por formato (reels, carrosséis,
fotos, stories) com quantidade, médias, engajamento, seguidores gerados e melhor
conteúdo, e o ranking de posts e reels com colunas orgânicas, colunas pagas,
selo "impulsionado", ordenação e filtros.

## Pronto quando

- Os cartões mostram as médias do período para cada formato, com destaque no de
  maior alcance e no de maior engajamento, e "nenhum publicado" quando for o caso.
- Clicar num cartão filtra o ranking pelo formato; o de Stories leva à sub-aba Stories.
- O ranking ordena por qualquer coluna numérica (padrão: alcance, maior primeiro)
  e filtra por formato e por impulsionado / não impulsionado.
- Posts impulsionados mostram alcance pago, visualizações pagas e investimento, e o
  selo mostra campanha e período ao passar o mouse; nos outros, essas colunas
  mostram vazio, nunca zero.
- Clicar na linha ou na miniatura abre o post no Instagram; a legenda completa e a
  hora da última atualização aparecem ao passar o mouse.
- Período sem posts mostra "Nenhum post publicado neste período."

## Observações

- Depende de 339 (posts e pago) e 340 (tela no ar). O cartão de Stories usa a 338.
