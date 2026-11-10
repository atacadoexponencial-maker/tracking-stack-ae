# S8-04: Resumo e telas de detalhe da Imersão 2027

**Tipo:** Implementação
**Página:** Imersão 2027 → Resumo e subabas de detalhe
**Spec:** `spec-imersao-2027.md` (seção 10, revisão de 10/11)

## Descrição

Trocar a "Visão geral do lançamento" por um Resumo para bater o olho no estado do
lançamento e passar cada bloco do briefing para uma subaba própria, com as metas numa
subaba "Metas".

## Pronto quando

A usuária abre "Imersão 2027" e cai no Resumo, que mostra:
- os cards de estado;
- a projeção em uma linha;
- os alertas;
- o gráfico e a tabela de venda por dia.

Cada subaba de detalhe mostra só o seu bloco, e as metas são gravadas na subaba "Metas".

## Critérios de aceite

- **CA-S8-33** (automática) — Venda por dia no Resumo. Dado um dia com 5 ingressos, R$ 240 faturados (ingressos + bump), 80 visitas na página, previsto de R$ 200 e meta de 4 ingressos para o dia, quando a tela monta o Resumo, então a linha do dia mostra 5 ingressos, R$ 240, conversão de 6,25%, meta do dia de 4 ingressos e atingimento de 120% (com a cor do dia).
- **CA-S8-34** (automática) — Conversão do dia sem visitas. Dado um dia sem visitas registradas na página (ou visitas ainda não ligadas), quando a tela monta o Resumo, então a conversão do dia aparece como "—", sem erro e sem 0%.
- **CA-S8-35** (automática) — Cards de estado do Resumo. Dado 40 ingressos a R$ 39 e 8 bumps (R$ 3.936), R$ 2.080 investidos (CAC de R$ 52), verba de R$ 3.500 com 75% do tráfego (CPA teto de R$ 46,67), meta do bump de 25%, em 20/11 com 15 dias de venda pela frente, quando a tela monta o Resumo, então os cards mostram 40 de 100, R$ 3.936, 4/dia, o CAC ao lado do teto marcado em alerta e o bump de 20% ao lado da meta de 25%.
- **CA-S8-36** (automática) — Projeção em uma linha igual à Simulação. Dado qualquer conjunto de vendas, quando a tela monta o Resumo, então a linha de projeção traz os mesmos ingressos no fim, o mesmo "bate / não bate" e o mesmo dia que a Simulação mostra com ajuste 0.
- **CA-S8-37** (automática) — Alertas do Resumo. Dado o último dia fechado abaixo do previsto, CAC acima do teto antes da reta final, bump abaixo da meta e projeção sem bater a meta, quando a tela monta o Resumo, então aparecem os quatro alertas; e, sem nenhuma dessas situações, aparece "nada fora do previsto".
- **CA-S8-38** (automática) — Cada subaba mostra o seu bloco. Dado a tela aberta, quando a pessoa abre "Ingressos", "Tráfego e página", "Bump", "Evento e pós" e "Metas", então cada uma mostra só o seu conteúdo, e o Resumo não mostra o formulário das metas.
- **CA-S8-39** (manual) — Resumo e telas de detalhe aprovados no ar. Dado a tela no ar com os dados de exemplo, quando a usuária abre o Resumo e passa pelas subabas, então ela consegue dizer o estado do lançamento só pelo Resumo e aprova o layout.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S8-13 | No gráfico, a meta de ingressos do dia = ingressos que faltavam no começo do dia ÷ dias de venda que restavam (a mesma conta do previsto); o atingimento = faturamento realizado ÷ previsto do dia, a mesma base das cores | confirmada | usuária, 10/11/2026 |
| SUP-S8-14 | Alertas do Resumo: (a) o último dia de venda já fechado ficou abaixo do previsto; (b) CAC acima do teto antes da reta final; (c) conversão do bump abaixo da meta; (d) a projeção pelo ritmo atual não bate a meta | confirmada | usuária, 10/11/2026 |
| SUP-S8-15 | Visitas por dia = visualizações da página da Imersão no dia; no modo real ficam "—" até a ligação da página (como as visualizações hoje) | confirmada | usuária, 10/11/2026 |

## Perguntas em aberto

Nenhuma.

## Cenários

### Happy Path
1. A pessoa clica em "Imersão 2027" e cai no Resumo.
2. O Resumo mostra:
   - os 5 cards de estado;
   - a frase da projeção;
   - os alertas (ou "Nada fora do previsto");
   - o gráfico de barras com a marca da meta do dia;
   - a tabela por dia.
3. Ela clica numa subaba de detalhe e vê só aquele bloco, com as mesmas contas de antes.
4. Em "Metas" ela grava as metas, e a tela inteira é recalculada.

### Edge Cases
- Nenhum dia de venda ainda: o gráfico e a tabela dizem "Nenhum dia de venda ainda".
- Meta batida: o card de por dia mostra "Meta batida". Sem previsto, não há alerta de dia nem de projeção.
- Venda encerrada: a frase da projeção some e o card mostra "Venda encerrada".
- Dia sem visitas ou visitas não ligadas: a conversão fica "—".
- Aba guardada com nome antigo ("visao"): cai no Resumo.

### Cenário de Erro
- A API falha: aparece o mesmo aviso de antes ("Não foi possível carregar a Imersão 2027 agora.").

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S8-33 | automática | `tests/imersao.test.js` | Linha do dia: 5 ingressos, R$ 240, 6,25%, meta 4 e 120% em verde forte. A meta do dia na conta real é 100 ÷ 25 = 4 |
| CA-S8-34 | automática | `tests/imersao.test.js` | Visitas null ou 0 → conversão null; a célula mostra "—" e não 0% |
| CA-S8-35 | automática | `tests/imersao.test.js` | Cards: 40 de 100, R$ 3.936, 4/dia, CAC R$ 52 em alerta com teto de R$ 46,67, bump 20% × meta 25% |
| CA-S8-36 | automática | `tests/imersao.test.js` | A projeção do Resumo é igual à de `simular(…, 0)` no exemplo e num caso real; a frase aparece na tela |
| CA-S8-37 | automática | `tests/imersao.test.js` | Os 4 alertas na ordem certa, com texto; no caso sem nada fora, aparece "Nada fora do previsto" |
| CA-S8-38 | automática | `tests/imersao.test.js` | Cada subaba só com o seu `data-im-bloco`; o form das metas só em "Metas"; subabas na ordem; "visao" cai no Resumo |
| CA-S8-39 | manual | roteiro abaixo | A usuária aprova o Resumo e as subabas |

### Roteiro manual — CA-S8-39
1. Abrir `#imersao` no ar, com a faixa "dados de exemplo".
2. Ler só o Resumo e dizer como está o lançamento:
   - vendidos;
   - ritmo;
   - projeção;
   - o que está fora.
3. Passar o mouse nas barras do gráfico: aparecem o dia, os ingressos, a meta do dia e o faturamento.
4. Passar por Ingressos, Tráfego e página, Bump, Evento e pós, Simulação e Metas.
5. A usuária aprova o layout.

## Banco de Dados

Nenhuma mudança.

## Arquivos

- **Modificar:** `functions/api/_imersao.js`:
  - `meta_ingressos` em cada dia;
  - `linhaVendaDia`, `alertasDoResumo` e `montarResumo`;
  - `resumo` na resposta de `calcularVisao`, reaproveitando `simular` para a projeção.
- **Modificar:** `functions/api/_imersao-exemplo.js` — `visitas_por_dia` (soma 960).
- **Modificar:** `functions/api/imersao/index.js` — `visitas_por_dia: null` no modo real.
- **Modificar:** `public/dash/imersao.js`:
  - as 7 subabas;
  - `desenharResumo` com o gráfico SVG;
  - `desenharAba`;
  - metas numa subaba própria.
- **Modificar:** `public/dash/index.html` — CSS do Resumo (gráfico, alertas, projeção) e versão do script.
- **Modificar:** `tests/imersao.test.js`:
  - helper `tela` por subaba;
  - testes CA-S8-33..38.

Documentos ajustados junto, fora da conferência de escopo:
- `spec-imersao-2027.md`: seção 10, SUP-S8-13..15 e o texto das subabas em CA-S8-01, 02 e 25.
- `issues/S8-01-visao-geral-imersao.md`: o mesmo texto nos critérios e nos roteiros.

## Dependências Externas

Nenhuma.

## Checklist

- [x] `resumo` montado no servidor (`_imersao.js`)
- [x] Visitas por dia no exemplo e `null` no modo real
- [x] Subabas, Resumo, gráfico e Metas em `imersao.js`
- [x] CSS e versão do script em `index.html`
- [x] Textos de CA-S8-01, 02 e 25 alinhados na spec e na S8-01
- [x] Testes CA-S8-33..38 passando
