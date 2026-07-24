# 145: Cutover — ativar cron e desligar o n8n

**Tipo:** Implementação
**Página:** operação (VPS / n8n)

## Descrição

Após validar em produção com lead de teste, agendar o cron do coletor na VPS (a cada 15 min) com o marco de corte inicial, e desligar o workflow do n8n que lê a planilha e cria no ClickUp — evitando processamento em duplicidade (o dedup do `sendToClickUp` cobre a sobreposição). Referência: spec, "Transição / aposentar o n8n".
