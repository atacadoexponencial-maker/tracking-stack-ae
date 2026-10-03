# 374: Protótipo das telas de Contatos e Segmentos

**Tipo:** Protótipo
**Página:** Dash, seção **E-mail**: Contatos e Segmentos (spec `spec-email-proprio.md`, módulos 4 e 5)

## Descrição

Desenhar a lista de contatos (busca, filtros por situação, origem e funil, totais), o detalhe do contato com histórico, a lista de segmentos e o montador de regra com contagem ao vivo e amostra.

## Pronto quando

Na prévia, a usuária navega por lista, detalhe e montador, com estados de vazio, contato descadastrado, "voltou", "denunciou" e inválido, no computador e no celular, e aprova o desenho.

## Implementação (03/10/2026)

Protótipo só de front, com dados de exemplo gerados no próprio navegador: nada chama a API, nada é salvo nem enviado (cada tela tem o selo "Protótipo"). Código em `public/dash/email-mkt.js` e `public/dash/email-fluxos.js`; no `public/dash/index.html` só a ponte (seções, navegação, `TITULOS`, `FILTROS`, `APP_DA_SECAO`, URL) e o CSS prefixado `em-`/`fx-`. A aba `email` do GHL não foi tocada.

Como abrir (pede a chave do dash):
- Contatos: https://email-proprio.tracking-ae.pages.dev/dash/#mkt-email?v=contatos. 2.400 contatos de exemplo; filtre por situação para ver descadastrado, voltou (com "Reativar" e aviso de risco), denunciou e inválido. "Ver estado: Tudo vazio" mostra o primeiro dia.
- Segmentos: https://email-proprio.tracking-ae.pages.dev/dash/#mkt-email?v=segmentos. "Novo segmento" abre o montador com contagem ao vivo e amostra.

Falta: aprovação dela na prévia.
