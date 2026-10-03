# 375: Protótipo das telas de Campanhas e Relatório

**Tipo:** Protótipo
**Página:** Dash, seção **E-mail**: Campanhas e Relatório (spec `spec-email-proprio.md`, módulos 6 e 7)

## Descrição

Desenhar a lista de campanhas por situação, o formulário da campanha (modelo, segmentos, agora ou agendado), o resumo antes de disparar, o andamento do envio, o relatório da campanha e a visão geral do canal com o limite do mês.

## Pronto quando

Na prévia, a usuária percorre rascunho, resumo, enviando, enviada, agendada, cancelada e falhou, abre um relatório com dados de exemplo e a visão geral, e aprova o desenho.

## Implementação (03/10/2026)

Protótipo só de front, com dados de exemplo gerados no próprio navegador: nada chama a API, nada é salvo nem enviado (cada tela tem o selo "Protótipo"). Código em `public/dash/email-mkt.js` e `public/dash/email-fluxos.js`; no `public/dash/index.html` só a ponte (seções, navegação, `TITULOS`, `FILTROS`, `APP_DA_SECAO`, URL) e o CSS prefixado `em-`/`fx-`. A aba `email` do GHL não foi tocada.

Como abrir (pede a chave do dash):
- Campanhas: https://email-proprio.tracking-ae.pages.dev/dash/#mkt-email?v=campanhas. Uma de cada situação (rascunho, agendada, enviando, enviada, cancelada, falhou). "Nova campanha" vai até o resumo de quem recebe e quem fica de fora e o disparo com confirmação; o percentual sobe sozinho. "Ver estado: Marketing não liberado" bloqueia o disparo com o motivo.
- Relatório: clique em "Convite workshop 08/10". Visão geral do canal: https://email-proprio.tracking-ae.pages.dev/dash/#mkt-email?v=relatorio ("Ver estado: Domínio com problema" mostra o alerta de reputação).

Falta: aprovação dela na prévia.
