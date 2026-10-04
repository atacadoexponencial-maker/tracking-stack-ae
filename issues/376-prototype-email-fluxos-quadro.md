# 376: Protótipo do quadro de Fluxos automáticos

**Tipo:** Protótipo
**Página:** Dash, seção **E-mail**: Fluxos (spec `spec-email-proprio.md`, módulo 9)

## Descrição

Desenhar a lista de fluxos e o quadro visual no estilo do ManyChat: cartões de início (gatilhos com filtros), e-mail, espera (3 modos), desvio, objetivo, ir para outro fluxo e fim; botão "+", ligações, notas, zoom, mapa em miniatura, painel lateral de edição, números no cartão, barra de situação e marcação de fluxo quebrado.

## Pronto quando

Na prévia, a usuária monta um fluxo de exemplo com desvio e objetivo usando dados fictícios, vê os números nos cartões e os estados (rascunho, ativo, pausado, com problema), e aprova o desenho.

## Implementação (03/10/2026)

Protótipo só de front, com dados de exemplo gerados no próprio navegador: nada chama a API, nada é salvo nem enviado (cada tela tem o selo "Protótipo"). Código em `public/dash/email-mkt.js` e `public/dash/email-fluxos.js`; no `public/dash/index.html` só a ponte (seções, navegação, `TITULOS`, `FILTROS`, `APP_DA_SECAO`, URL) e o CSS prefixado `em-`/`fx-`. A aba `email` do GHL não foi tocada.

Quadro feito em JS puro (cartões em HTML num "mundo" com translate/scale e ligações em SVG, gestos por Pointer Events), sem biblioteca: assim o visual segue o "Etiqueta" sem brigar com CSS de terceiros e funciona igual com mouse e com dedo (pinça para zoom).

Como abrir (pede a chave do dash): https://email-proprio.tracking-ae.pages.dev/dash/#mkt-email?v=fluxos
- "Boas-vindas do workshop gratuito": exemplo pedido, ativo, com números nos cartões.
- "Convite para sessão estratégica": ativo com mudanças não publicadas. "Pós-compra do workshop pago": pausado. "Reengajar leads frios": rascunho com problemas marcados.
- Dá para adicionar pelo "+", ligar arrastando da bolinha de saída, mover cartões, arrastar a tela, zoom, centralizar, organizar, mapa, notas, painel lateral de edição, excluir, desfazer/refazer, testar e publicar (barrado com problema).
- Fora do protótipo: copiar e colar um grupo de cartões (pede seleção múltipla; entra na construção).

Falta: aprovação dela na prévia.
