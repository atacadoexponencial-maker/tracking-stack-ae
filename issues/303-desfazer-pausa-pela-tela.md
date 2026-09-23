# 303: Desfazer uma pausa pela tela

**Tipo:** Implementação
**Página:** Aba Propostas (histórico) + executor na VPS — spec `spec-argo-aprovar-propostas.md`, módulos 3 e 4

## Descrição

Botão Desfazer nas pausas executadas, com confirmação na linha; o executor reativa o alvo a partir do estado anterior gravado e registra o desfazer como entrada nova ligada à ação original, sem alterar o registro da pausa. Alvo já ativo vira "já estava ativo".

## Pronto quando

Desfazer uma pausa no dash reativa o alvo no Gerenciador em até ~10 min, a linha mostra "Desfeita" com quem e quando, e o registro original da pausa continua intacto.
