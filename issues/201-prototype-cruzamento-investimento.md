# 201: Protótipo: cruzamento com investimento

**Tipo:** Protótipo
**Página:** Módulo 2 — Cruzamento com investimento

## Descrição

Montar o cruzamento entre cada campanha que vendeu e quanto foi investido nela, produzindo retorno e custo por venda. Sem tela.

## Spec

`spec-greenn-aba-dashboard.md`

## Cenários

### Happy Path
1. Os gastos de `ad_spend` são somados por `campaign_name`, sem recorte de data.
2. Cada campanha é casada com as vendas cujo `utm_campaign` é igual ao nome dela.
3. São calculados receita, vendas, ROAS e custo por venda de cada campanha.

### Edge Cases
- Campanha com gasto e zero venda → aparece com ROAS 0 e custo por venda indisponível.
- Vendas sem campanha → linha própria "sem campanha", com investimento indisponível (não zero).
- Campanha com venda e sem gasto (orgânico) → ROAS indisponível, nunca infinito.
- Divisão por zero em qualquer das duas contas → devolve `null`, e o dashboard desenha `—`.

### Cenário de Erro
Se `ad_spend` estiver vazia, a aba ainda mostra receita e vendas; só os campos de investimento e ROAS vêm `null`, com aviso.

## Decisão de implementação: quais campanhas são "do produto"

A nomenclatura das campanhas do workshop é `ae_vendas-workshop-pago-<data>_<publico>`. O `resolverFunilAuto` de `_funil-campanha.js` olha apenas o **último** segmento (`publico-frio`), então essas campanhas caem em `sem-funil` e não podem ser identificadas por ele.

O conjunto de campanhas do produto é, portanto, a **união** de:
1. campanhas que aparecem nas vendas da Greenn (`utm_campaign`), e
2. campanhas de `ad_spend` cujo nome casa com um padrão declarado numa constante única e comentada no topo do módulo.

Sem o item 2, campanha que gastou e não vendeu sumiria da tela — exatamente o caso que a spec manda mostrar.

## Banco de Dados

Somente leitura. Nenhuma migration, nenhuma coluna nova.

- Tabela `greenn_webhook_event`
  - `event` (TEXT) — filtrar por `saleUpdated`
  - `current_status` (TEXT) — `paid` conta receita; os demais ficam à parte
  - `entity_id` (INTEGER) — id da venda na Greenn
  - `amount` (REAL) — valor em reais
  - `received_at` (INTEGER) — unix seconds
  - `raw_json` (TEXT) — de onde saem comprador (`$.client.name`, `$.client.email`), método (`$.sale.method`), produto (`$.product.name`) e o rastreio (`$.sf_trk`)
- Tabela `checkout_sessions`
  - `trk` (TEXT) — casa com `sf_trk` da venda. **Não** é `event_log.session_id`; cruzar por ali devolve zero.
  - `utm_campaign`, `utm_content`, `utm_source`, `utm_medium` (TEXT) — a atribuição
- Tabela `ad_spend`
  - `campaign_name` (TEXT) — bate **exatamente** com `utm_campaign` das vendas (verificado em 2026-09-01)
  - `spend_cents` (INTEGER), `date` (TEXT), `platform` (TEXT = `meta`)

## Arquivos

- **Criar:** `functions/api/_greenn-metricas.js` — módulo PURO (sem `env.DB`, sem `fetch`, sem `Date.now()`): recebe vendas, sessões de checkout e gastos já lidos e devolve `{ resumo, por_campanha, vendas }` prontos para desenhar. Mesmo contrato de `_cpl-calculo.js` e `_funil-etapas.js`.
- **Criar:** `functions/api/greenn.js` — endpoint `GET /api/greenn?key=...`. Só I/O: valida a chave, faz as três consultas, chama o módulo puro, devolve JSON. Sem `from`/`to`: a aba lê o ciclo inteiro (mesmo padrão de `/api/workshops`).
- **Criar:** `tests/greenn-metricas.test.js` — testes do módulo puro com `node --test`.
- **Modificar:** `public/dash/index.html` — entrada no `#nav`, `<section id="secao-greenn">`, verbete em `TITULOS` e o renderer `R.greenn`.

## Reuso (pesquisado na base)

Importar / usar o que já existe, sem recriar:

- `tabela(el, colunas, linhas, aoClicar)` (`public/dash/index.html:410`) — já entrega ordenação por coluna, escape e estado vazio.
- `tile(k)` (`index.html:~403`) — o cartão de indicador, com suporte a `nota` e `—` para valor ausente.
- `money`, `fmtNum`, `fmtInt`, `esc`, `fetchJson` (`index.html:348-358`).
- O roteador por hash e o `try/catch` de `render()` (`index.html:1353-1363`) — link direto e estado de erro saem de graça ao registrar a seção.
- Padrão de endpoint: `functions/api/cpl.js` (I/O puro + módulo de cálculo separado).
- Padrão de teste: `tests/cpl-calculo.test.js` e `tests/funil-etapas.test.js`.

## Checklist

- [x] Soma de `spend_cents` por `campaign_name` sem filtro de data
- [x] Constante única e comentada com o padrão de nome das campanhas do produto
- [x] União entre campanhas que venderam e campanhas que gastaram
- [x] ROAS e custo por venda devolvem `null` em vez de dividir por zero
- [x] Campanha com gasto e sem venda permanece na lista
- [x] Teste cobrindo: campanha normal, campanha sem venda, venda sem campanha, gasto zero
