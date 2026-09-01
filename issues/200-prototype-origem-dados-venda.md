# 200: Protótipo: origem dos dados de venda

**Tipo:** Protótipo
**Página:** Módulo 1 — Origem dos dados de venda

## Descrição

Montar a leitura das vendas do produto da Greenn a partir do que já está guardado, com a atribuição de origem de cada uma. Sem tela: é a base que alimenta o resto da aba.

## Spec

`spec-greenn-aba-dashboard.md`

## Cenários

### Happy Path
1. O endpoint lê as vendas de `greenn_webhook_event` e as sessões de `checkout_sessions`.
2. Cada venda é casada com sua sessão pelo `sf_trk` → `trk`.
3. Vendas de teste interno saem do conjunto.
4. O módulo puro devolve a lista de vendas com atribuição, pronta para agregar.

### Edge Cases
- Venda sem `sf_trk` no payload → entra como "sem campanha", nunca é descartada.
- `sf_trk` presente mas sem linha correspondente em `checkout_sessions` → idem.
- Sessão encontrada com UTMs vazias (visita direta) → "sem campanha".
- `raw_json` malformado numa linha → aquela linha é ignorada com log, as demais seguem.
- Status diferente de `paid` (reembolso, recusa) → contado à parte, fora da receita.

### Cenário de Erro
Falha na consulta ao banco devolve HTTP 500 com `{ error }`; o dashboard cai no estado de erro já existente. Nunca devolver zeros como se fossem dado real.

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

- [ ] `_greenn-metricas.js` recebe `{ vendas, sessoes, gastos }` e não toca em I/O
- [ ] Casamento `sf_trk` → `trk` implementado no módulo puro
- [ ] `raw_json` parseado com try/catch por linha
- [ ] Venda sem atribuição entra como `sem-campanha`
- [ ] Vendas não pagas separadas da receita
- [ ] Teste cobrindo venda com UTM, venda sem `sf_trk` e `sf_trk` órfão
