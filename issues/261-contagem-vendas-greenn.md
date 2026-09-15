# 261: Contar compras realizadas na Greenn

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Contar as vendas pagas no período pela atualização mais recente de cada venda, reaproveitando as regras da aba Greenn.

## Comportamentos cobertos

- Todas as vendas cuja atualização mais recente é paga e que foram pagas no período (Brasília), qualquer origem
- Venda notificada várias vezes conta uma vez
- Paga e depois estornada/reembolsada não conta; aguardando, recusada ou cancelada não conta
- Teste interno (lista de e-mails da aba Greenn) não conta
- Notificação ilegível: não conta e gera aviso "N registros da Greenn não puderam ser lidos."
- Nenhum evento da Greenn desde antes do início do período: aviso "Nenhum evento da Greenn desde <data>."
- Compra atribuída pelo Meta não é usada em nenhum número

## Cenários

### Happy Path
1. O endpoint calcula `limitesDoPeriodoUnix` (issue 254) e, em paralelo com as demais leituras, chama `lerVendasGreennDoPeriodo(env.DB, limites)`.
2. Leitura 1 — vendas candidatas: `entity_id` distintos com uma atualização `saleUpdated` **paga** recebida em `[desde, ate)`, pelo índice `idx_greenn_recebido`.
3. Leitura 2 — histórico completo SÓ dessas vendas: todas as linhas `saleUpdated` com `entity_type = 'sale'` e `entity_id` na lista, em lotes de 50 (`IN (?, …)`, pelo índice `idx_greenn_entidade`; conferido com EXPLAIN no D1 remoto — a forma com `json_each` varria a tabela).
4. Leitura 3 — `MAX(received_at)` da tabela inteira (índice coberto), para o frescor e o aviso de silêncio.
5. `contarComprasDoPeriodo({ linhas, limites })` (puro): `reduzirPorVenda` (reuso da aba Greenn) → última atualização de cada venda; payload ilegível → soma em `ilegiveis`; `ehTesteInterno(email)` → fora; status da última ≠ `paid` → fora; **data da venda** = `received_at` da PRIMEIRA atualização paga da venda; conta se essa data está em `[desde, ate)`.
6. Devolve `{ compras: [{ entity_id, pago_em, trk }], ilegiveis }`.

### Decisão: data da venda
- A data da venda é a **primeira** atualização `paid` recebida (relógio nosso, `received_at`), recortada pelo dia de Brasília. A Greenn reemite o `paid` quando a venda é editada (novo `updated_at`, linha nova): usar a última atualização faria a venda "andar" para o dia da reemissão e contar em dois períodos consultados em momentos diferentes. A primeira paga é fixa.
- O status é o da atualização mais recente **no momento da consulta** (mesma regra da aba Greenn): estorno depois do fim do período tira a venda do período se ele for consultado de novo.
- Em vez de "margem antes do início" por `received_at`, o histórico é lido pela venda (índice `idx_greenn_entidade`): é exato (acha a última atualização e a primeira paga, estejam onde estiverem) e só lê as linhas das vendas pagas no período.

### Edge Cases
- **Mesma venda notificada várias vezes** (paid repetido): conta uma vez (`reduzirPorVenda`).
- **Paga antes do período e reemitida dentro dele:** a primeira paga está fora → não conta neste período.
- **Paga e depois estornada/reembolsada** (última ≠ `paid`): não conta. Aguardando, recusada, cancelada: nunca foram candidatas ou a última não é paga → não conta.
- **Teste interno** (`EMAILS_TESTE_INTERNO`): não conta em nada, nem no aviso de ilegíveis.
- **Última atualização com payload ilegível:** não conta; aviso "N registros da Greenn não puderam ser lidos." (N > 0).
- **Nenhum evento da Greenn desde antes do início** (`MAX(received_at) < desde`): compras normais (podem ser 0) + aviso "Nenhum evento da Greenn desde DD/MM/AAAA HH:MM." (Brasília).
- **Tabela sem nenhum evento:** aviso "Nenhum evento da Greenn registrado." (decisão própria: a frase da spec exige uma data).
- **Compra atribuída pelo Meta** (`purchase_log`, Meta Ads): não é lida.
- **Nenhuma venda candidata:** a leitura 2 não roda.

### Cenário de Erro
- Falha do D1 nas leituras da Greenn: sobe para o tratamento de falha inesperada do endpoint (issue 265) — nunca vira 0.

## Banco de Dados

Só leitura, sem migration (índices já existem: `idx_greenn_recebido` da 0032, `idx_greenn_entidade` da 0037):
- `SELECT DISTINCT entity_id FROM greenn_webhook_event WHERE received_at >= ? AND received_at < ? AND event = 'saleUpdated' AND current_status = 'paid'`
- `SELECT id, entity_id, current_status, amount, received_at, raw_json FROM greenn_webhook_event WHERE entity_type = 'sale' AND entity_id IN (?, …) AND event = 'saleUpdated'` (lotes de 50)
- `SELECT MAX(received_at) AS ultimo FROM greenn_webhook_event`

## Arquivos

- **Criar:** `functions/api/_feedback-marketing-greenn.js` — `contarComprasDoPeriodo`, `avisosGreenn` (puros); `lerVendasGreennDoPeriodo(db, limites)` (I/O).
- **Criar:** `tests/feedback-marketing-greenn.test.js`
- **Modificar:** `functions/api/_feedback-marketing-investimento.js` — exportar `dataHoraLegivel` e `dataHoraIso` (reuso da data em Brasília; sem mudar comportamento).
- **Modificar:** `functions/api/feedback-marketing.js` — leitura da Greenn em paralelo, contagem e avisos.

## Reuso (pesquisado na base)

- `reduzirPorVenda`, `ehTesteInterno` (`_greenn-metricas.js`); `limitesDoPeriodoUnix` (`_feedback-marketing-periodo.js`); `dataHoraLegivel`/`dataHoraIso` (`_feedback-marketing-investimento.js`); lotes de 50 de `greenn.js`.

## Checklist

- [x] Candidatas por `received_at` com índice; histórico por venda com índice, em lotes
- [x] Última atualização por `reduzirPorVenda`; teste interno por `ehTesteInterno`
- [x] Data da venda = primeira atualização paga, dia de Brasília
- [x] Estorno/reembolso/recusa/aguardando não contam
- [x] Ilegível não conta e gera aviso
- [x] Aviso de nenhum evento desde antes do início
- [x] Testes
- [x] `npm test` passando
