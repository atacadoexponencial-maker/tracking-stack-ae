# 302: Executor das aprovações

**Tipo:** Implementação
**Página:** Argo na VPS (repo `gestor-ae`) + histórico da aba Propostas — spec `spec-argo-aprovar-propostas.md`, módulo 4

## Descrição

Rotina na VPS a cada ~10 min que executa cada proposta aprovada uma única vez: confere parada geral e estado atual do alvo, grava intenção e estado anterior antes de agir, pausa (anúncio: todos com o mesmo nome), relê o alvo e marca conferido/falhou/desconhecido. O histórico da tela passa a mostrar os selos de execução.

## Pronto quando

Aprovar uma proposta no dash faz o alvo aparecer pausado no Gerenciador em até ~10 min e a proposta aparece como "Executada e conferida"; com parada geral ligada ela fica "aguardando"; rodar o executor duas vezes ao mesmo tempo não age duas vezes.
