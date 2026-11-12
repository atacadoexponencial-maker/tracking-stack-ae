# S9-01: Funil da Visão geral só com leads novos (RC e RC realizada)

**Tipo:** Implementação
**Página:** Visão geral do dash, funil do topo e tabela "Por funil"
**Spec:** `spec-funil-leads-novos.md`

## Descrição

O funil da Visão geral troca "Reunião agendada" e "Reunião realizada" por RC (reunião
criada por lead novo) e RC realizada, com as taxas MQL → RC e RC → RR e os custos por RC
e por RC realizada. Lead antigo que agenda deixa de entrar no funil.

## Pronto quando

A Visão geral no ar mostra o funil Leads novos → MQL → SQL → RC → RC realizada; na semana
de 09 a 15/11/2026 o lead antigo que agendou em 11/11 não aparece em nenhuma faixa e a
lead nova do ManyChat conta como MQL e RC em Aquisição.

## Critérios de aceite

- **CA-S9-01** (automática) — O funil mostra RC e RC realizada no lugar de Reunião agendada e realizada. Dado a Visão geral aberta, quando a tela termina de carregar, então as faixas são, nesta ordem, Leads novos, MQL, SQL, RC e RC realizada; a faixa RC traz a legenda "reunião criada por lead novo"; e não existe faixa "Reunião agendada".
- **CA-S9-02** (automática) — Lead antigo que agenda não entra no funil. Dado um período com 1 lead novo que agendou reunião e 1 lead com card criado antes do período que também agendou no período, quando a Visão geral abre, então RC mostra 1.
- **CA-S9-03** (automática) — Lead novo que não é MQL e agenda conta na RC, com observação. Dado um período com 3 leads novos que agendaram, sendo 2 MQL e 1 não MQL, quando a Visão geral abre, então RC mostra 3 e a faixa traz a observação "1 de lead não MQL".
- **CA-S9-04** (automática) — Sem lead não MQL, a observação não aparece. Dado um período em que todas as RC são de MQL, quando a Visão geral abre, então a faixa RC não mostra observação de lead não MQL.
- **CA-S9-05** (automática) — Lead novo que agenda depois do fim do período conta na RC do período em que chegou. Dado um lead com card criado no último dia do período que agenda a reunião dois dias depois do fim do período, quando a Visão geral abre naquele período, então RC mostra 1.
- **CA-S9-06** (automática) — Reunião cancelada não conta como RC. Dado um lead novo cuja única reunião foi cancelada, quando a Visão geral abre, então RC mostra 0.
- **CA-S9-07** (automática) — RC realizada conta só as reuniões dos leads novos. Dado um período com 2 leads novos com reunião (1 realizada, 1 com falta) e 1 lead antigo com reunião realizada no período, quando a Visão geral abre, então RC realizada mostra 1.
- **CA-S9-08** (automática) — Taxas MQL → RC e RC → RR. Dado um período com 12 MQLs novos, 6 desses MQLs com reunião, 1 lead novo não MQL com reunião, e das 7 RC: 3 realizadas, 2 faltas e 2 ainda por acontecer, quando a Visão geral abre, então aparecem MQL → RC 50% ("6 de 12") e RC → RR 60% ("3 de 5"), e o quadro RC → RR avisa que 2 ainda vão acontecer.
- **CA-S9-09** (automática) — Custo por RC e por RC realizada. Dado um período com R$ 300 investidos nos funis que agendam reunião, 5 RC e 3 RC realizadas, quando a Visão geral abre, então a faixa RC mostra custo de R$ 60,00 e a faixa RC realizada, R$ 100,00.
- **CA-S9-10** (automática) — Filtro de funil vale para RC e RC realizada. Dado um período com 4 RC na Sessão Estratégica e 1 RC no workshop, quando a pessoa filtra pelo funil workshop, então RC mostra 1; e sem filtro, a tabela "Por funil" mostra 4 na linha da Sessão Estratégica e 1 na linha do workshop, nas colunas RC, RC realizada, Custo por RC, Custo por RR, MQL → RC e RC → RR.
- **CA-S9-11** (automática) — CRM fora do ar não derruba a tela. Dado o CRM sem responder, quando a Visão geral abre, então as faixas MQL, SQL, RC e RC realizada mostram "sem dados do CRM", e Leads novos, investimento, leads e CPL aparecem com os números.
- **CA-S9-12** (automática) — Números do funil comparados com o período anterior. Dado 4 RC no período e 2 no período anterior, quando a Visão geral abre, então a faixa RC mostra 4 com a variação de 100% para cima, pela mesma régua nos dois períodos.
- **CA-S9-13** (manual) — O caso real de 11/11 fecha. Dado a Visão geral no ar, no período de 09/11 a 15/11/2026, quando a Marcelle abre a tela sem filtro e depois filtrada por Sessão Estratégica e por Aquisição, então o lead antigo que agendou em 11/11 (Lucas) não aparece em nenhuma faixa do funil, e a lead nova do ManyChat (Amanda Michella) conta como 1 MQL e 1 RC em Aquisição.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S9-01 | RC conta todo lead novo que agendou, MQL ou não, de qualquer funil; a taxa MQL → RC olha só os MQLs. | confirmada | Marcelle, 12/11/2026 |
| SUP-S9-02 | Lead novo = card criado no CRM dentro do período, a mesma régua do MQL e do SQL. | confirmada | Marcelle, 12/11/2026 |
| SUP-S9-03 | Lead novo que agenda depois do fim do período conta na RC do período em que chegou; por isso a RC de uma semana já fechada pode subir depois. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-04 | A observação da RC é automática ("N de lead não MQL"); não há campo para escrever à mão. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-05 | "Agendou" na RC segue a regra de hoje do MQL → RA: reunião comercial da agenda própria que não é de teste nem cancelada (inclui a marcada pelo time), ou consultoria ativa do Calendly agendada pelo próprio lead. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-06 | Lead novo com mais de uma reunião conta uma vez; vale a situação mais avançada: realizada, depois a acontecer, depois sem presença, depois faltou. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-07 | O funil da RC é o funil do card no CRM (o mesmo do MQL): lead do ManyChat com opção Sessão Estratégica conta em Aquisição. No Detalhe, o funil da reunião continua sendo o do lead pelo e-mail, como hoje. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-08 | Card novo com opção de funil não cadastrada no relatório ("sem funil") fica fora da RC, como já fica fora do MQL e do SQL. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-09 | No total sem filtro, o custo por RC e por RC realizada usa o investimento dos funis que agendam reunião, como o custo por reunião de hoje. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |
| SUP-S9-13 | Semana já fechada pode levar até 1 hora para mostrar no funil uma presença recém-marcada (a leitura do CRM fica guardada por 1 hora); o Detalhe mostra na hora. | confirmada | Marcelle, 12/11/2026 (aprovação da spec) |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S9-01 | Lead não MQL que agenda entra na RC? | respondida | Sim, se for lead novo, junto com os demais e com observação (Marcelle, 12/11/2026) |
| PER-S9-02 | O nome da métrica nova é RC (Reunião criada)? | respondida | Sim, sugestão da própria Marcelle (12/11/2026) |

## Cenários

### Happy Path
1. A Visão geral abre e pede `/api/agenda/taxas` para o período e o anterior.
2. O servidor lê os cards criados no período no CRM (a leitura que já existe), guarda o e-mail de cada card novo com a marca de MQL e procura a reunião de cada e-mail agendada a partir do início do período.
3. Para cada funil do CRM e no total, a resposta traz `rc`, `rc_nao_mql`, `rc_realizada`, `rc_faltou`, `rc_sem_presenca`, `rc_a_acontecer` e `rc_fora_do_registro`.
4. A tela desenha as faixas Leads novos, MQL, SQL, RC e RC realizada, as taxas Lead → MQL, MQL → RC e RC → RR e os custos, tudo comparado ao período anterior.

### Edge Cases
- Lead antigo (card criado antes do período) que agenda: o card não vem na leitura do período, então não entra.
- Lead novo que agenda depois do fim do período: conta (a busca da reunião não tem limite no fim).
- Lead novo com mais de uma reunião: conta uma vez, pela situação mais avançada (realizada, a acontecer, sem presença, faltou).
- Reunião cancelada, de teste ou do Calendly marcada pela equipe: não conta como "agendou".
- Dois cards novos com o mesmo e-mail: contam duas vezes, como já acontece no MQL → RA.
- Card novo sem e-mail: não tem como casar com reunião, não conta.
- Calendly de antes de 19/10 sem presença: fica fora do RC → RR, com o aviso de hoje.
- Filtro num funil sem MQL (workshop): MQL e MQL → RC mostram "só Sessão Estratégica e Aquisição"; RC e RC realizada mostram o número.

### Cenário de Erro
- CRM fora do ar: MQL, SQL, RC e RC realizada mostram "sem dados do CRM"; as três taxas também.
- CRM ainda lendo: as mesmas faixas mostram "lendo o CRM…".
- Tabela do Calendly com erro: a RC conta só a agenda própria, sem derrubar a tela.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S9-01 | automática | `tests/visao-reuniao.test.js` | as cinco faixas na ordem, a legenda da RC e a ausência de "Reunião agendada" |
| CA-S9-02 | automática | `tests/visao-reuniao.test.js` | com 1 lead novo e 1 antigo agendando no período, RC = 1 (banco real + CRM simulado) |
| CA-S9-03 | automática | `tests/visao-reuniao.test.js` | 2 MQL + 1 não MQL com reunião: RC = 3 e a observação "1 de lead não MQL" na faixa |
| CA-S9-04 | automática | `tests/visao-reuniao.test.js` | só MQL com reunião: nenhuma observação de lead não MQL |
| CA-S9-05 | automática | `tests/visao-reuniao.test.js` | card do último dia que agenda dois dias depois do período: RC = 1 |
| CA-S9-06 | automática | `tests/visao-reuniao.test.js` | lead novo só com reunião cancelada: RC = 0 |
| CA-S9-07 | automática | `tests/visao-reuniao.test.js` | 2 novos (realizada e falta) e 1 antigo com realizada: RC realizada = 1 |
| CA-S9-08 | automática | `tests/visao-reuniao.test.js` | MQL → RC 50% "6 de 12", RC → RR 60% "3 de 5" e o aviso "2 a acontecer" |
| CA-S9-09 | automática | `tests/visao-reuniao.test.js` | R$ 300, 5 RC e 3 realizadas: custos R$ 60,00 e R$ 100,00 |
| CA-S9-10 | automática | `tests/visao-reuniao.test.js` | filtro no workshop mostra RC 1; sem filtro, a tabela traz 4 e 1 e as seis colunas novas |
| CA-S9-11 | automática | `tests/visao-reuniao.test.js` | sem CRM: MQL, SQL, RC e RC realizada com "sem dados do CRM"; Leads novos e lateral com número |
| CA-S9-12 | automática | `tests/visao-reuniao.test.js` | RC 4 contra 2: variação de 100% para cima na faixa |
| CA-S9-13 | manual | roteiro abaixo | Lucas fora do funil; Amanda como 1 MQL e 1 RC em Aquisição |

### Roteiro manual — CA-S9-13
1. Abra o dash na Visão geral e escolha o período de 09/11 a 15/11/2026, sem filtro de funil.
2. Filtre por Sessão Estratégica: a faixa RC não deve contar a reunião do Lucas (agendada em 11/11 às 22h34).
3. Filtre por Aquisição: MQL deve contar a Amanda Michella e RC deve contá-la também (reunião em 13/11 às 16h).
4. No Detalhe das reuniões, mais abaixo, as duas reuniões continuam aparecendo.

## Arquivos

- **Modificar:** `functions/api/feedback-marketing.js` — com `emailsMql`, cada bloco de lead ganha também `emails_novos` (e-mail e marca de MQL de cada card novo).
- **Modificar:** `functions/api/_reunioes-agendadas.js` — função nova `reuniaoPorEmail` (situação da reunião de cada e-mail agendada desde o início do período), reutilizando `statusNaCoorte`.
- **Modificar:** `functions/api/agenda/taxas.js` — `lerCrm` e `numerosDoCrm` passam a devolver os números da RC por funil e no total.
- **Modificar:** `public/dash/visao-reuniao.js` — faixas RC e RC realizada, taxas MQL → RC e RC → RR, custos e colunas da tabela, lendo a RC de `/api/agenda/taxas`.
- **Modificar:** `public/dash/index.html` — marca de versão nova no pedido de `/api/agenda/taxas` (resposta antiga guardada não traz a RC) e no script da tela.
- **Modificar:** `tests/visao-reuniao.test.js` — testes dos critérios CA-S9-01 a 12 e ajuste dos testes da S4 que conferiam a régua antiga de reunião.

## Checklist

- [x] `emails_novos` em cada bloco de lead do relatório quando as taxas pedem
- [x] `reuniaoPorEmail` com a mesma seleção de `emailsComReuniao` e a prioridade de situação
- [x] `lerCrm` conta `rc`, `rc_nao_mql` e as situações por funil
- [x] `numerosDoCrm` leva os números da RC para `crm` e `crm_total`
- [x] Funil com RC e RC realizada, observação de lead não MQL e custos
- [x] Taxas MQL → RC e RC → RR dependendo do CRM
- [x] Tabela "Por funil" com as colunas novas
- [x] Marca de versão nova no pedido das taxas e no script
- [x] Testes CA-S9-01 a 12 e ajuste dos testes antigos
