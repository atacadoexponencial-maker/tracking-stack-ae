# Receptor de webhook da Greenn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Receber e gravar os webhooks da plataforma de checkout Greenn em uma tabela isolada, sem tocar em nada que já existe.

**Architecture:** Um endpoint do Cloudflare Pages Functions (`POST /api/webhooks/greenn`) valida o header `X-Webhook-Token`, delega a interpretação do corpo a um módulo puro e grava numa tabela nova do D1 com `INSERT OR IGNORE`. O módulo puro é a única parte com teste automatizado — é o padrão já usado por `_classificar.js` / `whatsapp-grupo.js`.

**Tech Stack:** Cloudflare Pages Functions (ES modules), D1 (SQLite), `node --test` para testes, `wrangler` para migrations.

**Spec:** `docs/superpowers/specs/2026-08-10-greenn-webhook-design.md`

## Global Constraints

- Idioma: comentários, mensagens de commit e documentação em **português**. Nomes de colunas, funções e variáveis seguem o padrão do arquivo vizinho (`whatsapp-grupo.js` usa português para variáveis locais e inglês para colunas do banco).
- **Nenhum arquivo existente é modificado.** Todos os arquivos deste plano são novos. Se algum passo parecer exigir editar um arquivo existente, pare e reporte.
- Prefixo `_` em módulos dentro de `functions/`: o Pages não os transforma em rota. O extrator **precisa** desse prefixo.
- O `raw_json` é gravado íntegro, sem truncar.
- Nunca logar `raw_json`, o token recebido ou o token esperado.
- Migration: `0032_greenn_webhook.sql`. Não reaplicar migrations antigas em remoto — este projeto tem migrations que quebram ao reaplicar (0021/0022/0025).
- Timestamps nossos em unix seconds (inteiro); os da Greenn ficam como a string ISO 8601 que ela envia.

---

### Task 1: Extrator puro do evento

**Files:**
- Create: `functions/api/webhooks/_greenn-evento.js`
- Test: `tests/greenn-evento.test.js`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: `export function extrairEvento(body)` — recebe o corpo já parseado (objeto) e devolve `null` quando não reconhece, ou um objeto com exatamente estas chaves:
  ```
  { event: string, entity_type: string, entity_id: number|null,
    current_status: string, product_id: number|null,
    amount: number|null, entity_updated: string|null }
  ```
  A Task 3 consome esse objeto e grava cada chave numa coluna de mesmo nome.

- [ ] **Step 1: Escrever o teste que falha — venda paga**

Criar `tests/greenn-evento.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extrairEvento } from '../functions/api/webhooks/_greenn-evento.js';

// Payloads reduzidos aos campos que o extrator lê. Os exemplos completos da
// Greenn trazem client, seller, saleMetas etc., que a ingestão não interpreta.
function vendaPaga(extra = {}) {
  return {
    type: 'sale',
    event: 'saleUpdated',
    oldStatus: 'waiting_payment',
    currentStatus: 'paid',
    sale: {
      id: 1001,
      type: 'TRANSACTION',
      status: 'paid',
      amount: 97.0,
      updated_at: '2026-06-11T17:13:46.000000Z',
    },
    product: { id: 77, name: 'Curso de Exemplo' },
    productMetas: { utm_source: 'facebook' },
    ...extra,
  };
}

test('saleUpdated extrai venda, produto e status', () => {
  const r = extrairEvento(vendaPaga());
  assert.equal(r.event, 'saleUpdated');
  assert.equal(r.entity_type, 'sale');
  assert.equal(r.entity_id, 1001);
  assert.equal(r.current_status, 'paid');
  assert.equal(r.product_id, 77);
  assert.equal(r.amount, 97.0);
  assert.equal(r.entity_updated, '2026-06-11T17:13:46.000000Z');
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Cannot find module '../functions/api/webhooks/_greenn-evento.js'`

- [ ] **Step 3: Implementação mínima**

Criar `functions/api/webhooks/_greenn-evento.js`:

```js
// Traduz o corpo de um webhook da Greenn nas colunas de greenn_webhook_event.
// Função PURA: sem I/O, sem D1, sem env — é o que permite testá-la com
// `node --test` sem subir nada.
//
// Prefixo "_" no nome: o Cloudflare Pages não transforma em rota (mesmo
// mecanismo de _classificar.js).

export function extrairEvento(body) {
  if (!body || typeof body !== 'object') return null;

  if (body.event === 'saleUpdated') {
    return {
      event: 'saleUpdated',
      entity_type: 'sale',
      entity_id: numero(body.sale?.id),
      current_status: texto(body.currentStatus),
      product_id: numero(body.product?.id),
      amount: numero(body.sale?.amount),
      entity_updated: texto(body.sale?.updated_at) || null,
    };
  }

  return null;
}

// A Greenn manda inteiros e floats como números, mas um campo ausente vira
// undefined e o D1 recusa undefined no bind. Normaliza para null.
function numero(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function texto(v) {
  return typeof v === 'string' ? v : '';
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/greenn-evento.test.js functions/api/webhooks/_greenn-evento.js
git commit -m "feat(greenn): extrai colunas do webhook de venda"
```

- [ ] **Step 6: Teste que falha — contrato (assinatura)**

Acrescentar em `tests/greenn-evento.test.js`:

```js
function contratoPago() {
  return {
    type: 'contract',
    event: 'contractUpdated',
    oldStatus: 'pending_payment',
    currentStatus: 'paid',
    // ATENÇÃO: em contractUpdated a venda chama-se `currentSale`, não `sale`.
    currentSale: { id: 1003, amount: 49.9, updated_at: '2026-06-11T19:10:00.000000Z' },
    contract: { id: 201, status: 'paid', updated_at: '2026-06-11T19:10:00.000000Z', charge: 6 },
    product: { id: 78, name: 'Assinatura Mensal' },
  };
}

test('contractUpdated usa contract.id e o valor vem de currentSale', () => {
  const r = extrairEvento(contratoPago());
  assert.equal(r.event, 'contractUpdated');
  assert.equal(r.entity_type, 'contract');
  assert.equal(r.entity_id, 201);
  assert.equal(r.current_status, 'paid');
  assert.equal(r.product_id, 78);
  assert.equal(r.amount, 49.9);
  assert.equal(r.entity_updated, '2026-06-11T19:10:00.000000Z');
});
```

- [ ] **Step 7: Rodar e confirmar que falha**

Run: `npm test`
Expected: FAIL — `extrairEvento` devolve `null` para `contractUpdated`

- [ ] **Step 8: Implementar o ramo do contrato**

Em `_greenn-evento.js`, antes do `return null` final:

```js
  if (body.event === 'contractUpdated') {
    return {
      event: 'contractUpdated',
      entity_type: 'contract',
      entity_id: numero(body.contract?.id),
      current_status: texto(body.currentStatus),
      product_id: numero(body.product?.id),
      amount: numero(body.currentSale?.amount),
      entity_updated: texto(body.contract?.updated_at) || null,
    };
  }
```

- [ ] **Step 9: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS (2 testes)

- [ ] **Step 10: Commit**

```bash
git add -A tests/greenn-evento.test.js functions/api/webhooks/_greenn-evento.js
git commit -m "feat(greenn): extrai colunas do webhook de assinatura"
```

- [ ] **Step 11: Teste que falha — checkout abandonado**

Acrescentar em `tests/greenn-evento.test.js`:

```js
function checkoutAbandonado() {
  return {
    type: 'lead',
    event: 'checkoutAbandoned',
    lead: {
      id: 9001,
      name: 'Beltrana Silva',
      email: 'beltrana@exemplo.com',
      updated_at: '2026-06-11T20:02:00.000000Z',
      step: 2,
    },
    link_checkout: 'https://pay.greenn.com.br/77',
    product: { id: 77, name: 'Curso de Exemplo', amount: 97 },
    productMetas: { utm_source: 'instagram' },
    proposalMetas: {},
  };
}

test('checkoutAbandoned usa lead.id e não tem status nem valor', () => {
  const r = extrairEvento(checkoutAbandonado());
  assert.equal(r.event, 'checkoutAbandoned');
  assert.equal(r.entity_type, 'lead');
  assert.equal(r.entity_id, 9001);
  // String vazia, não null: NULL nunca casa com NULL num índice único do
  // SQLite, e a dedup precisa valer também para o abandono.
  assert.equal(r.current_status, '');
  assert.equal(r.product_id, 77);
  // product.amount é preço de tabela, não receita — registrar daria a
  // impressão de uma venda que não aconteceu.
  assert.equal(r.amount, null);
  assert.equal(r.entity_updated, '2026-06-11T20:02:00.000000Z');
});
```

- [ ] **Step 12: Rodar e confirmar que falha**

Run: `npm test`
Expected: FAIL — devolve `null` para `checkoutAbandoned`

- [ ] **Step 13: Implementar o ramo do abandono**

Em `_greenn-evento.js`, antes do `return null` final:

```js
  if (body.event === 'checkoutAbandoned') {
    return {
      event: 'checkoutAbandoned',
      entity_type: 'lead',
      entity_id: numero(body.lead?.id),
      current_status: '',
      product_id: numero(body.product?.id),
      amount: null,
      entity_updated: texto(body.lead?.updated_at) || null,
    };
  }
```

- [ ] **Step 14: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS (3 testes)

- [ ] **Step 15: Commit**

```bash
git add -A tests/greenn-evento.test.js functions/api/webhooks/_greenn-evento.js
git commit -m "feat(greenn): extrai colunas do checkout abandonado"
```

- [ ] **Step 16: Testes que falham — bordas**

Acrescentar em `tests/greenn-evento.test.js`:

```js
test('evento desconhecido devolve null', () => {
  assert.equal(extrairEvento({ type: 'sale', event: 'saleInventado' }), null);
});

test('corpo vazio, nulo ou sem event devolve null', () => {
  assert.equal(extrairEvento(null), null);
  assert.equal(extrairEvento(undefined), null);
  assert.equal(extrairEvento({}), null);
  assert.equal(extrairEvento('texto'), null);
});

test('venda sem produto e sem valor grava null nas colunas, não undefined', () => {
  const r = extrairEvento({
    type: 'sale',
    event: 'saleUpdated',
    currentStatus: 'refused',
    sale: { id: 1002, status: 'refused', updated_at: '2026-06-11T18:05:00.000000Z' },
  });
  assert.equal(r.entity_id, 1002);
  assert.equal(r.current_status, 'refused');
  // O D1 recusa `undefined` num bind — tem que ser null de verdade.
  assert.equal(r.product_id, null);
  assert.equal(r.amount, null);
});

test('as três formas de productMetas não derrubam o extrator', () => {
  // A doc da Greenn diz `[]` quando vazio e objeto quando preenchido; os
  // exemplos dela também mostram `{}`. A ingestão não lê esses campos —
  // este teste existe para garantir que continue assim.
  for (const metas of [[], {}, { utm_source: 'facebook' }]) {
    const r = extrairEvento(vendaPaga({ productMetas: metas, proposalMetas: metas }));
    assert.equal(r.entity_id, 1001);
  }
});

test('venda recusada traz sale.refused sem afetar as colunas', () => {
  const r = extrairEvento(vendaPaga({
    currentStatus: 'refused',
    sale: {
      id: 1002, status: 'refused', amount: 97.0,
      updated_at: '2026-06-11T18:05:00.000000Z',
      refused: { event: 'INSUFFICIENT_FUNDS', reason: 'Limite insuficiente' },
    },
  }));
  assert.equal(r.current_status, 'refused');
  assert.equal(r.entity_id, 1002);
});
```

- [ ] **Step 17: Rodar e ver o resultado**

Run: `npm test`
Expected: os testes de borda devem passar com a implementação atual. Se algum falhar, corrija `_greenn-evento.js` — provavelmente o guard `typeof body !== 'object'` (note que `typeof null === 'object'`, por isso o `!body` vem antes).

- [ ] **Step 18: Commit**

```bash
git add -A tests/greenn-evento.test.js functions/api/webhooks/_greenn-evento.js
git commit -m "test(greenn): cobre bordas do extrator de webhook"
```

---

### Task 2: Tabela no D1

**Files:**
- Create: `migrations/0032_greenn_webhook.sql`

**Interfaces:**
- Consumes: os nomes de coluna produzidos pela Task 1 (`event`, `entity_type`, `entity_id`, `current_status`, `product_id`, `amount`, `entity_updated`).
- Produces: tabela `greenn_webhook_event` e índices `idx_greenn_dedup` e `idx_greenn_recebido`, usados pela Task 3.

- [ ] **Step 1: Escrever a migration**

Criar `migrations/0032_greenn_webhook.sql`:

```sql
-- Eventos crus da Greenn, a plataforma de checkout onde roda um produto
-- SEPARADO do restante do tracking. Alimentado por /api/webhooks/greenn.
--
-- Esta tabela é deliberadamente isolada: não se relaciona com purchase_log
-- nem com event_log, e nenhuma aba atual do dash a lê. A visão dela no
-- dashboard é um ciclo à parte, por decisão da usuária em 2026-08-10.
CREATE TABLE IF NOT EXISTS greenn_webhook_event (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    event          TEXT NOT NULL,    -- saleUpdated | contractUpdated | checkoutAbandoned
    entity_type    TEXT,             -- sale | contract | lead
    entity_id      INTEGER,          -- sale.id | contract.id | lead.id
    current_status TEXT NOT NULL,    -- paid, refused, ...; '' em checkoutAbandoned
    product_id     INTEGER,
    amount         REAL,             -- valor da venda em reais; NULL no abandono
    entity_updated TEXT,             -- updated_at da entidade, ISO 8601 da Greenn
    received_at    INTEGER NOT NULL, -- unix seconds, relógio nosso
    raw_json       TEXT NOT NULL     -- payload íntegro, fonte da verdade
);

-- A Greenn não garante entrega única e a própria doc avisa que `oldStatus`
-- pode vir igual ao `currentStatus`. Esta é a chave natural do fato: a mesma
-- entidade, no mesmo status, com o mesmo updated_at é o mesmo evento.
-- Combinada com INSERT OR IGNORE, torna a reentrega inofensiva.
--
-- current_status é NOT NULL (com '' no abandono) de propósito: no SQLite, NULL
-- nunca é igual a NULL num índice único, e um NULL aqui desativaria a dedup
-- justamente para o evento mais repetido.
CREATE UNIQUE INDEX IF NOT EXISTS idx_greenn_dedup
    ON greenn_webhook_event(event, entity_id, current_status, entity_updated);

CREATE INDEX IF NOT EXISTS idx_greenn_recebido
    ON greenn_webhook_event(received_at);
```

- [ ] **Step 2: Aplicar no banco local e conferir o schema**

```bash
npx wrangler d1 migrations apply tracking-ae-db --local
npx wrangler d1 execute tracking-ae-db --local --command "PRAGMA table_info(greenn_webhook_event);"
```

Expected: as 10 colunas listadas, com `current_status` e `received_at` e `raw_json` marcados `notnull = 1`.

- [ ] **Step 3: Provar que a deduplicação funciona**

```bash
npx wrangler d1 execute tracking-ae-db --local --command "INSERT OR IGNORE INTO greenn_webhook_event (event, entity_type, entity_id, current_status, product_id, amount, entity_updated, received_at, raw_json) VALUES ('saleUpdated','sale',1001,'paid',77,97.0,'2026-06-11T17:13:46.000000Z',1760000000,'{}'); INSERT OR IGNORE INTO greenn_webhook_event (event, entity_type, entity_id, current_status, product_id, amount, entity_updated, received_at, raw_json) VALUES ('saleUpdated','sale',1001,'paid',77,97.0,'2026-06-11T17:13:46.000000Z',1760000099,'{}'); INSERT OR IGNORE INTO greenn_webhook_event (event, entity_type, entity_id, current_status, product_id, amount, entity_updated, received_at, raw_json) VALUES ('checkoutAbandoned','lead',9001,'',77,NULL,'2026-06-11T20:02:00.000000Z',1760000100,'{}'); INSERT OR IGNORE INTO greenn_webhook_event (event, entity_type, entity_id, current_status, product_id, amount, entity_updated, received_at, raw_json) VALUES ('checkoutAbandoned','lead',9001,'',77,NULL,'2026-06-11T20:02:00.000000Z',1760000101,'{}'); SELECT event, count(*) AS linhas FROM greenn_webhook_event GROUP BY event;"
```

Expected: `checkoutAbandoned | 1` e `saleUpdated | 1` — cada par de inserções idênticas virou uma linha só. Se o abandono aparecer com 2, o `current_status` foi gravado como NULL em vez de `''` e a dedup está furada.

- [ ] **Step 4: Limpar as linhas de teste**

```bash
npx wrangler d1 execute tracking-ae-db --local --command "DELETE FROM greenn_webhook_event; SELECT count(*) AS restantes FROM greenn_webhook_event;"
```

Expected: `restantes | 0`

- [ ] **Step 5: Commit**

```bash
git add migrations/0032_greenn_webhook.sql
git commit -m "feat(greenn): tabela isolada para os eventos da Greenn"
```

**Nota de implantação (não é passo deste plano):** aplicar em produção é `npx wrangler d1 migrations apply tracking-ae-db --remote`, que neste projeto **falha ao reaplicar as migrations antigas 0021/0022/0025**. Não rode às cegas — confira com a usuária antes.

---

### Task 3: Endpoint e documentação

**Files:**
- Create: `functions/api/webhooks/greenn.js`
- Create: `docs/greenn-webhook.md`

**Interfaces:**
- Consumes: `extrairEvento(body)` da Task 1; a tabela `greenn_webhook_event` da Task 2.
- Produces: rota pública `POST /api/webhooks/greenn`; variável de ambiente `GREENN_WEBHOOK_TOKEN`.

- [ ] **Step 1: Escrever o endpoint**

Criar `functions/api/webhooks/greenn.js`:

```js
// POST /api/webhooks/greenn
//
// Recebe os webhooks da Greenn, a plataforma de checkout de um produto
// SEPARADO do restante do tracking. A URL é cadastrada no campo `url_callback`
// de cada produto na Greenn — quais produtos entram é decisão operacional de
// onde a URL foi colada, não deste código.
//
// Auth: header `X-Webhook-Token`, comparado com env.GREENN_WEBHOOK_TOKEN. É o
// único fator disponível: a Greenn não assina o corpo com HMAC.
//
// Responde 200 mesmo quando não entende o evento. Um 5xx nosso faria a Greenn
// tratar como falha de entrega, e ela não promete reentrega — o erro nosso
// viraria perda de dado dela. A única exceção é falha de escrita no D1, onde o
// dado realmente não entrou e um 200 mentiria.
//
// O payload traz nome, e-mail, celular, CPF e endereço do comprador: nada de
// raw_json em log, nunca.

import { extrairEvento } from './_greenn-evento.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const enviado = request.headers.get('x-webhook-token') || '';
  if (!env.GREENN_WEBHOOK_TOKEN || !tokenConfere(enviado, env.GREENN_WEBHOOK_TOKEN)) {
    // Sem o valor recebido no log: ele é um segredo mesmo quando está errado.
    console.error('greenn — token divergente ou ausente (401)');
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    console.error('greenn — JSON inválido no corpo da requisição:', e?.message || e);
    return json({ ok: true, status: 'ignorado', motivo: 'json_invalido' });
  }

  const evento = extrairEvento(body);
  if (!evento) {
    // Só o suficiente para diagnosticar: se a Greenn criar um evento novo,
    // isto é o que vai aparecer no log do Pages.
    console.error('greenn — evento não reconhecido:', {
      type: body?.type,
      event: body?.event,
    });
    return json({ ok: true, status: 'ignorado', motivo: 'evento_desconhecido' });
  }

  // Íntegro, sem truncar: o raw_json é a fonte da verdade desta tabela, e um
  // corte no meio produziria JSON inválido.
  const cru = JSON.stringify(body);

  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO greenn_webhook_event
         (event, entity_type, entity_id, current_status, product_id, amount,
          entity_updated, received_at, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      evento.event, evento.entity_type, evento.entity_id, evento.current_status,
      evento.product_id, evento.amount, evento.entity_updated,
      Math.floor(Date.now() / 1000), cru
    ).run();
  } catch (e) {
    // Único 5xx do endpoint, e é honesto: o dado não entrou.
    console.error('greenn — falha ao gravar no D1:', e?.message || e);
    return json({ error: 'Erro ao gravar' }, 500);
  }

  return json({ ok: true, status: 'gravado', event: evento.event });
}

// Comparação em tempo constante. Um `!==` comum interrompe na primeira
// diferença e vaza o prefixo do token por timing. O comprimento é comparado
// antes porque timingSafeEqual exige buffers do mesmo tamanho.
function tokenConfere(recebido, esperado) {
  const a = new TextEncoder().encode(recebido);
  const b = new TextEncoder().encode(esperado);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: Confirmar que a suíte segue verde**

Run: `npm test`
Expected: PASS — os 7 testes da Task 1. O endpoint não tem teste automatizado (o projeto não tem harness para handlers do Pages); a verificação dele é o passo 3.

- [ ] **Step 3: Verificar o endpoint localmente**

Em um terminal:

```bash
npx wrangler pages dev dist --d1 DB=tracking-ae-db --binding GREENN_WEBHOOK_TOKEN=token-de-teste
```

Se `dist/` não existir, rode `npm run build` antes.

Em outro terminal, os três casos que importam:

```bash
# 1. Token errado -> 401, nada gravado
curl -s -o /dev/null -w "sem token: %{http_code}\n" -X POST http://localhost:8788/api/webhooks/greenn \
  -H "Content-Type: application/json" -d '{"event":"saleUpdated"}'

# 2. Token certo, venda paga -> 200 gravado
curl -s -X POST http://localhost:8788/api/webhooks/greenn \
  -H "Content-Type: application/json" -H "X-Webhook-Token: token-de-teste" \
  -d '{"type":"sale","event":"saleUpdated","oldStatus":"waiting_payment","currentStatus":"paid","sale":{"id":1001,"amount":97.0,"updated_at":"2026-06-11T17:13:46.000000Z"},"product":{"id":77},"client":{"name":"Fulano","email":"f@ex.com"}}'
echo

# 3. Mesma coisa de novo -> 200 de novo, mas SEM duplicar no banco
curl -s -X POST http://localhost:8788/api/webhooks/greenn \
  -H "Content-Type: application/json" -H "X-Webhook-Token: token-de-teste" \
  -d '{"type":"sale","event":"saleUpdated","oldStatus":"waiting_payment","currentStatus":"paid","sale":{"id":1001,"amount":97.0,"updated_at":"2026-06-11T17:13:46.000000Z"},"product":{"id":77},"client":{"name":"Fulano","email":"f@ex.com"}}'
echo
```

Expected: `sem token: 401`, depois dois `{"ok":true,"status":"gravado","event":"saleUpdated"}`.

Conferir que gravou uma linha só:

```bash
npx wrangler d1 execute tracking-ae-db --local --command "SELECT id, event, entity_id, current_status, amount FROM greenn_webhook_event;"
```

Expected: exatamente 1 linha, `entity_id = 1001`, `current_status = paid`, `amount = 97`.

- [ ] **Step 4: Limpar o dado de teste**

```bash
npx wrangler d1 execute tracking-ae-db --local --command "DELETE FROM greenn_webhook_event;"
```

- [ ] **Step 5: Escrever a documentação**

Criar `docs/greenn-webhook.md`:

```markdown
# Webhook da Greenn

A Greenn é a plataforma de checkout de um produto **separado** do restante do
tracking. Os eventos dela caem numa tabela isolada (`greenn_webhook_event`) e
não aparecem em nenhuma aba atual do dashboard — isso é intencional.

## URL

    https://atacadoexponencial.com/api/webhooks/greenn

## Como cadastrar

Na Greenn, a URL de webhook é cadastrada **por produto** (campo `url_callback`).
Cole a URL acima em cada produto que deve ser rastreado. Produto sem a URL não
gera evento nenhum aqui — é assim que se escolhe o que entra.

## Segredo

O endpoint valida o header `X-Webhook-Token` que a Greenn envia em todo POST,
comparando com a variável `GREENN_WEBHOOK_TOKEN`:

- local: no `.env` (nunca commitado)
- produção: Cloudflare Pages → projeto `tracking-ae` → Settings → Environment
  variables → **Secret** (não "plaintext")

Se o token da Greenn não estiver visível no painel dela, cadastre a URL mesmo
assim: o primeiro POST vai levar 401 e o valor aparece no log do Pages, junto
da requisição. Configure o secret e a partir daí os eventos passam a gravar.

## O que é gravado

Os três eventos que a Greenn envia: `saleUpdated` (venda mudou de status),
`contractUpdated` (assinatura) e `checkoutAbandoned` (visitante preencheu o
checkout e não comprou). Todos vão para a mesma tabela, com o payload íntegro
em `raw_json`.

Status de venda possíveis: `paid`, `waiting_payment`, `refused`, `refunded`,
`chargedback`, `unpaid`.

## Respostas

| Situação | HTTP |
|---|---|
| Gravado | 200 |
| Evento desconhecido ou JSON inválido | 200 (registra no log, não grava) |
| Token ausente ou divergente | 401 |
| Falha de escrita no D1 | 500 |

O 200 em evento desconhecido é deliberado: a Greenn não promete reentrega, e um
erro nosso viraria perda de dado dela.

## Conferir se está chegando

    npx wrangler d1 execute tracking-ae-db --remote \
      --command "SELECT id, event, entity_id, current_status, amount, datetime(received_at,'unixepoch','-3 hours') AS recebido FROM greenn_webhook_event ORDER BY id DESC LIMIT 20;"

Tabela vazia significa uma de três coisas: nenhuma venda aconteceu, a URL não
foi cadastrada no produto, ou o token está errado (procure `greenn — token`
nos logs do Pages).

## Recuperar o que se perdeu

A Greenn não reentrega. Se o endpoint ficou fora do ar, as vendas ainda podem
ser recuperadas pela API:

    GET https://apiadm.greenn.com.br/api/v1/sales?filter[created_after]=2026-08-01
    Authorization: Bearer grn_live_...

Não há limite de janela nesse filtro. O que não se recupera é o evento no
instante em que aconteceu.

## Limites conhecidos

- **Sem HMAC.** O `X-Webhook-Token` é o único fator de autenticação. Quem
  descobrir o token pode forjar eventos.
- **`oldStatus` não é confiável.** A doc da Greenn avisa que ele pode vir igual
  ao `currentStatus`. Use sempre `currentStatus`.
- **`productMetas` e `proposalMetas` mudam de tipo** — `[]`, `{}` ou objeto
  preenchido. A ingestão não os lê; quem for consumir o `raw_json` precisa
  tratar os três formatos.
```

- [ ] **Step 6: Commit**

```bash
git add functions/api/webhooks/greenn.js docs/greenn-webhook.md
git commit -m "feat(greenn): endpoint que recebe e grava os webhooks"
```

---

## Depois do plano (não são tasks)

Estes passos dependem da usuária e não podem ser executados por quem implementa:

1. **Obter o `X-Webhook-Token`** na Greenn e configurá-lo como secret no Pages.
2. **Aplicar a migration em produção** — com a ressalva das migrations 0021/0022/0025.
3. **Cadastrar a URL** no `url_callback` dos produtos escolhidos.
4. **Confirmar com uma venda real** — é a única prova de que a integração funciona. Testes passando não provam isso.

## Self-review

Conferência do plano contra a spec:

- Escopo só de ingestão, sem tela — Tasks 1–3, nenhuma toca no dash. ✅
- Tabela isolada `greenn_webhook_event` — Task 2. ✅
- Mapeamento de colunas por tipo de evento — Task 1, steps 3, 8 e 13. ✅
- `raw_json` íntegro, sem truncar — Task 3, step 1. ✅
- Dedup por `INSERT OR IGNORE` + índice único — Task 2, steps 1 e 3. ✅
- `current_status` NOT NULL com `''` — Task 1 step 13, Task 2 steps 1 e 3. ✅
- Token em tempo constante, sem logar valor — Task 3, step 1. ✅
- Tabela de respostas HTTP (200/401/500) — Task 3, steps 1 e 3. ✅
- Armadilha de `productMetas` — Task 1, step 16. ✅
- Testes com os payloads da doc — Task 1, steps 1, 6, 11, 16. ✅
- Documentação — Task 3, step 5. ✅
- Nenhum arquivo existente modificado — todos os `Files:` são `Create`. ✅
- Verificação real declarada como impossível localmente — seção "Depois do plano". ✅
