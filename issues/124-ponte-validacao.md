# 124: ponte validacao

**Tipo:** Implementação
**Página:** ponte tracking↔ClickUp

## Descrição

Validação ponta a ponta no preview + registro do webhook em produção após o merge.

## Arquivos

—

## Validado no preview (2026-07-17)

- [x] Lead workshop aceito pelo /tracker, event_log correto (funnel=workshop, is_bot=0), redirect preservado
- [x] Webhook: assinatura inválida → 401; válida → 200 + crm_status_log gravado; sem secret → 503
- [x] SQLs do /api/crm-funnel e do join do /api/leads validados direto no D1
- [x] Dados de teste limpos (event_log, crm_status_log, config_kv)

## Pendente (exige produção — após merge na main)

- [ ] CLICKUP_API_TOKEN só existe em produção → criação de tarefa + lead_dispatch só validam lá (lead de teste real)
- [ ] Registrar o webhook: `curl -X POST "https://atacadoexponencial.com/api/crm-setup?key=<DASH_KEY>"` (usuária — eu não tenho a DASH_KEY)
- [ ] Tarefa de teste movida p/ "contrato assinado" com 💰 Arrecadado preenchido → conferir purchase_log + Receita no dash + evento na Meta

## Validado em produção (2026-07-17, pós-merge a87173d)

- [x] Merge na main; build de produção saudável (home 200, dash novo no ar, endpoints com auth correta)
- [x] Lead de teste → tarefa criada no ClickUp com funil WORKSHOP, WhatsApp/e-mail/nome e link da jornada na descrição; lead_dispatch `criado` com task_id/url
- [x] Reenvio do mesmo lead → `comentado` na MESMA tarefa (novos×retornando funcionando)
- [x] Rastros de teste removidos (tarefa ClickUp + linhas D1)
- [ ] Usuária: registrar o webhook — `curl -X POST "https://atacadoexponencial.com/api/crm-setup?key=<DASH_KEY>"`
- [ ] Teste de venda: mover uma tarefa de teste para "contrato assinado" com 💰 Arrecadado preenchido
