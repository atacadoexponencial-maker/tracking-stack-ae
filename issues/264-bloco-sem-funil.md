# 264: Montar o bloco sem funil

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Montar o bloco "sem funil" com todo investimento e todo lead que não casou com nenhum funil ativo, sem calcular custo.

## Comportamentos cobertos

- Investido sem classificação com campanhas, valores e motivos
- Novos leads com opção fora do cadastro (ex.: `TRAFEGO PAGO`, `ISCAS`), contados por opção
- Card sem opção: "sem opção de funil no CRM"; opção cadastrada com origem não coberta: "opção <x> com origem não cadastrada"
- MQLs desses leads; sem CPL
- Com investimento: aviso "R$ <valor> de investimento sem funil — classifique as campanhas no dashboard."
- Vazio: presente e marcado como vazio
- Funil arquivado não gera bloco; o que era dele cai aqui

## Cenários

### Happy Path
1. `montarSemFunil` (puro) recebe o investimento sem funil (`montarInvestimento(...).sem_funil`, issue 256) e os leads sem funil (`atribuirCards(...).sem_funil`, issue 257: `[{ opcao, cards }]`).
2. Devolve `investido`, `campanhas` (nome, valor, motivo), `novos_leads` (soma dos cards), `leads_por_opcao: [{ opcao, novos_leads }]` (na ordem de `atribuirCards`: mais leads primeiro), `mqls` (`contarMqls` sobre todos esses cards) e `vazio`. **Sem CPL.**
3. Rótulos vêm prontos da 257: a opção do CRM (ex.: `TRAFEGO PAGO`, `ISCAS`), "sem opção de funil no CRM" e "opção <x> com origem não cadastrada".
4. Com investimento > 0, aviso geral "R$ <valor> de investimento sem funil — classifique as campanhas no dashboard." (valor em reais no formato brasileiro, ex.: `R$ 1.234,56`).

### Edge Cases
- **Vazio** (investido 0, nenhuma campanha e 0 leads): bloco presente com `vazio: true`, sem aviso.
- **Só campanha com soma ≤ 0:** listada; `vazio: false`; aviso só quando investido > 0.
- **Funil arquivado:** não gera bloco; seu investimento e seus leads já chegam aqui pelo reconhecimento (256) e pela atribuição (257), que só olham funis ativos.
- **CRM indisponível:** `novos_leads`, `leads_por_opcao` e `mqls` null (nunca 0); `vazio: false` (sem ler o CRM não dá para afirmar que está vazio — decisão própria). Investimento segue.
- **Nenhum funil ativo:** todo investimento e todo lead caem aqui (mesmas funções).

### Cenário de Erro
- Nenhum específico: derivado de leituras já feitas.

## Arquivos

- **Modificar:** `functions/api/_feedback-marketing-blocos.js` — `montarSemFunil`, `avisoInvestimentoSemFunil`, `formatarReais`.
- **Modificar:** `tests/feedback-marketing-blocos.test.js`
- **Modificar:** `functions/api/feedback-marketing.js` — `sem_funil` por `montarSemFunil` (sem o modelo do protótipo) e aviso de investimento sem funil.

## Reuso (pesquisado na base)

- `contarMqls` (`_feedback-marketing-mql.js`, só importado); `atribuirCards` e rótulos (`_feedback-marketing-crm.js`); `montarInvestimento` (`_feedback-marketing-investimento.js`). Não há formatador de reais em `functions/` (grep): função mínima em centavos.

## Checklist

- [x] Investido e campanhas com motivo
- [x] Novos leads por opção, MQLs, sem CPL
- [x] Aviso de investimento sem funil
- [x] Vazio marcado; CRM indisponível → null
- [x] Endpoint usa `montarSemFunil`
- [x] Testes
- [x] `npm test` passando
