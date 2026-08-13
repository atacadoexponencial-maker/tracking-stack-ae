# Ponte Greenn → ClickUp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quem compra o Workshop Black Exponencial pela Greenn vira card no 🤑 CRM do ClickUp, já com a origem (UTMs) da visita que gerou a compra.

**Architecture:** O endpoint `/api/webhooks/greenn` (que hoje só grava) passa a disparar a ponte em `context.waitUntil` quando a venda é paga. A montagem do card é uma função pura e testável; o I/O (buscar sessão, buscar/criar task, comentar, taguear) fica no endpoint. Os helpers de ClickUp que hoje moram dentro de `functions/tracker.js` são extraídos para um módulo compartilhado antes, para não existirem duas cópias dos IDs de custom field.

**Tech Stack:** Cloudflare Pages Functions (ES modules), D1 (SQLite), API do ClickUp v2, `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-13-greenn-clickup-design.md`

## Global Constraints

- Comentários, mensagens de commit e documentação em **português**.
- Prefixo `_` em módulos dentro de `functions/`: o Pages não os transforma em rota. Obrigatório para `_clickup.js` e `_greenn-clickup.js`.
- **Nunca logar** `raw_json`, dados do comprador (nome, e-mail, telefone, CPF, endereço) ou tokens. Em erro, só o id da venda.
- **`💰 Arrecadado` (`85ef1a33-01f7-4ea4-9f24-f742b660a04e`) nunca é preenchido** por esta feature. O valor da venda vai para **`💵 Valor` (`67bc0514-2f0b-4317-a081-6fa69904681e`)**. Motivo: `functions/webhook/clickup.js` lê o Arrecadado quando um card entra em `contrato assinado` e registra a venda no `purchase_log`/ROAS do negócio antigo — a Greenn não pode entrar ali.
- **O card nunca nasce em `contrato assinado`.** Status inicial é `leads de entrada`.
- A ponte roda em `waitUntil` e **nunca** pode alterar, atrasar ou derrubar a resposta 200 para a Greenn.
- NUNCA usar a flag `--remote` do wrangler durante a implementação. Só `--local`.
- Migration: `0033_greenn_clickup.sql`. Não rodar `d1 migrations apply` neste projeto (0021/0022/0025 quebram ao reaplicar) — aplicar com `d1 execute --file`.

## Constantes de referência (conferidas na API do ClickUp em 2026-08-13)

Lista 🤑 CRM: `205126080`

| O quê | ID |
|---|---|
| 👤 Nome | `7f70363f-9fc4-4d34-aab1-0a81d4a6f45d` |
| 📩 E-mail | `24f5a3d3-e21e-4e08-b396-8a4ce2133a98` |
| ☎️ Whatsapp | `754a41c9-2835-48d5-a70e-8b61841e0037` |
| 🔻 Funil (dropdown) | `a663b002-661c-4dc1-86c3-612e94f3a447` |
| 🛒 Produto (dropdown) | `6fd27248-beb5-49e1-9626-f1ab7ed81e5a` |
| 💵 Valor (currency) | `67bc0514-2f0b-4317-a081-6fa69904681e` |
| utm_source | `64ffa839-dac1-4995-9cbb-7bd50f9dc5d5` |
| utm_medium | `e367ce2e-a06c-43b6-ac9b-0feb4923f007` |
| utm_content | `5710cb4d-a375-464b-8ac6-5267745eaddc` |
| utm_campaing (typo na lista) | `78b59aa4-6e98-4555-bbbf-5a0259309eb0` |
| Opção `WO PAGO` do Funil | `420877c7-44de-4d46-a934-718889443f49` |
| Opção `AE` do Produto | `6cf677ce-5592-4ff7-9f63-d18d52d42be5` |
| 💰 Arrecadado — **proibido** | `85ef1a33-01f7-4ea4-9f24-f742b660a04e` |

---

### Task 1: Extrair os helpers de ClickUp para um módulo compartilhado

Refatoração pura, sem mudança de comportamento. As definições saem de
`functions/tracker.js` e passam a ser importadas. As ~50 chamadas no arquivo
**não mudam** — só as definições se movem.

**Nota de desvio da spec:** a spec propunha `functions/api/webhooks/_clickup-api.js`.
O plano usa **`functions/api/_clickup.js`**, que segue o precedente já existente
de `functions/api/_hash.js` (importado pelo tracker como `./api/_hash.js`). O
módulo é usado pelo tracker E pelo webhook, então não pertence à pasta de um só.

**Files:**
- Create: `functions/api/_clickup.js`
- Modify: `functions/tracker.js` (remove as definições das linhas 603–631 e 651–709; acrescenta um import no topo)

**Interfaces:**
- Consumes: nada.
- Produces: `functions/api/_clickup.js` exporta —
  ```
  CLICKUP_API: string
  CU_FIELD: { nome, email, instagram, faturamento, whatsapp, justificativa,
              objetivo, cargo, investimento, funil, produto, valor,
              utmSource, utmMedium, utmContent, utmCampaign }   // todos string (uuid)
  CU_DEFAULT_LIST: string
  CU_PRODUTO_AE, CU_PRODUTO_ACELERACAO: string
  CU_FUNIL_SESSAO, CU_FUNIL_LIVES, CU_FUNIL_APLICACAO, CU_FUNIL_WORKSHOP,
  CU_FUNIL_TRAFEGO, CU_FUNIL_ISCAS, CU_FUNIL_WO_PAGO: string
  toClickUpPhone(ph: string): string
  clickupFetch(path: string, options: object, env: object): Promise<Response>
  searchClickUpTask(fieldId: string, value: string, env: object): Promise<object|null>
  clickupWrite(fn: () => Promise<Response>): Promise<Response>
  addClickUpTag(taskId: string, tag: string, env: object): Promise<void>
  ```
  A Task 4 importa `CU_FIELD`, `toClickUpPhone`, `clickupFetch`, `searchClickUpTask`, `clickupWrite` e `addClickUpTag`.

- [ ] **Step 1: Ler o bloco que vai ser movido**

Run: `sed -n '596,712p' functions/tracker.js`

Confira que o trecho contém, nesta ordem: o comentário de cabeçalho "CLICKUP —",
`CLICKUP_API`, `CU_FIELD`, `CU_DEFAULT_LIST`, `CU_PRODUTO_*`, `CU_FUNIL_*`,
`mapFunnelToOption`, `mapProdutoToOption`, `toClickUpPhone`, `clickupFetch`,
`searchClickUpTask`, `clickupWrite`, `addClickUpTag`.

**`mapFunnelToOption` e `mapProdutoToOption` NÃO se movem** — elas traduzem o
funil do site, que é assunto do tracker. Ficam onde estão e passam a usar as
constantes importadas.

- [ ] **Step 2: Criar o módulo compartilhado**

Criar `functions/api/_clickup.js`:

```js
// Acesso à API do ClickUp — constantes e helpers COMPARTILHADOS.
//
// Extraído de functions/tracker.js em 2026-08-13, quando a ponte da Greenn
// (functions/api/webhooks/greenn.js) passou a precisar dos mesmos IDs. Duas
// cópias dos IDs de custom field é como eles divergem em silêncio: alguém
// renomeia um campo no ClickUp, atualiza um arquivo, e o outro segue escrevendo
// no campo errado sem erro nenhum.
//
// Prefixo "_": o Cloudflare Pages não transforma em rota. Mora em functions/api/
// e não em functions/api/webhooks/ porque é usado pelos dois — mesmo precedente
// de functions/api/_hash.js.
//
// O que NÃO está aqui: `mapFunnelToOption` e `mapProdutoToOption` seguem no
// tracker.js. Elas traduzem o funil do SITE para a opção do dropdown, que é
// assunto do fluxo de leads, não da API.

export const CLICKUP_API = 'https://api.clickup.com/api/v2';

// IDs dos custom fields da lista (🤑 CRM). Ver spec 2026-07-02.
export const CU_FIELD = {
  nome: '7f70363f-9fc4-4d34-aab1-0a81d4a6f45d',
  email: '24f5a3d3-e21e-4e08-b396-8a4ce2133a98',
  instagram: '3f24aa2d-050f-4be2-ab63-09b91307919b',
  faturamento: '97d8308d-d6b2-4dd6-9bd7-76f6662d5de2',
  whatsapp: '754a41c9-2835-48d5-a70e-8b61841e0037',
  justificativa: 'bc6b9579-de7c-4256-b649-b99d95132fa4',
  objetivo: '64e17f77-689c-487a-b8f3-8878df137a27',
  cargo: '150014bc-01ca-466f-90b6-9711ec19408e',
  investimento: '1e87bc05-95ba-444c-a728-eddf5fb603de', // 💵 Investimento em Tráfego (short_text)
  funil: 'a663b002-661c-4dc1-86c3-612e94f3a447',
  produto: '6fd27248-beb5-49e1-9626-f1ab7ed81e5a',
  // 💵 Valor (currency). Acrescentado em 2026-08-13 para a ponte da Greenn.
  // DELIBERADAMENTE não é o 💰 Arrecadado (85ef1a33-...): aquele é lido por
  // functions/webhook/clickup.js quando um card entra em "contrato assinado", e
  // registra a venda no purchase_log/ROAS do negócio antigo.
  valor: '67bc0514-2f0b-4317-a081-6fa69904681e',
  utmSource: '64ffa839-dac1-4995-9cbb-7bd50f9dc5d5',
  utmMedium: 'e367ce2e-a06c-43b6-ac9b-0feb4923f007',
  utmContent: '5710cb4d-a375-464b-8ac6-5267745eaddc',
  utmCampaign: '78b59aa4-6e98-4555-bbbf-5a0259309eb0', // "utm_campaing" (nome com typo na lista)
};

export const CU_DEFAULT_LIST = '205126080'; // 🤑 CRM — fallback se CLICKUP_LIST_ID não estiver setado
export const CU_PRODUTO_AE = '6cf677ce-5592-4ff7-9f63-d18d52d42be5';
export const CU_PRODUTO_ACELERACAO = '5a98b2d7-bfe0-4c29-9de4-2c15721bd9a7'; // ACELERAÇÃO
export const CU_FUNIL_SESSAO = 'a158d342-c1ac-4705-a6da-ce39019f0a2a'; // SESSÃO ESTRATÉGICA
export const CU_FUNIL_LIVES = 'e6893b0b-5a69-4f48-9c99-a3c0a415a118';  // LIVES SEMANAIS
export const CU_FUNIL_APLICACAO = '51f77888-2ba1-4f83-9b33-d8ef516b80be'; // APLICAÇÃO
export const CU_FUNIL_WORKSHOP = 'b5e04cdb-f62d-4159-b89b-751726a61831'; // WORKSHOP
export const CU_FUNIL_TRAFEGO = 'f88ef3e2-2928-439b-83ad-c7ff55083f60'; // TRAFEGO PAGO
export const CU_FUNIL_ISCAS = 'b1d0bc63-3d66-41f0-ad31-4a74d7b541ed'; // ISCAS (materiais do ManyChat)
// WO PAGO — usado pela ponte da Greenn (workshop pago). Opção que já existia na
// lista; não foi criada por nós.
export const CU_FUNIL_WO_PAGO = '420877c7-44de-4d46-a934-718889443f49';

// Mesma normalização do n8n: dígitos, sem zeros à esquerda, prefixa 55, com '+'.
export function toClickUpPhone(ph) {
  const digits = (ph || '').toString().replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  return '+' + (digits.startsWith('55') ? digits : '55' + digits);
}

export function clickupFetch(path, options, env) {
  return fetch(`${CLICKUP_API}${path}`, {
    ...options,
    headers: {
      Authorization: env.CLICKUP_API_TOKEN,
      'Content-Type': 'application/json',
      ...(options && options.headers),
    },
  });
}

// Busca uma task na lista pelo custom field (telefone ou email). Read-only:
// o chamador trata falha como "não achou" — nunca pode travar o lead.
export async function searchClickUpTask(fieldId, value, env) {
  if (!value) return null;
  const cf = encodeURIComponent(JSON.stringify([{ field_id: fieldId, operator: '=', value }]));
  const listId = env.CLICKUP_LIST_ID || CU_DEFAULT_LIST;
  const res = await clickupFetch(`/list/${listId}/task?custom_fields=${cf}`, { method: 'GET' }, env);
  if (!res.ok) throw new Error(`ClickUp search ${res.status}`);
  const data = await res.json();
  return (data.tasks && data.tasks[0]) || null;
}

// Executa uma chamada de escrita com 1 retry em erro transitório
// (429 / 5xx / erro de rede). Erros não-transitórios (ex.: 401) não repetem.
export async function clickupWrite(fn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res, netErr;
    try { res = await fn(); } catch (e) { netErr = e; }
    if (!netErr && res.ok) return res;
    const status = res ? res.status : 0;
    const retriable = !!netErr || status === 429 || status >= 500;
    if (retriable && attempt === 1) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    // Anexa o status HTTP no erro pra quem chama poder reagir (ex.: fallback no 400).
    throw netErr || Object.assign(new Error(`ClickUp write ${status}`), { status });
  }
}

// Aplica uma tag a uma task JÁ existente (POST /task/{id}/tag/{name}). O ClickUp
// cria a tag no Space se ela ainda não existir. Best-effort: falha aqui nunca
// trava o lead — o card/comentário e o lead_dispatch já garantem que nada se perde.
export async function addClickUpTag(taskId, tag, env) {
  if (!taskId || !tag) return;
  try {
    await clickupWrite(() => clickupFetch(
      `/task/${taskId}/tag/${encodeURIComponent(tag)}`, { method: 'POST' }, env));
  } catch (e) {
    console.error('ClickUp add tag error:', e.message);
  }
}
```

- [ ] **Step 3: Remover as definições do tracker.js e importar**

Em `functions/tracker.js`:

1. Acrescentar o import junto dos outros, no topo do arquivo (linha 3 é `import { detectBot } from './_bots.js';`):

```js
import {
  CU_FIELD,
  CU_DEFAULT_LIST,
  CU_PRODUTO_AE,
  CU_PRODUTO_ACELERACAO,
  CU_FUNIL_SESSAO,
  CU_FUNIL_LIVES,
  CU_FUNIL_APLICACAO,
  CU_FUNIL_WORKSHOP,
  CU_FUNIL_TRAFEGO,
  CU_FUNIL_ISCAS,
  toClickUpPhone,
  clickupFetch,
  searchClickUpTask,
  clickupWrite,
  addClickUpTag,
} from './api/_clickup.js';
```

2. **Apagar** do arquivo, mantendo tudo o mais intacto:
   - a declaração `const CLICKUP_API = ...`
   - o objeto `const CU_FIELD = { ... };` inteiro
   - `const CU_DEFAULT_LIST`, `const CU_PRODUTO_AE`, `const CU_PRODUTO_ACELERACAO`
   - as seis linhas `const CU_FUNIL_*`
   - as funções `toClickUpPhone`, `clickupFetch`, `searchClickUpTask`, `clickupWrite`, `addClickUpTag` (corpos completos, com seus comentários)

3. **NÃO apagar** `mapFunnelToOption` nem `mapProdutoToOption`, nem o comentário
   de cabeçalho "CLICKUP — cria/atualiza o lead DIRETO na API", nem qualquer
   linha que apenas *chame* esses helpers.

`CU_FUNIL_WO_PAGO` não é importado pelo tracker — ele não usa essa opção.

- [ ] **Step 4: Provar que não sobrou definição duplicada nem referência órfã**

```bash
grep -nE "^const (CLICKUP_API|CU_FIELD|CU_DEFAULT_LIST|CU_PRODUTO|CU_FUNIL)|^function (toClickUpPhone|clickupFetch)|^async function (searchClickUpTask|clickupWrite|addClickUpTag)" functions/tracker.js
```
Expected: nenhuma saída — todas as definições saíram.

```bash
grep -c "CU_FIELD\|toClickUpPhone\|clickupFetch\|searchClickUpTask\|clickupWrite\|addClickUpTag\|CU_FUNIL\|CU_PRODUTO\|CU_DEFAULT_LIST" functions/tracker.js
```
Expected: um número maior que 30 — as chamadas continuam lá, é só o import que passou a alimentá-las.

- [ ] **Step 5: Build e suíte completa**

Run: `npm run build && npm test`
Expected: build sem erro; 173 testes passando (nenhum teste novo nesta task — é refatoração, e a rede de segurança é o build resolver os imports e a suíte não regredir).

- [ ] **Step 6: Commit**

```bash
git add functions/api/_clickup.js functions/tracker.js
git commit -m "refactor(clickup): extrai constantes e helpers para modulo compartilhado"
```

---

### Task 2: Coluna `clickup_task_id`

**Files:**
- Create: `migrations/0033_greenn_clickup.sql`

**Interfaces:**
- Consumes: a tabela `greenn_webhook_event` da migration 0032.
- Produces: coluna `clickup_task_id TEXT` (nullable), usada pela Task 4.

- [ ] **Step 1: Escrever a migration**

Criar `migrations/0033_greenn_clickup.sql`:

```sql
-- Ponte Greenn → ClickUp: guarda o id da task criada para cada venda paga.
--
-- NULL significa "ainda não virou card" — ou porque o evento não é uma venda
-- paga (reembolso, abandono), ou porque a ponte falhou. Como o raw_json íntegro
-- já está guardado desde a 0032, nenhuma venda se perde: o que não foi pontado
-- é encontrável e recuperável a qualquer momento com
--
--   SELECT id, entity_id FROM greenn_webhook_event
--   WHERE event = 'saleUpdated' AND current_status = 'paid'
--     AND clickup_task_id IS NULL;
--
-- Não há retry automático de propósito (ver spec 2026-08-13): o dado sustenta a
-- recuperação quando ela for necessária.
ALTER TABLE greenn_webhook_event ADD COLUMN clickup_task_id TEXT;

CREATE INDEX IF NOT EXISTS idx_greenn_sem_card
    ON greenn_webhook_event(current_status, clickup_task_id);
```

- [ ] **Step 2: Aplicar no banco local**

```bash
npx wrangler@4.120.1 d1 execute tracking-ae-db --local --file=migrations/0033_greenn_clickup.sql
npx wrangler@4.120.1 d1 execute tracking-ae-db --local --command "PRAGMA table_info(greenn_webhook_event);"
```

Expected: a listagem termina com `clickup_task_id | TEXT`, com `notnull = 0`.

Nota: não use `d1 migrations apply` — neste projeto as migrations 0021/0022/0025
quebram ao reaplicar. E **nunca** `--remote` nesta task.

- [ ] **Step 3: Provar que a coluna aceita nulo e texto**

```bash
npx wrangler@4.120.1 d1 execute tracking-ae-db --local --command "INSERT OR IGNORE INTO greenn_webhook_event (event, entity_type, entity_id, current_status, product_id, amount, entity_updated, received_at, raw_json) VALUES ('saleUpdated','sale',777,'paid',1,27.0,'2026-08-13T10:00:00Z',1760000000,'{}'); UPDATE greenn_webhook_event SET clickup_task_id = 'abc123' WHERE entity_id = 777; SELECT entity_id, clickup_task_id FROM greenn_webhook_event WHERE entity_id = 777;"
```

Expected: `777 | abc123`.

- [ ] **Step 4: Limpar a linha de teste**

```bash
npx wrangler@4.120.1 d1 execute tracking-ae-db --local --command "DELETE FROM greenn_webhook_event WHERE entity_id = 777;"
```

- [ ] **Step 5: Commit**

```bash
git add migrations/0033_greenn_clickup.sql
git commit -m "feat(greenn): coluna clickup_task_id para rastrear a ponte"
```

---

### Task 3: Montagem do card (módulo puro + testes)

**Files:**
- Create: `functions/api/webhooks/_greenn-clickup.js`
- Test: `tests/greenn-clickup.test.js`

**Interfaces:**
- Consumes: `CU_FIELD`, `CU_FUNIL_WO_PAGO`, `CU_PRODUTO_AE`, `toClickUpPhone` de `functions/api/_clickup.js` (Task 1).
- Produces:
  ```
  TAG_EDICAO: string                       // 'wo-pago-09-09'
  STATUS_INICIAL: string                   // 'leads de entrada'
  deveCriarCard(payload: object): boolean
  montarCard(payload: object, sessao: object|null): {
    name: string,
    status: string,
    custom_fields: Array<{ id: string, value: any }>,
    tag: string,
    comentario: string,
  }
  ```
  A Task 4 chama as duas funções e usa `TAG_EDICAO`.

- [ ] **Step 1: Escrever o teste que falha — venda paga com sessão**

Criar `tests/greenn-clickup.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TAG_EDICAO,
  STATUS_INICIAL,
  deveCriarCard,
  montarCard,
} from '../functions/api/webhooks/_greenn-clickup.js';
import { CU_FIELD, CU_FUNIL_WO_PAGO, CU_PRODUTO_AE } from '../functions/api/_clickup.js';

// Recorte do payload REAL da venda 9606659 (12/08/2026), com os campos que a
// ponte lê. Os exemplos da doc da Greenn são fictícios; este veio de produção.
function vendaPaga(extra = {}) {
  return {
    type: 'sale',
    event: 'saleUpdated',
    oldStatus: 'waiting_payment',
    currentStatus: 'paid',
    sale: {
      id: 9606659,
      type: 'TRANSACTION',
      status: 'paid',
      method: 'PIX',
      amount: 27,
      fee: 2.35,
      seller_balance: 24.65,
      updated_at: '2026-08-12T18:18:00.000000Z',
    },
    client: {
      id: 644,
      name: 'Marcelle Mesquita',
      email: 'marcellefernandesdemesquita@gmail.com',
      cellphone: '+5521993911946',
      document: '449.669.868-75',
    },
    product: { id: 186687, name: 'Workshop Black Exponencial Atacado 2026', amount: 27 },
    offer: { hash: 'WwUtjz', name: 'Inteira', amount: 27 },
    sf_trk: '9c1a011e-f15c-45d8-a886-9022b395f3bf',
    saleMetas: [
      { meta_key: 'sf_trk', meta_value: '9c1a011e-f15c-45d8-a886-9022b395f3bf' },
    ],
    ...extra,
  };
}

const sessao = {
  utm_source: 'facebookads',
  utm_medium: 'auto_ig_aberto',
  utm_campaign: 'ae_workshop_black',
  utm_content: 'ad06_planner',
};

// Acha o valor de um custom field pelo id, para o teste não depender da ordem
// do array.
const campo = (card, id) => {
  const achado = card.custom_fields.find((c) => c.id === id);
  return achado ? achado.value : undefined;
};

test('venda paga com sessão vira card com nome, contato e UTMs da visita', () => {
  const card = montarCard(vendaPaga(), sessao);

  assert.equal(card.name, 'Marcelle Mesquita');
  assert.equal(card.status, 'leads de entrada');
  assert.equal(card.tag, 'wo-pago-09-09');

  assert.equal(campo(card, CU_FIELD.nome), 'Marcelle Mesquita');
  assert.equal(campo(card, CU_FIELD.email), 'marcellefernandesdemesquita@gmail.com');
  assert.equal(campo(card, CU_FIELD.whatsapp), '+5521993911946');
  assert.equal(campo(card, CU_FIELD.funil), CU_FUNIL_WO_PAGO);
  assert.equal(campo(card, CU_FIELD.produto), CU_PRODUTO_AE);
  assert.equal(campo(card, CU_FIELD.valor), 27);

  assert.equal(campo(card, CU_FIELD.utmSource), 'facebookads');
  assert.equal(campo(card, CU_FIELD.utmMedium), 'auto_ig_aberto');
  assert.equal(campo(card, CU_FIELD.utmCampaign), 'ae_workshop_black');
  assert.equal(campo(card, CU_FIELD.utmContent), 'ad06_planner');
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Cannot find module '../functions/api/webhooks/_greenn-clickup.js'`

- [ ] **Step 3: Implementação mínima**

Criar `functions/api/webhooks/_greenn-clickup.js`:

```js
// Monta o card do ClickUp a partir de uma venda paga da Greenn.
//
// Função PURA: sem I/O, sem D1, sem fetch, sem env. Quem busca a sessão e fala
// com a API do ClickUp é o endpoint (greenn.js) — aqui só se traduz payload em
// corpo de task, que é a parte onde errar é fácil e testar é barato.
//
// Prefixo "_": o Cloudflare Pages não transforma em rota.

import { CU_FIELD, CU_FUNIL_WO_PAGO, CU_PRODUTO_AE, toClickUpPhone } from '../_clickup.js';

// A tag nomeia a EDIÇÃO do workshop, não a Greenn. A turma seguinte precisa de
// tag nova, senão duas turmas ficam indistinguíveis no CRM. Trocar de edição é
// editar esta linha.
export const TAG_EDICAO = 'wo-pago-09-09';

// NUNCA 'contrato assinado': aquele status faz functions/webhook/clickup.js
// registrar a venda no purchase_log/ROAS do negócio antigo, e a Greenn é um
// produto à parte (decisão da usuária, 2026-08-10).
export const STATUS_INICIAL = 'leads de entrada';

/**
 * Só venda PAGA vira card. Reembolso, estorno, recusa, aguardando pagamento,
 * assinatura e abandono de checkout não criam nada.
 */
export function deveCriarCard(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return payload.event === 'saleUpdated' && payload.currentStatus === 'paid';
}

/**
 * Traduz a venda no corpo da task. `sessao` é a linha de `checkout_sessions`
 * casada pelo `sf_trk`, ou `null` quando a compra não passou pela LP — nesse
 * caso os campos de UTM simplesmente não entram. Não se inventa origem.
 */
export function montarCard(payload, sessao) {
  const cliente = payload.client || {};
  const venda = payload.sale || {};

  const campos = [
    { id: CU_FIELD.nome, value: cliente.name || '' },
    { id: CU_FIELD.email, value: cliente.email || '' },
    { id: CU_FIELD.whatsapp, value: toClickUpPhone(cliente.cellphone) },
    { id: CU_FIELD.funil, value: CU_FUNIL_WO_PAGO },
    { id: CU_FIELD.produto, value: CU_PRODUTO_AE },
    // 💵 Valor, NUNCA 💰 Arrecadado — ver o comentário em _clickup.js.
    { id: CU_FIELD.valor, value: numero(venda.amount) },
  ];

  if (sessao) {
    // Só entram os que têm valor: um custom field com string vazia aparece
    // preenchido-porém-vazio no ClickUp, o que mente sobre haver origem.
    const utms = [
      [CU_FIELD.utmSource, sessao.utm_source],
      [CU_FIELD.utmMedium, sessao.utm_medium],
      [CU_FIELD.utmCampaign, sessao.utm_campaign],
      [CU_FIELD.utmContent, sessao.utm_content],
    ];
    for (const [id, valor] of utms) {
      if (valor) campos.push({ id, value: valor });
    }
  }

  return {
    name: cliente.name || `Venda Greenn ${venda.id || ''}`.trim(),
    status: STATUS_INICIAL,
    custom_fields: campos,
    tag: TAG_EDICAO,
    comentario: comentarioDaVenda(payload, sessao),
  };
}

// O comentário é o registro humano da compra: o que o card não mostra em campo.
function comentarioDaVenda(payload, sessao) {
  const v = payload.sale || {};
  const p = payload.product || {};
  const linhas = [
    `Compra na Greenn — ${p.name || 'produto sem nome'}`,
    `Venda ${v.id} · ${v.method || 'método desconhecido'} · ${moeda(v.amount)}`,
    `Taxa ${moeda(v.fee)} · Líquido ${moeda(v.seller_balance)}`,
  ];
  if (payload.sf_trk) linhas.push(`Rastreamento: ${payload.sf_trk}`);
  if (!sessao) linhas.push('Sem sessão casada: a compra não passou pela LP, ou a visita expirou.');
  return linhas.join('\n');
}

// O D1 e a API do ClickUp recusam `undefined`; e um valor ausente vira 0 no
// campo de moeda, não `null`, para o card não ficar com o campo em branco.
function numero(v) {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function moeda(v) {
  return `R$ ${numero(v).toFixed(2).replace('.', ',')}`;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/greenn-clickup.test.js functions/api/webhooks/_greenn-clickup.js
git commit -m "feat(greenn): monta o card do ClickUp a partir da venda paga"
```

- [ ] **Step 6: Testes que falham — o gatilho e a armadilha**

Acrescentar em `tests/greenn-clickup.test.js`:

```js
test('só venda paga vira card', () => {
  assert.equal(deveCriarCard(vendaPaga()), true);

  for (const status of ['refused', 'refunded', 'chargedback', 'waiting_payment', 'unpaid']) {
    assert.equal(deveCriarCard(vendaPaga({ currentStatus: status })), false, status);
  }
});

test('contrato, abandono e corpo inválido não viram card', () => {
  assert.equal(deveCriarCard({ event: 'contractUpdated', currentStatus: 'paid' }), false);
  assert.equal(deveCriarCard({ event: 'checkoutAbandoned' }), false);
  assert.equal(deveCriarCard({}), false);
  assert.equal(deveCriarCard(null), false);
  assert.equal(deveCriarCard('texto'), false);
});

// ESTE TESTE TRAVA A ARMADILHA. O campo 💰 Arrecadado é lido por
// functions/webhook/clickup.js quando um card entra em "contrato assinado", e
// registra a venda no purchase_log/ROAS do negócio antigo. A Greenn é produto
// separado (decisão da usuária) e não pode entrar ali.
test('o card NUNCA carrega o campo 💰 Arrecadado', () => {
  const ARRECADADO = '85ef1a33-01f7-4ea4-9f24-f742b660a04e';
  const card = montarCard(vendaPaga(), sessao);
  assert.equal(
    card.custom_fields.some((c) => c.id === ARRECADADO),
    false,
    'Arrecadado preencheria a receita do negocio antigo com uma venda da Greenn'
  );
});

test('o card nasce em "leads de entrada", nunca em "contrato assinado"', () => {
  const card = montarCard(vendaPaga(), sessao);
  assert.equal(card.status, 'leads de entrada');
  assert.notEqual(card.status, 'contrato assinado');
  assert.equal(STATUS_INICIAL, 'leads de entrada');
});
```

- [ ] **Step 7: Rodar**

Run: `npm test`
Expected: PASS — a implementação do Step 3 já satisfaz estes testes. Se algum
falhar, corrija `_greenn-clickup.js`; não afrouxe o teste.

- [ ] **Step 8: Commit**

```bash
git add -A tests/greenn-clickup.test.js functions/api/webhooks/_greenn-clickup.js
git commit -m "test(greenn): trava o gatilho e a armadilha do campo Arrecadado"
```

- [ ] **Step 9: Testes que falham — sem sessão e bordas**

Acrescentar em `tests/greenn-clickup.test.js`:

```js
test('sem sessão o card sai sem UTMs, com o resto igual', () => {
  const card = montarCard(vendaPaga({ sf_trk: null }), null);

  assert.equal(campo(card, CU_FIELD.nome), 'Marcelle Mesquita');
  assert.equal(campo(card, CU_FIELD.funil), CU_FUNIL_WO_PAGO);
  assert.equal(campo(card, CU_FIELD.valor), 27);

  for (const id of [CU_FIELD.utmSource, CU_FIELD.utmMedium, CU_FIELD.utmCampaign, CU_FIELD.utmContent]) {
    assert.equal(campo(card, id), undefined);
  }
});

test('sessão com UTMs vazias não cria campo vazio', () => {
  // O checkout_sessions grava '' quando a visita chegou sem UTM. Mandar isso ao
  // ClickUp deixaria o campo "preenchido" com nada.
  const card = montarCard(vendaPaga(), { utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '' });
  for (const id of [CU_FIELD.utmSource, CU_FIELD.utmMedium, CU_FIELD.utmCampaign, CU_FIELD.utmContent]) {
    assert.equal(campo(card, id), undefined);
  }
});

test('telefone é normalizado para o formato do ClickUp', () => {
  const semDDI = montarCard(vendaPaga({
    client: { name: 'Fulana', email: 'f@ex.com', cellphone: '(21) 99391-1946' },
  }), null);
  assert.equal(campo(semDDI, CU_FIELD.whatsapp), '+5521993911946');
});

test('comprador sem nome não gera card sem título', () => {
  const card = montarCard(vendaPaga({
    client: { email: 'sem.nome@ex.com', cellphone: '' },
  }), null);
  assert.equal(card.name, 'Venda Greenn 9606659');
  assert.equal(campo(card, CU_FIELD.whatsapp), '');
});

test('o comentário registra venda, método, taxa e líquido', () => {
  const c = montarCard(vendaPaga(), sessao).comentario;
  assert.match(c, /9606659/);
  assert.match(c, /PIX/);
  assert.match(c, /R\$ 27,00/);
  assert.match(c, /R\$ 2,35/);   // taxa
  assert.match(c, /R\$ 24,65/);  // líquido
  assert.match(c, /9c1a011e-f15c-45d8-a886-9022b395f3bf/);
  assert.match(c, /Workshop Black Exponencial Atacado 2026/);
});

test('sem sessão o comentário diz por quê, em vez de calar', () => {
  const c = montarCard(vendaPaga({ sf_trk: null }), null).comentario;
  assert.match(c, /não passou pela LP/);
});
```

- [ ] **Step 10: Rodar e corrigir o que falhar**

Run: `npm test`
Expected: PASS. Se `comprador sem nome` falhar, confira que o fallback do
`name` usa `venda.id`; se `sessão com UTMs vazias` falhar, confira o `if (valor)`.

- [ ] **Step 11: Commit**

```bash
git add -A tests/greenn-clickup.test.js functions/api/webhooks/_greenn-clickup.js
git commit -m "test(greenn): cobre ausencia de sessao, telefone e comentario"
```

---

### Task 4: Ligar a ponte no endpoint e documentar

**Files:**
- Modify: `functions/api/webhooks/greenn.js`
- Modify: `docs/greenn-webhook.md`

**Interfaces:**
- Consumes: `deveCriarCard`, `montarCard`, `TAG_EDICAO` de `_greenn-clickup.js` (Task 3); `CU_FIELD`, `CU_DEFAULT_LIST`, `clickupFetch`, `searchClickUpTask`, `clickupWrite`, `addClickUpTag` de `_clickup.js` (Task 1); a coluna `clickup_task_id` (Task 2).
- Produces: nada consumido por tasks posteriores.

- [ ] **Step 1: Ler o endpoint atual**

Run: `cat functions/api/webhooks/greenn.js`

Localize o bloco que grava no D1 (o `INSERT OR IGNORE`) e o `return json({ ok: true, status: 'gravado', ... })` no fim. A ponte entra **entre** os dois.

- [ ] **Step 2: Acrescentar os imports**

No topo de `functions/api/webhooks/greenn.js`, junto do import existente de `_greenn-evento.js`:

```js
import { deveCriarCard, montarCard, TAG_EDICAO } from './_greenn-clickup.js';
import {
  CU_FIELD,
  CU_DEFAULT_LIST,
  clickupFetch,
  searchClickUpTask,
  clickupWrite,
  addClickUpTag,
} from '../_clickup.js';
```

- [ ] **Step 3: Escrever a função da ponte**

Acrescentar no fim de `functions/api/webhooks/greenn.js`, antes do helper `json`:

```js
// PONTE GREENN → CLICKUP
//
// Roda em waitUntil: a resposta 200 para a Greenn já saiu quando isto executa.
// Nada aqui pode alterar, atrasar ou derrubar aquela resposta — a Greenn não
// reentrega, e um erro nosso viraria perda de dado dela.
//
// Falha deixa `clickup_task_id` NULL na linha já gravada. Como o raw_json está
// guardado, a venda é recuperável: nada se perde, só fica pendente. Não há
// retry automático de propósito (ver spec 2026-08-13).
async function pontearParaClickUp(env, payload, linhaId) {
  if (!env.CLICKUP_API_TOKEN) {
    console.error('greenn — ponte ClickUp ignorada: falta CLICKUP_API_TOKEN');
    return;
  }

  const cliente = payload.client || {};
  const vendaId = payload.sale && payload.sale.id;

  try {
    // Origem da visita: o sf_trk é o mesmo UUID gravado em checkout_sessions
    // quando a pessoa entrou na LP (confirmado com a venda 9606659). Sem ele, ou
    // sem linha casada, o card sai sem UTMs — não se inventa origem.
    let sessao = null;
    if (payload.sf_trk) {
      try {
        sessao = await env.DB.prepare(
          `SELECT utm_source, utm_medium, utm_campaign, utm_content
             FROM checkout_sessions WHERE trk = ?`
        ).bind(payload.sf_trk).first();
      } catch (e) {
        console.error('greenn — falha ao buscar a sessão do sf_trk:', e?.message || e);
      }
    }

    const card = montarCard(payload, sessao);

    // Dedup: mesma busca do /tracker. Erro na busca é tratado como "não achou" —
    // criar um card duplicado é menos ruim do que perder o comprador.
    let existente = null;
    try {
      existente =
        (await searchClickUpTask(CU_FIELD.email, cliente.email || '', env)) ||
        (await searchClickUpTask(CU_FIELD.whatsapp, card.custom_fields.find(
          (c) => c.id === CU_FIELD.whatsapp)?.value || '', env));
    } catch (e) {
      console.error('greenn — busca no ClickUp falhou, seguindo como novo:', e?.message || e);
    }

    let taskId;
    if (existente) {
      // NÃO sobrescreve Funil nem Produto: se a pessoa veio de LIVES SEMANAIS,
      // ela continua vindo de lá. Carimbar WO PAGO por cima apagaria a origem
      // verdadeira. A tag e o comentário são aditivos.
      taskId = existente.id;
    } else {
      const listId = env.CLICKUP_LIST_ID || CU_DEFAULT_LIST;
      const res = await clickupWrite(() => clickupFetch(`/list/${listId}/task`, {
        method: 'POST',
        body: JSON.stringify({
          name: card.name,
          status: card.status,
          custom_fields: card.custom_fields,
        }),
      }, env));
      const criada = await res.json();
      taskId = criada.id;
    }

    if (!taskId) {
      console.error('greenn — ClickUp não devolveu id da task; venda', vendaId);
      return;
    }

    await addClickUpTag(taskId, TAG_EDICAO, env);

    // Comentário best-effort: o card já existe e já está tagueado, então falhar
    // aqui não justifica marcar a ponte como perdida.
    try {
      await clickupWrite(() => clickupFetch(`/task/${taskId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ comment_text: card.comentario, notify_all: false }),
      }, env));
    } catch (e) {
      console.error('greenn — comentário falhou na venda', vendaId, e?.message || e);
    }

    if (linhaId) {
      await env.DB.prepare(
        `UPDATE greenn_webhook_event SET clickup_task_id = ? WHERE id = ?`
      ).bind(taskId, linhaId).run();
    }
  } catch (e) {
    // Só o id da venda: o payload carrega nome, e-mail, telefone e CPF.
    console.error('greenn — ponte ClickUp falhou na venda', vendaId, e?.message || e);
  }
}
```

- [ ] **Step 4: Disparar a ponte depois da gravação**

No corpo de `onRequestPost`, o `INSERT OR IGNORE` atual não devolve o id da
linha. Substitua o bloco de gravação por esta versão, que captura o id e dispara
a ponte:

```js
  let linhaId = null;
  try {
    const gravou = await env.DB.prepare(
      `INSERT OR IGNORE INTO greenn_webhook_event
         (event, entity_type, entity_id, current_status, product_id, amount,
          entity_updated, received_at, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      evento.event, evento.entity_type, evento.entity_id, evento.current_status,
      evento.product_id, evento.amount, evento.entity_updated,
      Math.floor(Date.now() / 1000), cru
    ).run();
    // `meta.last_row_id` só vale quando a linha realmente entrou. Numa reentrega
    // o INSERT OR IGNORE não insere nada, e aí não há ponte a fazer — o card já
    // foi criado na primeira vez.
    linhaId = gravou?.meta?.changes ? gravou.meta.last_row_id : null;
  } catch (e) {
    // Único 5xx do endpoint, e é honesto: o dado não entrou.
    console.error('greenn — falha ao gravar no D1:', e?.message || e);
    return json({ error: 'Erro ao gravar' }, 500);
  }

  // A ponte é o ÚLTIMO passo e roda fora do caminho da resposta. Só venda paga
  // que acabou de entrar (linhaId não-nulo) vira card: reentrega não duplica.
  if (linhaId && deveCriarCard(body)) {
    context.waitUntil(pontearParaClickUp(env, body, linhaId));
  }
```

Atenção: `context` precisa estar disponível. A assinatura atual é
`export async function onRequestPost(context)` e o corpo faz
`const { request, env } = context;` — mantenha o `context` acessível (não
desestruture-o de forma que o perca).

- [ ] **Step 5: Rodar a suíte e o build**

Run: `npm test && npm run build`
Expected: testes passando (os da Task 3 continuam verdes; nenhum teste novo aqui — o caminho HTTP não é coberto, conforme a spec) e build sem erro.

- [ ] **Step 6: Verificar localmente com o servidor**

Em um terminal:

```bash
npx wrangler@4.120.1 pages dev dist --port 8788 --binding GREENN_WEBHOOK_TOKEN=token-de-teste
```

(Se `dist/` não existir, rode `npm run build` antes. NÃO passe a flag `--d1`: ela
cria um SQLite diferente do que o `d1 execute --local` usa; o binding vem do
`wrangler.toml`.)

Em outro terminal, uma venda paga sem token de ClickUp configurado — a ponte deve
ser ignorada com log, e a gravação deve funcionar normalmente:

```bash
curl -s -X POST http://localhost:8788/api/webhooks/greenn \
  -H "Content-Type: application/json" -H "X-Webhook-Token: token-de-teste" \
  -d '{"type":"sale","event":"saleUpdated","currentStatus":"paid","sale":{"id":424242,"method":"PIX","amount":27,"fee":2.35,"seller_balance":24.65,"updated_at":"2026-08-13T12:00:00.000Z"},"client":{"name":"Teste Ponte","email":"teste.ponte@exemplo.com","cellphone":"+5521999990000"},"product":{"id":186687,"name":"Workshop Black Exponencial Atacado 2026"},"sf_trk":null}'
echo
```

Expected: `{"ok":true,"status":"gravado","event":"saleUpdated"}`, e no terminal do
servidor a linha `greenn — ponte ClickUp ignorada: falta CLICKUP_API_TOKEN`.

Conferir que a linha entrou com a coluna nova nula:

```bash
npx wrangler@4.120.1 d1 execute tracking-ae-db --local --command "SELECT entity_id, current_status, clickup_task_id FROM greenn_webhook_event WHERE entity_id = 424242;"
```

Expected: `424242 | paid | NULL` — a venda gravada, a ponte pendente. É
exatamente o comportamento de falha desejado: nada se perde.

- [ ] **Step 7: Limpar o dado de teste**

```bash
npx wrangler@4.120.1 d1 execute tracking-ae-db --local --command "DELETE FROM greenn_webhook_event WHERE entity_id = 424242;"
```

- [ ] **Step 8: Documentar**

Acrescentar em `docs/greenn-webhook.md`, antes da seção "Limites conhecidos":

```markdown
## Comprador vira card no ClickUp

Quando uma venda é **paga**, o comprador vira card na lista 🤑 CRM:

- 🔻 Funil `WO PAGO`, 🛒 Produto `AE`, status `leads de entrada`
- tag **`wo-pago-09-09`** — ela nomeia a EDIÇÃO do workshop; a próxima turma
  precisa de tag nova, trocada em `functions/api/webhooks/_greenn-clickup.js`
- as UTMs da visita que gerou a compra, casadas pelo `sf_trk`
- um comentário com venda, método, taxa e líquido

Só venda paga. Reembolso, recusa e abandono não criam card.

**Se o comprador já era lead**, o card dele NÃO tem o funil trocado — só ganha a
tag e o comentário. A origem original dele continua valendo.

**O campo 💰 Arrecadado nunca é preenchido.** Ele é lido por
`functions/webhook/clickup.js` quando um card entra em `contrato assinado`, e
registraria a venda da Greenn na Receita e no ROAS do negócio antigo. O valor vai
para 💵 Valor.

### Vendas que não viraram card

    npx wrangler d1 execute tracking-ae-db --remote \
      --command "SELECT id, entity_id, datetime(received_at,'unixepoch','-3 hours') AS recebido FROM greenn_webhook_event WHERE event='saleUpdated' AND current_status='paid' AND clickup_task_id IS NULL;"

Lista vazia significa que todas as vendas pagas viraram card. Não há retry
automático: o `raw_json` guardado permite recriar qualquer uma à mão.
```

- [ ] **Step 9: Commit**

```bash
git add functions/api/webhooks/greenn.js docs/greenn-webhook.md
git commit -m "feat(greenn): comprador vira card no ClickUp com a origem da visita"
```

---

## Depois do plano (não são tasks)

Dependem da usuária e não podem ser executados por quem implementa:

1. **Aplicar a migration 0033 em produção:**
   `npx wrangler d1 execute tracking-ae-db --remote --file=migrations/0033_greenn_clickup.sql`
   (não use `d1 migrations apply --remote` — 0021/0022/0025 quebram ao reaplicar)
2. **Fazer o merge e o deploy.**
3. **Confirmar com uma venda real** — é a única prova de que o card nasce certo.
   A verificação local só cobre o caminho em que o ClickUp está desligado.
4. **Conferir o primeiro card**: funil `WO PAGO`, tag `wo-pago-09-09`, UTMs
   preenchidas, e **💰 Arrecadado vazio**.

## Self-review

Conferência do plano contra a spec:

- Gatilho só em `saleUpdated`/`paid` — Task 3 (`deveCriarCard`), Task 4 step 4. ✅
- `waitUntil`, sem afetar a resposta — Task 4, steps 3 e 4. ✅
- Funil `WO PAGO`, Produto `AE`, status `leads de entrada`, tag `wo-pago-09-09` — Task 3, step 3, com teste. ✅
- Armadilha do 💰 Arrecadado — Task 3 step 6 (teste dedicado) + comentário em `_clickup.js`. ✅
- UTMs via `sf_trk` → `checkout_sessions` — Task 4 step 3; ausência coberta em Task 3 step 9. ✅
- Card existente não tem funil sobrescrito — Task 4, step 3. ✅
- Coluna `clickup_task_id` + consulta de pendentes — Task 2, doc na Task 4 step 8. ✅
- Sem retry automático — declarado na Task 2 e na doc. ✅
- Extração dos helpers para módulo compartilhado — Task 1 (com desvio de caminho declarado). ✅
- Testes listados na spec — Task 3, steps 1, 6 e 9 cobrem os oito itens. ✅
- Nunca logar dados do comprador — Task 4, step 3 (só id da venda). ✅
- Verificação ponta a ponta só com venda real — "Depois do plano". ✅

Consistência de nomes: `deveCriarCard`, `montarCard`, `TAG_EDICAO`,
`STATUS_INICIAL` e `CU_FIELD.valor` são usados com os mesmos nomes nas Tasks 3 e
4. `CU_FUNIL_WO_PAGO` é definido na Task 1 e consumido na Task 3.
