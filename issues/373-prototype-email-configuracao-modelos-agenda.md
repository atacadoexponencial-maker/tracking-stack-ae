# 373: Protótipo das telas de Configuração, Modelos e E-mails da agenda

**Tipo:** Protótipo
**Página:** Dash, seção nova **E-mail**: Configuração, Modelos e a parte de e-mails dentro da Agenda (spec `spec-email-proprio.md`, módulos 1, 2 e 3)

## Descrição

Desenhar no dash, no estilo "Etiqueta", a tela de configuração (remetentes, endereço de resposta, rodapé, situação da conta e dos domínios), a biblioteca e o editor de modelos (campos, pré-visualização computador/celular, aviso de campo desconhecido) e, dentro da Agenda, a lista de e-mails por tipo de reunião com lembretes e o histórico de e-mails no detalhe do agendamento.

## Pronto quando

Na prévia, a usuária navega pelas telas com estados de vazio, erro (domínio com problema, marketing não liberado, falha de envio) e modelo arquivado, no computador e no celular, e aprova o desenho.

## Implementação (03/10/2026)

Protótipo só de front, com dados de exemplo gerados no próprio navegador: nada chama a API, nada é salvo nem enviado (cada tela tem o selo "Protótipo"). Código em `public/dash/email-mkt.js` e `public/dash/email-fluxos.js`; no `public/dash/index.html` só a ponte (seções, navegação, `TITULOS`, `FILTROS`, `APP_DA_SECAO`, URL) e o CSS prefixado `em-`/`fx-`. A aba `email` do GHL não foi tocada.

Como abrir (pede a chave do dash):
- Configuração: https://email-proprio.tracking-ae.pages.dev/dash/#mkt-email?v=configuracao (app Marketing > E-mail > Configuração). O seletor "Ver estado" no selo mostra domínio com problema, marketing não liberado e vazio.
- Modelos: https://email-proprio.tracking-ae.pages.dev/dash/#mkt-email?v=modelos. "Black do atacado" traz o `{{nmoe}}` para ver o aviso de campo desconhecido; filtro "Arquivados"; arquivar modelo em uso é barrado.
- E-mails da agenda: https://email-proprio.tracking-ae.pages.dev/dash/#agenda-emails (app Agenda > Configuração > E-mails). Mostra por tipo de reunião e o exemplo de detalhe do agendamento com entregue, aberto, voltou e falhou. Não mexeu no `agenda.js`.

Falta: aprovação dela na prévia.
