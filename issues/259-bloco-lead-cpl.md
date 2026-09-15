# 259: Montar o bloco do tipo Lead do formulário + MQL com CPL

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Montar o bloco do tipo "Lead do formulário + MQL" com investido, novos leads, MQLs e CPL, respeitando a regra de custo sem denominador.

## Comportamentos cobertos

- CPL = investido ÷ novos leads, em reais com duas casas
- Sem novos leads: leads 0, MQLs 0 e CPL vazio
- Leads sem investimento: CPL 0 marcado "sem investimento no período"

## Cenários

### Happy Path
1. Para cada funil ativo do tipo `lead_mql`, `montarBlocoLead` recebe o funil, o investimento do bloco (issue 256) e os cards atribuídos (issue 257).
2. Devolve `nome`, `tipo`, `posicao`, `investido`, `sem_investimento`, `campanhas`, `metricas: { novos_leads, mqls }` (issue 258), `custo_tipo: 'CPL'`, `custo_por_resultado` e `avisos`.
3. CPL = investido ÷ novos leads, em reais com duas casas, calculado em centavos (ex.: R$ 150,00 ÷ 7 = 21,43).

### Edge Cases
- **Sem novos leads:** `novos_leads: 0`, `mqls: 0`, `custo_por_resultado: null` (o relatório escreve "—"), com ou sem investimento.
- **Leads sem investimento:** `custo_por_resultado: 0`, `sem_investimento: true` e `avisos: ['sem investimento no período']` — custo zero de verdade (lead orgânico), marcado.
- **Arredondamento:** meio centavo arredonda para cima (R$ 0,05 ÷ 2 = 0,03).

### Cenário de Erro
- **CRM indisponível** (cards `null`): `novos_leads: null`, `mqls: null`, `custo_por_resultado: null` — nunca 0; investimento e campanhas seguem; o aviso geral é o da issue 257.

## Arquivos

- **Criar:** `functions/api/_feedback-marketing-blocos.js` — `MARCA_SEM_INVESTIMENTO`, `calcularCusto`, `montarBlocoLead` (puros).
- **Criar:** `tests/feedback-marketing-blocos.test.js`
- **Modificar:** `functions/api/feedback-marketing.js` — blocos do tipo lead montados por `montarBlocoLead`.

## Reuso (pesquisado na base)

- `contarMqls` (`_feedback-marketing-mql.js`); investimento por bloco de `montarInvestimento` (`_feedback-marketing-investimento.js`); convenção `null` = sem denominador de `_cpl-calculo.js`.

## Checklist

- [x] CPL em centavos, duas casas
- [x] 0 leads → CPL null; leads e investimento 0 → CPL 0 com a marca
- [x] CRM indisponível → leads, MQLs e CPL null
- [x] Endpoint usa `montarBlocoLead`
- [x] Testes
- [x] `npm test` passando

## Ajustes pós-revisão

- A marca "sem investimento no período" usava `custo === 0` e aparecia com investimento > 0 quando o CPL arredondava para 0,00 (ex.: R$ 0,01 em 3 leads). Agora usa `investimento.sem_investimento && novos_leads > 0`. Teste com R$ 0,01 em `tests/feedback-marketing-blocos.test.js`.
