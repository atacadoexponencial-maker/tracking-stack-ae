# 265: Montar a resposta: ordem, totais, frescor e falhas

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Juntar os blocos na resposta final, na ordem do cadastro, com totais, frescor das fontes, avisos gerais e tratamento de erro inesperado.

## Comportamentos cobertos

- Blocos na ordem do cadastro; "sem funil" sempre por último
- Totais: investido geral, novos leads e MQLs (blocos de lead + "sem funil"), compras realizadas; nada de funis "Manual" além do investimento
- Frescor: última atualização do investimento, se a leitura do CRM funcionou, último evento da Greenn
- Nenhum funil ativo: só investido geral, "sem funil" com tudo e aviso "Nenhum funil cadastrado."
- Dia sem dado: resposta completa, volumes 0, custos vazios, sem erro
- Cadastro vigente na hora da consulta; mudança vale na consulta seguinte; mesma consulta sem mudança → mesma resposta
- Falha inesperada: "Não foi possível montar o feedback agora." sem números parciais

## Cenários

### Happy Path
1. O endpoint faz as leituras (investimento, cadastro, CRM, Greenn) e monta os blocos (issues 256–264).
2. `montarResposta` (puro) devolve, nesta ordem: `periodo`, `gerado_em` (agora em Brasília, `AAAA-MM-DDTHH:MM:SS-03:00`), `investido_geral`, `blocos` (na ordem do cadastro, como vieram do `ORDER BY posicao, id` — nunca reordenados), `sem_funil` (sempre presente, sempre depois dos blocos), `totais`, `frescor`, `nota_mql`, `avisos`.
3. `montarTotais`: `investido_geral`; `novos_leads` e `mqls` = soma dos blocos `lead_mql` + "sem funil" (Manual não entra); `compras_realizadas` = do bloco `venda_greenn`.
4. `frescor`: `investimento_atualizado_em` (256), `crm_lido` (true/false), `greenn_ultimo_evento_em` (ISO Brasília do `MAX(received_at)`, ou null).
5. O endpoint não tem mais nenhum dado fixo do protótipo: `CONTRATO_PROTOTIPO` sai do arquivo.

### Edge Cases
- **Nenhum funil ativo:** `blocos: []`, "sem funil" com tudo, aviso "Nenhum funil cadastrado." (primeiro da lista de avisos, junto dos demais avisos que se aplicarem — ex.: vendas sem funil de venda); `totais.compras_realizadas: null`.
- **Sem funil de venda ativo:** `totais.compras_realizadas: null` — não há bloco de venda de onde somar (decisão própria; as vendas seguem visíveis pelo aviso da 263).
- **CRM indisponível:** `totais.novos_leads` e `totais.mqls` null (nunca soma parcial); `frescor.crm_lido: false`.
- **Dia sem dado:** resposta completa, volumes 0, custos null, `sem_funil.vazio: true`, sem erro.
- **Cadastro vigente:** lido a cada consulta, sem cache; mudança vale na seguinte. Mesma consulta sem mudança nos dados → mesma resposta (exceto `gerado_em`, que é a hora da consulta).
- **Período parcial:** `periodo.parcial` e o aviso já vêm da issue 254.

### Cenário de Erro
- **Falha inesperada** (exceção em qualquer leitura do D1 ou na montagem): HTTP 500 com `{ "error": "Não foi possível montar o feedback agora." }`, sem nenhum número; detalhe só no `console.error`. CRM fora do ar continua sendo aviso, não erro (a leitura do CRM não lança).

## Arquivos

- **Criar:** `functions/api/_feedback-marketing-resposta.js` — `AVISO_NENHUM_FUNIL`, `ERRO_FALHA_INESPERADA`, `montarTotais`, `montarResposta` (puros).
- **Criar:** `tests/feedback-marketing-resposta.test.js`
- **Modificar:** `functions/api/feedback-marketing.js` — remove `CONTRATO_PROTOTIPO`, monta por `montarResposta`, `try/catch` com o erro geral, comentário de cabeçalho atualizado.

## Reuso (pesquisado na base)

- `dataHoraIso` (`_feedback-marketing-investimento.js`); `NOTA_MQL` (`_feedback-marketing-mql.js`, só importado); blocos das issues 259–264.

## Checklist

- [x] Ordem do cadastro; "sem funil" por último
- [x] Totais sem números de Manual; null quando a fonte não respondeu
- [x] Frescor: investimento, CRM lido, último evento da Greenn
- [x] "Nenhum funil cadastrado."
- [x] `gerado_em` real em Brasília
- [x] Falha inesperada → 500 com a mensagem, sem números
- [x] Nenhum dado fixo do protótipo no endpoint (grep)
- [x] Testes
- [x] `npm test` passando
