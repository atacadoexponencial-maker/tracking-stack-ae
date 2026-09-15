# 256: Somar o investimento do período por bloco

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Somar o investimento das campanhas nos dias do período, distribuir entre os blocos e calcular o investido geral, com as conferências de fechamento e de frescor.

## Comportamentos cobertos

- Soma por campanha nos dias do período; investido geral inclui "sem funil"
- Período sem investimento: investido geral 0, blocos com 0 e sem campanhas
- Investimento desatualizado: aviso "O investimento foi atualizado pela última vez em <data e hora> — pode estar incompleto."
- Soma dos blocos + "sem funil" diferente do geral: aviso "Investimento dos blocos não fecha com o investido geral."

## Cenários

### Happy Path
1. O endpoint resolve o período (issue 254) e lê em paralelo, só leitura: gastos do período por campanha em `ad_spend`, `campaign_funnel_map`, funis ativos de `funis_relatorio` na ordem, `listarFunisConhecidos` e a última sincronização com sucesso do Meta em `sync_log`.
2. `reconhecerCampanhasDoPeriodo` (issue 255) liga cada campanha a um bloco ou ao "sem funil".
3. `montarInvestimento` soma em centavos (inteiros, sem erro de ponto flutuante) e devolve: investido geral, investido/campanhas/`sem_investimento` por bloco, investido e campanhas (com motivo) do "sem funil", `investimento_atualizado_em` e avisos.
4. O endpoint monta `blocos` na ordem do cadastro com `investido`, `sem_investimento` e `campanhas` reais, `sem_funil.investido`/`campanhas`, `investido_geral`, `totais.investido_geral` e `frescor.investimento_atualizado_em`; os avisos entram em `avisos`.

### Edge Cases
- **Investido geral inclui "sem funil":** é a soma de TODAS as linhas do período (inclusive campanha com soma ≤ 0, que não é listada em bloco nenhum).
- **Valores:** reais com duas casas (`spend_cents / 100`); campanhas de cada bloco da maior para a menor.
- **Período sem investimento:** `investido_geral: 0`, todo bloco com `investido: 0`, `sem_investimento: true`, `campanhas: []`; "sem funil" com 0 e sem campanhas.
- **`sem_investimento`:** `true` quando o investido do bloco é 0 (o uso no custo fica para as issues de CPL/CPA).
- **Investimento desatualizado:** última sincronização com sucesso do Meta (`sync_log`, `status = 'ok'`, mesma fonte do `/api/attribution`) anterior ao fim do período (meia-noite de Brasília do dia seguinte ao último dia) → "O investimento foi atualizado pela última vez em 15/09/2026 06:00 — pode estar incompleto." (data e hora de Brasília). Num período parcial (inclui hoje) o aviso aparece sempre — é verdade: o gasto de hoje ainda não fechou.
- **Nenhuma sincronização registrada:** `investimento_atualizado_em: null` e aviso "Não há registro de atualização do investimento — pode estar incompleto."
- **Fechamento:** soma dos blocos + "sem funil" ≠ investido geral (ex.: campanha com soma negativa no período) → "Investimento dos blocos não fecha com o investido geral."
- **Nenhum funil ativo:** `blocos: []` e todo o investimento em "sem funil".
- **Métricas ainda não calculadas** (leads, MQL, compras, custos, leads do "sem funil", totais de volume, frescor do CRM e da Greenn): seguem com os valores fixos do protótipo por tipo até as issues 257–265.

### Cenário de Erro
- Falha do D1: sem tratamento novo aqui — a mensagem "Não foi possível montar o feedback agora." é da issue 265.

## Banco de Dados

Só leitura, sem migration:
- `ad_spend`: `SELECT campaign_id, MAX(campaign_name), SUM(spend_cents) ... WHERE platform = 'meta' AND date BETWEEN ? AND ? GROUP BY campaign_id` — entra pelo índice `idx_ad_spend_platform_date`; lê só as linhas do período (no máximo 92 dias × campanhas). Sem `HAVING`, para o investido geral enxergar também campanha com soma ≤ 0.
- `sync_log`: `SELECT MAX(run_at) ... WHERE platform = 'meta' AND status = 'ok'` — índice `idx_sync_log_platform_run_at`.
- `campaign_funnel_map` (tabela pequena, mesma leitura de `/api/campaign-funnel`) e `funis_relatorio` ativos (índice por situação + posição).
- `listarFunisConhecidos` — mesma consulta pelo índice de `event_name` usada na aba Meta Ads e no aviso de conflito.

## Arquivos

- **Modificar:** `functions/api/_feedback-marketing-investimento.js` — adiciona `montarInvestimento({ gastos, campanhas, funisAtivos, ultimaAtualizacaoUnix, periodo })` e o formato de data/hora de Brasília do aviso.
- **Modificar:** `tests/feedback-marketing-investimento.test.js` — soma por bloco, geral com "sem funil", período vazio, ordenação, desatualizado, sem registro, período parcial, fechamento.
- **Modificar:** `functions/api/feedback-marketing.js` — leituras do D1 e troca dos números fixos de investimento pelos calculados; blocos a partir dos funis ativos na ordem do cadastro.

## Reuso (pesquisado na base)

- SQL de gasto por campanha de `functions/api/funis-relatorio-conflitos.js` / `campaign-funnel.js`.
- Última sincronização do Meta como em `functions/api/attribution.js`.
- `limitesDoPeriodoUnix` (issue 254) para o fim do período; `FUSO_BRT` (`_data-brt.js`) para data e hora de Brasília.

## Checklist

- [x] `montarInvestimento` puro, somando em centavos
- [x] Investido geral = todas as linhas do período, inclusive "sem funil"
- [x] Investido, `sem_investimento` e campanhas por bloco; "sem funil" com motivo
- [x] Período sem investimento: tudo 0 e sem campanhas
- [x] Aviso de investimento desatualizado (e sem registro)
- [x] Aviso de fechamento dos blocos com o geral
- [x] Endpoint lê o D1 por intervalo de data com índice e monta os blocos na ordem do cadastro
- [x] Testes do módulo puro
- [x] `npm test` passando
