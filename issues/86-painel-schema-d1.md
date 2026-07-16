# 86: Schema do banco D1

**Tipo:** Implementação
**Página:** —

## Descrição

Criar as tabelas e migrações: clientes, metas, ads_diario, criativos_diario, ga4_diario,
ga4_funil, ga4_produtos, sync_log — com índices por (cliente, data) conforme a spec.

## Arquivos

- **Criar:** `painel/migrations/0001_schema.sql` — 8 tabelas (clientes, metas, ads_diario, criativos_diario, ga4_diario, ga4_funil, ga4_produtos, sync_log)

## Checklist

- [x] Migração criada com valores monetários em cents (padrão ad_spend do tracking)
- [x] Colunas mapeadas aos IDs reais do Windsor (validados via MCP: session_default_channel_group, add_to_carts, item_name, thumbnail_url etc.)
- [x] Aplicada no D1 remoto `painel-clientes-db` — 8 tabelas confirmadas via sqlite_master
- [x] Cliente piloto UP Semijoias inserido (Meta 628094463950329, GA4 315016683)
