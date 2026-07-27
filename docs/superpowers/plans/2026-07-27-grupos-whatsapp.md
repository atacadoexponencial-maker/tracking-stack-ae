# Aba "Grupos" no dash — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma aba nova no dashboard mostrando entradas e saídas por dia nos grupos de WhatsApp das Lives Semanais e dos Workshops, com o dia recorde de cada e um card do estado da conexão.

**Architecture:** Os eventos `GROUP_PARTICIPANTS_UPDATE` da Evolution já chegam no n8n; um nó novo repassa uma cópia para `POST /api/webhooks/whatsapp-grupo`, que classifica e grava no D1. O dash lê de `GET /api/grupos` (só D1) e, em requisição separada, de `GET /api/grupos-conexao` (única que fala com a Evolution). Toda a lógica fica no backend; o HTML só desenha.

**Tech Stack:** Cloudflare Pages Functions (JS, ESM), D1 (binding `DB`), HTML/JS estático em `public/dash/index.html`, testes com o runner nativo do Node (`node --test`).

**Spec:** `docs/superpowers/specs/2026-07-27-grupos-whatsapp-design.md`

## Global Constraints

- **Fuso:** todo agrupamento "por dia" usa `-03:00` (America/Sao_Paulo, sem horário de verão desde 2019). O dia local é gravado na escrita, nunca calculado na leitura.
- **Thin client:** nenhum cálculo de métrica no HTML. Séries, totais, saldos e recordes vêm prontos do endpoint. O front só formata.
- **Segredos nunca no front:** a `apikey` da Evolution só existe dentro da Pages Function.
- **Nomes de rótulo:** exatamente `Lives Semanais` e `Workshops`.
- **Ações gravadas:** exatamente as strings `entrou`, `saiu`, `removido`.
- **JIDs monitorados** (grupos de avisos das Comunidades — o grupo "pai" é ignorado de propósito, senão cada entrada conta duas vezes):
  - Workshops: `120363380235066572@g.us`
  - Lives Semanais: `120363427499061913@g.us`
- **Idempotência:** reentrega do n8n não pode duplicar contagem.
- **Estilo do código:** comentários em português explicando *por quê*, como no resto de `functions/`. Sem dependências novas.

---

### Task 1: Migration e schema

**Files:**
- Create: `migrations/0026_whatsapp_grupos.sql`
- Modify: `docs/schema.md` (acrescentar seção antes de "Things NOT in the schema")

**Interfaces:**
- Consumes: nada.
- Produces: tabelas `whatsapp_group_events`, `whatsapp_groups_tracked`, `whatsapp_groups_seen` no D1, com os dois grupos já semeados.

- [ ] **Step 1: Escrever a migration**

Criar `migrations/0026_whatsapp_grupos.sql`:

```sql
-- Entradas e saídas nos grupos de WhatsApp (feature: aba "Grupos" do dash).
-- Alimentado por /api/webhooks/whatsapp-grupo (fan-out do webhook da Evolution
-- que já roda no n8n), lido por /api/grupos. Mesmo padrão de workshops/ad_spend:
-- o dash lê daqui e nunca toca a Evolution no caminho da requisição.

-- Um registro por PESSOA por evento. O evento da Evolution pode trazer vários
-- participantes de uma vez (`participants: []`), e cada um vira uma linha.
CREATE TABLE IF NOT EXISTS whatsapp_group_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid       TEXT NOT NULL,
    participant_jid TEXT NOT NULL,
    action          TEXT NOT NULL,   -- 'entrou' | 'saiu' | 'removido'
    actor_jid       TEXT,            -- quem executou (NULL quando a Evolution não informa)
    occurred_at     TEXT NOT NULL,   -- ISO 8601 UTC
    day_local       TEXT NOT NULL,   -- 'YYYY-MM-DD' em -03:00, calculado na escrita
    received_at     INTEGER NOT NULL,-- unix seconds
    raw_json        TEXT             -- payload truncado, para depuração
);

-- O evento da Evolution não tem ID próprio. Esta é a chave natural: o mesmo
-- participante, com a mesma ação, no mesmo grupo e no mesmo instante é o mesmo
-- fato. Combinada com INSERT OR IGNORE, torna a reentrega do n8n inofensiva.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wge_dedup
    ON whatsapp_group_events(group_jid, participant_jid, action, occurred_at);
CREATE INDEX IF NOT EXISTS idx_wge_dia
    ON whatsapp_group_events(group_jid, day_local);

-- Quais grupos são monitorados. Vive em tabela, não em código, porque a
-- Comunidade da live NÃO é permanente: quando abrirem o ciclo seguinte, o JID
-- muda e passar a acompanhar o novo precisa ser um INSERT, não um deploy.
CREATE TABLE IF NOT EXISTS whatsapp_groups_tracked (
    group_jid  TEXT PRIMARY KEY,
    label      TEXT NOT NULL,       -- 'Lives Semanais' | 'Workshops'
    group_name TEXT,                -- só rótulo humano; o nome do grupo muda toda semana
    enabled    INTEGER NOT NULL DEFAULT 1
);

-- Todo grupo que gerar evento entra aqui, SEM dados de pessoas. O número está em
-- ~119 grupos, a maioria de terceiros: guardar participantes deles não se faz.
-- Serve de rede de segurança — Comunidade nova aparece no dash como "não
-- monitorado" em vez de sumir em silêncio.
CREATE TABLE IF NOT EXISTS whatsapp_groups_seen (
    group_jid     TEXT PRIMARY KEY,
    group_name    TEXT,
    events        INTEGER NOT NULL DEFAULT 0,
    last_event_at TEXT
);

-- Grupos de AVISOS das duas Comunidades (verificado na Evolution em 2026-07-27).
-- Os grupos "pai" (120363397317313470 e 120363429583787754) ficam de fora de
-- propósito: uma entrada na Comunidade gera evento nos dois, e contar ambos
-- dobraria o número.
INSERT OR IGNORE INTO whatsapp_groups_tracked (group_jid, label, group_name, enabled) VALUES
  ('120363380235066572@g.us', 'Workshops',      '📦 Workshop | Atacado Exponencial', 1),
  ('120363427499061913@g.us', 'Lives Semanais', '30/07 às 12h | O jogo da escala no atacado', 1);
```

- [ ] **Step 2: Aplicar no D1 local e conferir**

```bash
npx wrangler d1 migrations apply tracking-ae-db --local
npx wrangler d1 execute tracking-ae-db --local --command "SELECT group_jid, label FROM whatsapp_groups_tracked ORDER BY label"
```

Expected: duas linhas — `120363427499061913@g.us | Lives Semanais` e `120363380235066572@g.us | Workshops`.

- [ ] **Step 3: Documentar no schema.md**

Em `docs/schema.md`, antes da seção `## Things NOT in the schema (deliberate)`, acrescentar:

```markdown
## WhatsApp group events

Fed by `/api/webhooks/whatsapp-grupo` (fan-out of the Evolution webhook that
already runs in n8n), read by `/api/grupos`.

### `whatsapp_group_events`

One row per person per event.

| Column | Type | Notes |
|---|---|---|
| `group_jid` | TEXT NOT NULL | `…@g.us` |
| `participant_jid` | TEXT NOT NULL | who joined/left |
| `action` | TEXT NOT NULL | `entrou` / `saiu` / `removido` |
| `actor_jid` | TEXT | who performed it; NULL when Evolution omits it |
| `occurred_at` | TEXT NOT NULL | ISO 8601 UTC |
| `day_local` | TEXT NOT NULL | `YYYY-MM-DD` at `-03:00`, computed on write |
| `received_at` | INTEGER NOT NULL | Unix seconds |

**Unique index** `idx_wge_dedup` on `(group_jid, participant_jid, action,
occurred_at)` — the Evolution event has no ID of its own, so this natural key
plus `INSERT OR IGNORE` makes n8n redelivery harmless.

### `whatsapp_groups_tracked`

Allowlist: `group_jid` (PK), `label`, `group_name`, `enabled`. Lives in a table
rather than in code because the live Community is not permanent — a new cycle
means a new JID, and following it must be an INSERT, not a deploy.

### `whatsapp_groups_seen`

Every group that emits an event, **without participant data**: `group_jid` (PK),
`group_name`, `events`, `last_event_at`. Safety net so a new Community shows up
in the dash instead of vanishing silently.
```

- [ ] **Step 4: Commit**

```bash
git add migrations/0026_whatsapp_grupos.sql docs/schema.md
git commit -m "feat: schema dos eventos de grupo de WhatsApp (migration 0026)"
```

---

### Task 2: Classificação do evento (função pura + testes)

**Files:**
- Create: `functions/api/webhooks/_classificar.js`
- Create: `tests/grupos-classificar.test.js`
- Modify: `package.json` (adicionar script `test`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `diaLocal(isoUtc: string) → string` (`'YYYY-MM-DD'` em `-03:00`)
  - `diaLocalDeUnix(unixSeconds: number) → string`
  - `classificarEvento(raw: object, recebidoEmMs: number) → null | { groupJid: string, occurredAt: string, dayLocal: string, linhas: Array<{ participantJid: string, action: 'entrou'|'saiu'|'removido', actorJid: string|null }> }`

Arquivos em `functions/` cujo nome começa com `_` não viram rota no Cloudflare Pages — é o mesmo mecanismo de `functions/webhook/_core.js`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/grupos-classificar.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificarEvento, diaLocal, diaLocalDeUnix } from '../functions/api/webhooks/_classificar.js';

const RECEBIDO_MS = Date.parse('2026-07-27T18:00:00.000Z');

function evento(extra = {}) {
  return {
    event: 'group-participants.update',
    instance: 'MarcelleProfissional',
    date_time: '2026-07-27T17:30:00.000Z',
    data: {
      id: '120363380235066572@g.us',
      author: '5521999999999@s.whatsapp.net',
      participants: ['5511888888888@s.whatsapp.net'],
      action: 'add',
      ...extra,
    },
  };
}

test('add vira "entrou"', () => {
  const r = classificarEvento(evento(), RECEBIDO_MS);
  assert.equal(r.groupJid, '120363380235066572@g.us');
  assert.equal(r.linhas.length, 1);
  assert.equal(r.linhas[0].action, 'entrou');
  assert.equal(r.linhas[0].participantJid, '5511888888888@s.whatsapp.net');
});

test('remove por outra pessoa vira "removido"', () => {
  const r = classificarEvento(evento({ action: 'remove' }), RECEBIDO_MS);
  assert.equal(r.linhas[0].action, 'removido');
  assert.equal(r.linhas[0].actorJid, '5521999999999@s.whatsapp.net');
});

test('remove de si mesmo vira "saiu"', () => {
  const r = classificarEvento(evento({
    action: 'remove',
    author: '5511888888888@s.whatsapp.net',
  }), RECEBIDO_MS);
  assert.equal(r.linhas[0].action, 'saiu');
});

test('sufixo de dispositivo no JID não confunde saiu com removido', () => {
  const r = classificarEvento(evento({
    action: 'remove',
    author: '5511888888888:12@s.whatsapp.net',
  }), RECEBIDO_MS);
  assert.equal(r.linhas[0].action, 'saiu');
});

test('sem autor informado, remove assume "saiu"', () => {
  const r = classificarEvento(evento({ action: 'remove', author: undefined }), RECEBIDO_MS);
  assert.equal(r.linhas[0].action, 'saiu');
  assert.equal(r.linhas[0].actorJid, null);
});

test('vários participantes viram várias linhas', () => {
  const r = classificarEvento(evento({
    participants: ['551188@s.whatsapp.net', '551199@s.whatsapp.net', '551177@s.whatsapp.net'],
  }), RECEBIDO_MS);
  assert.equal(r.linhas.length, 3);
  assert.ok(r.linhas.every((l) => l.action === 'entrou'));
});

test('promote e demote são ignorados', () => {
  assert.equal(classificarEvento(evento({ action: 'promote' }), RECEBIDO_MS), null);
  assert.equal(classificarEvento(evento({ action: 'demote' }), RECEBIDO_MS), null);
});

test('evento de outro tipo é ignorado', () => {
  const r = classificarEvento({ event: 'messages.upsert', data: {} }, RECEBIDO_MS);
  assert.equal(r, null);
});

test('conversa individual é ignorada', () => {
  const r = classificarEvento(evento({ id: '5511888888888@s.whatsapp.net' }), RECEBIDO_MS);
  assert.equal(r, null);
});

test('payload malformado não explode', () => {
  assert.equal(classificarEvento(null, RECEBIDO_MS), null);
  assert.equal(classificarEvento({}, RECEBIDO_MS), null);
  assert.equal(classificarEvento(evento({ participants: [] }), RECEBIDO_MS), null);
});

test('sem date_time usa a hora de recebimento', () => {
  const cru = evento();
  delete cru.date_time;
  const r = classificarEvento(cru, RECEBIDO_MS);
  assert.equal(r.occurredAt, new Date(RECEBIDO_MS).toISOString());
});

test('date_time em unix segundos é aceito', () => {
  const cru = evento();
  cru.date_time = 1785000000;
  const r = classificarEvento(cru, RECEBIDO_MS);
  assert.equal(r.occurredAt, new Date(1785000000 * 1000).toISOString());
});

test('dia local usa -03:00, não UTC', () => {
  // 02:00 UTC do dia 28 ainda é dia 27 em Brasília.
  assert.equal(diaLocal('2026-07-28T02:00:00.000Z'), '2026-07-27');
  assert.equal(diaLocal('2026-07-28T03:00:00.000Z'), '2026-07-28');
});

test('dia local a partir de unix', () => {
  assert.equal(diaLocalDeUnix(Date.parse('2026-07-28T02:00:00.000Z') / 1000), '2026-07-27');
});

test('o dia do evento acompanha occurredAt', () => {
  const cru = evento();
  cru.date_time = '2026-07-28T02:30:00.000Z';
  assert.equal(classificarEvento(cru, RECEBIDO_MS).dayLocal, '2026-07-27');
});
```

- [ ] **Step 2: Adicionar o script de teste**

Em `package.json`, dentro de `"scripts"`, acrescentar após `"preview"`:

```json
    "test": "node --test tests/"
```

- [ ] **Step 3: Rodar os testes e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module .../functions/api/webhooks/_classificar.js`

- [ ] **Step 4: Implementar**

Criar `functions/api/webhooks/_classificar.js`:

```js
// Traduz o payload de GROUP_PARTICIPANTS_UPDATE da Evolution em linhas de
// whatsapp_group_events. Função PURA: sem I/O, sem D1, sem env — é o que permite
// testá-la com `node --test` sem subir nada.
//
// Prefixo "_" no nome: o Cloudflare Pages não transforma em rota (mesmo
// mecanismo de functions/webhook/_core.js).

// America/Sao_Paulo não tem horário de verão desde 2019, então o deslocamento é
// fixo. Se um dia voltar, este é o único ponto a mudar.
const OFFSET_SEGUNDOS = -3 * 3600;

const pad = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' no fuso de Brasília. O dia é calculado UMA vez, na escrita, e
// gravado: assim a agregação por dia não depende do fuso de quem consulta.
export function diaLocal(isoUtc) {
  const ms = Date.parse(isoUtc);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + OFFSET_SEGUNDOS * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function diaLocalDeUnix(unixSeconds) {
  return diaLocal(new Date(unixSeconds * 1000).toISOString());
}

// A Evolution manda o instante ora como ISO, ora como unix (segundos ou ms).
function paraIso(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (Number.isFinite(n) && n > 0) {
    const ms = String(Math.trunc(n)).length <= 10 ? n * 1000 : n;
    return new Date(ms).toISOString();
  }
  const ms = Date.parse(valor);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

// '5511888888888:12@s.whatsapp.net' → '5511888888888'. O sufixo ":N" identifica
// o aparelho; sem tirá-lo, alguém que sai pelo celular secundário seria contado
// como "removido por outra pessoa".
function numeroDe(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

export function classificarEvento(raw, recebidoEmMs) {
  if (!raw || typeof raw !== 'object') return null;

  const nome = String(raw.event || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (nome !== 'GROUP_PARTICIPANTS_UPDATE') return null;

  const data = raw.data || {};
  const groupJid = String(data.id || '');
  if (!groupJid.endsWith('@g.us')) return null;

  const acao = String(data.action || '').toLowerCase();
  // promote/demote mudam o papel de quem já está no grupo — não são entrada nem
  // saída, e contá-los inflaria o número.
  if (acao !== 'add' && acao !== 'remove') return null;

  const participantes = (Array.isArray(data.participants) ? data.participants : []).filter(Boolean);
  if (!participantes.length) return null;

  const autor = data.author ? String(data.author) : null;
  const occurredAt = paraIso(raw.date_time) || new Date(recebidoEmMs).toISOString();

  const linhas = participantes.map((p) => {
    const participantJid = String(p);
    let action;
    if (acao === 'add') {
      action = 'entrou';
    } else if (!autor || numeroDe(autor) === numeroDe(participantJid)) {
      // Sem autor não dá para distinguir; "saiu" é o caso esmagadoramente mais
      // comum num grupo aberto, e é o mais conservador (não acusa remoção).
      action = 'saiu';
    } else {
      action = 'removido';
    }
    return { participantJid, action, actorJid: autor };
  });

  return { groupJid, occurredAt, dayLocal: diaLocal(occurredAt), linhas };
}
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `npm test`
Expected: PASS — 15 testes, 0 falhas.

- [ ] **Step 6: Commit**

```bash
git add functions/api/webhooks/_classificar.js tests/grupos-classificar.test.js package.json
git commit -m "feat: classificação dos eventos de participante de grupo do WhatsApp"
```

---

### Task 3: Endpoint de escrita

**Files:**
- Create: `functions/api/webhooks/whatsapp-grupo.js`

**Interfaces:**
- Consumes: `classificarEvento` e `diaLocal` de `./_classificar.js`; binding `DB`; env `GRUPOS_WEBHOOK_SECRET`.
- Produces: rota `POST /api/webhooks/whatsapp-grupo`. Respostas: `401 {error}`; `200 {ok:true, status:'ignorado'|'nao_monitorado'|'gravado', linhas?}`.

- [ ] **Step 1: Implementar o endpoint**

Criar `functions/api/webhooks/whatsapp-grupo.js`:

```js
// POST /api/webhooks/whatsapp-grupo
//
// Recebe uma CÓPIA do evento cru da Evolution, repassada por um nó HTTP do
// workflow do n8n que já recebe o webhook ("Evolution -> Postgres | Grupos
// clientes read-only"). A Evolution só aceita uma URL de webhook por instância,
// e ela já aponta para o n8n — repontar quebraria aquele fluxo.
//
// Auth: header `x-grupos-secret: <env.GRUPOS_WEBHOOK_SECRET>`. É um segredo
// PRÓPRIO, não o SYNC_SECRET: aquele abre quatro endpoints de sync, e colá-lo no
// n8n daria poder de escrita em todos eles a quem tem acesso ao n8n.
//
// Responde 200 rápido mesmo quando ignora o evento — a resposta do n8n para a
// Evolution não pode ficar pendurada por causa daqui.

import { classificarEvento } from './_classificar.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const enviado = request.headers.get('x-grupos-secret') || '';
  if (!env.GRUPOS_WEBHOOK_SECRET || enviado !== env.GRUPOS_WEBHOOK_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try { body = await request.json(); } catch (_) {
    return json({ ok: true, status: 'ignorado', motivo: 'json_invalido' });
  }

  const evento = classificarEvento(body, Date.now());
  if (!evento) return json({ ok: true, status: 'ignorado' });

  const agora = Math.floor(Date.now() / 1000);

  // Todo grupo que gera evento é registrado — sem participantes. É assim que uma
  // Comunidade nova aparece no dash em vez de sumir calada.
  const stmts = [
    env.DB.prepare(
      `INSERT INTO whatsapp_groups_seen (group_jid, group_name, events, last_event_at)
       VALUES (?, NULL, 1, ?)
       ON CONFLICT(group_jid) DO UPDATE SET
         events = whatsapp_groups_seen.events + 1,
         last_event_at = excluded.last_event_at`
    ).bind(evento.groupJid, evento.occurredAt),
  ];

  const monitorado = await env.DB.prepare(
    `SELECT label FROM whatsapp_groups_tracked WHERE group_jid = ? AND enabled = 1`
  ).bind(evento.groupJid).first();

  if (!monitorado) {
    await env.DB.batch(stmts);
    return json({ ok: true, status: 'nao_monitorado', group_jid: evento.groupJid });
  }

  // Payload truncado: serve para depurar um caso estranho, não para virar acervo.
  const cru = JSON.stringify(body).slice(0, 2000);
  const ins = env.DB.prepare(
    `INSERT OR IGNORE INTO whatsapp_group_events
       (group_jid, participant_jid, action, actor_jid, occurred_at, day_local, received_at, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const l of evento.linhas) {
    stmts.push(ins.bind(
      evento.groupJid, l.participantJid, l.action, l.actorJid,
      evento.occurredAt, evento.dayLocal, agora, cru));
  }

  await env.DB.batch(stmts);
  return json({ ok: true, status: 'gravado', linhas: evento.linhas.length });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: Subir o ambiente local**

```bash
npx wrangler pages dev dist --d1 DB=tracking-ae-db --binding GRUPOS_WEBHOOK_SECRET=teste-local
```

Deixar rodando em outro terminal. Se `dist/` não existir, rodar `npm run build` antes.

- [ ] **Step 3: Smoke test — segredo errado é rejeitado**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8788/api/webhooks/whatsapp-grupo \
  -H "x-grupos-secret: errado" -H "Content-Type: application/json" -d '{}'
```

Expected: `401`

- [ ] **Step 4: Smoke test — entrada em grupo monitorado é gravada**

```bash
curl -s -X POST http://localhost:8788/api/webhooks/whatsapp-grupo \
  -H "x-grupos-secret: teste-local" -H "Content-Type: application/json" \
  -d '{"event":"group-participants.update","date_time":"2026-07-27T17:30:00.000Z","data":{"id":"120363380235066572@g.us","author":"5521999999999@s.whatsapp.net","participants":["5511888888888@s.whatsapp.net"],"action":"add"}}'
```

Expected: `{"ok":true,"status":"gravado","linhas":1}`

- [ ] **Step 5: Smoke test — reenviar o MESMO evento não duplica**

Repetir exatamente o comando do Step 4, depois conferir:

```bash
npx wrangler d1 execute tracking-ae-db --local --command "SELECT COUNT(*) AS n FROM whatsapp_group_events"
```

Expected: `n = 1` (a segunda chamada também responde `gravado`, mas o `INSERT OR IGNORE` descarta).

- [ ] **Step 6: Smoke test — grupo de terceiro não guarda participante**

```bash
curl -s -X POST http://localhost:8788/api/webhooks/whatsapp-grupo \
  -H "x-grupos-secret: teste-local" -H "Content-Type: application/json" \
  -d '{"event":"group-participants.update","date_time":"2026-07-27T17:31:00.000Z","data":{"id":"120363999999999999@g.us","author":"5521999999999@s.whatsapp.net","participants":["5511777777777@s.whatsapp.net"],"action":"add"}}'
npx wrangler d1 execute tracking-ae-db --local --command "SELECT COUNT(*) AS eventos FROM whatsapp_group_events; SELECT group_jid, events FROM whatsapp_groups_seen"
```

Expected: `eventos = 1` (não subiu), e `whatsapp_groups_seen` com as duas linhas — a monitorada e a de terceiro, esta sem nenhum participante gravado.

- [ ] **Step 7: Commit**

```bash
git add functions/api/webhooks/whatsapp-grupo.js
git commit -m "feat: endpoint que recebe os eventos de grupo do WhatsApp"
```

---

### Task 4: Endpoint de leitura

**Files:**
- Create: `functions/api/grupos.js`

**Interfaces:**
- Consumes: `diaLocalDeUnix` de `./webhooks/_classificar.js`; binding `DB`; env `DASH_KEY`.
- Produces: rota `GET /api/grupos?from=<unix>&to=<unix>&key=<DASH_KEY>`, respondendo:

```js
{
  grupos: [{
    group_jid: string, label: string,
    entradas: number, saidas: number, removidos: number, saldo: number,
    serie: [{ d: 'YYYY-MM-DD', entradas: number, saidas: number }],  // dias sem evento vêm com 0
    dia_top_entradas: { d: string, n: number } | null,
    dia_top_saidas:   { d: string, n: number } | null,
  }],
  recentes: [{ label: string, participant_jid: string, action: string, occurred_at: string }],
  nao_monitorados: [{ group_jid: string, events: number, last_event_at: string }],
  ultimo_evento_em: string | null,
}
```

- [ ] **Step 1: Implementar o endpoint**

Criar `functions/api/grupos.js`:

```js
// GET /api/grupos?from=<unix>&to=<unix>&key=...
//
// Entradas e saídas nos grupos de WhatsApp monitorados, para a aba "Grupos" do
// dash. Lê SÓ do D1 (whatsapp_group_events / whatsapp_groups_tracked /
// whatsapp_groups_seen), alimentado por /api/webhooks/whatsapp-grupo. Nunca fala
// com a Evolution — quem faz isso é /api/grupos-conexao, em requisição separada.
//
// Séries, totais, saldos e recordes saem prontos daqui: o dash só formata.

import { diaLocalDeUnix } from './webhooks/_classificar.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const agora = Math.floor(Date.now() / 1000);
  const de = Number(url.searchParams.get('from')) || (agora - 30 * 86400);
  const ate = Number(url.searchParams.get('to')) || agora;
  const diaDe = diaLocalDeUnix(de);
  const diaAte = diaLocalDeUnix(ate);

  const { results: grupos } = await env.DB.prepare(
    `SELECT group_jid, label FROM whatsapp_groups_tracked WHERE enabled = 1 ORDER BY label`
  ).all();

  const { results: porDia } = await env.DB.prepare(
    `SELECT e.group_jid, e.day_local,
            SUM(CASE WHEN e.action = 'entrou'   THEN 1 ELSE 0 END) AS entradas,
            SUM(CASE WHEN e.action = 'saiu'     THEN 1 ELSE 0 END) AS saidas,
            SUM(CASE WHEN e.action = 'removido' THEN 1 ELSE 0 END) AS removidos
       FROM whatsapp_group_events e
       JOIN whatsapp_groups_tracked t
         ON t.group_jid = e.group_jid AND t.enabled = 1
      WHERE e.day_local BETWEEN ? AND ?
      GROUP BY e.group_jid, e.day_local`
  ).bind(diaDe, diaAte).all();

  const { results: recentes } = await env.DB.prepare(
    `SELECT t.label, e.participant_jid, e.action, e.occurred_at
       FROM whatsapp_group_events e
       JOIN whatsapp_groups_tracked t
         ON t.group_jid = e.group_jid AND t.enabled = 1
      WHERE e.day_local BETWEEN ? AND ?
      ORDER BY e.occurred_at DESC
      LIMIT 100`
  ).bind(diaDe, diaAte).all();

  const { results: naoMonitorados } = await env.DB.prepare(
    `SELECT s.group_jid, s.events, s.last_event_at
       FROM whatsapp_groups_seen s
       LEFT JOIN whatsapp_groups_tracked t ON t.group_jid = s.group_jid
      WHERE t.group_jid IS NULL
      ORDER BY s.events DESC
      LIMIT 20`
  ).all();

  const ultimo = await env.DB.prepare(
    `SELECT MAX(occurred_at) AS quando FROM whatsapp_group_events`
  ).first();

  // Dias sem evento precisam existir com zero: buraco na série faria o gráfico
  // ligar dois pontos distantes como se o período no meio não existisse.
  const dias = listarDias(diaDe, diaAte);
  const porGrupo = {};
  for (const r of (porDia || [])) {
    (porGrupo[r.group_jid] = porGrupo[r.group_jid] || {})[r.day_local] = r;
  }

  const saida = (grupos || []).map((g) => {
    const mapa = porGrupo[g.group_jid] || {};
    const serie = dias.map((d) => ({
      d,
      entradas: Number(mapa[d]?.entradas || 0),
      saidas: Number(mapa[d]?.saidas || 0),
    }));
    const entradas = serie.reduce((a, p) => a + p.entradas, 0);
    const saidas = serie.reduce((a, p) => a + p.saidas, 0);
    const removidos = dias.reduce((a, d) => a + Number(mapa[d]?.removidos || 0), 0);
    return {
      group_jid: g.group_jid,
      label: g.label,
      entradas, saidas, removidos,
      saldo: entradas - saidas - removidos,
      serie,
      dia_top_entradas: recorde(serie, 'entradas'),
      dia_top_saidas: recorde(serie, 'saidas'),
    };
  });

  return json({
    grupos: saida,
    recentes: recentes || [],
    nao_monitorados: naoMonitorados || [],
    ultimo_evento_em: ultimo?.quando || null,
  });
}

// Todos os dias entre duas datas 'YYYY-MM-DD', inclusive. Usa UTC para andar de
// dia em dia porque as datas já vêm convertidas para o fuso local.
function listarDias(diaDe, diaAte) {
  const dias = [];
  let atual = Date.parse(diaDe + 'T00:00:00Z');
  const fim = Date.parse(diaAte + 'T00:00:00Z');
  if (!Number.isFinite(atual) || !Number.isFinite(fim) || fim < atual) return dias;
  while (atual <= fim) {
    dias.push(new Date(atual).toISOString().slice(0, 10));
    atual += 86400000;
  }
  return dias;
}

// Dia de maior valor. Empate fica com o mais recente; período sem nenhum evento
// devolve null em vez de um "dia recorde" com zero, que seria mentira.
function recorde(serie, campo) {
  let melhor = null;
  for (const p of serie) {
    if (p[campo] > 0 && (!melhor || p[campo] >= melhor.n)) melhor = { d: p.d, n: p[campo] };
  }
  return melhor;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: Semear dados de teste variados**

Com o `wrangler pages dev` rodando (Task 3, Step 2), mandar eventos em dias diferentes:

```bash
S="x-grupos-secret: teste-local"
U=http://localhost:8788/api/webhooks/whatsapp-grupo
post() { curl -s -X POST $U -H "$S" -H "Content-Type: application/json" -d "$1" >/dev/null; }
post '{"event":"group-participants.update","date_time":"2026-07-25T14:00:00.000Z","data":{"id":"120363380235066572@g.us","author":"5521999@s.whatsapp.net","participants":["551101@s.whatsapp.net","551102@s.whatsapp.net","551103@s.whatsapp.net"],"action":"add"}}'
post '{"event":"group-participants.update","date_time":"2026-07-26T14:00:00.000Z","data":{"id":"120363380235066572@g.us","author":"551102@s.whatsapp.net","participants":["551102@s.whatsapp.net"],"action":"remove"}}'
post '{"event":"group-participants.update","date_time":"2026-07-26T15:00:00.000Z","data":{"id":"120363427499061913@g.us","author":"5521999@s.whatsapp.net","participants":["551104@s.whatsapp.net"],"action":"add"}}'
post '{"event":"group-participants.update","date_time":"2026-07-26T16:00:00.000Z","data":{"id":"120363427499061913@g.us","author":"5521999@s.whatsapp.net","participants":["551105@s.whatsapp.net"],"action":"remove"}}'
```

- [ ] **Step 3: Conferir a resposta**

Descobrir a `DASH_KEY` local (a que já se usa para abrir o dash em dev) e chamar:

```bash
curl -s "http://localhost:8788/api/grupos?from=$(date -d 2026-07-20 +%s)&to=$(date -d 2026-07-28 +%s)&key=<DASH_KEY>" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);for(const g of j.grupos)console.log(g.label,'| entradas',g.entradas,'saidas',g.saidas,'removidos',g.removidos,'saldo',g.saldo,'| topE',JSON.stringify(g.dia_top_entradas),'topS',JSON.stringify(g.dia_top_saidas),'| dias',g.serie.length);console.log('recentes',j.recentes.length,'| nao monitorados',j.nao_monitorados.length,'| ultimo',j.ultimo_evento_em)})"
```

Expected:
- `Workshops | entradas 3 saidas 1 removidos 0 saldo 2 | topE {"d":"2026-07-25","n":3} topS {"d":"2026-07-26","n":1}`
- `Lives Semanais | entradas 1 saidas 0 removidos 1 saldo 0 | topE {"d":"2026-07-26","n":1} topS null`
- `dias 9` nos dois (a série cobre o intervalo inteiro, inclusive os dias sem evento)
- `nao monitorados 1` (o grupo de terceiro do Task 3)

- [ ] **Step 4: Conferir que chave errada é rejeitada**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8788/api/grupos?key=errada"
```

Expected: `401`

- [ ] **Step 5: Commit**

```bash
git add functions/api/grupos.js
git commit -m "feat: endpoint de leitura das entradas e saídas dos grupos"
```

---

### Task 5: Endpoint do estado da conexão

**Files:**
- Create: `functions/api/grupos-conexao.js`
- Modify: `docs/superpowers/specs/2026-07-27-grupos-whatsapp-design.md` (a spec chamava a rota de `/api/grupos/conexao`)

**Interfaces:**
- Consumes: env `EVOLUTION_BASE_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_APIKEY_NOTIF`, `DASH_KEY`.
- Produces: rota `GET /api/grupos-conexao?key=<DASH_KEY>` → `{ estado: 'conectado'|'reconectando'|'desconectado'|'indefinido', state: string|null, instancia: string|null, motivo?: string }`.

A rota é `grupos-conexao` e não `grupos/conexao` para não criar ao mesmo tempo o arquivo `functions/api/grupos.js` e o diretório `functions/api/grupos/` — evita ambiguidade de roteamento no Pages. Ajustar a spec junto.

- [ ] **Step 1: Implementar o endpoint**

Criar `functions/api/grupos-conexao.js`:

```js
// GET /api/grupos-conexao?key=...
//
// Estado da conexão do WhatsApp, para o card no topo da aba "Grupos". É o ÚNICO
// endpoint desta feature que fala com a Evolution, e de propósito fica separado
// do /api/grupos: assim uma Evolution lenta ou fora do ar deixa só este card
// indefinido, sem atrasar a aba inteira.
//
// A apikey nunca chega ao navegador — a consulta acontece aqui.
//
// Reusa EVOLUTION_APIKEY_NOTIF (mesma instância dos alertas; não faz sentido
// cadastrar a chave duas vezes). EVOLUTION_BASE_URL e EVOLUTION_INSTANCE são
// variáveis próprias porque o EVOLUTION_API_URL existente é a URL completa de
// ENVIO de mensagem, não uma base.

const TIMEOUT_MS = 5000;

const ESTADOS = {
  open: 'conectado',
  connecting: 'reconectando',
  close: 'desconectado',
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const base = String(env.EVOLUTION_BASE_URL || '').trim().replace(/\/+$/, '');
  const instancia = String(env.EVOLUTION_INSTANCE || '').trim();
  const apikey = env.EVOLUTION_APIKEY_NOTIF;

  if (!base || !instancia || !apikey) {
    const faltando = [
      !base && 'EVOLUTION_BASE_URL',
      !instancia && 'EVOLUTION_INSTANCE',
      !apikey && 'EVOLUTION_APIKEY_NOTIF',
    ].filter(Boolean).join(', ');
    console.error('grupos-conexao — config faltando:', faltando);
    return json({ estado: 'indefinido', state: null, instancia: instancia || null, motivo: 'config_faltando' });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base}/instance/connectionState/${encodeURIComponent(instancia)}`,
      { headers: { apikey }, signal: ctrl.signal }
    );
    if (!res.ok) {
      return json({ estado: 'indefinido', state: null, instancia, motivo: `http_${res.status}` });
    }
    const dados = await res.json();
    const state = dados?.instance?.state || null;
    return json({ estado: ESTADOS[state] || 'indefinido', state, instancia });
  } catch (e) {
    // Timeout ou rede: o card diz "não foi possível consultar" em vez de mentir
    // "desconectado" — são coisas diferentes.
    return json({ estado: 'indefinido', state: null, instancia, motivo: 'timeout_ou_erro' });
  } finally {
    clearTimeout(timer);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: Corrigir o nome da rota na spec**

Em `docs/superpowers/specs/2026-07-27-grupos-whatsapp-design.md`, trocar as duas ocorrências de `/api/grupos/conexao` por `/api/grupos-conexao` (o título da seção e a menção no diagrama/texto da aba).

- [ ] **Step 3: Smoke test local**

Reiniciar o `wrangler pages dev` incluindo as variáveis (valores reais estão no `.env` da raiz):

```bash
npx wrangler pages dev dist --d1 DB=tracking-ae-db \
  --binding GRUPOS_WEBHOOK_SECRET=teste-local \
  --binding EVOLUTION_BASE_URL=https://api.marcellemesquita.com.br \
  --binding EVOLUTION_INSTANCE=MarcelleProfissional \
  --binding EVOLUTION_APIKEY_NOTIF=<valor de EVOLUTION_API_KEY do .env>
```

Depois:

```bash
curl -s "http://localhost:8788/api/grupos-conexao?key=<DASH_KEY>"
```

Expected: `{"estado":"conectado","state":"open","instancia":"MarcelleProfissional"}`

- [ ] **Step 4: Smoke test — instância inexistente não derruba o endpoint**

Reiniciar trocando `EVOLUTION_INSTANCE=NaoExiste` e chamar de novo.

Expected: HTTP 200 com `{"estado":"indefinido",...,"motivo":"http_404"}` — nunca um 500.

- [ ] **Step 5: Commit**

```bash
git add functions/api/grupos-conexao.js docs/superpowers/specs/2026-07-27-grupos-whatsapp-design.md
git commit -m "feat: endpoint do estado da conexão do WhatsApp"
```

---

### Task 6: Gráfico de duas séries

**Files:**
- Modify: `public/dash/index.html` — bloco `:root` (linha ~17), CSS do `.grafico` (linhas ~74-81) e a função `grafico()` (linha ~334)

**Interfaces:**
- Consumes: nada.
- Produces: `grafico(el, serie, valorFmt, opcoes)` — o 4º parâmetro é novo e opcional. Quando ausente, o comportamento é idêntico ao de hoje. Quando presente: `{ serie2: [{d, v}], rotulo1: string, rotulo2: string }`.

As abas Visão geral e Vendas já usam `grafico()` com três argumentos e **não podem mudar de comportamento**.

- [ ] **Step 1: Adicionar a cor da segunda série**

Em `public/dash/index.html`, na linha `--serie: #f5f0eb; --serie-area: rgba(245,240,235,0.13);`, acrescentar ao final da mesma linha:

```css
  --serie2: #f37f7f;
```

Reusa o mesmo tom de `--down`, que no dash já significa "para baixo" — saída de gente lê igual.

- [ ] **Step 2: Adicionar o CSS da segunda linha e da legenda**

Logo após a regra `.grafico circle { fill: var(--serie); }`, acrescentar:

```css
.grafico .linha2 { fill: none; stroke: var(--serie2); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.grafico circle.p2 { fill: var(--serie2); }
.legenda { display: flex; gap: 1rem; margin-bottom: 0.4rem; font-size: 0.78rem; color: var(--muted); }
.legenda span::before { content: '●'; margin-right: 0.3rem; }
.legenda .s1::before { color: var(--serie); }
.legenda .s2::before { color: var(--serie2); }
```

- [ ] **Step 3: Substituir a função `grafico()`**

Trocar a função inteira (de `function grafico(el, serie, valorFmt) {` até o `}` que fecha, logo antes de `// ---------- seções ----------`) por:

```js
// `opcoes.serie2` é opcional: sem ele, o desenho é exatamente o de antes (uma
// linha com área preenchida), que é o que as abas Visão geral e Vendas usam.
// Com ele, vira duas linhas sem área — área com duas séries sobrepostas vira
// borrão.
function grafico(el, serie, valorFmt, opcoes) {
  if (!serie.length) { el.innerHTML = '<div class="aviso">Sem dados no período.</div>'; return; }
  const serie2 = opcoes && opcoes.serie2 && opcoes.serie2.length === serie.length ? opcoes.serie2 : null;
  const W = 900, H = 240, m = { t: 14, r: 12, b: 26, l: 56 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const todos = serie.map((p) => p.v).concat(serie2 ? serie2.map((p) => p.v) : []);
  const max = Math.max(...todos, 1) * 1.08;
  const x = (i) => m.l + (serie.length === 1 ? iw / 2 : (i / (serie.length - 1)) * iw);
  const y = (v) => m.t + ih - (v / max) * ih;
  const caminho = (s) => 'M' + s.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('L');
  const linha = caminho(serie);
  const area = serie2 ? '' : `<path class="area" d="${linha}L${x(serie.length - 1).toFixed(1)},${m.t + ih}L${x(0).toFixed(1)},${m.t + ih}Z"/>`;
  const linha2 = serie2 ? `<path class="linha2" d="${caminho(serie2)}"/>` : '';
  const yt = [0, 0.5, 1].map((f) => { const v = max * f, yy = y(v); return `<line class="eixo" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/><text class="rot-eixo" x="${m.l - 6}" y="${yy + 3}" text-anchor="end">${valorFmt(v, true)}</text>`; }).join('');
  const passo = Math.max(1, Math.ceil(serie.length / 8));
  const xt = serie.map((p, i) => i % passo ? '' : `<text class="rot-eixo" x="${x(i)}" y="${H - 8}" text-anchor="middle">${diaBR(p.d)}</text>`).join('');
  const legenda = serie2 ? `<div class="legenda"><span class="s1">${esc(opcoes.rotulo1 || '')}</span><span class="s2">${esc(opcoes.rotulo2 || '')}</span></div>` : '';
  const pt2 = serie2 ? '<circle class="p2" r="4" stroke="var(--bg)" stroke-width="2" style="display:none"/>' : '';
  el.innerHTML = `${legenda}<svg viewBox="0 0 ${W} ${H}">${yt}${xt}${area}<path class="linha" d="${linha}"/>${linha2}<line class="cursor" y1="${m.t}" y2="${m.t + ih}" x1="-9" x2="-9" style="display:none"/><circle r="4" stroke="var(--bg)" stroke-width="2" style="display:none"/>${pt2}</svg><div class="tooltip"></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('.tooltip');
  const cur = el.querySelector('.cursor'), pt = el.querySelector('circle:not(.p2)');
  const ptB = el.querySelector('circle.p2');
  svg.addEventListener('pointermove', (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(serie.length - 1, Math.round(((px - m.l) / iw) * (serie.length - 1))));
    const cx = x(i), cy = y(serie[i].v);
    cur.setAttribute('x1', cx); cur.setAttribute('x2', cx); cur.style.display = '';
    pt.setAttribute('cx', cx); pt.setAttribute('cy', cy); pt.style.display = '';
    if (ptB) { ptB.setAttribute('cx', cx); ptB.setAttribute('cy', y(serie2[i].v)); ptB.style.display = ''; }
    tip.style.display = 'block'; tip.style.left = (cx / W) * r.width + 'px'; tip.style.top = (cy / H) * r.height + 'px';
    tip.innerHTML = serie2
      ? `${diaBR(serie[i].d)}<b>${esc(opcoes.rotulo1 || '')}: ${valorFmt(serie[i].v)}</b><b>${esc(opcoes.rotulo2 || '')}: ${valorFmt(serie2[i].v)}</b>`
      : `${diaBR(serie[i].d)}<b>${valorFmt(serie[i].v)}</b>`;
  });
  svg.addEventListener('pointerleave', () => {
    cur.style.display = 'none'; pt.style.display = 'none';
    if (ptB) ptB.style.display = 'none';
    tip.style.display = 'none';
  });
}
```

- [ ] **Step 4: Conferir que as abas antigas não mudaram**

Abrir `http://localhost:8788/dash/?key=<DASH_KEY>` e verificar, uma a uma:
- **Visão geral** → "Leads por dia": linha única com área preenchida, tooltip com um valor só, sem legenda.
- **Vendas** → "Receita por dia": idem, valores em reais.

Expected: idênticos ao comportamento anterior. Se apareceu legenda ou sumiu a área, o 4º parâmetro está vazando.

- [ ] **Step 5: Commit**

```bash
git add public/dash/index.html
git commit -m "feat: gráfico do dash aceita uma segunda série"
```

---

### Task 7: Aba "Grupos" no dash

**Files:**
- Modify: `public/dash/index.html` — nav (linha ~125), nova `<section>` (após a de workshops, ~linha 207), `R.grupos` (após `R.workshops`) e `TITULOS` (linha ~734)

**Interfaces:**
- Consumes: `GET /api/grupos` e `GET /api/grupos-conexao` (Tasks 4 e 5); helpers `tile`, `tabela`, `grafico`, `fmtInt`, `esc`, `intervalo`, `q`, `fetchJson`.
- Produces: seção `#secao-grupos`, alcançável por `#grupos`.

- [ ] **Step 1: Adicionar o link na navegação**

Em `public/dash/index.html`, na `<nav class="nav" id="nav">`, logo após a linha do Workshops:

```html
      <a href="#grupos" data-secao="grupos">Grupos</a>
```

- [ ] **Step 2: Adicionar a seção**

Logo após o fechamento de `</section>` da seção `secao-workshops`, acrescentar:

```html
    <section class="secao" id="secao-grupos">
      <div class="card" id="grupos-conexao-card"><h2>Conexão do WhatsApp <small id="grupos-conexao-nota"></small></h2><div id="grupos-conexao"></div></div>
      <div id="grupos-aviso"></div>
      <div id="grupos-blocos"></div>
      <div class="card"><h2>Eventos recentes <small>quem entrou e quem saiu</small></h2><div class="tabela-wrap" id="grupos-eventos"></div></div>
    </section>
```

- [ ] **Step 3: Registrar o título da aba**

Na linha do `const TITULOS = {...}`, acrescentar `grupos: 'Grupos',` logo após `workshops: 'Workshops',`.

- [ ] **Step 4: Implementar `R.grupos`**

Logo após o fim da função `R.workshops` (antes de `R.jornada`), acrescentar:

```js
R.grupos = async () => {
  const p = intervalo();
  const dados = await fetchJson(`/api/grupos?${q(p.de, p.ate)}`);

  // Conexão em requisição SEPARADA e sem travar a aba: é a única coisa aqui que
  // depende da Evolution, e ela pode estar lenta ou fora do ar.
  $('#grupos-conexao').innerHTML = '<span class="mini">consultando…</span>';
  fetchJson('/api/grupos-conexao').then((c) => {
    const rotulos = { conectado: 'Conectado', reconectando: 'Reconectando', desconectado: 'Desconectado', indefinido: 'Não foi possível consultar' };
    const cores = { conectado: 'var(--up)', reconectando: 'var(--warn)', desconectado: 'var(--down)', indefinido: 'var(--muted)' };
    // Envolto em .kpi porque .valor/.rotulo só ganham estilo dentro dele.
    $('#grupos-conexao').innerHTML = `<div class="kpi"><div class="rotulo">Estado</div>` +
      `<div class="valor" style="color:${cores[c.estado] || 'var(--muted)'}">${rotulos[c.estado] || '—'}</div>` +
      `<div class="mini">instância ${esc(c.instancia || '—')}${c.motivo ? ' · ' + esc(c.motivo) : ''}</div></div>`;
  }).catch(() => {
    $('#grupos-conexao').innerHTML = '<div class="kpi"><div class="rotulo">Estado</div><div class="valor" style="color:var(--muted)">Não foi possível consultar</div></div>';
  });

  // Último evento vem do D1: conexão aberta há dias SEM evento nenhum é um
  // problema diferente de conexão caída, e sem este par passaria por "semana fraca".
  $('#grupos-conexao-nota').textContent = dados.ultimo_evento_em
    ? `último evento recebido em ${new Date(dados.ultimo_evento_em).toLocaleString('pt-BR')}`
    : 'nenhum evento recebido ainda';

  const naoMon = dados.nao_monitorados || [];
  $('#grupos-aviso').innerHTML = naoMon.length
    ? `<div class="aviso">${naoMon.length} grupo(s) gerando eventos fora da lista monitorada. Se um deles for o ciclo novo das lives, é só cadastrar: ${naoMon.slice(0, 3).map((g) => esc(g.group_jid)).join(', ')}</div>`
    : '';

  const dataHora = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const dataDia = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—';
  const telefone = (jid) => String(jid || '').split('@')[0].split(':')[0];

  const blocos = $('#grupos-blocos');
  blocos.innerHTML = '';
  for (const g of (dados.grupos || [])) {
    const idSerie = 'grupos-serie-' + g.group_jid.replace(/[^a-z0-9]/gi, '');
    const idDias = 'grupos-dias-' + g.group_jid.replace(/[^a-z0-9]/gi, '');
    blocos.insertAdjacentHTML('beforeend', `
      <div class="card">
        <h2>${esc(g.label)}</h2>
        <div class="grid-kpi">
          ${tile({ rotulo: 'Entradas', valor: fmtInt(g.entradas) })}
          ${tile({ rotulo: 'Saídas', valor: fmtInt(g.saidas) })}
          ${tile({ rotulo: 'Removidos', valor: fmtInt(g.removidos) })}
          ${tile({ rotulo: 'Saldo', valor: (g.saldo > 0 ? '+' : '') + fmtInt(g.saldo) })}
          ${tile({ rotulo: 'Dia com mais entradas', valor: g.dia_top_entradas ? `${dataDia(g.dia_top_entradas.d)} · ${fmtInt(g.dia_top_entradas.n)}` : null })}
          ${tile({ rotulo: 'Dia com mais saídas', valor: g.dia_top_saidas ? `${dataDia(g.dia_top_saidas.d)} · ${fmtInt(g.dia_top_saidas.n)}` : null })}
        </div>
        <div class="grafico" id="${idSerie}"></div>
        <div class="tabela-wrap" id="${idDias}" style="margin-top:0.8rem"></div>
      </div>`);

    grafico(
      $('#' + idSerie),
      g.serie.map((p) => ({ d: p.d, v: p.entradas })),
      (v) => fmtInt(Math.round(v)),
      { serie2: g.serie.map((p) => ({ d: p.d, v: p.saidas })), rotulo1: 'Entradas', rotulo2: 'Saídas' }
    );

    // Só os dias com movimento: uma tabela com 30 linhas de zero não informa nada.
    tabela($('#' + idDias), [
      { titulo: 'Dia', campo: 'd', render: (r) => dataDia(r.d) },
      { titulo: 'Entradas', num: true, campo: 'entradas', render: (r) => fmtInt(r.entradas) },
      { titulo: 'Saídas', num: true, campo: 'saidas', render: (r) => fmtInt(r.saidas) },
      { titulo: 'Saldo', num: true, campo: 'saldo', render: (r) => (r.saldo > 0 ? '+' : '') + fmtInt(r.saldo) },
    ], g.serie.filter((p) => p.entradas || p.saidas).map((p) => ({ ...p, saldo: p.entradas - p.saidas })));
  }

  if (!(dados.grupos || []).length) {
    blocos.innerHTML = '<div class="card"><div class="aviso">Nenhum grupo monitorado.</div></div>';
  }

  const acoes = { entrou: 'entrou', saiu: 'saiu', removido: 'removido' };
  tabela($('#grupos-eventos'), [
    { titulo: 'Quando', campo: 'occurred_at', render: (r) => `<span class="mini">${dataHora(r.occurred_at)}</span>` },
    { titulo: 'Grupo', campo: 'label', render: (r) => esc(r.label) },
    { titulo: 'Telefone', campo: 'participant_jid', render: (r) => esc(telefone(r.participant_jid)) },
    { titulo: 'O quê', campo: 'action', render: (r) => acoes[r.action] || esc(r.action) },
  ], dados.recentes || []);
};
```

- [ ] **Step 5: Conferir no navegador**

Com o `wrangler pages dev` no ar e os dados semeados na Task 4, abrir `http://localhost:8788/dash/?key=<DASH_KEY>#grupos` com o período em "Personalizado 20/07 → 28/07".

Expected:
- Card "Conexão do WhatsApp" mostrando **Conectado** e a nota do último evento.
- Aviso de 1 grupo não monitorado.
- Bloco **Lives Semanais**: entradas 1, saídas 0, removidos 1, saldo 0.
- Bloco **Workshops**: entradas 3, saídas 1, removidos 0, saldo +2; dia com mais entradas `25/07 · 3`; dia com mais saídas `26/07 · 1`.
- Gráfico com legenda "Entradas / Saídas" e duas linhas; tooltip mostrando os dois valores.
- Tabela dia a dia só com 25/07 e 26/07.
- "Eventos recentes" com 6 linhas, telefones sem o `@s.whatsapp.net`.

- [ ] **Step 6: Conferir as abas vizinhas**

Clicar em Visão geral, Vendas e Workshops. Expected: tudo como antes, sem erro no console.

- [ ] **Step 7: Commit**

```bash
git add public/dash/index.html
git commit -m "feat: aba Grupos no dash com entradas, saídas e estado da conexão"
```

---

### Task 8: Deploy e validação fim-a-fim

**Files:**
- Modify: `docs/superpowers/specs/2026-07-27-grupos-whatsapp-design.md` (registrar data de entrada no ar)

**Interfaces:**
- Consumes: tudo das Tasks 1-7.
- Produces: feature no ar, validada com evento real.

- [ ] **Step 1: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, 15 testes.

- [ ] **Step 2: Aplicar a migration no D1 remoto**

```bash
npx wrangler d1 migrations apply tracking-ae-db --remote
npx wrangler d1 execute tracking-ae-db --remote --command "SELECT group_jid, label FROM whatsapp_groups_tracked ORDER BY label"
```

Expected: as duas linhas semeadas.

- [ ] **Step 3: Publicar**

O projeto `tracking-ae` é git-connected: o deploy sai do push na `main`. Fazer merge/push conforme o fluxo do repositório e aguardar o build no Cloudflare.

- [ ] **Step 4: Conferir os endpoints em produção**

```bash
curl -s -o /dev/null -w "conexao %{http_code}\n" "https://atacadoexponencial.com/api/grupos-conexao?key=<DASH_KEY>"
curl -s "https://atacadoexponencial.com/api/grupos-conexao?key=<DASH_KEY>"
curl -s -o /dev/null -w "grupos %{http_code}\n" "https://atacadoexponencial.com/api/grupos?key=<DASH_KEY>"
curl -s -o /dev/null -w "webhook sem segredo %{http_code}\n" -X POST "https://atacadoexponencial.com/api/webhooks/whatsapp-grupo" -H "Content-Type: application/json" -d '{}'
```

Expected: `conexao 200` com `{"estado":"conectado",...}`; `grupos 200`; `webhook sem segredo 401`.

Se `conexao` vier com `motivo: "config_faltando"`, as variáveis `EVOLUTION_BASE_URL` / `EVOLUTION_INSTANCE` não pegaram no ambiente de Production — conferir no painel do Cloudflare e refazer o deploy (variável nova só entra em vigor num build novo).

- [ ] **Step 5: Ligar o nó no n8n**

No workflow "Evolution -> Postgres | Grupos clientes read-only", acrescentar um nó **HTTP Request** ligado a uma **segunda saída do nó `Webhook`** (em paralelo ao `Normalize Evolution Payload`, não em série):

| Campo | Valor |
|---|---|
| Name | `Repassar p/ tracking (grupos)` |
| Method | `POST` |
| URL | `https://atacadoexponencial.com/api/webhooks/whatsapp-grupo` |
| Send Headers | sim → `x-grupos-secret` = valor de `GRUPOS_WEBHOOK_SECRET` |
| Send Body | sim → JSON → `={{ $json.body }}` |
| Options → Timeout | `5000` |
| Settings → On Error | **Continue (using regular output)** |
| Settings → Retry on Fail | desligado |

`On Error: Continue` não é opcional: sem ele, tracking fora do ar derruba a execução inteira e o monitor de mensagens de clientes para junto. O nó é ponta solta — quem responde ao webhook continua sendo o ramo original.

Salvar e manter o workflow **ativo**.

- [ ] **Step 6: Validar com evento real**

Entrar em um dos grupos monitorados com um número de teste (ou pedir a alguém), depois sair. Em seguida:

```bash
npx wrangler d1 execute tracking-ae-db --remote --command "SELECT group_jid, action, occurred_at, day_local FROM whatsapp_group_events ORDER BY id DESC LIMIT 5"
```

Expected: duas linhas novas, uma `entrou` e uma `saiu`, com `day_local` no dia de Brasília.

Se não aparecer nada, verificar nesta ordem: (1) a execução do n8n mostra o nó novo rodando? (2) que status ele recebeu — `401` é segredo divergente, `nao_monitorado` é JID fora da lista, `ignorado` é evento de outro tipo.

- [ ] **Step 7: Conferir a aba em produção**

Abrir `https://atacadoexponencial.com/dash/?key=<DASH_KEY>#grupos`.

Expected: card de conexão em **Conectado**, com a nota do último evento apontando para o teste que acabou de ser feito; o bloco do grupo usado mostrando a entrada e a saída.

- [ ] **Step 8: Registrar na spec e commitar**

No fim de `docs/superpowers/specs/2026-07-27-grupos-whatsapp-design.md`, acrescentar:

```markdown
## Status

**No ar desde <data do deploy>.** Validado fim-a-fim com entrada e saída reais em
um dos grupos monitorados.
```

```bash
git add docs/superpowers/specs/2026-07-27-grupos-whatsapp-design.md
git commit -m "docs: registra a aba de grupos de WhatsApp no ar"
```

---

## Notas de execução

**Ordem:** as Tasks 1→5 são backend e podem ser revisadas isoladamente. A Task 6 mexe em código compartilhado com duas abas que já funcionam — o Step 4 dela (conferir Visão geral e Vendas) é o portão. A Task 7 depende de 4, 5 e 6. A Task 8 depende de tudo.

**O que só a usuária pode fazer:** o nó do n8n (Task 8, Step 5). Enquanto ele não existir, os endpoints funcionam mas nenhum evento chega.

**Variáveis no Cloudflare Pages** (já cadastradas, conferir se algo falhar): `GRUPOS_WEBHOOK_SECRET` (secret), `EVOLUTION_BASE_URL` e `EVOLUTION_INSTANCE` (texto). A `EVOLUTION_APIKEY_NOTIF` e a `DASH_KEY` já existiam.
