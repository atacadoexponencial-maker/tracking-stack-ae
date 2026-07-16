# 107: Check-up de dados (painel × fonte)

**Tipo:** Implementação
**Página:** Todas (APIs de consulta)

## Descrição

Auditoria métrica a métrica (período fechado 09–15/07, UP Semijoias) comparando o
painel com a Connectors API do Windsor. Corrigir divergências corrigíveis.

## Resultado da auditoria

| Métrica | Antes | Depois | Fonte |
|---|---|---|---|
| Receita, Pedidos, Novos usuários, Carrinho, Checkout, Investimento (Meta), Receita atribuída | 0,00% | 0,00% | ✅ exatos |
| Total de usuários | +15,3% | +12,4% | ⚠️ ver nota |
| Sessões | +1,6% | +1,6% | ⚠️ ver nota |
| Sessões engajadas | −1,2% | −1,3% | ⚠️ ver nota |

**Correção aplicada:** KPIs de cartão passaram a ler de `ga4_funil`, promovida a tabela
de totais diários SEM quebra de dimensão (migração 0002 adiciona usuarios,
novos_usuarios, sessoes_engajadas, receita_cents; sync do funil puxa os campos novos;
backfill jan–jul re-executado). Isso eliminou o overcount por dimensão (~2,6 p.p. em
usuários). `ga4_diario` segue alimentando apenas as tabelas de canal/origem.

**Nota (limitação conhecida e documentada):** métricas "únicas" do GA4 não são somáveis
entre dias — usuário que visita em 2 dias conta 2× na soma diária (+12,4% no período
testado); sessões que cruzam meia-noite geram +1,6%. É o mesmo comportamento de
qualquer tabela diária do próprio GA4. Correção total exigiria consulta ao vivo por
período (avaliar na fase 2).

- [x] Migração 0002 aplicada no D1 remoto
- [x] Sync + APIs atualizados e deployados
- [x] Backfill re-executado (196 dias)
- [x] Re-auditoria confirmando: monetário/contagens exatos; únicos dentro da limitação documentada
