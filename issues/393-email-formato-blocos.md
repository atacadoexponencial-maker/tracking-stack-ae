# 393: E-mails saem do formato por blocos; modelos antigos convertidos

**Tipo:** Implementação
**Página:** Modelos e todos os envios: agenda, campanhas, fluxos, teste (spec `spec-editor-email.md`, módulos 5 na parte da versão só texto, 6 e 7)

## Descrição

Trocar o corpo de texto do modelo pelo formato por blocos (título, texto, botão, divisória, espaço; imagem entra na 395), montar o e-mail final e a versão só texto a partir dos blocos, converter sozinhos todos os modelos salvos (parágrafo vira texto, [[Texto | link]] vira botão, cabeçalho padrão = logo de hoje) e ligar agenda, campanhas, fluxos e teste ao formato novo, sem parar nenhum envio.

## Pronto quando

Os 5 modelos da agenda estão em blocos, o e-mail de teste de cada um sai igual ao de antes (mesmo texto, links e campos), e agenda, campanhas e fluxos seguem enviando; o resumo do disparo continua apontando "sem nome" quando algum bloco usa o nome.
