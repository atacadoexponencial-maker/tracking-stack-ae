# 125: Investimento Meta via Windsor

**Tipo:** Implementação
**Página:** /dash (Visão geral, Meta Ads)

## Descrição

O tile Investimento (e CPL/CPA/ROAS/campanhas) estava vazio: o sync de ad spend nunca
fora configurado e o token CAPI não tem ads_read. Solução: conta CA_AtacadoExponencial
conectada ao Windsor (OAuth de 1 clique pela usuária) e o /api/sync/meta-ads ganhou a
fonte Windsor (preferida; fallback Meta direta mantido).

## Resultado

- [x] Conta CA_AtacadoExponencial (4577256079174658) conectada no Windsor e validada via MCP
- [x] Sync via Windsor gravando em ad_spend (mesmo formato; upsert intocado); secrets WINDSOR_API_KEY, WINDSOR_META_ACCOUNT e SYNC_SECRET cadastrados
- [x] Backfill: conta é nova (começou a veicular em julho) — 40 linhas desde 08/07; jan–jun corretamente vazio
- [x] Cron na VPS a cada 6h (log /var/log/tracking-adspend-sync.log)
- [x] Verificado: /api/attribution meta_spend R$ 2.312,65 (7d) e /api/ad-spend com 5 campanhas — tiles do dash acesos
- [x] Diagnóstico /api/meta-adaccounts mantido (útil p/ futuro token direto na fase 2)
