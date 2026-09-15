# 262: Classificar a origem das vendas da Greenn

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Quebrar as compras realizadas por origem, pela UTM da sessão de checkout ligada à venda, como informação complementar.

## Comportamentos cobertos

- Tráfego pago: anúncio pela regra de canal do CPL por canal
- Disparo: origem de disparo de WhatsApp (ex.: `disparo-api`)
- Outra origem: UTM presente que não é anúncio nem disparo
- Sem rastreio: sem sessão de checkout, ligação órfã ou sessão sem UTM
- Soma das origens sempre igual ao total; não altera compras nem CPA

## Cenários

### Happy Path
1. Com as compras realizadas da issue 261 (`{ entity_id, pago_em, trk }`), o endpoint lê as sessões de checkout dos `trk` não vazios: `checkout_sessions` por `trk` (chave primária), em lotes de 50.
2. `contarPorOrigem(compras, sessoes)` (puro) classifica cada compra por `classificarOrigem(sessao)`:
   - **tráfego pago:** `canalDeLead` (`_canal.js`, a regra do CPL por canal) devolve `meta-ads` (hoje: `utm_source = facebookads`);
   - **disparo:** `utm_source` começando por `disparo` (sem diferenciar caixa) — ex.: `disparo-api`;
   - **outra origem:** alguma UTM presente (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content` ou `utm_term`) que não é anúncio nem disparo (ex.: `organico`, e-mail);
   - **sem rastreio:** compra sem `sf_trk`, `sf_trk` sem sessão (órfão) ou sessão com todas as UTMs vazias.
3. Devolve `{ trafego_pago, disparo, outra_origem, sem_rastreio }`; a soma é sempre o total de compras.

### Decisão: regra de disparo
- `_canal.js` não reconhece disparo (lá `disparo-api` cai em `outro`). Regra mínima, só neste módulo: `utm_source` que começa com `disparo`. No D1 remoto (15/09) os disparos usam `utm_source = disparo-api` (376 sessões de checkout); nenhum outro valor começa com `disparo`. `_canal.js` não é alterado (mudaria o CPL por canal).

### Edge Cases
- **Dado real 14/09:** 3 compras — 2 com `utm_source = disparo-api` → `disparo: 2`; 1 sem `sf_trk` → `sem_rastreio: 1`.
- **`trk` repetido em duas compras:** as duas usam a mesma sessão.
- **Sem compras:** todas as origens 0 e nenhuma leitura de sessão.
- **Espaços/caixa no `utm_source`** (`" Disparo-API "`): disparo; `FacebookAds` → tráfego pago (mesma normalização de `canalDeLead`).
- **Só `utm_campaign` `bioperfil…`:** outra origem.
- A quebra não altera compras realizadas nem CPA.

### Cenário de Erro
- Falha do D1 na leitura das sessões: sobe para a falha inesperada do endpoint (issue 265).

## Banco de Dados

Só leitura, sem migration:
- `SELECT trk, utm_source, utm_medium, utm_campaign, utm_content, utm_term FROM checkout_sessions WHERE trk IN (?, …)` — lotes de 50, pela chave primária (`sqlite_autoindex_checkout_sessions_1`, conferido com EXPLAIN).

## Arquivos

- **Modificar:** `functions/api/_feedback-marketing-greenn.js` — `classificarOrigem`, `contarPorOrigem` (puros), `lerSessoesCheckout(db, trks)` (I/O).
- **Modificar:** `tests/feedback-marketing-greenn.test.js`
- **Modificar:** `functions/api/feedback-marketing.js` — leitura das sessões e `compras_por_origem` real.

## Reuso (pesquisado na base)

- `canalDeLead` (`_canal.js`); ligação `sf_trk` → `checkout_sessions.trk` e lotes de `greenn.js`.

## Checklist

- [x] Tráfego pago pela regra de canal
- [x] Disparo por `utm_source` de disparo (regra documentada)
- [x] Outra origem e sem rastreio (sem trk, órfão, sem UTM)
- [x] Soma das origens = total
- [x] Leitura das sessões por chave primária, em lotes, só com compras
- [x] Testes
- [x] `npm test` passando
