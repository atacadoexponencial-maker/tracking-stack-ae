# 176: Schema dos links no D1

**Tipo:** Implementação
**Página:** Banco de dados

## Descrição

Criar a migration `0030` com as tabelas `short_links` (rótulo, URL, janela, `apagado_em`) e `short_link_clicks` (clique por linha, com dia local e UTMs), sem alterar nenhuma tabela existente.

## Cenários

### Happy Path
A migration é aplicada e as duas tabelas passam a existir vazias. Nenhuma tabela existente é tocada, então nada que está no ar muda de comportamento.

### Edge Cases
- Reaplicação: todo `CREATE` usa `IF NOT EXISTS` para ser idempotente.
- Nenhum destino cadastrado ainda: as tabelas vazias são estado válido — quem resolve isso é a issue 177 (cai em `/`).

### Cenário de Erro
Nenhum caminho de erro em runtime: é DDL. O risco é operacional (ver observação abaixo).

> ⚠️ **`d1 migrations apply --remote` NÃO pode ser rodado neste projeto** — as migrations 0021/0022/0025 quebram ao reaplicar. Aplicar este arquivo isoladamente via `d1 execute --remote --file`.

## Banco de Dados

- Tabela: `short_links`
  - `id` (INTEGER PK AUTOINCREMENT)
  - `label` (TEXT NOT NULL) — rótulo escrito pela usuária, ex.: "Disparo Live 05/08"
  - `target_url` (TEXT NOT NULL) — destino, só `http`/`https` (validado na 182)
  - `starts_at` (INTEGER) — unix seconds; NULL junto com `ends_at` = destino padrão
  - `ends_at` (INTEGER) — unix seconds
  - `criado_em` (INTEGER NOT NULL)
  - `apagado_em` (INTEGER) — NULL = ativo. Apagar é marcação, para o histórico de cliques não perder rótulo e URL.

- Tabela: `short_link_clicks`
  - `id` (INTEGER PK AUTOINCREMENT)
  - `link_id` (INTEGER) — qual destino serviu; NULL quando nenhum estava cadastrado
  - `occurred_at` (INTEGER NOT NULL) — unix seconds
  - `day_local` (TEXT NOT NULL) — 'YYYY-MM-DD' em -03:00, calculado na escrita
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` (TEXT)
  - `user_agent` (TEXT), `ip` (TEXT)

Índices: `short_links(apagado_em, starts_at)` para a escolha do destino;
`short_link_clicks(link_id)` e `short_link_clicks(day_local)` para a agregação do dash.

## Arquivos

- **Criar:** `migrations/0030_short_links.sql` — as duas tabelas e seus índices.

## Checklist

- [x] Criar `migrations/0030_short_links.sql` com `short_links` e `short_link_clicks`
- [x] Usar `IF NOT EXISTS` em tabelas e índices
- [x] Comentar no arquivo por que apagar é marcação e por que `day_local` é gravado
- [x] Não alterar nenhuma tabela existente
