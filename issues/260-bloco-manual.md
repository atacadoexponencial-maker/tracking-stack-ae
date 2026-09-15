# 260: Montar o bloco do tipo Manual

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Montar o bloco do tipo "Manual" apenas com o investimento, marcando leads e custo como não calculados.

## Comportamentos cobertos

- Investido e lista de campanhas do funil
- Novos leads e custo "não calculados" com motivo "contagem manual" — nunca 0 nem estimado
- Sem investimento: investido 0; leads e custo continuam "não calculados"
- A contagem manual não é recebida nem devolvida pela consulta

## Cenários

### Happy Path
1. Para cada funil ativo do tipo `manual` (cadastro inicial: LIVE), `montarBlocoManual` recebe o funil e o investimento do bloco (issue 256).
2. Devolve `nome`, `tipo`, `posicao`, `investido`, `sem_investimento`, `campanhas` (as reconhecidas para o funil), `metricas: { novos_leads: { calculado: false, motivo: 'contagem manual' } }`, `custo_tipo: 'CPL'`, `custo_por_resultado: { calculado: false, motivo: 'contagem manual' }` e `avisos: []`.

### Edge Cases
- **Sem investimento:** `investido: 0`, `sem_investimento: true`, `campanhas: []`; leads e custo continuam "não calculados".
- **CRM indisponível:** não muda nada no bloco (ele não lê o CRM).
- **Cards do CRM com a opção do funil Manual:** já ficam fora de todos os blocos e do "sem funil" (issue 257); o bloco não recebe cards.
- **Contagem manual:** a consulta não recebe nem devolve número; nunca 0 nem estimativa.
- **Objetos independentes:** cada bloco recebe o seu próprio objeto "não calculado" (nenhuma referência compartilhada entre blocos).

### Cenário de Erro
- Nenhum específico: o bloco é derivado só do investimento.

## Arquivos

- **Modificar:** `functions/api/_feedback-marketing-blocos.js` — `MOTIVO_CONTAGEM_MANUAL` e `montarBlocoManual`.
- **Modificar:** `tests/feedback-marketing-blocos.test.js`
- **Modificar:** `functions/api/feedback-marketing.js` — blocos do tipo Manual montados por `montarBlocoManual`.

## Reuso (pesquisado na base)

- `baseDoBloco` (`_feedback-marketing-blocos.js`, issue 259); convenção `{ calculado: false, motivo }` do contrato (issue 234).

## Checklist

- [x] Investido e campanhas do funil
- [x] Leads e custo `{ calculado: false, motivo: 'contagem manual' }`
- [x] Sem investimento: investido 0, ainda não calculados
- [x] Endpoint usa `montarBlocoManual`
- [x] Testes
- [x] `npm test` passando
