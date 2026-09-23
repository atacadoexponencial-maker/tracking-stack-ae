# 301: Ver e decidir propostas no dash

**Tipo:** Implementação
**Página:** Aba Argo — spec `spec-argo-aprovar-propostas.md`, módulos 1, 2, 3 e 6

## Descrição

Ligar o protótipo 298 aos dados reais: pendentes e histórico de 30 dias, aprovar e rejeitar (com "por quê?") presos à versão vista, recusar decisão sobre proposta já decidida, vencida ou desatualizada, avisar sobre parada geral, e ajustar os textos da aba Controle para o Propor funcional. A tela só registra a decisão; ninguém executa ainda.

## Pronto quando

Uma proposta real gerada pela issue 300 aparece na aba Propostas, pode ser aprovada ou rejeitada, e a decisão fica gravada e aparece no histórico como "Aprovada — aguardando execução" ou "Rejeitada"; decidir uma versão antiga é recusado.
