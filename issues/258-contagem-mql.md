# 258: Contar MQLs dos novos leads

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Aplicar o critério de MQL sobre os novos leads de cada bloco e informar a nota do critério na resposta.

## Comportamentos cobertos

- MQL = faturamento mensal acima de R$ 20 mil e status atual diferente de Desqualificado
- Card sem faturamento: lead, não MQL
- Status avaliado no momento da consulta (não no fim do período)
- Resposta sempre traz a nota de que o MQL reflete o status do momento da consulta

## Cenários

### Happy Path
1. Sobre os cards que a issue 257 atribuiu a cada bloco do tipo lead (a mesma leitura do CRM), `contarMqls` conta os que são MQL.
2. MQL = status atual do card ≠ "Desqualificado" (comparação sem acento e sem caixa) **e** faturamento mensal acima de R$ 20 mil.
3. Faturamento = custom field "🤑 Faturamento Mensal" (pelo ID `CU_FIELD.faturamento` ou pelos nomes "🤑 Faturamento Mensal" / ":money_mouth_face: Faturamento Mensal"); dropdown resolvido pelo `id`/`orderindex` da opção, ou texto (hoje é `short_text`).
4. A resposta sempre traz `nota_mql`: "MQL reflete o status atual do card no CRM, no momento da consulta."

### Edge Cases (régua de texto — porte fiel do relatório atual)
- Normaliza (sem acento, minúsculo). Se casar "menos de / abaixo de / até (R$) 20 (mil|k|.000)", "R$ 20.000,00", ou for exatamente "20 mil"/"20k" → não é MQL.
- Extrai os números; número < 1000 em texto com "mil" (ou "r$") é multiplicado por 1000 — o "150" de "De 150 a 200 Mil" vira 150.000, como no relatório atual; "milhão/milhões/mi" multiplica por 1.000.000.
- Um número → MQL se > 20000 ("Acima de 50 mil" → sim; "Mais de 500Mil" → sim).
- Faixa ("até", "menos de", "abaixo de", "-", " a ") → MQL se o TETO for > 20000 ("De 150 a 200 Mil" → sim; "De 10 a 20 mil" → não; "De 20 a 30 Mil" e "De 20 a 50 Mil" → sim; "Menos de 20 Mil" → não).
- Vários números sem marca de faixa → MQL (como no relatório atual).
- **Sem número** → não é MQL (diferença deliberada pedida: o relatório atual contava).
- Faturamento vazio → lead, não MQL.
- Status "desqualificado", "Desqualificado", "DESQUALIFICADO" → não MQL, qualquer faturamento.
- Status avaliado no momento da consulta (o que vem do card agora).
- Valores reais de 90 dias (15/09): todos os 16 valores distintos do campo cobertos nos testes, com o resultado esperado.

### Cenário de Erro
- CRM indisponível → `mqls: null` (nunca 0), com o aviso já emitido pela issue 257.

## Decisões

- **Faixa conta como MQL se o teto passar de R$ 20 mil** — decisão da usuária em 15/09/2026, igual ao comparativo semanal (`is_mql_task`). O coletor do diário (`revenue_above_20k`) exigia piso e teto; as duas réguas divergiam só em 'De 20 a 30 Mil' e 'De 20 a 50 Mil'.
- **'De 20 a 30 Mil' (31 cards/90d) e 'De 20 a 50 Mil' (1) passam a ser MQL.** O diário passa a mostrar ~10 MQLs/mês a mais que antes.
- **"milhão", "milhões" ou "mi" = × 1.000.000** ("Mais de 1 Milhão" → MQL). Corrige um bug do script, que devolvia não. Hoje nenhum card real tem esse valor, então a paridade não muda.
- **Faturamento sem número não é MQL** (pedido explícito; o script contava).

## Arquivos

- **Criar:** `functions/api/_feedback-marketing-mql.js` — `NOTA_MQL`, `CAMPO_FATURAMENTO`, `valoresDeDinheiro`, `faturamentoAcimaDe20Mil`, `ehMql`, `contarMqls` (puros).
- **Criar:** `tests/feedback-marketing-mql.test.js`
- **Modificar:** `functions/api/feedback-marketing.js` — `metricas.mqls` real nos blocos do tipo lead e `nota_mql` pela constante.

## Reuso (pesquisado na base)

- `normalizarTexto` e `lerCampo` (`_feedback-marketing-crm.js`, issue 257); `CU_FIELD.faturamento` (`_clickup.js`).
- Porte de `extract_money_candidates`, `is_low_revenue_bucket` e `is_mql_task` de `/root/ae_weekly_comparative_report.py`.

## Checklist

- [x] Status ≠ Desqualificado normalizado
- [x] Faturamento por ID ou nome; dropdown ou texto
- [x] Régua de texto portada, com "sem número → não"
- [x] Casos exigidos nos testes ("De 150 a 200 Mil", "Até R$ 20 mil", "De 10 a 20 mil", "Acima de 50 mil")
- [x] `mqls` real (null com CRM indisponível) e `nota_mql` sempre presente
- [x] Conferido contra os cards reais (mesmo resultado do script da VPS)
- [x] `npm test` passando
