# 140: Coluna `origin` no event_log

**Tipo:** Implementação
**Página:** D1 / schema (backend)

## Descrição

Criar migration que adiciona a coluna `origin TEXT NOT NULL DEFAULT 'site'` à tabela `event_log`, para distinguir a origem do lead (leads do site ficam `site`; os do formulário Meta gravarão `meta_form`). Referência: spec `2026-07-24-meta-leads-sync-design.md`, seção "Componente 3 — D1".

## Cenários

### Happy Path
Aplicada a migration, toda linha existente de `event_log` passa a ter `origin = 'site'` (via DEFAULT). O endpoint de leads do Meta (issue 142) grava novas linhas com `origin = 'meta_form'`. O dashboard (issue 144) pode filtrar por `origin` mantendo a contagem somada no funil.

### Edge Cases
- Linhas históricas: cobertas pelo DEFAULT `'site'` — nenhum backfill necessário (todos os leads pré-existentes vieram do site/`/tracker`).
- Reexecução da migration: `ALTER TABLE ADD COLUMN` falha se a coluna já existe; a aplicação via `wrangler d1 migrations` é idempotente por controle de versão (não reaplica migrations já rodadas).

### Cenário de Erro
Se a coluna já existir (aplicação manual repetida), o SQLite retorna "duplicate column name". Evitar rodando pela via de migrations versionadas, não por `--command` avulso.

## Banco de Dados

- Tabela: `event_log`
  - `origin` (TEXT NOT NULL DEFAULT 'site') — origem do lead: `site` (via `/tracker`) ou `meta_form` (formulário nativo do Meta via `/api/sync/meta-leads`)

## Arquivos

- **Criar:** `migrations/0025_event_log_origin.sql` — ALTER TABLE adicionando `origin` + índice, seguindo o padrão de `migrations/0022_event_log_is_junk.sql`.

> Nenhum código de aplicação muda nesta issue; apenas o schema. O uso da coluna vem nas issues 142 (escrita) e 144 (leitura).

## Checklist

- [x] Criar `migrations/0025_event_log_origin.sql` com `ALTER TABLE event_log ADD COLUMN origin TEXT NOT NULL DEFAULT 'site';`
- [x] Adicionar `CREATE INDEX IF NOT EXISTS idx_event_log_origin ON event_log(origin);` (paridade com `is_junk`)
- [x] Comentário-cabeçalho explicando o propósito (padrão das outras migrations)
- [ ] [PAUSA/produção] Aplicar no D1 remoto (`wrangler d1 migrations apply tracking-ae-db --remote`) — junto do deploy, com o usuário
