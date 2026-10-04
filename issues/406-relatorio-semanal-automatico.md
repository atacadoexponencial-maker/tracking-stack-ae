# 406: Relatório toda segunda às 07h, com aviso no Slack e histórico

**Tipo:** Implementação
**Página:** Aba Argo › Relatório da semana (spec `spec-relatorio-semanal-argo.md`, módulo 4: geração, aviso e histórico)

## Descrição

O relatório passa a ser gerado sozinho toda segunda às 07h cobrindo os 7 dias anteriores, avisa no canal dos monitores do Slack (pronto ou falhou, com o motivo), e a aba ganha o histórico de semanas, a abertura de relatórios antigos como foram publicados, a comparação de duas semanas lado a lado e o "gerar de novo" que guarda a versão anterior como substituída.

## Pronto quando

Numa segunda às 07h o relatório aparece na aba sem ninguém pedir e a mensagem chega no Slack com o link; uma falha forçada aparece como "falhou" na aba e no Slack com o motivo; ela abre uma semana antiga, compara duas semanas e refaz uma semana vendo a versão anterior marcada como substituída.
