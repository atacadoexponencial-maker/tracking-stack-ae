# 135: Tabela email_campaign_stats

**Tipo:** Implementação
**Página:** Banco (D1)

## Descrição

Criar a migration `migrations/0023_email_campaign_stats.sql` com a tabela `email_campaign_stats` (chave `source_id`, campanha/nome/assunto/from/status, `sent_at`, contagens sent/delivered/opened/clicked/bounced/unsubscribed/complained/failed, `synced_at`) + índice em `sent_at`. Aplicar no D1 remoto.
