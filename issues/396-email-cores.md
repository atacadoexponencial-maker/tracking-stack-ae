# 396: Cores personalizáveis no e-mail

**Tipo:** Implementação
**Página:** Editor do modelo (spec `spec-editor-email.md`, módulo 2, escolha de cor e fundos)

## Descrição

Deixar escolher qualquer cor (paleta livre, código, atalhos da marca, últimas usadas) em título, texto, links, botão (fundo e texto), divisória, fundo em volta do e-mail e fundo do conteúdo, com aviso de contraste baixo no botão.

## Pronto quando

Ela muda as cores de um modelo, a prévia e o e-mail de teste saem com essas cores, as últimas cores ficam à mão e o aviso de contraste aparece quando texto e fundo do botão ficam difíceis de ler.

## Plano e execução (04/10/2026)

A escolha de cor do protótipo aprovado (paleta, código, atalhos da marca, últimas usadas, aviso de contraste no botão e do texto contra o fundo) passou para o editor de verdade na 394. O servidor guarda só cores em código válido (`#rrggbb`) e devolve ao padrão o que vier inválido, para título, texto, links, botão (fundo e texto), divisória, fundo em volta, fundo do conteúdo e fundo da faixa do cabeçalho.

- Arquivos: `functions/api/_email-blocos.js` (normalização e uso das cores no HTML, 393) e `tests/email-blocos.test.js` (cores no e-mail; inválida volta ao padrão).

- [x] Cores livres em todos os lugares da spec
- [x] Aviso de contraste (botão e texto contra o fundo)
- [x] Teste das cores no e-mail
