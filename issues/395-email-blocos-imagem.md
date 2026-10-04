# 395: Blocos de imagem e de imagem com texto

**Tipo:** Implementação
**Página:** Editor do modelo (spec `spec-editor-email.md`, módulos 2 na parte de imagem, 5 e 7)

## Descrição

Acrescentar ao editor o bloco de imagem (escolher da biblioteca ou subir na hora, trocar, texto alternativo, largura, alinhamento, link) e o de imagem com texto (lado da imagem, empilhar no celular), com GIF animado aceito, campo no texto alternativo, prévia mostrando o texto alternativo enquanto a imagem carrega, versão só texto com o texto alternativo e clique em imagem com link contando no relatório.

## Pronto quando

Ela põe uma imagem com link e um bloco de imagem com texto num modelo, a prévia e o teste mostram as imagens (empilhadas no celular), e o clique na imagem aparece no relatório como clique.

## Plano e execução (04/10/2026)

Quase tudo entrou junto com a 392–394, porque o editor de verdade já precisava da biblioteca: escolher da biblioteca e subir do bloco (`POST /api/email/imagens`), trocar, texto alternativo (aceita campo), largura (toda, metade, original, personalizada em px), alinhamento, link, bloco de imagem com texto (lado; empilha no celular pela regra `@media` no `<head>`), GIF aceito, soltar arquivo na prévia (em cima de imagem troca; entre blocos cria), texto alternativo na versão só texto.

- Clique em imagem com link conta no relatório: o envio marca todos os links (`TrackLinks: HtmlAndText`), inclusive o que envolve a imagem.
- Arquivos: só `tests/email-blocos.test.js` (imagem com texto, GIF, texto puro); o resto já estava em `_email-blocos.js` e `email-blocos.js`.

- [x] Imagem e imagem com texto no editor e no e-mail
- [x] GIF, campo no texto alternativo, versão só texto
- [x] Clique contado
- [x] Conferido na prévia (imagem da biblioteca em bloco de imagem com texto)
