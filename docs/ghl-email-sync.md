# Sync de estatística de email do GoHighLevel

A aba **Email** do dash lê da tabela `email_campaign_stats`, que é preenchida por
um cron externo que chama `/api/sync/ghl-email`. Mesmo desenho do sync de
investimento do Meta (`docs/ad-spend-sync.md`): o dash lê do banco, nunca bate no
GoHighLevel no caminho da requisição. Se o cron parar por algumas horas, o dash
continua mostrando o último snapshot — só fica desatualizado.

## O que o endpoint faz

`POST /api/sync/ghl-email` lista as campanhas de email **enviadas** (GHL API v3),
puxa a estatística de cada uma (enviados, entregues, aberturas, cliques, bounces,
descadastros) e faz upsert em `email_campaign_stats`. É idempotente — re-rodar não
duplica.

## Requisitos (secrets do Pages, produção)

Já configurados nesta stack:

- `SYNC_SECRET` — string aleatória compartilhada entre o cron e o endpoint
- `TOKEN_GHL` — Private Integration Token do GoHighLevel (prefixo `pit-`)
- `LOCAL_ID` — locationId da sub-conta

## Cron na VPS (recomendado: 6/6h)

A VPS já roda os outros syncs. Adicionar ao crontab (`crontab -e`):

```cron
# Sync de estatística de email do GHL — a cada 6 horas (min 40 pra não colidir
# com os outros syncs do topo da hora)
40 */6 * * * curl -fsS -X POST https://atacadoexponencial.com/api/sync/ghl-email -H "x-sync-secret: <SYNC_SECRET>" >/dev/null 2>&1
```

Troque `<SYNC_SECRET>` pelo valor real (o mesmo já usado nos outros syncs da VPS).

## Rodar manualmente / verificar

Disparar na mão:

```bash
curl -X POST https://atacadoexponencial.com/api/sync/ghl-email \
  -H "x-sync-secret: <SYNC_SECRET>"
# → {"ok":true,"sincronizadas":N,"com_erro":0}
```

Conferir no banco:

```bash
wrangler d1 execute tracking-ae-db --remote --command \
  "SELECT name, sent_at, sent, delivered, opened, clicked FROM email_campaign_stats ORDER BY sent_at DESC LIMIT 10"
```

A aba Email também mostra "última sincronização" no cabeçalho da tabela. Se estiver
muito antiga, o cron parou de disparar — cheque o log da VPS.
