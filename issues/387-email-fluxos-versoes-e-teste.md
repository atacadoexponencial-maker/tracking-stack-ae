# 387: Fluxos: editar ativo com segurança e testar

**Tipo:** Implementação
**Página:** Dash › E-mail › Fluxos (spec `spec-email-proprio.md`, módulo 9)

## Descrição

Mudanças num fluxo ativo ficam em rascunho até publicar (o fluxo no ar segue rodando a versão anterior), descartar mudanças, publicar mudanças movendo quem está dentro sem perder ninguém (quem estava em cartão excluído sai com registro), e teste com endereço da equipe pulando esperas e escolhendo sim/não nos desvios.

## Pronto quando

A usuária edita um fluxo ativo, confere que ninguém recebeu nada novo, descarta, edita de novo e publica; roda o teste e recebe na hora todos os e-mails do caminho escolhido.
