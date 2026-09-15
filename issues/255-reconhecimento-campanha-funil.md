# 255: Reconhecer o funil de cada campanha

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Implementar a regra única de reconhecimento campanha→bloco do cadastro, reaproveitando a classificação manual e a regra automática existentes.

## Comportamentos cobertos

- Ordem: (1) classificação manual da aba Meta Ads; (2) trecho de funil ativo; (3) regra automática pelo último segmento, incluindo impulsionamento como `aquisicao`; (4) "sem funil"
- Ligar ao bloco pelo funil do tracking do funil ativo
- Funil do tracking não cadastrado: "sem funil" com motivo "funil <x> não cadastrado no relatório"
- Nome com trecho de dois funis ativos: "sem funil" com motivo "casou com mais de um funil" e aviso geral
- Classificação manual para funil arquivado ou não cadastrado: "sem funil" com o motivo correspondente
- Cada campanha informa como foi reconhecida (manual, trecho, regra automática, impulsionamento)

## Cenários

### Happy Path
1. O endpoint (issue 256) entrega a `reconhecerCampanhasDoPeriodo` os gastos do período já somados por campanha, as classificações manuais (`campaign_funnel_map`), os funis ativos e os funis conhecidos.
2. Cada campanha com investimento passa por `reconhecerCampanha` (`_funis-relatorio-conflitos.js`) — a MESMA função do aviso de conflito da aba — na ordem: (1) classificação manual; (2) trecho do nome de um funil ativo; (3) regra automática pelo último segmento, com impulsionamento = `aquisicao`; (4) nada.
3. Casou com exatamente um bloco → a campanha sai com `bloco_id` e `reconhecida_por` (`manual`, `trecho`, `automatica`, `impulsionamento`).
4. Não casou com exatamente um → `bloco_id: null` e `motivo` para ir ao "sem funil".

### Edge Cases
- **Classificação manual vence o trecho:** `ae_vendas-workshop-pago-23-09_publico-frio` classificada como `sessao-estrategica` vai para SE, não para WO PAGO.
- **Venda na Greenn só pelo trecho (decisão nova, registrada na spec):** o bloco não tem funil do tracking, então classificação manual e regra automática nunca o alcançam; classificação manual para outro funil vence o trecho.
- **Classificação manual para funil sem bloco ativo** (arquivado ou nunca cadastrado, ex.: `workshop`): `bloco_id: null`, motivo "funil workshop não cadastrado no relatório" — mesmo quando o nome contém o trecho de um funil ativo.
- **Funil do tracking reconhecido sem bloco ativo** (ex.: `trafego-atacado`): motivo "funil trafego-atacado não cadastrado no relatório".
- **Nome com o trecho de dois funis ativos:** `bloco_id: null`, motivo "casou com mais de um funil" e aviso geral "A campanha <nome> casou com o trecho de mais de um funil (<A>, <B>) e foi para 'sem funil' — ajuste os trechos no cadastro de funis." Nunca dividida nem atribuída ao primeiro.
- **Nada reconhecido:** motivo "nenhum funil reconhecido".
- **Campanha sem nome:** reconhecida pelo nome vazio (não casa nada, como em `/api/campaign-funnel`) e listada pelo id.
- **Campanha com investimento ≤ 0 no período:** não é listada (mesma regra do aviso de conflito). O dinheiro dela continua no investido geral (issue 256).
- **Sem funil ativo:** toda campanha vai para "sem funil" com o motivo.

### Cenário de Erro
- Sem I/O neste módulo; entrada nula ou vazia devolve `{ campanhas: [], avisos: [] }`.

## Banco de Dados

Não se aplica aqui (as leituras de `ad_spend`, `campaign_funnel_map` e `funis_relatorio` entram no endpoint na issue 256).

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio-conflitos.js` — extrai `reconhecerGastos(gastos, ctx)` (mapa de classificação manual + nome de exibição + filtro de investimento > 0 + `reconhecerCampanha`) e `listarConflitosCampanhas` passa a usá-la, com a mesma saída de hoje. Assim a aba e o endpoint usam a mesma função, sem segunda cópia.
- **Criar:** `functions/api/_feedback-marketing-investimento.js` — puro: `reconhecerCampanhasDoPeriodo(gastos, ctx)` → `{ campanhas: [{ campaign_id, nome, spend_cents, bloco_id, reconhecida_por, motivo }], avisos }`.
- **Criar:** `tests/feedback-marketing-investimento.test.js` — ordem de reconhecimento, manual vence trecho, venda na Greenn só pelo trecho, manual para funil sem bloco, dois trechos com aviso, nada reconhecido, sem nome, sem investimento.
- **Modificar:** `spec-feedback-marketing.md` — decisão 10 em "## Decisões" e a frase "Investido do bloco" do tipo Venda na Greenn (módulo 2).

## Reuso (pesquisado na base)

- `reconhecerCampanha` (`_funis-relatorio-conflitos.js`), que já usa `resolverFunilAuto` (`_funil-campanha.js`).
- Os testes existentes de `tests/funis-relatorio-conflitos.test.js` garantem que a extração não muda o aviso da aba.

## Checklist

- [x] `reconhecerGastos` extraída no módulo de conflitos e usada por `listarConflitosCampanhas`
- [x] Ordem manual → trecho → automática/impulsionamento → nada
- [x] Ligação ao bloco pelo funil do tracking; venda na Greenn só pelo trecho
- [x] Motivos: não cadastrado, mais de um funil, nenhum reconhecido
- [x] Aviso geral para campanha que casa com o trecho de dois funis
- [x] Cada campanha informa `reconhecida_por`
- [x] Decisão 10 e frase do módulo 2 ajustadas na spec
- [x] Testes do módulo puro (e os de conflitos seguem passando)
- [x] `npm test` passando
