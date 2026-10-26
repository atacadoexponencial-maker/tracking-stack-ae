# S4-05: Níveis de qualificação da Sessão Estratégica

**Tipo:** Implementação
**Página:** Visão geral — níveis de qualificação
**Spec:** `spec-visao-geral-reuniao-semanal.md`

## Descrição

Bloco na Visão geral que separa os leads novos da Sessão Estratégica em Abaixo de R$ 20 mil,
Acima de R$ 20 mil e Não informado (quantidade e %), com a mesma leitura de faturamento do
MQL. Workshop e outros funis ficam de fora; com o filtro em outro funil, o bloco some.

## Pronto quando

Na Visão geral da semana passada, o bloco mostra as três faixas dos leads novos de SE e a
soma bate com o total de leads novos de SE.

## Critérios de aceite

- **CA-S4-11** (automática) — Leads novos de SE separados por faixa de faturamento. Dado no período 5 leads novos de SE (2 com "até R$ 20 mil", 2 com "R$ 50 mil" e 1 sem faturamento) e 3 leads novos do workshop, quando a Visão geral abre, então o bloco mostra Abaixo de R$ 20 mil 2 (40%), Acima de R$ 20 mil 2 (40%), Não informado 1 (20%), e os leads do workshop não entram.
- **CA-S4-12** (automática) — Faixa usa a mesma leitura de faturamento do MQL. Dado cards com faturamento escrito de formas diferentes ("menos de 20 mil", "20k", "R$ 35.000", "entre 50 e 100 mil"), quando o bloco classifica as faixas, então cada card cai na mesma faixa que a régua do MQL usa hoje (abaixo para os dois primeiros, acima para os dois últimos).
- **CA-S4-13** (automática) — Bloco some com filtro de funil que não é SE. Dado o filtro do topo no funil workshop, quando a Visão geral abre, então o bloco de níveis de qualificação não aparece.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S4-04 | Níveis de qualificação mostram três faixas, incluindo "Não informado", para a soma bater com o total de leads novos de SE. | confirmada | Usuária, 26/10/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S4-02 | Níveis de qualificação valem para quais leads? | respondida | Só leads de Sessão Estratégica; workshop não informa faturamento (usuária, 26/10/2026) |

## Cenários

### Happy Path
1. Quando o CRM responde, o backend separa os cards novos do funil Sessão Estratégica (mesmos cards dos leads novos de SE) pelo faturamento: acima de R$ 20 mil (mesma régua do MQL, sem olhar o status), abaixo de R$ 20 mil (faturamento com número ou faixa "até/menos de 20 mil") e não informado (vazio ou sem número).
2. A Visão geral mostra o bloco com as três faixas, quantidade, % e o total.

### Edge Cases
- Filtro do topo em outro funil: o bloco não aparece. Em "Todos os funis" ou em Sessão Estratégica, aparece.
- Nenhum lead novo de SE: o bloco aparece com "Nenhum lead novo de Sessão Estratégica no período".
- Enquanto o CRM não responde, o bloco não aparece (só depois da leitura).

### Cenário de Erro
- CRM fora do ar: o bloco aparece com "sem dados do CRM".

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S4-11 | automática | `tests/visao-reuniao.test.js` | 5 leads novos de SE (2 até 20 mil, 2 de 50 mil, 1 vazio) e 3 do workshop viram 2 (40%), 2 (40%), 1 (20%), sem o workshop |
| CA-S4-12 | automática | `tests/visao-reuniao.test.js` | "menos de 20 mil" e "20k" caem em abaixo; "R$ 35.000" e "entre 50 e 100 mil" em acima |
| CA-S4-13 | automática | `tests/visao-reuniao.test.js` | com o filtro no workshop o bloco não aparece |

## Banco de Dados

Não se aplica (lê os cards do CRM).

## Arquivos

- **Modificar:** `functions/api/_feedback-marketing-mql.js` — `faixaDeFaturamento(card)`: 'acima' | 'abaixo' | 'nao_informado', reaproveitando `faturamentoAcimaDe20Mil`, `valoresDeDinheiro` e os padrões de "até R$ 20 mil".
- **Modificar:** `functions/api/feedback-marketing.js` — opção `contarFaixas`: cada bloco de lead ganha `faixas` `{ abaixo, acima, nao_informado }`.
- **Modificar:** `functions/api/agenda/taxas.js` — `lerCrm` soma `faixas` por funil; cada recorte ganha `qualificacao` (`{ abaixo, acima, nao_informado, total }` do funil `sessao-estrategica`, ou null sem CRM) e `qualificacao_funil`.
- **Modificar:** `public/dash/visao-reuniao.js` — `montarNumeros` devolve `qualificacao` só sem filtro ou com o filtro no funil da qualificação.
- **Modificar:** `tests/visao-reuniao.test.js` — testes CA-S4-11 a 13.

## Dependências Externas

Nenhuma.

## Checklist

- [x] `faixaDeFaturamento` e `faixas` no relatório
- [x] `qualificacao` na resposta de `/api/agenda/taxas`
- [x] Bloco só sem filtro ou em SE
- [x] Testes CA-S4-11 a 13
