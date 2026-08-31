# 191: Coluna `step` na `event_log`

**Tipo:** Implementação
**Página:** banco (D1)
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`

## Descrição

Criar a migration `0034_event_log_step.sql` com `ALTER TABLE event_log ADD COLUMN step INTEGER`, para o evento `FormStep` guardar o número da etapa concluída. Fica `NULL` em todo evento que não seja `FormStep`, inclusive no histórico anterior.

## Por que assim

Neste projeto o `wrangler d1 migrations apply --remote` está quebrado (0021/0022/0025 estouram ao reaplicar): em produção a coluna vai por `wrangler d1 execute --remote --command`. O arquivo de migration existe para o banco local e para o histórico do schema. Precisa estar aplicada ANTES do deploy do código que grava o `step`.

## Pesquisa da base de codigo

- **Precedente exato:** `migrations/0027_event_log_material.sql` -- tambem um
  `ALTER TABLE event_log ADD COLUMN` de coluna opcional, com o aviso do
  `--remote` ja escrito no cabecalho. **Copiar o formato desse arquivo**:
  comentario explicando o porque, o que acontece com as linhas historicas, e o
  aviso da aplicacao manual.
- **Sem indice.** `0022_event_log_is_junk.sql` criou indice porque `is_junk`
  entra no `WHERE` de quase toda query do dash. O `step` so e lido junto de
  `event_name = 'FormStep'`, que ja tem o indice `idx_event_log_event_name`.
  Um indice a mais so encareceria a escrita.
- **Sem backfill.** Diferente da `0022`, nao ha nada a corrigir no historico:
  antes desta issue o dado nao existia.

## Cenarios

### Happy Path

1. `wrangler d1 migrations apply --local` cria a coluna no banco local.
2. Em producao, `wrangler d1 execute <DB> --remote --command "ALTER TABLE
   event_log ADD COLUMN step INTEGER"` cria a mesma coluna.
3. Todo evento existente e todo evento que nao seja `FormStep` fica com
   `step = NULL`.

### Edge Cases

- **Migration reaplicada:** o SQLite nao tem `ADD COLUMN IF NOT EXISTS`, entao
  rodar duas vezes da `duplicate column name: step`. E exatamente o motivo de a
  0021/0022/0025 quebrarem o `migrations apply --remote` neste banco. Nao tentar
  contornar com `IF NOT EXISTS` (nao existe) nem com `PRAGMA`: o aviso no
  cabecalho do arquivo e o controle, igual a 0027.
- **Codigo antes da coluna:** se a 192 subir antes de a coluna existir, o INSERT
  falha e o evento se perde. Ordem obrigatoria: esta issue primeiro, em producao.

### Cenario de Erro

Se o `execute --remote` falhar (credencial, banco errado), nada e gravado e o
estado anterior permanece -- `ALTER TABLE ADD COLUMN` e atomico no SQLite. Basta
corrigir e repetir.

## Banco de Dados

- Tabela: `event_log`
  - `step` (INTEGER, nullable) -- numero da etapa concluida, preenchido **apenas**
    em eventos `FormStep`. `NULL` em todos os outros e em todo o historico.

## Arquivos

- **Criar:** `migrations/0034_event_log_step.sql` -- o `ALTER TABLE`, com o
  cabecalho no formato da `0027`.

## Checklist

- [x] `migrations/0034_event_log_step.sql` criado com `ALTER TABLE event_log ADD COLUMN step INTEGER`
- [x] Cabecalho explica: para que serve, por que linhas antigas ficam `NULL`, e o aviso do `--remote`
- [x] Sem indice e sem backfill (justificados no comentario)
- [x] Aplicada no banco local
- [ ] Aplicada em producao por `wrangler d1 execute --remote --command`, **antes** do deploy da issue 192
