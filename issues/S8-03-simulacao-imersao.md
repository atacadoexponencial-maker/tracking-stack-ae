# S8-03: Simulação da Imersão 2027 (projeção até o fim)

**Tipo:** Implementação
**Página:** Imersão 2027 → Simulação
**Spec:** `spec-imersao-2027.md`

## Descrição

Preencher a subaba "Simulação" com a projeção de onde o lançamento termina pelo ritmo
atual, com um campo de ajuste de ritmo que muda a projeção na hora sem gravar nada.

## Pronto quando

A usuária abre a subaba Simulação, vê o ritmo atual, os ingressos e o faturamento
projetados até 05/12 9h30, se a meta é batida e em que dia, e ao mexer no ajuste de ritmo
a projeção muda; zerando o ajuste, volta ao ritmo atual.

## Critérios de aceite

- **CA-S8-28** (automática) — Projeção pelo ritmo atual. Dado 37 ingressos, ritmo atual de 4 ingressos/dia e 10 dias corridos de venda pela frente, quando a Simulação calcula a projeção, então projeta 77 ingressos no fim, diz que a meta não é batida e mostra o ritmo necessário de 6,3/dia.
- **CA-S8-29** (automática) — Ajuste de ritmo. Dado o mesmo cenário do CA-S8-28, quando a pessoa aplica +60% no ritmo, então a projeção vira 101 ingressos, diz que a meta é batida e em que dia, e o ajuste não é gravado para outras pessoas.
- **CA-S8-30** (automática) — Faturamento projetado com o preço de cada lote. Dado ritmo de 4 ingressos/dia, 2 dias restantes no lote de R$ 45 e 3 no de R$ 49, conversão atual do bump de 10%, quando a Simulação calcula o faturamento projetado dos próximos 5 dias, então soma 8 × R$ 45 + 12 × R$ 49 + 20 × 10% × R$ 297 = R$ 1.542, mais o já realizado.
- **CA-S8-32** (manual) — Protótipo aprovado no ar. Dado a tela no ar com os dados de exemplo, quando a usuária abre a Visão geral e a Simulação, então ela aprova o layout e a ordem dos blocos.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S8-02 | A venda de ingressos encerra em 05/12 às 9h30; o pacing conta os dias de venda até lá, incluindo o dia de hoje | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |
| SUP-S8-12 | Dias de venda do pacing e da Simulação vão de hoje até sexta 04/12; o sábado 05/12 (venda até 9h30) só conta quando hoje é 05/12 | confirmada | usuária, 09/11/2026 |
| SUP-S8-10 | Ritmo atual da Simulação = média de ingressos por dia dos últimos 3 dias de venda (ou de todos os dias, se houver menos de 3) | confirmada | usuária, 09/11/2026 (aprovou a spec como escrita) |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S8-02 | O que a Simulação simula? | respondida | Projeção até o fim pelo ritmo atual (usuária, 09/11) |

## Cenários

### Happy Path
1. A usuária clica na subaba "Simulação".
2. O dash busca `GET /api/imersao/simulacao?ajuste=0`. O servidor usa os mesmos dados da Visão geral (exemplo ou reais), calcula o ritmo atual (SUP-S8-10), os dias de venda restantes (SUP-S8-12) e projeta dia a dia: ingressos (ritmo × (1 + ajuste)), preço do lote vigente em cada dia, bump pela conversão atual.
3. A tela mostra: ritmo atual, ritmo necessário, ingressos projetados no fim, "bate a meta em DD/MM" ou "não bate a meta (faltam N)", faturamento projetado (realizado + projeção de ingressos e bump) e a tabela dia a dia.
4. A usuária digita +60 no ajuste de ritmo: a tela pede de novo com `ajuste=60` e redesenha. Nada é gravado.
5. "Voltar ao ritmo atual" zera o ajuste e redesenha.

### Edge Cases
- Ajuste abaixo de -100%: tratado como -100% (ritmo zero).
- Venda encerrada (depois de 05/12 9h30): projeção = realizado, sem dias pela frente.
- Ritmo zero (sem venda): projeção = vendidos agora, meta não batida.

### Cenário de Erro
- Ajuste não numérico: o servidor usa 0.
- Falha ao buscar: "Não foi possível calcular a simulação agora."

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S8-28 | automática | `tests/imersao.test.js` | 37 + 4/dia × 10 dias → 77, não bate, ritmo necessário 6,3 |
| CA-S8-29 | automática | `tests/imersao.test.js` | +60% → 101, bate a meta no 10º dia; um GET sem ajuste continua dando o mesmo de antes |
| CA-S8-30 | automática | `tests/imersao.test.js` | 5 dias (2 a R$ 45, 3 a R$ 49), bump 10% → R$ 1.542 + realizado |
| CA-S8-32 | manual | roteiro abaixo | Usuária aprova o layout e a ordem dos blocos |

### Roteiro manual — CA-S8-32
1. Abrir `#imersao` no ar, com a faixa "dados de exemplo".
2. Percorrer a Visão geral (5 blocos) e a Simulação, mexendo no ajuste de ritmo.
3. A usuária diz se aprova o layout e a ordem dos blocos.

## Banco de Dados

Nenhuma mudança.

## Arquivos

- **Modificar:** `functions/api/_imersao.js` — `ritmoAtual(vendas, agora)` e `projetar({ vendidos, ritmo, ajuste, agora, conversaoBump, realizado })`.
- **Modificar:** `functions/api/imersao/index.js` — exporta a leitura dos dados (exemplo × real) para a simulação reaproveitar.
- **Criar:** `functions/api/imersao/simulacao.js` — `GET /api/imersao/simulacao?key=&ajuste=`.
- **Modificar:** `public/dash/imersao.js` — subaba Simulação: campo de ajuste, botão de voltar, desenho da projeção.
- **Modificar:** `public/dash/index.html` — CSS da Simulação e versão do script.
- **Modificar:** `tests/imersao.test.js` — testes CA-S8-28, CA-S8-29, CA-S8-30.

## Dependências Externas

Nenhuma.

## Checklist

- [ ] `ritmoAtual` e `projetar` em `_imersao.js`
- [ ] `GET /api/imersao/simulacao`
- [ ] Subaba Simulação desenhada em `imersao.js`
- [ ] CSS e versão do script em `index.html`
- [ ] Testes CA-S8-28, CA-S8-29, CA-S8-30 passando

### Depois do commit (fora do checklist: só dá para fazer com o código no ar)

1. Push na main e esperar o deploy.
2. Usuária percorre o roteiro CA-S8-32 e aprova.
