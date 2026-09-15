# 236: Tabela do cadastro de funis e cadastro inicial

**Tipo:** Implementação
**Página:** Módulo 3 — Migração do reconhecimento do workshop pago
**Spec:** spec-feedback-marketing.md

## Descrição

Criar a migration da tabela de funis do relatório (com situação, posição, controle de versão para concorrência e data de alteração) e semear, uma única vez, os quatro blocos do relatório atual na ordem atual. O funil do tracking é obrigatório nos tipos "Lead do formulário + MQL" e "Manual" e não se aplica (fica vazio) no tipo "Venda na Greenn" — decisões 8 e 9 da spec.

## Comportamentos cobertos

- Cadastro inicial: `SE` (Lead + MQL, `sessao-estrategica`, `SESSÃO ESTRATÉGICA`, "Tráfego pago"); `LIVE` (Manual, `lives-semanais-v1`, `LIVES SEMANAIS`); `WO PAGO` (Venda na Greenn, sem funil do tracking, `WO PAGO`, trecho `workshop-pago`); `AQUISIÇÃO` (Lead + MQL, `aquisicao`, `SESSÃO ESTRATÉGICA`, "Qualquer origem exceto tráfego pago")
- Criado uma única vez; se já houver funis cadastrados, nada é criado nem sobrescrito
- Primeiro acesso após a entrada da feature já mostra os quatro blocos na ordem atual
- Funil nunca é apagado — só arquivado

## Cenários

### Happy Path
1. A migration `0039_funis_relatorio.sql` cria a tabela `funis_relatorio`, o índice e a trava contra DELETE.
2. A migration `0040_funis_relatorio_cadastro_inicial.sql` insere os quatro blocos na ordem SE, LIVE, WO PAGO, AQUISIÇÃO, todos `ativo`, `versao = 1`.
3. A aba (issue 238) abre já com os quatro blocos.

### Edge Cases
- Migrations reaplicadas: `CREATE ... IF NOT EXISTS` não quebra, e o cadastro inicial usa `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM funis_relatorio)`. Se já houver qualquer funil (inclusive arquivado), nada é criado nem sobrescrito.
- `tipo`, `origem_lead` e `situacao` fora da lista → recusados pelo `CHECK`.
- `funil_tracking` preenchido num `venda_greenn`, ou vazio num `lead_mql`/`manual` → recusado pelo `CHECK`.
- `DELETE FROM funis_relatorio` → abortado pelo trigger.
- Funil arquivado → `posicao = NULL` (sai da ordem).

### Cenário de Erro
- Tentativa de apagar funil: `RAISE(ABORT, 'funis_relatorio: funil nunca é apagado, só arquivado')`.

## Banco de Dados

Tabela `funis_relatorio` (migration `0039_funis_relatorio.sql`):

| coluna | tipo | observação |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `nome` | TEXT NOT NULL | nome no relatório |
| `tipo` | TEXT NOT NULL | CHECK `lead_mql` / `manual` / `venda_greenn` |
| `funil_tracking` | TEXT NULL | slug do funil do tracking; CHECK: obrigatório em `lead_mql`/`manual`, NULL em `venda_greenn` |
| `opcoes_crm` | TEXT NOT NULL | JSON `[{"id","nome"}]` das opções do campo "🔻 Funil" |
| `origem_lead` | TEXT NULL | CHECK `trafego_pago` / `exceto_trafego_pago` / `qualquer`; só no `lead_mql` |
| `trecho_campanha` | TEXT NULL | opcional |
| `situacao` | TEXT NOT NULL DEFAULT `ativo` | CHECK `ativo` / `arquivado` |
| `posicao` | INTEGER NULL | ordem no relatório; NULL quando arquivado |
| `versao` | INTEGER NOT NULL DEFAULT 1 | concorrência otimista |
| `criado_em` | INTEGER NOT NULL | unix seconds |
| `alterado_em` | INTEGER NOT NULL | unix seconds |

- Índice `idx_funis_relatorio_situacao_posicao (situacao, posicao)`.
- Trigger `trg_funis_relatorio_sem_delete` (BEFORE DELETE → ABORT).

Ids das opções do CRM do cadastro inicial (conferidos no campo "🔻 Funil" da lista 205126080 em 15/09/2026, iguais às constantes de `functions/api/_clickup.js`):
- `SESSÃO ESTRATÉGICA` = `a158d342-c1ac-4705-a6da-ce39019f0a2a` (`CU_FUNIL_SESSAO`)
- `LIVES SEMANAIS` = `e6893b0b-5a69-4f48-9c99-a3c0a415a118` (`CU_FUNIL_LIVES`)
- `WO PAGO` = `420877c7-44de-4d46-a934-718889443f49` (`CU_FUNIL_WO_PAGO`)

## Arquivos

- **Criar:** `migrations/0039_funis_relatorio.sql` — tabela, CHECKs, índice e trava contra DELETE.
- **Criar:** `migrations/0040_funis_relatorio_cadastro_inicial.sql` — `INSERT ... WHERE NOT EXISTS` dos quatro blocos.
- **Modificar:** `functions/api/_funis-relatorio.js` e `tests/funis-relatorio.test.js` (issue 238) — `funil_tracking` vazio sai como `null` (bloco de venda na Greenn).

## Reuso (pesquisado na base)

- Estilo e densidade de comentário de `migrations/0035_leads_bloqueados.sql` e `0028_campaign_funnel_map.sql`.
- Ids das opções do CRM de `functions/api/_clickup.js`.

## Checklist

- [x] Migration `0039_funis_relatorio.sql` com todas as colunas, CHECKs e defaults
- [x] `funil_tracking` obrigatório só em `lead_mql`/`manual`, NULL em `venda_greenn` (CHECK)
- [x] Índice por situação + posição
- [x] Trigger que impede DELETE (funil só é arquivado)
- [x] Ids das opções do CRM conferidos no ClickUp (leitura)
- [x] Migration `0040` do cadastro inicial com os quatro blocos, `WHERE NOT EXISTS`
- [x] LIVE com `lives-semanais-v1`; WO PAGO sem funil do tracking e com trecho `workshop-pago`
- [x] Conferido em SQLite em memória: semeia uma vez, reaplicar não duplica, CHECKs recusam o que devem
- [x] Nada aplicado no D1 remoto

## Ajustes pós-revisão

- `0039` ganhou `CHECK ((tipo = 'lead_mql') = (origem_lead IS NOT NULL))` (origem preenchida se e somente se lead+MQL) e o índice único parcial `idx_funis_relatorio_venda_greenn_ativo` (`tipo` WHERE `tipo = 'venda_greenn' AND situacao = 'ativo'`). Migration ainda não aplicada em lugar nenhum.
- Conferido em `tests/funis-relatorio.test.js` (node:sqlite em memória): 0039 + 0040 reaplicam sem erro e sem duplicar; o seed da 0040 continua válido; CHECK e índice recusam o que devem; arquivado não conta para a unicidade.
