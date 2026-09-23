# 300: Monitores geram propostas de verdade

**Tipo:** Implementação
**Página:** Argo na VPS (repo `gestor-ae`) — spec `spec-argo-aprovar-propostas.md`, módulo 5

## Descrição

Fazer os dois monitores respeitarem Desligado/Propor/Executar da grade e gravar propostas versionadas (uma pendente por alvo; versão nova substitui a anterior; vence na rodada seguinte; rejeitado respeita o intervalo mínimo), agendar o monitor de anúncios nos dias úteis logo após o de tráfego e fazer o Slack trazer sempre "N propostas aguardando" com link para a aba. "Pausar anúncio" em Executar continua recusado nesta issue.

## Pronto quando

Com "Pausar campanha de tráfego" em Propor, a rodada real grava uma proposta para cada candidata e o Slack mostra a contagem e o link — inclusive "0 aguardando"; o monitor de anúncios roda sozinho no dia útil seguinte; os testes dos dois monitores passam na VPS.
