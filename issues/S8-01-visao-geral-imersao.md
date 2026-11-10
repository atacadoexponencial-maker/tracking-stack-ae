# S8-01: Aba Imersão 2027 com a Visão geral do lançamento (dados de exemplo)

**Tipo:** Implementação
**Página:** Imersão 2027 → Visão geral do lançamento
**Spec:** `spec-imersao-2027.md`

## Descrição

Criar a aba "Imersão 2027" no dash, com as subabas no topo, e a subaba "Visão geral do
lançamento" com os 5 blocos do briefing, todos calculados no servidor. Enquanto não houver
venda real, a tela usa dados de exemplo coerentes e mostra a faixa "dados de exemplo".

## Pronto quando

A usuária abre `#imersao` no dash no ar e vê as subabas e os 5 blocos (venda de ingressos,
tráfego e página, order bump, evento, venda depois do evento) com números de exemplo, as
faixas de referência ao lado e a faixa "dados de exemplo" no topo.

## Critérios de aceite

- **CA-S8-01** (manual) — A aba Imersão 2027 abre no Resumo. Dado que a pessoa está logada no dash, quando clica em "Imersão 2027" no menu, então a tela abre com as subabas no topo, com a primeira ("Resumo") selecionada. *(texto revisto em 10/11 junto com a S8-04)*
- **CA-S8-02** (manual) — Trocar de subaba mostra o conteúdo certo. Dado que a tela Imersão 2027 está aberta, quando a pessoa clica em "Simulação" e depois em "Resumo", então cada clique mostra o conteúdo da subaba clicada e marca a subaba como selecionada.
- **CA-S8-03** (automática) — Sem venda real, a tela mostra dados de exemplo com aviso. Dado que não há nenhuma venda de ingresso da Zouti registrada, quando a tela pede os dados do lançamento, então recebe os dados de exemplo marcados como exemplo, e a faixa "dados de exemplo" aparece no topo.
- **CA-S8-04** (automática) — Com a primeira venda real, o aviso some e só entram dados reais. Dado que existe ao menos uma venda de ingresso da Zouti registrada, quando a tela pede os dados do lançamento, então recebe só dados reais, sem a marca de exemplo, e a faixa não aparece.
- **CA-S8-06** (automática) — Indicador sem meta pede a meta. Dado que a verba de anúncios de ingresso está vazia, quando a tela calcula o CPA teto, então o card do CPA teto mostra "defina a meta" em vez de um número.
- **CA-S8-08** (automática) — Ingressos vendidos sobre a meta. Dado 37 ingressos pagos, quando a tela calcula o bloco 1, então mostra "37 de 100" e 37% na barra.
- **CA-S8-09** (automática) — Pacing por dia corrido e por dia útil. Dado 37 ingressos pagos e a venda encerrando em 05/12 às 9h30, quando a tela calcula o pacing num dia com 10 dias corridos e 8 dias úteis de venda pela frente (contando hoje), então mostra 6,3 ingressos/dia corrido (63 ÷ 10) e 7,9 ingressos/dia útil (63 ÷ 8).
- **CA-S8-10** (automática) — Pacing com a meta já batida. Dado 104 ingressos pagos, quando a tela calcula o pacing, então mostra que a meta foi batida, sem pacing negativo.
- **CA-S8-11** (automática) — Previsto do dia calculado pela meta. Dado que faltam 63 ingressos e 10 dias corridos, o lote do dia custa R$ 39 e a meta de conversão do bump é 10%, quando a tela calcula o previsto do dia, então o previsto é 6,3 × R$ 39 + 6,3 × 10% × R$ 297 = R$ 432,81 (sem meta de conversão do bump preenchida, o previsto conta só os ingressos).
- **CA-S8-12** (automática) — Cor do faturamento do dia. Dado um previsto de R$ 400 para o dia, quando o realizado é R$ 480 (20% acima), R$ 410 (até 20% acima) ou R$ 390 (abaixo), então a cor é verde forte, verde claro e vermelho, respectivamente (realizado igual ao previsto conta como verde claro).
- **CA-S8-13** (automática) — Vendas por lote. Dado ingressos vendidos em datas dos lotes 01, 02 e 03, quando a tela calcula as vendas por lote, então cada ingresso conta no lote vigente no momento da compra, os 7 lotes aparecem (os sem venda com zero) e o lote atual vem destacado.
- **CA-S8-14** (automática) — Vendas por origem pela UTM. Dado vendas com UTM de anúncio, de bio/conteúdo, de disparo para a base e sem UTM, quando a tela calcula as vendas por origem, então cada venda cai em tráfego pago, orgânico/conteúdo, base antiga ou outros, com quantidade e %, e a referência "~75% do tráfego" aparece ao lado como referência.
- **CA-S8-15** (automática) — CAC do ingresso e CPA teto. Dado R$ 1.500 investidos em anúncios de ingresso, 30 ingressos vindos do tráfego pago, verba de R$ 5.000 e 75% esperado do tráfego, quando a tela calcula o bloco 2, então o CAC é R$ 50,00 e o CPA teto é R$ 66,67 (5.000 ÷ 75).
- **CA-S8-16** (automática) — Aviso do CAC acima do teto antes da reta final. Dado CAC acima do CPA teto, quando os ingressos vendidos estão abaixo de 60% da meta, então o card do CAC fica em alerta; acima de 70% da meta, o mesmo CAC não fica em alerta (reta final).
- **CA-S8-17** (automática) — Taxas do funil com referência. Dado 200 mil impressões, R$ 4.000 investidos, 2.000 cliques no link, 1.600 visualizações da página, 240 inícios de checkout e 96 compras de ingresso, quando a tela calcula o bloco 2, então CPM = R$ 20,00, CTR = 1,00%, connect rate = 80%, page to checkout = 15%, checkout to compra = 40%, cada uma com a faixa de referência ao lado marcada como referência.
- **CA-S8-18** (automática) — Taxa com denominador zero. Dado zero cliques no link, quando a tela calcula o connect rate, então mostra "—" em vez de erro ou infinito.
- **CA-S8-19** (automática) — Ranking de criativos. Dado três anúncios com 10, 4 e 0 vendas e custos de R$ 300, R$ 80 e R$ 50, quando a pessoa ordena por vendas e depois por custo por venda, então a primeira ordem é 10, 4, 0; a segunda é R$ 20 (4 vendas), R$ 30 (10 vendas) e o anúncio sem venda vai para o fim com "—".
- **CA-S8-20** (automática) — Conversão do bump por dia. Dado um dia com 8 ingressos e 2 bumps, quando a tela calcula a conversão do bump, então mostra 25% naquele dia; dia sem ingresso mostra "—".
- **CA-S8-21** (automática) — Mentoria com bump x sem bump. Dado 20 compradores do bump com 6 mentorias e 80 compradores só de ingresso com 12 mentorias, quando a tela calcula a comparação, então mostra 30% com bump, 15% sem bump e "+100%" de diferença, com a referência 30%–100% ao lado.
- **CA-S8-22** (automática) — Comparecimento pelo Meet. Dado 100 ingressos vendidos e 74 pessoas distintas que entraram no Meet do evento (equipe excluída), quando a tela calcula o bloco 4, então mostra 74% com a referência 70%–80%.
- **CA-S8-23** (automática) — Pico ao vivo no horário da oferta. Dado entradas e saídas do Meet e o horário da oferta gravado como 16h, quando a tela calcula o pico no pitch, então mostra o maior número de pessoas presentes ao mesmo tempo na janela da oferta.
- **CA-S8-24** (automática) — Bloco do evento antes da data. Dado dados reais e a data de hoje antes de 05/12, quando a tela monta o bloco 4, então mostra "disponível a partir de 05/12" no lugar dos números.
- **CA-S8-25** (manual) — Três cards grandes no topo do bloco 5. Dado a subaba "Evento e pós" aberta, quando a pessoa chega ao bloco 5, então vê, antes de qualquer outro número do bloco, três cards grandes: pessoas ao vivo, ticket médio e conversão na Mentoria.
- **CA-S8-26** (automática) — Conversão na Mentoria no dia x 14 dias seguintes. Dado 100 ingressos, 9 mentorias em 05/12, 11 entre 06/12 e 19/12 e 2 depois de 19/12, quando a tela calcula o bloco 5, então mostra 9% no dia, 11% nos 14 dias seguintes e conversão total de 22% (todas as mentorias de compradores do ingresso).
- **CA-S8-27** (automática) — Faturamento total, ticket médio e ROAS. Dado R$ 4.500 em ingressos, R$ 5.940 em bump, R$ 60.000 em Mentoria, 100 compradores e R$ 6.000 investidos em anúncios, quando a tela calcula o bloco 5, então o faturamento total é R$ 70.440, o ticket médio é R$ 704,40 e o ROAS é 11,74.
- **CA-S8-31** (automática) — Dados de exemplo coerentes. Dado o conjunto de dados de exemplo, quando a tela calcula todos os blocos com ele, então nenhuma taxa passa de 100%, compras ≤ inícios de checkout ≤ visualizações ≤ cliques ≤ impressões, e mentorias ≤ compradores de ingresso.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S8-01 | As datas de virada dos lotes são as da tabela já usada pela página (`lotes-imersao`); quando as datas forem confirmadas, a tela segue a mesma tabela | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-02 | A venda de ingressos encerra em 05/12 às 9h30; o pacing conta os dias de venda até lá, incluindo o dia de hoje | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-03 | Dia útil = segunda a sexta, sem descontar feriados | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-04 | Regras de origem pela UTM: tráfego pago = UTM de anúncio; base antiga = UTM de disparo (WhatsApp, e-mail, ManyChat); orgânico/conteúdo = bio, stories, posts; outros = sem UTM ou não reconhecida | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-05 | Investimento "de ingresso" = campanhas do Meta cujo nome identifica a Imersão; investimento total para o ROAS = essas mesmas campanhas | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-06 | Ranking de criativos atribui a venda ao anúncio pela UTM do link (utm_content = anúncio); atualização diária | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-07 | Entre 60% e 70% dos ingressos vendidos, o CAC acima do teto continua em alerta (o relaxamento começa em 70%) | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-08 | Comprador do ingresso e da Mentoria são cruzados por e-mail ou telefone; mentoria de quem não comprou ingresso não entra nas conversões | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-09 | "Pico no pitch" = maior número de presentes simultâneos entre o horário da oferta e 30 min depois | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-12 | Dias de venda do pacing e da Simulação vão de hoje até sexta 04/12; o sábado 05/12 (venda até 9h30) só conta quando hoje é 05/12 | confirmada | usuária, 09/11/2026 |
| SUP-S8-11 | Compras canceladas ou reembolsadas saem de todos os números | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S8-03 | A Zouti é o checkout do ingresso? | respondida | Sim; ingresso, bump e Mentoria vêm da Zouti (usuária, 09/11) |
| PER-S8-04 | De onde vem o previsto de cada dia? | respondida | Calculado pela meta (usuária, 09/11) |
| PER-S8-06 | Limite do verde forte? | respondida | 20% ou mais acima do previsto (usuária, 09/11) |
| PER-S8-07 | Comparecimento e pico ao vivo: como entram? | respondida | Os dois pelo Meet (usuária, 09/11) |
| PER-S8-08 | Como marcar dados fictícios? | respondida | Faixa "dados de exemplo" que some com a primeira venda real (usuária, 09/11) |

## Cenários

### Happy Path
1. A usuária clica em "Imersão 2027" no menu (grupo Resultados) e o dash abre `#imersao`.
2. O topo mostra as subabas "Visão geral do lançamento" (selecionada) e "Simulação"; o filtro de datas some (nota "lançamento inteiro · não usa o filtro de datas").
3. O dash busca `GET /api/imersao`. Sem venda de ingresso paga em `imersao_vendas`, o servidor monta os dados de exemplo (com "hoje" fictício em 26/11 14h), calcula os 5 blocos e devolve `exemplo: true`.
4. A tela mostra a faixa "Dados de exemplo · como se hoje fosse 26/11" e, em ordem: Venda de ingressos, Tráfego e página, Order bump, Evento (05/12), Venda depois do evento (com os 3 cards grandes no topo). Cada indicador com faixa de referência traz o selo "referência".
5. No ranking de criativos, os botões "por vendas" e "por custo por venda" trocam a ordem (as duas ordens já vêm prontas do servidor).
6. "Simulação" mostra, nesta issue, só "em construção" (conteúdo da S8-03).

### Edge Cases
- Indicador cuja meta está vazia (verba, conversão do bump, conversão na Mentoria): mostra "defina a meta". No modo exemplo, a meta vazia é preenchida com um valor de exemplo; meta salva sempre prevalece.
- Denominador zero (sem cliques, sem visualizações, dia sem ingresso): "—".
- Meta de ingressos batida: pacing mostra "meta batida" e nada negativo.
- Venda cancelada ou reembolsada: não entra em nenhum número.
- Dados reais antes de 05/12: blocos 4 e 5 mostram "disponível a partir de 05/12". (No exemplo eles aparecem preenchidos, para a usuária ver o desenho.)
- Dados reais nesta série só trazem as vendas (`imersao_vendas`); tráfego, inícios de checkout, visualizações e Meet ficam "—" até a issue de ligação da Zouti/Meta/Meet (fora desta spec).
- Celular (até 640px): cards em uma coluna, tabelas com rolagem dentro do bloco, sem rolagem lateral da página.

### Cenário de Erro
- `/api/imersao` falha: a tela mostra "Não foi possível carregar a Imersão 2027 agora." e o resto do dash segue.
- Sem a chave do dash: 401, como os outros endpoints.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S8-01 | manual | roteiro abaixo | Aba abre na Visão geral com as duas subabas |
| CA-S8-02 | manual | roteiro abaixo | Trocar de subaba troca o conteúdo e a seleção |
| CA-S8-03 | automática | `tests/imersao.test.js` | Banco sem venda → resposta `exemplo: true` e a tela desenha a faixa "dados de exemplo" |
| CA-S8-04 | automática | `tests/imersao.test.js` | Com 1 ingresso pago no banco → `exemplo: false`, números saem das vendas reais e a faixa não aparece |
| CA-S8-06 | automática | `tests/imersao.test.js` | Verba vazia → CPA teto sem número e o card mostra "defina a meta" |
| CA-S8-08 | automática | `tests/imersao.test.js` | 37 pagos → "37 de 100" e 37% |
| CA-S8-09 | automática | `tests/imersao.test.js` | 37 pagos, hoje 25/11 → 6,3/dia corrido e 7,9/dia útil |
| CA-S8-10 | automática | `tests/imersao.test.js` | 104 pagos → meta batida, sem pacing negativo |
| CA-S8-11 | automática | `tests/imersao.test.js` | Previsto do dia = R$ 432,81 com bump de 10%; só ingressos sem a meta |
| CA-S8-12 | automática | `tests/imersao.test.js` | 480/410/400/390 contra 400 → verde forte, verde claro, verde claro, vermelho |
| CA-S8-13 | automática | `tests/imersao.test.js` | Vendas em lotes 01–03 contam no lote da compra, 7 lotes listados, atual destacado |
| CA-S8-14 | automática | `tests/imersao.test.js` | UTMs de anúncio, bio, disparo e sem UTM caem nas 4 origens com % e referência |
| CA-S8-15 | automática | `tests/imersao.test.js` | CAC R$ 50,00 e CPA teto R$ 66,67 |
| CA-S8-16 | automática | `tests/imersao.test.js` | CAC acima do teto: alerta com 50 e 65 vendidos, sem alerta com 75 |
| CA-S8-17 | automática | `tests/imersao.test.js` | CPM 20, CTR 1%, connect 80%, page→checkout 15%, checkout→compra 40%, cada uma com referência |
| CA-S8-18 | automática | `tests/imersao.test.js` | Zero cliques → connect rate "—" |
| CA-S8-19 | automática | `tests/imersao.test.js` | Ordens 10/4/0 e R$ 20/R$ 30/— |
| CA-S8-20 | automática | `tests/imersao.test.js` | Dia com 8 ingressos e 2 bumps = 25%; dia sem ingresso "—" |
| CA-S8-21 | automática | `tests/imersao.test.js` | 30% com bump, 15% sem, "+100%", referência 30–100% |
| CA-S8-22 | automática | `tests/imersao.test.js` | 74 pessoas distintas / 100 = 74% com referência 70–80% |
| CA-S8-23 | automática | `tests/imersao.test.js` | Pico de presentes simultâneos entre 16h e 16h30 |
| CA-S8-24 | automática | `tests/imersao.test.js` | Dados reais em 20/11 → bloco 4 "disponível a partir de 05/12" |
| CA-S8-25 | manual | roteiro abaixo | 3 cards grandes no topo do bloco 5 |
| CA-S8-26 | automática | `tests/imersao.test.js` | 9% no dia, 11% nos 14 dias, 22% no total |
| CA-S8-27 | automática | `tests/imersao.test.js` | Faturamento R$ 70.440, ticket R$ 704,40, ROAS 11,74 |
| CA-S8-31 | automática | `tests/imersao.test.js` | Exemplo: nenhuma taxa > 100%, funil em ordem decrescente, mentorias ≤ compradores |

### Roteiro manual — CA-S8-01
1. Abrir o dash no ar e clicar em "Imersão 2027" no menu.
2. Ver as subabas no topo (Resumo, Ingressos, Tráfego e página, Bump, Evento e pós, Simulação, Metas), com "Resumo" marcada.

### Roteiro manual — CA-S8-02
1. Na tela Imersão 2027, clicar em "Simulação": o conteúdo troca e a subaba fica marcada.
2. Clicar em "Resumo": o Resumo volta e a subaba fica marcada.

### Roteiro manual — CA-S8-25
1. Abrir a subaba "Evento e pós" e rolar até "Venda depois do evento".
2. Os primeiros elementos do bloco são três cards grandes: Pessoas ao vivo, Ticket médio e Conversão na Mentoria.

## Banco de Dados

Migration `migrations/0070_imersao.sql`:

- Tabela: `imersao_vendas` (alimentada pela futura ligação da Zouti; nesta série só é lida)
  - `id` (TEXT, PK) — id da compra na Zouti
  - `produto` (TEXT) — `ingresso` | `bump` | `mentoria`
  - `valor_centavos` (INTEGER) — valor pago
  - `pago_em` (INTEGER) — unix da aprovação
  - `email` (TEXT), `telefone` (TEXT) — para cruzar ingresso × Mentoria
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` (TEXT) — origem e criativo
  - `situacao` (TEXT, padrão `paga`) — `paga` | `cancelada` | `reembolsada`
  - `criado_em` (INTEGER)
  - índice em `(produto, situacao)`
- Tabela: `imersao_metas`
  - `campo` (TEXT, PK) — `verba_ingresso`, `pct_trafego`, `meta_bump`, `meta_mentoria`, `horario_oferta`
  - `valor` (TEXT) — número ou "HH:MM"
  - `alterada_em` (INTEGER)

## Arquivos

- **Criar:** `migrations/0070_imersao.sql` — as duas tabelas acima.
- **Criar:** `functions/api/_imersao.js` — regras e contas puras (sem banco): constantes (meta 100, bump R$ 297, fim da venda, dia do evento, faixas de referência), `diasDeVenda(agora)` (corridos e úteis, SUP-S8-12), preço e lote da venda reaproveitando `loteVigente` de `src/data/lotes-workshop.js` com `LOTES_IMERSAO` de `src/data/lotes-imersao.js`, `origemDaVenda` (reaproveita `canalDeLead` de `functions/api/_canal.js` e refina "outro" por `utm_source`/`utm_medium`), cruzamento de pessoa (e-mail ou `variantesTelefone` de `functions/_telefone.js`), `corDoDia`, `picoNaJanela`, e `calcularVisao(dados, metas, agora, { exemplo })` que devolve os 5 blocos prontos para desenhar (valores, "defina a meta", alertas, as duas ordens do ranking).
- **Criar:** `functions/api/_imersao-exemplo.js` — `dadosDeExemplo()` determinístico (vendas de 09/11 a 26/11 nos lotes 01–05, bump, Mentoria em 05/12 e nos 14 dias seguintes, tráfego, anúncios, Meet), `METAS_EXEMPLO` e `AGORA_EXEMPLO` = 26/11/2026 14h.
- **Criar:** `functions/api/imersao/index.js` — `GET /api/imersao?key=`: autoriza com `DASH_KEY` (padrão de `functions/api/metas/index.js`), lê `imersao_metas` e as vendas pagas; sem ingresso pago usa o exemplo; responde `calcularVisao(...)`.
- **Criar:** `public/dash/imersao.js` — `window.Imersao.abrir(raiz, ctx)` (padrão IIFE de `arvore.js`): subabas, faixa de exemplo, desenho dos 5 blocos e troca de ordem do ranking; nenhuma conta, só desenho do que o servidor mandou.
- **Modificar:** `public/dash/index.html` — link "Imersão 2027" no grupo Resultados do menu; `<section class="secao" id="secao-imersao">`; `<script src="/dash/imersao.js?v=...">`; `R.imersao` chamando `Imersao.abrir` com `{ esc, fmtInt, fmtPct, fmtNum, money, fetchJson }`; `TITULOS.imersao` e `FILTROS.imersao` (nota, sem período); bloco CSS `.im-*` com a quebra de 640px.
- **Criar:** `tests/imersao.test.js` — contas de `_imersao.js`, endpoint contra SQLite real com a migration 0070 (padrão `tests/detalhe-reunioes.test.js` + `tests/_fluxos-banco.js`) e desenho de `imersao.js` com contexto falso.

## Dependências Externas

Nenhuma.

## Checklist

- [x] Migration `0070_imersao.sql` criada e aplicada no D1 remoto antes do commit (`wrangler d1 execute tracking-ae-db --remote --file migrations/0070_imersao.sql`; só cria tabelas vazias, não depende do código no ar)
- [x] `_imersao.js` com as contas dos 5 blocos
- [x] `_imersao-exemplo.js` com dados coerentes e "hoje" fictício
- [x] `GET /api/imersao` escolhendo exemplo × real
- [x] `public/dash/imersao.js` desenhando subabas, faixa e blocos
- [x] Menu, seção, script, `R.imersao`, título, filtro e CSS em `index.html`
- [x] Testes dos critérios em `tests/imersao.test.js` passando

### Depois do commit (fora do checklist: só dá para fazer com o código no ar)

1. Push na main e esperar o deploy do Pages terminar.
2. Conferir no ar os roteiros manuais CA-S8-01, CA-S8-02 e CA-S8-25.
