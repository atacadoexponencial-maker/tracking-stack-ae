# 386: Fluxos: publicar e rodar

**Tipo:** Implementação
**Página:** Dash › E-mail › Fluxos (spec `spec-email-proprio.md`, módulo 9)

## Descrição

Publicar o fluxo e fazê-lo rodar: entrada pelos gatilhos (todos os acontecimentos da lista, com filtros, e contagem dos últimos 30 dias ao montar), sem puxar o passado, sem entrar duas vezes; e-mails, esperas nos 3 modos com janela, desvios, objetivo, ir para outro fluxo e fim; saída automática por descadastro/devolução/spam e manual; pausar e retomar sem rajada de acumulados.

## Pronto quando

A usuária publica um fluxo com gatilho "preencheu formulário" filtrado, envia um lead de teste, ele entra, recebe o e-mail 1, segue pelo desvio certo conforme abriu ou não, pula para o objetivo quando a condição acontece, e pausar segura quem está dentro.
