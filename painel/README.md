# Painel de Clientes — Atacado Exponencial

Plataforma própria de relatórios (substitui o Looker Studio): Google Ads + Meta Ads +
GA4 via Windsor.ai → D1 → dashboard por cliente com link secreto.
Spec: `../docs/superpowers/specs/2026-07-16-painel-clientes-design.md`.

## URLs

- Produção: https://painel-atacadoexponencial.pages.dev (→ `painel.atacadoexponencial.com` após configurar o domínio)
- Dashboard do cliente: `/c/<slug>` (slug secreto, gerado no admin)
- Admin: `/admin` (senha única — env `ADMIN_PASSWORD`)

## Arquitetura

```
Windsor.ai ─▶ POST /api/sync/run (cron externo, x-sync-secret) ─▶ D1 ─▶ /api/painel/* ─▶ dashboard
                                   └▶ POST /api/admin/sync ("Sincronizar agora" / backfill)
```

- App Astro estático (`src/pages/dash.astro`, `admin.astro`) + Pages Functions (`functions/`)
- Banco D1 `painel-clientes-db` — resumos diários, valores em cents (schema em `migrations/`)
- Projeto Cloudflare Pages `painel-atacadoexponencial`, **separado** do site (tracking-ae)

## Deploy

```bash
cd painel
npm run build
npx wrangler pages deploy dist --branch main
```

## Secrets do projeto (já configurados via `wrangler pages secret put`)

| Var | Uso |
|---|---|
| `WINDSOR_API_KEY` | Connectors API do Windsor (sync) |
| `SYNC_SECRET` | gate do POST /api/sync/run (cron externo) |
| `ADMIN_PASSWORD` | senha do /admin |

## Operação

- **Cron do sync**: agendar POST `https://painel.atacadoexponencial.com/api/sync/run`
  com header `x-sync-secret: <SYNC_SECRET>` a cada 6h (mesmo provedor de cron do
  ad-spend-sync do tracking). Sem body = janela dos últimos 3 dias (upsert).
- **Cliente novo**: /admin → Clientes → preencher nome + IDs das contas → Salvar.
  O link secreto aparece na lista. Depois: backfill via botão "Sincronizar agora"
  (ou POST /api/admin/sync com `date_from`/`date_to`, mês a mês para históricos longos)
  e cadastrar as metas do mês.
- **Status das conexões**: /admin → Status (🟢🟡🔴 por cliente × fonte, com último erro).

## Migrações

```bash
npx wrangler d1 execute painel-clientes-db --remote --file migrations/000X_nome.sql
```
