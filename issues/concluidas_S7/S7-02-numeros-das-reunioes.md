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
| SUP-S7-06 | Consultorias antigas do Calendly (antes de 19/10) que passaram sem presença ("fora do registro") aparecem num número próprio "Fora do registro" só quando o período tiver alguma; ficam fora do no-show e das listas, e a soma continua batendo com as criadas | confirmada | usuária, 09/11/2026 |
| SUP-S7-07 | Reuniões da Aplicação Mentoria contam como Sessão Estratégica (regra única de funil da S3: Mentoria é porta da SE); o filtro de funil separa SE dos outros funis (ex.: workshop), não SE de Mentoria | confirmada | usuária, 09/11/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S7-01 | Como calcular o no-show? | respondida | Faltou ÷ (realizada + faltou); cancelada fica fora (usuária, 09/11/2026) |
| PER-S7-02 | Contagens e listas partem das reuniões criadas no período ou das que acontecem no período? | respondida | Criadas no período, como o card da coorte (usuária, 09/11/2026) |
| PER-S7-04 | O que fazer com reunião que passou sem presença marcada? | respondida | Lista própria, fora do no-show (usuária, 09/11/2026) |

## Cenários

### Happy Path
1. A usuária abre a Visão geral (sem `proto=1`) com o filtro em 02/11 a 08/11.
2. O dash já busca a coorte de agendamento (`/api/agenda/coorte`, período e anterior). A resposta passa a trazer o no-show de cada recorte, calculado no servidor.
3. No fim da Visão geral, a seção "Detalhe das reuniões" mostra os cards Criadas 11, Realizadas 1, Faltaram 1, Canceladas 1, A acontecer 8, Sem presença marcada 0 e No-show 50% ("1 de 2"), cada um com o carimbo de variação e o balão com o valor do período anterior.
4. Com o filtro de funil em Sessão Estratégica, os cards mostram só os números desse funil (`por_funil`).

### Edge Cases
- Nenhuma presença marcada (realizada + faltou = 0): no-show "—" com a nota "sem presença marcada"; o carimbo some.
- Período anterior sem reunião (anterior 0): o carimbo some (sem base para variação), o balão mostra 0.
- Funil filtrado sem nenhuma reunião no período: a seção diz "Nenhuma reunião criada no período".
- Período que pega Calendly de antes de 19/10 sem presença: aparece o card "Fora do registro" com a quantidade; sem nenhuma, o card não aparece (SUP-S7-06).
- As listas ainda não aparecem com dados reais (são da S7-03). O protótipo com `proto=1` continua igual.

### Cenário de Erro
- `/api/agenda/coorte` falha (o index já faz `.catch(() => null)`): a seção mostra "Não foi possível carregar as reuniões agora." e o resto da Visão geral segue.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S7-01 | automática | `tests/detalhe-reunioes.test.js` | Com 11 reuniões criadas na semana (1 realizada, 1 faltou, 1 cancelada, 8 marcadas/remarcadas futuras), a seção mostra 11, 1, 1, 1, 8, 0 e a soma das situações dá as criadas |
| CA-S7-02 | automática | `tests/detalhe-reunioes.test.js` | Com 1 realizada, 1 faltou, 1 cancelada, 8 a acontecer e 2 sem presença, o no-show na tela é 50% ("1 de 2") |
| CA-S7-03 | automática | `tests/detalhe-reunioes.test.js` | Sem realizada nem falta, o no-show aparece "—", não 0% |
| CA-S7-09 | automática | `tests/detalhe-reunioes.test.js` | Com reuniões de SE e Aplicação Mentoria, o filtro em SE mostra só os números de SE |
| CA-S7-14 | automática | `tests/detalhe-reunioes.test.js` | Com 11 criadas e 50% agora e 8 criadas e 25% no período anterior, cada card mostra o anterior (8; 25%) e a variação |

## Banco de Dados

Nenhuma mudança: lê `agenda_reunioes` e `calendly_consultorias` pela coorte que já existe.

## Arquivos

- **Modificar:** `functions/api/_reunioes-agendadas.js` — novas `noShow(r)` (faltou ÷ (realizada + faltou) × 100, ou `null` sem base) e `comNoShow(resumo)` (acrescenta `no_show` no total e em cada funil). `resumirCoorte` fica igual, para não mexer no card RA → RR nem nos testes da S4.
- **Modificar:** `functions/api/agenda/coorte.js` — a resposta passa por `comNoShow` (incluído no /execute com aprovação da usuária em 09/11/2026: pôr o campo dentro de `resumirCoorte` quebraria os testes da S4).
- **Modificar:** `public/dash/detalhe-reunioes.js` — `montarNumeros(coorte, fSel)` (escolhe o recorte total ou do funil, monta os cards com valor, anterior e variação; "Fora do registro" só quando houver) e `desenhar(raiz, coorte, fSel, ctx)`; o `prototipo` continua.
- **Modificar:** `public/dash/index.html` — em `R.visao`, sem `proto=1`, chama `DetalheReunioes.desenhar($('#visao-detalhe-reunioes'), coorte, fSel, ctx)` com a coorte que já é buscada; sobe a versão do script (`?v=2026-11-09b`).
- **Criar:** `tests/detalhe-reunioes.test.js` — SQLite real com as migrations da agenda e do Calendly (como `tests/visao-reuniao.test.js`), `coorteDasAgendadas` + `resumirCoorte`, e o desenho de `detalhe-reunioes.js` com contexto falso.

## Dependências Externas

Nenhuma.

## Checklist

- [x] `/api/agenda/coorte` devolve `no_show` no total e por funil (`comNoShow`)
- [x] `montarNumeros` e `desenhar` em `detalhe-reunioes.js`, com "Fora do registro" só quando houver, erro e período vazio
- [x] `R.visao` desenha a seção real sem `proto=1`; versão do script atualizada
- [x] Testes dos critérios em `tests/detalhe-reunioes.test.js`, passando junto com `tests/visao-reuniao.test.js`
