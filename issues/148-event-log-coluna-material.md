# 148: Coluna `material` no event_log

**Tipo:** Implementação
**Página:** banco (D1) + backend (`functions/tracker.js`)
**Spec:** `docs/superpowers/specs/2026-07-27-paginas-materiais-iscas-design.md`

## Descrição

Registrar, em cada lead, qual material rico foi baixado. Como todos os materiais
compartilham o funil `iscas-manychat`, o `funnel` sozinho não distingue as iscas
— daí uma coluna própria, ao lado dele, no `event_log`.

## Cenários

### Happy Path
1. Chega um `Lead` com `lead_data.material === 'icp'`.
2. O `INSERT` no `event_log` grava `material = 'icp'`, junto do
   `funnel = 'iscas-manychat'`.

### Edge Cases
- Eventos sem `lead_data` (ex.: `InitiateCheckout`) e leads dos demais funis →
  `material` gravado como string vazia, mesmo tratamento do `funnel`.
- Linhas históricas ficam com `material` nulo — nenhum backfill.

## Arquivos

- **Criar:** `migrations/0027_event_log_material.sql` —
  `ALTER TABLE event_log ADD COLUMN material TEXT;`
- **Modificar:** `functions/tracker.js` — extrair `loggedMaterial` de
  `body.lead_data.material` (normalizado como o `loggedFunnel`, linha ~274) e
  incluir a coluna e o bind no `INSERT INTO event_log` (linha ~287).

## Restrições

- ⚠️ Aplicar em produção com `wrangler d1 execute --remote`. **Nunca** rodar
  `wrangler d1 migrations apply --remote` neste projeto: as migrations 0021,
  0022 e 0025 quebram ao serem reaplicadas.
- Manter a ordem posicional dos binds do `INSERT` — a lista é longa e um bind
  fora de ordem corrompe colunas vizinhas em silêncio.

## Checklist

- [x] `migrations/0027_event_log_material.sql` criada
- [x] `loggedMaterial` extraído e normalizado
- [x] Coluna e bind acrescentados ao `INSERT`, na mesma posição relativa
- [x] Migration aplicada em produção via `wrangler d1 execute --remote`
- [ ] Lead de teste grava o `material` corretamente
