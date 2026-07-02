# 43: Criar tabela D1 `clickup_sync_failures`

**Tipo:** Implementação
**Página:** ClickUp direto — remover n8n (transversal)

## Descrição

Criar a tabela `clickup_sync_failures` no D1 para registrar leads cuja criação/comentário no ClickUp falhou, garantindo que nenhum lead se perca. Base para a issue 47.

## Cenários

### Happy Path
Migração aplicada; a tabela existe e aceita INSERT com o payload completo do lead.

### Edge Cases
- Reaplicar a migração não pode quebrar → usar `CREATE TABLE IF NOT EXISTS`.

### Cenário de Erro
- N/A (DDL). Se o `wrangler d1 migrations apply` falhar, corrigir o SQL e reaplicar.

## Banco de Dados

- Tabela: `clickup_sync_failures`
  - `id` (INTEGER PK AUTOINCREMENT) — id do registro
  - `created_at` (TEXT, default `datetime('now')`) — quando falhou
  - `phone` (TEXT) — telefone normalizado do lead (para busca/replay)
  - `email` (TEXT) — email do lead
  - `lead_json` (TEXT NOT NULL) — payload completo do lead p/ replay manual
  - `error` (TEXT) — mensagem/status do erro
  - `resolved` (INTEGER NOT NULL default 0) — flag p/ marcar como reprocessado

## Arquivos

- **Criar:** `migrations/0018_clickup_sync_failures.sql` — DDL da tabela, no estilo das migrações existentes (comentário no topo explicando o porquê + `CREATE TABLE IF NOT EXISTS`).

## Checklist

- [x] Escrever `migrations/0018_clickup_sync_failures.sql` com o schema acima (SQL validado em sqlite: schema + INSERT + defaults OK)
- [ ] Aplicar local: `wrangler d1 migrations apply tracking-ae-db --local` *(deploy — pendente)*
- [ ] Aplicar remoto: `wrangler d1 migrations apply tracking-ae-db --remote` *(deploy — pendente)*
- [ ] Confirmar a criação (`wrangler d1 execute tracking-ae-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='clickup_sync_failures'"`) *(deploy — pendente)*
