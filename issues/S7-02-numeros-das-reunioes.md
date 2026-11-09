# S7-02: Números das reuniões e no-show na Visão geral

**Tipo:** Implementação
**Página:** Visão geral
**Spec:** `spec-detalhe-reunioes.md`

## Descrição

Ligar a linha de números da seção aos dados reais: das reuniões criadas no período do
filtro, quantas foram criadas, realizadas, faltaram, canceladas, a acontecer e sem presença
marcada, o no-show (faltou ÷ (realizada + faltou)) e a comparação com o período anterior,
respeitando o filtro de funil.

## Pronto quando

Na Visão geral no ar, a seção mostra os números e o no-show do período escolhido, com a
variação em relação ao período anterior, e eles mudam ao trocar datas ou funil.

## Critérios de aceite

- **CA-S7-01** (automática) — Os números da seção fecham com o total de criadas. Dado as reuniões criadas em 02–08/11 (1 realizada, 1 faltou, 1 cancelada, 8 marcadas ou remarcadas com horário futuro), quando a seção é montada para esse período, então mostra 11 criadas, 1 realizada, 1 faltou, 1 cancelada, 8 a acontecer, 0 sem presença marcada, e realizadas + faltaram + canceladas + a acontecer + sem presença marcada = criadas.
- **CA-S7-02** (automática) — No-show é faltou sobre realizada mais faltou. Dado um período com 1 realizada, 1 faltou, 1 cancelada, 8 a acontecer e 2 sem presença marcada, quando a seção calcula o no-show, então mostra 50% (1 ÷ 2); cancelada, a acontecer e sem presença marcada não entram na conta.
- **CA-S7-03** (automática) — Sem nenhuma presença marcada o no-show não vira 0%. Dado um período em que nenhuma reunião foi realizada nem teve falta marcada, quando a seção calcula o no-show, então o no-show aparece como "—" (sem base), não como 0%.
- **CA-S7-09** (automática) — Filtro de funil restringe números e listas. Dado reuniões criadas no período nos funis Sessão Estratégica e Aplicação Mentoria, quando o filtro está em Sessão Estratégica, então números e listas mostram só as de Sessão Estratégica.
- **CA-S7-14** (automática) — Números comparados com o período anterior. Dado o período 02–08/11 com 11 criadas e no-show de 50%, e o período anterior (26/10–01/11) com 8 criadas e no-show de 25%, quando a seção é montada para 02–08/11, então cada número mostra o valor anterior e a variação (criadas 11 contra 8; no-show 50% contra 25%), contando no período anterior só as reuniões criadas nele.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S7-01 | A seção segue o filtro de funil da Visão geral, além do de datas | confirmada | usuária, 09/11/2026 |
| SUP-S7-02 | Os números da seção não trazem comparação com o período anterior | invalidada | Compara com o período anterior (CA-S7-14) (usuária, 09/11/2026) |
| SUP-S7-03 | Reuniões que vieram do Calendly (antes da agenda própria) entram nos números e listas com o e-mail quando não houver nome; no reagendamento aparecem só como "remarcada", sem os horários das trocas (o Calendly não guarda o histórico) | confirmada | usuária, 09/11/2026 |
| SUP-S7-05 | A seção fica abaixo do funil e da tabela por funil, no fim da Visão geral | confirmada | usuária, 09/11/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S7-01 | Como calcular o no-show? | respondida | Faltou ÷ (realizada + faltou); cancelada fica fora (usuária, 09/11/2026) |
| PER-S7-02 | Contagens e listas partem das reuniões criadas no período ou das que acontecem no período? | respondida | Criadas no período, como o card da coorte (usuária, 09/11/2026) |
| PER-S7-04 | O que fazer com reunião que passou sem presença marcada? | respondida | Lista própria, fora do no-show (usuária, 09/11/2026) |
