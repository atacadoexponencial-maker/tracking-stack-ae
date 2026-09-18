# Agenda de ações de grupo (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agendar e executar sozinho, na aba Grupos do dash, duas ações no grupo de WhatsApp — mandar mensagem e renomear — com cancelamento até a hora.

**Architecture:** Fila de ações no D1. O painel grava a ação; o cron da VPS acorda `/api/sync/grupo-acoes` de 5 em 5 minutos, que passa cada ação vencida pelo mesmo executor que o botão "fazer agora" usa. Toda conversa com a Evolution passa por um único arquivo de fronteira.

**Tech Stack:** Cloudflare Pages Functions (JS, ESM), D1 (SQLite), `node --test` + `node:sqlite` nos testes, dash em HTML/JS puro (`public/dash/index.html`).

**Spec:** `docs/superpowers/specs/2026-09-17-gestao-grupos-whatsapp-design.md`

## Global Constraints

- **Nada que está no ar pode cair.** Não alterar `functions/api/grupos.js`, `functions/api/grupos-conexao.js`, `functions/api/webhooks/whatsapp-grupo.js`, nem a configuração de webhook da Evolution.
- **Nunca rodar `wrangler d1 migrations apply --remote`** neste projeto — as migrations 0021/0022/0025 quebram ao reaplicar. Migration nova vai ao remoto por `wrangler d1 execute --remote --file`.
- Arquivos com prefixo `_` não viram rota no Pages — é assim que módulos internos ficam internos.
- Autenticação: endpoints do painel por `?key=` igual a `env.DASH_KEY`; endpoint de sync por header `x-sync-secret` igual a `env.SYNC_SECRET`.
- Credenciais da Evolution: `EVOLUTION_BASE_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_APIKEY_NOTIF` (já existem em produção). A apikey **nunca** vai ao navegador.
- Horários: gravados em **unix segundos UTC**, digitados e exibidos em BRT (`America/Sao_Paulo`, offset fixo `-03:00`).
- Toda validação no backend. O formulário não valida nada sozinho.
- Comentários e mensagens de erro em português, explicando **por quê**, no tom dos arquivos vizinhos.
- Um commit por tarefa, na branch `feat/grupos-acoes`.

### Constantes (valores exatos)

| Constante | Valor | Onde |
|---|---|---|
| `ATRASO_MAX_SEG` | `30 * 60` | `_grupos-acoes.js` |
| `MAX_TENTATIVAS` | `3` (só `renomear`) | `_grupos-acoes.js` |
| `TIMEOUT_MS` | `5000` | `_evolution-grupos.js` |
| `TEXTO_MAX` | `4000` | `_grupos-acoes.js` |
| `TITULO_MAX` | `100` | `_grupos-acoes.js` |

---

### Task 1: Tabela da agenda (migration 0043)

**Files:**
- Create: `migrations/0043_grupos_acoes.sql`
- Test: `tests/grupos-acoes.test.js`

**Interfaces:**
- Consumes: nada
- Produces: tabela `whatsapp_group_actions` e coluna `whatsapp_groups_tracked.parent_jid`, usadas por todas as tarefas seguintes.

`parent_jid` existe porque os grupos da Comunidade vêm em par com o mesmo nome (grupo de avisos + grupo pai) e renomear só metade passa despercebido. Fica nula até ser conferida contra a Evolution na Task 8 — e `aplicar_no_par` sem `parent_jid` é recusado, nunca adivinhado.

- [ ] **Step 1: Escrever a migration**

```sql
-- migrations/0043_grupos_acoes.sql
-- Agenda de ações de grupo: mandar mensagem e renomear com hora marcada.
-- Spec: docs/superpowers/specs/2026-09-17-gestao-grupos-whatsapp-design.md
--
-- É uma fila de AÇÕES, não de mensagens: renomear e enviar são a mesma coisa
-- com hora marcada, e tipo novo (trancar, revogar link) entra sem tabela nova.

CREATE TABLE IF NOT EXISTS whatsapp_group_actions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  group_jid      TEXT    NOT NULL,
  tipo           TEXT    NOT NULL,   -- 'mensagem' | 'renomear'
  payload        TEXT    NOT NULL,   -- JSON: {texto} | {titulo, aplicar_no_par}
  agendada_para  INTEGER NOT NULL,   -- unix segundos UTC
  status         TEXT    NOT NULL DEFAULT 'agendada',
                                     -- agendada|executando|concluida|falhou|cancelada
  tentativas     INTEGER NOT NULL DEFAULT 0,
  erro           TEXT,
  resultado      TEXT,               -- resumo legível do que foi feito
  criada_em      INTEGER NOT NULL,
  executada_em   INTEGER
);

-- Única consulta quente: o cron varrendo vencidas. Sem o índice, cada passada
-- lê a tabela inteira — o tipo de varredura que já estourou o limite de
-- leitura do D1 duas vezes neste projeto.
CREATE INDEX IF NOT EXISTS idx_group_actions_fila
  ON whatsapp_group_actions (status, agendada_para);

-- O par da Comunidade (grupo pai), para renomear os dois de uma vez.
-- Nulo até ser conferido contra a Evolution; nulo significa "não sei", e
-- renomear o par é recusado em vez de adivinhado.
ALTER TABLE whatsapp_groups_tracked ADD COLUMN parent_jid TEXT;
```

- [ ] **Step 2: Escrever o teste que carrega a migration de verdade**

Criar `tests/grupos-acoes.test.js` com o arranjo abaixo. O adaptador `d1()` é o mesmo de `tests/meta-fila.test.js` — copiado de propósito, porque cada teste é um arquivo independente.

```js
// Agenda de ações de grupo contra SQLite de verdade, com a migration 0043 real.
// Spec: docs/superpowers/specs/2026-09-17-gestao-grupos-whatsapp-design.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// --- D1 mínimo em cima do node:sqlite (mesmo adaptador de meta-fila.test.js) ---
function d1(db) {
  const conv = (b) => b.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  const stmt = (sql, binds = []) => ({
    bind: (...b) => stmt(sql, conv(b)),
    all: async () => ({ results: db.prepare(sql).all(...binds) }),
    first: async () => db.prepare(sql).get(...binds) ?? null,
    run: async () => { const r = db.prepare(sql).run(...binds); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return { prepare: (sql) => stmt(sql) };
}

const AVISOS = '120363427499061913@g.us';
const PAI = '120363429583787754@g.us';
const AGORA = 1_789_600_000;

function novoBanco() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE whatsapp_groups_tracked (
      group_jid TEXT PRIMARY KEY, label TEXT, group_name TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      send_conversion INTEGER NOT NULL DEFAULT 0, conversion_since INTEGER);
  `);
  db.exec(readFileSync(new URL('../migrations/0043_grupos_acoes.sql', import.meta.url), 'utf8'));
  db.prepare('INSERT INTO whatsapp_groups_tracked (group_jid, label, enabled, parent_jid) VALUES (?, ?, 1, ?)')
    .run(AVISOS, 'Live semanal', PAI);
  db.prepare('INSERT INTO whatsapp_groups_tracked (group_jid, label, enabled) VALUES (?, ?, 0)')
    .run('desligado@g.us', 'Grupo desligado');
  return db;
}

test('migration 0043 cria a tabela e o índice da fila', () => {
  const db = novoBanco();
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='whatsapp_group_actions'").get();
  assert.ok(t, 'tabela whatsapp_group_actions não foi criada');
  const i = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_group_actions_fila'").get();
  assert.ok(i, 'índice da fila não foi criado');
  const col = db.prepare("SELECT parent_jid FROM whatsapp_groups_tracked WHERE group_jid = ?").get(AVISOS);
  assert.equal(col.parent_jid, PAI);
});

export { d1, novoBanco, AVISOS, PAI, AGORA };
```

- [ ] **Step 3: Rodar o teste**

Run: `npm test -- tests/grupos-acoes.test.js`
Esperado: PASS (1 teste).

- [ ] **Step 4: Commit**

```bash
git checkout -b feat/grupos-acoes
git add migrations/0043_grupos_acoes.sql tests/grupos-acoes.test.js
git commit -m "feat(grupos): tabela da agenda de acoes de grupo"
```

---

### Task 2: Fronteira com a Evolution

**Files:**
- Create: `functions/api/_evolution-grupos.js`
- Test: `tests/evolution-grupos.test.js`

**Interfaces:**
- Consumes: `env.EVOLUTION_BASE_URL`, `env.EVOLUTION_INSTANCE`, `env.EVOLUTION_APIKEY_NOTIF`
- Produces:
  - `credenciais(env) → { base, instancia, apikey } | null`
  - `enviarTexto(env, jid, texto, fetchImpl?) → { ok: true } | { ok: false, erro: string }`
  - `renomear(env, jid, titulo, fetchImpl?) → { ok: true } | { ok: false, erro: string }`
  - `TIMEOUT_MS`

Este é o único arquivo de toda a feature que fala com a Evolution. No dia em que ela sair, é ele que muda. Nunca lança: devolve `{ ok: false, erro }` para quem chama decidir — o mesmo contrato do `buscar()` em `grupos-conexao.js`.

- [ ] **Step 1: Escrever os testes**

```js
// tests/evolution-grupos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credenciais, enviarTexto, renomear } from '../functions/api/_evolution-grupos.js';

const ENV = { EVOLUTION_BASE_URL: 'https://api.exemplo.com/', EVOLUTION_INSTANCE: 'Marcelle', EVOLUTION_APIKEY_NOTIF: 'segredo' };
const JID = '120363427499061913@g.us';
const ok = () => new Response('{}', { status: 200 });

test('credenciais some quando falta qualquer variável', () => {
  assert.ok(credenciais(ENV));
  assert.equal(credenciais({ ...ENV, EVOLUTION_APIKEY_NOTIF: '' }), null);
  assert.equal(credenciais({}), null);
});

test('credenciais tira a barra final da base', () => {
  assert.equal(credenciais(ENV).base, 'https://api.exemplo.com');
});

test('enviarTexto chama a rota certa, com apikey no header e jid no corpo', async () => {
  let visto = null;
  const r = await enviarTexto(ENV, JID, 'Começou!', async (url, init) => { visto = { url, init }; return ok(); });
  assert.deepEqual(r, { ok: true });
  assert.equal(visto.url, 'https://api.exemplo.com/message/sendText/Marcelle');
  assert.equal(visto.init.headers.apikey, 'segredo');
  assert.deepEqual(JSON.parse(visto.init.body), { number: JID, text: 'Começou!' });
});

test('renomear chama updateGroupSubject com o jid na query', async () => {
  let visto = null;
  const r = await renomear(ENV, JID, '24/09 às 12h', async (url, init) => { visto = { url, init }; return ok(); });
  assert.deepEqual(r, { ok: true });
  assert.ok(visto.url.startsWith('https://api.exemplo.com/group/updateGroupSubject/Marcelle?groupJid='));
  assert.equal(new URL(visto.url).searchParams.get('groupJid'), JID);
  assert.deepEqual(JSON.parse(visto.init.body), { subject: '24/09 às 12h' });
});

test('HTTP de erro vira erro legível, sem lançar', async () => {
  const r = await enviarTexto(ENV, JID, 'oi', async () => new Response('sem permissão', { status: 403 }));
  assert.equal(r.ok, false);
  assert.match(r.erro, /403/);
});

test('rede caída vira erro legível, sem lançar', async () => {
  const r = await renomear(ENV, JID, 'x', async () => { throw new Error('ECONNRESET'); });
  assert.equal(r.ok, false);
  assert.match(r.erro, /Evolution/);
});

test('sem credenciais não tenta chamar nada', async () => {
  let chamou = false;
  const r = await enviarTexto({}, JID, 'oi', async () => { chamou = true; return ok(); });
  assert.equal(r.ok, false);
  assert.equal(chamou, false);
  assert.match(r.erro, /EVOLUTION/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/evolution-grupos.test.js`
Esperado: FAIL — `Cannot find module '../functions/api/_evolution-grupos.js'`.

- [ ] **Step 3: Implementar**

```js
// functions/api/_evolution-grupos.js
//
// A ÚNICA porta desta feature para a Evolution. Todo o resto (executor,
// endpoints, painel) fala com este arquivo, nunca com a Evolution.
//
// Existe por uma razão específica: a Evolution está sendo aposentada como
// canal de WhatsApp deste projeto, e o número conectado pode cair a qualquer
// momento. Quando isso acontecer, é este arquivo que muda — não a feature.
//
// Nunca lança: devolve { ok, erro } para quem chama decidir o que fazer. É o
// mesmo contrato do buscar() em grupos-conexao.js, e é o que impede uma
// Evolution lenta de derrubar o endpoint inteiro.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

export const TIMEOUT_MS = 5000;

/**
 * Credenciais da Evolution, ou null se faltar qualquer uma.
 * Reusa EVOLUTION_APIKEY_NOTIF (mesma instância dos alertas e do card de
 * conexão); cadastrar a chave de novo só criaria uma segunda coisa para
 * rotacionar.
 */
export function credenciais(env) {
  const base = String(env?.EVOLUTION_BASE_URL || '').trim().replace(/\/+$/, '');
  const instancia = String(env?.EVOLUTION_INSTANCE || '').trim();
  const apikey = env?.EVOLUTION_APIKEY_NOTIF;
  if (!base || !instancia || !apikey) return null;
  return { base, instancia, apikey };
}

/** Manda uma mensagem de texto no grupo. */
export async function enviarTexto(env, jid, texto, fetchImpl = fetch) {
  const c = credenciais(env);
  if (!c) return { ok: false, erro: faltando(env) };
  return chamar(
    `${c.base}/message/sendText/${encodeURIComponent(c.instancia)}`,
    { number: jid, text: texto },
    c.apikey, fetchImpl, 'enviar a mensagem',
  );
}

/** Troca o nome do grupo. Idempotente: aplicar duas vezes dá o mesmo resultado. */
export async function renomear(env, jid, titulo, fetchImpl = fetch) {
  const c = credenciais(env);
  if (!c) return { ok: false, erro: faltando(env) };
  return chamar(
    `${c.base}/group/updateGroupSubject/${encodeURIComponent(c.instancia)}?groupJid=${encodeURIComponent(jid)}`,
    { subject: titulo },
    c.apikey, fetchImpl, 'renomear o grupo',
  );
}

function faltando(env) {
  const nomes = ['EVOLUTION_BASE_URL', 'EVOLUTION_INSTANCE', 'EVOLUTION_APIKEY_NOTIF']
    .filter((n) => !String(env?.[n] || '').trim());
  return `Configuração da Evolution incompleta: falta ${nomes.join(', ')}.`;
}

async function chamar(url, corpo, apikey, fetchImpl, oQue) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { apikey, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detalhe = (await res.text().catch(() => '')).slice(0, 200);
      return { ok: false, erro: `A Evolution recusou ${oQue} (HTTP ${res.status}). ${detalhe}`.trim() };
    }
    return { ok: true };
  } catch (e) {
    // Timeout ou rede. Quem chama registra o motivo; o importante é não
    // confundir "não consegui falar com a Evolution" com "a ação falhou lá".
    return { ok: false, erro: `Não foi possível falar com a Evolution para ${oQue}: ${e?.message || e}` };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- tests/evolution-grupos.test.js`
Esperado: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add functions/api/_evolution-grupos.js tests/evolution-grupos.test.js
git commit -m "feat(grupos): fronteira unica com a Evolution para acoes de grupo"
```

---

### Task 3: Validar e criar ação

**Files:**
- Create: `functions/api/_grupos-acoes.js`
- Modify: `tests/grupos-acoes.test.js`

**Interfaces:**
- Consumes: tabela da Task 1
- Produces:
  - `ATRASO_MAX_SEG`, `MAX_TENTATIVAS`, `TEXTO_MAX`, `TITULO_MAX`
  - `validarAcao(corpo, grupo, agora) → { erro: string } | { acao: { group_jid, tipo, payload, agendada_para } }`
  - `criarAcao(env, corpo, agora) → { erro, status } | { id, acao }`
  - `cancelarAcao(env, id) → { ok: boolean, erro?: string }`
  - `listarAcoes(env, agora) → { agendadas: [], historico: [] }`

`validarAcao` é pura — é onde as regras ficam testáveis sem banco. `criarAcao` busca o grupo na allowlist e delega.

- [ ] **Step 1: Escrever os testes**

Acrescentar ao fim de `tests/grupos-acoes.test.js` (antes do `export`):

```js
import { validarAcao, criarAcao, cancelarAcao, listarAcoes, ATRASO_MAX_SEG } from '../functions/api/_grupos-acoes.js';

const GRUPO = { group_jid: AVISOS, label: 'Live semanal', parent_jid: PAI };

test('recusa tipo desconhecido', () => {
  const r = validarAcao({ tipo: 'apagar_tudo', agendada_para: AGORA + 600 }, GRUPO, AGORA);
  assert.match(r.erro, /tipo/i);
});

test('recusa mensagem sem texto e texto longo demais', () => {
  assert.match(validarAcao({ tipo: 'mensagem', texto: '   ', agendada_para: AGORA + 600 }, GRUPO, AGORA).erro, /texto/i);
  assert.match(validarAcao({ tipo: 'mensagem', texto: 'x'.repeat(4001), agendada_para: AGORA + 600 }, GRUPO, AGORA).erro, /4000/);
});

test('recusa renomear sem título e título longo demais', () => {
  assert.match(validarAcao({ tipo: 'renomear', titulo: '', agendada_para: AGORA + 600 }, GRUPO, AGORA).erro, /t[ií]tulo/i);
  assert.match(validarAcao({ tipo: 'renomear', titulo: 'x'.repeat(101), agendada_para: AGORA + 600 }, GRUPO, AGORA).erro, /100/);
});

test('recusa hora no passado', () => {
  const r = validarAcao({ tipo: 'mensagem', texto: 'oi', agendada_para: AGORA - 60 }, GRUPO, AGORA);
  assert.match(r.erro, /passado/i);
});

test('aceita agendar para daqui a pouco e guarda o payload como JSON', () => {
  const r = validarAcao({ tipo: 'mensagem', texto: ' Começou! ', agendada_para: AGORA + 600 }, GRUPO, AGORA);
  assert.equal(r.erro, undefined);
  assert.equal(r.acao.group_jid, AVISOS);
  assert.deepEqual(JSON.parse(r.acao.payload), { texto: 'Começou!' });
});

test('aplicar_no_par é recusado quando o grupo não tem par conhecido', () => {
  const semPar = { group_jid: AVISOS, label: 'x', parent_jid: null };
  const r = validarAcao({ tipo: 'renomear', titulo: 'Novo', aplicar_no_par: true, agendada_para: AGORA + 600 }, semPar, AGORA);
  assert.match(r.erro, /par/i);
});

test('criarAcao recusa grupo fora da allowlist e grupo desligado', async () => {
  const env = { DB: d1(novoBanco()) };
  const fora = await criarAcao(env, { group_jid: 'inventado@g.us', tipo: 'mensagem', texto: 'oi', agendada_para: AGORA + 600 }, AGORA);
  assert.equal(fora.status, 400);
  assert.match(fora.erro, /monitorad/i);
  const desligado = await criarAcao(env, { group_jid: 'desligado@g.us', tipo: 'mensagem', texto: 'oi', agendada_para: AGORA + 600 }, AGORA);
  assert.equal(desligado.status, 400);
});

test('criarAcao grava a ação como agendada', async () => {
  const db = novoBanco(); const env = { DB: d1(db) };
  const r = await criarAcao(env, { group_jid: AVISOS, tipo: 'renomear', titulo: '24/09 às 12h', aplicar_no_par: true, agendada_para: AGORA + 600 }, AGORA);
  assert.ok(r.id);
  const l = db.prepare('SELECT * FROM whatsapp_group_actions WHERE id = ?').get(r.id);
  assert.equal(l.status, 'agendada');
  assert.equal(l.agendada_para, AGORA + 600);
  assert.deepEqual(JSON.parse(l.payload), { titulo: '24/09 às 12h', aplicar_no_par: true });
});

test('cancelar só vale enquanto está agendada', async () => {
  const db = novoBanco(); const env = { DB: d1(db) };
  const { id } = await criarAcao(env, { group_jid: AVISOS, tipo: 'mensagem', texto: 'oi', agendada_para: AGORA + 600 }, AGORA);
  assert.deepEqual(await cancelarAcao(env, id), { ok: true });
  assert.equal(db.prepare('SELECT status FROM whatsapp_group_actions WHERE id = ?').get(id).status, 'cancelada');
  const segunda = await cancelarAcao(env, id);
  assert.equal(segunda.ok, false, 'cancelar duas vezes não pode dizer que deu certo');
});

test('listarAcoes separa o que ainda vai acontecer do que já aconteceu', async () => {
  const db = novoBanco(); const env = { DB: d1(db) };
  await criarAcao(env, { group_jid: AVISOS, tipo: 'mensagem', texto: 'futura', agendada_para: AGORA + 600 }, AGORA);
  const { id } = await criarAcao(env, { group_jid: AVISOS, tipo: 'mensagem', texto: 'passada', agendada_para: AGORA + 300 }, AGORA);
  db.prepare("UPDATE whatsapp_group_actions SET status='concluida', executada_em=? WHERE id=?").run(AGORA + 300, id);
  const r = await listarAcoes(env, AGORA);
  assert.equal(r.agendadas.length, 1);
  assert.equal(r.historico.length, 1);
  assert.equal(r.agendadas[0].label, 'Live semanal', 'a agenda mostra o rótulo do grupo, não o JID cru');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/grupos-acoes.test.js`
Esperado: FAIL — módulo `_grupos-acoes.js` não existe.

- [ ] **Step 3: Implementar a parte de criação**

```js
// functions/api/_grupos-acoes.js
//
// Agenda de ações de grupo: validar, criar, cancelar, listar e EXECUTAR.
// Spec: docs/superpowers/specs/2026-09-17-gestao-grupos-whatsapp-design.md
//
// A execução mora aqui, e não no endpoint, porque ela tem DOIS gatilhos: o
// cron (ações vencidas) e o botão "fazer agora" do painel. Um caminho de
// código só é o que garante que o que se testa clicando é o que roda às 12h.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { enviarTexto, renomear } from './_evolution-grupos.js';

// Passado isto da hora marcada, a ação NÃO dispara mais. Um aviso de live
// chegando quatro horas depois é pior que não chegar: a live já acabou, e
// quem recebe aprende que o aviso não vale.
export const ATRASO_MAX_SEG = 30 * 60;

// Só para 'renomear', que é idempotente. Mensagem nunca retenta — ver executar().
export const MAX_TENTATIVAS = 3;

export const TEXTO_MAX = 4000;
export const TITULO_MAX = 100;

const TIPOS = new Set(['mensagem', 'renomear']);

/**
 * Regras de uma ação nova. Pura de propósito: é onde a validação fica
 * testável sem banco, e é a única validação que existe — o formulário do
 * painel não valida nada (thin client).
 */
export function validarAcao(corpo, grupo, agora) {
  if (!grupo) return { erro: 'Esse grupo não está na lista de grupos monitorados.' };

  const tipo = String(corpo?.tipo || '').trim();
  if (!TIPOS.has(tipo)) return { erro: 'Tipo de ação desconhecido. Use "mensagem" ou "renomear".' };

  const quando = Number(corpo?.agendada_para);
  if (!Number.isFinite(quando)) return { erro: 'Informe a data e a hora.' };
  if (quando < agora) return { erro: 'Essa hora já passou — escolha um horário no futuro.' };

  let payload;
  if (tipo === 'mensagem') {
    const texto = String(corpo?.texto ?? '').trim();
    if (!texto) return { erro: 'Escreva o texto da mensagem.' };
    if (texto.length > TEXTO_MAX) return { erro: `A mensagem passou de ${TEXTO_MAX} caracteres.` };
    payload = { texto };
  } else {
    const titulo = String(corpo?.titulo ?? '').trim();
    if (!titulo) return { erro: 'Escreva o novo título do grupo.' };
    if (titulo.length > TITULO_MAX) return { erro: `O título passou de ${TITULO_MAX} caracteres.` };
    const noPar = !!corpo?.aplicar_no_par;
    // Sem parent_jid conferido, aplicar no par seria adivinhar qual é o outro
    // grupo — e renomear o grupo errado é justamente o dano que a allowlist
    // existe para impedir.
    if (noPar && !grupo.parent_jid) {
      return { erro: 'O grupo par (Comunidade) ainda não foi identificado para este grupo. Renomeie só este por enquanto.' };
    }
    payload = { titulo, aplicar_no_par: noPar };
  }

  return { acao: { group_jid: grupo.group_jid, tipo, payload: JSON.stringify(payload), agendada_para: quando } };
}

/** Grupo da allowlist, com o par. Fonte única de "em que grupo posso agir". */
export async function grupoMonitorado(env, jid) {
  return env.DB.prepare(
    'SELECT group_jid, label, parent_jid FROM whatsapp_groups_tracked WHERE group_jid = ? AND enabled = 1'
  ).bind(String(jid || '')).first();
}

export async function criarAcao(env, corpo, agora) {
  const grupo = await grupoMonitorado(env, corpo?.group_jid);
  const v = validarAcao(corpo, grupo, agora);
  if (v.erro) return { erro: v.erro, status: 400 };

  const r = await env.DB.prepare(
    `INSERT INTO whatsapp_group_actions (group_jid, tipo, payload, agendada_para, status, criada_em)
     VALUES (?, ?, ?, ?, 'agendada', ?)`
  ).bind(v.acao.group_jid, v.acao.tipo, v.acao.payload, v.acao.agendada_para, agora).run();

  return { id: r.meta.last_row_id, acao: v.acao };
}

/**
 * Cancela enquanto ainda está 'agendada'. O WHERE carrega a regra: uma ação
 * que já entrou em execução não volta atrás, e dizer "cancelei" nesse caso
 * seria mentir para quem clicou.
 */
export async function cancelarAcao(env, id) {
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) return { ok: false, erro: 'id inválido' };
  const r = await env.DB.prepare(
    "UPDATE whatsapp_group_actions SET status = 'cancelada' WHERE id = ? AND status = 'agendada'"
  ).bind(n).run();
  if (r.meta.changes === 0) return { ok: false, erro: 'Essa ação não está mais agendada — ou já saiu, ou já foi cancelada.' };
  return { ok: true };
}

/** O que vai acontecer e o que já aconteceu, com o rótulo do grupo resolvido. */
export async function listarAcoes(env, agora) {
  const campos = `a.id, a.group_jid, a.tipo, a.payload, a.agendada_para, a.status,
                  a.tentativas, a.erro, a.resultado, a.executada_em,
                  COALESCE(g.label, a.group_jid) AS label`;
  const juncao = 'FROM whatsapp_group_actions a LEFT JOIN whatsapp_groups_tracked g ON g.group_jid = a.group_jid';

  const agendadas = await env.DB.prepare(
    `SELECT ${campos} ${juncao} WHERE a.status IN ('agendada','executando') ORDER BY a.agendada_para ASC`
  ).all();
  // Histórico curto de propósito: é para responder "saiu?", não para virar
  // relatório. Tabela grande na tela custa leitura do D1 sem servir a ninguém.
  const historico = await env.DB.prepare(
    `SELECT ${campos} ${juncao} WHERE a.status IN ('concluida','falhou','cancelada')
     ORDER BY COALESCE(a.executada_em, a.agendada_para) DESC LIMIT 30`
  ).all();

  return { agora, agendadas: (agendadas.results || []).map(comPayload), historico: (historico.results || []).map(comPayload) };
}

// O payload chega do banco como texto; a tela não deveria precisar saber disso.
function comPayload(l) {
  let p = {};
  try { p = JSON.parse(l.payload || '{}'); } catch { p = {}; }
  return { ...l, payload: p };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- tests/grupos-acoes.test.js`
Esperado: PASS (11 testes).

- [ ] **Step 5: Commit**

```bash
git add functions/api/_grupos-acoes.js tests/grupos-acoes.test.js
git commit -m "feat(grupos): validacao, criacao, cancelamento e listagem de acoes"
```

---

### Task 4: Executor (trava de corrida, atraso, retentativa)

**Files:**
- Modify: `functions/api/_grupos-acoes.js`
- Modify: `tests/grupos-acoes.test.js`

**Interfaces:**
- Consumes: `enviarTexto`/`renomear` da Task 2, `grupoMonitorado` da Task 3
- Produces:
  - `executarAcao(env, id, agora, fetchImpl?) → { id, status, erro?, resultado? }`
  - `executarVencidas(env, agora, fetchImpl?) → { executadas: [], total: number, falhas: number }`

É a tarefa onde mora todo o risco da feature. As quatro regras da spec são estas quatro funções de guarda.

- [ ] **Step 1: Escrever os testes**

Acrescentar a `tests/grupos-acoes.test.js`:

```js
import { executarAcao, executarVencidas } from '../functions/api/_grupos-acoes.js';

const ENV_EVO = { EVOLUTION_BASE_URL: 'https://api.exemplo.com', EVOLUTION_INSTANCE: 'Marcelle', EVOLUTION_APIKEY_NOTIF: 'segredo' };
const envCom = (db) => ({ DB: d1(db), ...ENV_EVO });
const okFetch = () => new Response('{}', { status: 200 });

async function agendar(env, extra = {}) {
  const r = await criarAcao(env, { group_jid: AVISOS, tipo: 'mensagem', texto: 'oi', agendada_para: AGORA + 300, ...extra }, AGORA);
  assert.ok(r.id, r.erro);
  return r.id;
}

test('mensagem na hora certa é enviada e fica concluída', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await agendar(env);
  let chamadas = 0;
  const r = await executarAcao(env, id, AGORA + 300, async () => { chamadas++; return okFetch(); });
  assert.equal(r.status, 'concluida');
  assert.equal(chamadas, 1);
  const l = db.prepare('SELECT * FROM whatsapp_group_actions WHERE id=?').get(id);
  assert.equal(l.status, 'concluida');
  assert.equal(l.executada_em, AGORA + 300);
});

test('ação vencida há mais de 30 min NÃO dispara e vira falha', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await agendar(env);
  let chamadas = 0;
  const r = await executarAcao(env, id, AGORA + 300 + ATRASO_MAX_SEG + 1, async () => { chamadas++; return okFetch(); });
  assert.equal(chamadas, 0, 'mensagem atrasada não pode ser enviada');
  assert.equal(r.status, 'falhou');
  assert.match(r.erro, /atrasada/i);
});

test('exatamente no limite de 30 min ainda dispara', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await agendar(env);
  const r = await executarAcao(env, id, AGORA + 300 + ATRASO_MAX_SEG, async () => okFetch());
  assert.equal(r.status, 'concluida');
});

test('trava de corrida: a segunda execução simultânea não faz nada', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await agendar(env);
  let chamadas = 0;
  const f = async () => { chamadas++; return okFetch(); };
  const [a, b] = await Promise.all([executarAcao(env, id, AGORA + 300, f), executarAcao(env, id, AGORA + 300, f)]);
  assert.equal(chamadas, 1, 'a mensagem não pode sair duas vezes');
  const status = [a.status, b.status].sort();
  assert.deepEqual(status, ['concluida', 'ignorada']);
});

test('mensagem que falha NÃO é retentada', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await agendar(env);
  const r = await executarAcao(env, id, AGORA + 300, async () => new Response('nope', { status: 500 }));
  assert.equal(r.status, 'falhou');
  const l = db.prepare('SELECT * FROM whatsapp_group_actions WHERE id=?').get(id);
  assert.equal(l.status, 'falhou', 'mensagem falhada precisa sair da fila, não voltar para agendada');
  assert.equal(l.tentativas, 1);
});

test('renomear que falha volta para a fila até 3 tentativas', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await criarAcao(env, { group_jid: AVISOS, tipo: 'renomear', titulo: 'Novo', agendada_para: AGORA + 300 }, AGORA).then((r) => r.id);
  const falha = async () => new Response('nope', { status: 500 });
  await executarAcao(env, id, AGORA + 300, falha);
  let l = db.prepare('SELECT * FROM whatsapp_group_actions WHERE id=?').get(id);
  assert.equal(l.status, 'agendada', 'renomear é idempotente, pode tentar de novo');
  assert.equal(l.tentativas, 1);
  await executarAcao(env, id, AGORA + 310, falha);
  await executarAcao(env, id, AGORA + 320, falha);
  l = db.prepare('SELECT * FROM whatsapp_group_actions WHERE id=?').get(id);
  assert.equal(l.status, 'falhou', 'na 3ª tentativa desiste');
  assert.equal(l.tentativas, 3);
});

test('renomear com aplicar_no_par renomeia os dois grupos', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await criarAcao(env, { group_jid: AVISOS, tipo: 'renomear', titulo: '24/09 às 12h', aplicar_no_par: true, agendada_para: AGORA + 300 }, AGORA).then((r) => r.id);
  const jids = [];
  await executarAcao(env, id, AGORA + 300, async (url) => { jids.push(new URL(url).searchParams.get('groupJid')); return okFetch(); });
  assert.deepEqual(jids.sort(), [PAI, AVISOS].sort());
});

test('se um dos dois do par falha, a ação falha inteira', async () => {
  const db = novoBanco(); const env = envCom(db);
  const id = await criarAcao(env, { group_jid: AVISOS, tipo: 'renomear', titulo: 'x', aplicar_no_par: true, agendada_para: AGORA + 300 }, AGORA).then((r) => r.id);
  let n = 0;
  const r = await executarAcao(env, id, AGORA + 300, async () => (++n === 1 ? okFetch() : new Response('x', { status: 500 })));
  assert.notEqual(r.status, 'concluida');
});

test('executarVencidas pega só o que venceu e ignora cancelada e futura', async () => {
  const db = novoBanco(); const env = envCom(db);
  const venceu = await agendar(env, { texto: 'venceu', agendada_para: AGORA + 100 });
  const futura = await agendar(env, { texto: 'futura', agendada_para: AGORA + 9999 });
  const cancelada = await agendar(env, { texto: 'cancelada', agendada_para: AGORA + 100 });
  await cancelarAcao(env, cancelada);
  const r = await executarVencidas(env, AGORA + 200, async () => okFetch());
  assert.equal(r.total, 1);
  assert.equal(db.prepare('SELECT status FROM whatsapp_group_actions WHERE id=?').get(venceu).status, 'concluida');
  assert.equal(db.prepare('SELECT status FROM whatsapp_group_actions WHERE id=?').get(futura).status, 'agendada');
});

test('executarVencidas conta falhas e não para na primeira', async () => {
  const db = novoBanco(); const env = envCom(db);
  await agendar(env, { texto: 'a', agendada_para: AGORA + 100 });
  await agendar(env, { texto: 'b', agendada_para: AGORA + 110 });
  let n = 0;
  const r = await executarVencidas(env, AGORA + 200, async () => (++n === 1 ? new Response('x', { status: 500 }) : okFetch()));
  assert.equal(r.total, 2, 'a segunda ação precisa ser tentada mesmo com a primeira falhando');
  assert.equal(r.falhas, 1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/grupos-acoes.test.js`
Esperado: FAIL — `executarAcao is not a function`.

- [ ] **Step 3: Implementar**

Acrescentar a `functions/api/_grupos-acoes.js`:

```js
/**
 * Executa UMA ação. Os dois gatilhos (cron e botão "fazer agora") passam por
 * aqui — é o que garante que testar clicando testa o que roda às 12h.
 *
 * Devolve sempre um objeto, nunca lança: uma ação quebrada não pode derrubar
 * a rodada inteira nem o endpoint.
 */
export async function executarAcao(env, id, agora, fetchImpl = fetch) {
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) return { id, status: 'ignorada', erro: 'id inválido' };

  // TRAVA DE CORRIDA. A reserva é a própria condição do UPDATE: se zero linhas
  // mudaram, outra passada do cron já pegou esta ação e está executando. Sem
  // isto, um cron lento sobrepondo o seguinte manda a mesma mensagem duas
  // vezes para o grupo inteiro — o dano que não tem desfazer.
  const reserva = await env.DB.prepare(
    "UPDATE whatsapp_group_actions SET status = 'executando' WHERE id = ? AND status = 'agendada'"
  ).bind(n).run();
  if (reserva.meta.changes === 0) return { id: n, status: 'ignorada' };

  const acao = await env.DB.prepare('SELECT * FROM whatsapp_group_actions WHERE id = ?').bind(n).first();
  if (!acao) return { id: n, status: 'ignorada' };

  // JANELA DE ATRASO. Passou de 30 min da hora marcada (VPS caiu, deploy
  // travado, fila parada), a ação não sai. Aviso de live que chega depois da
  // live é pior que aviso nenhum.
  const atraso = agora - acao.agendada_para;
  if (atraso > ATRASO_MAX_SEG) {
    return finalizar(env, acao, agora, {
      ok: false,
      erro: `Não foi executada: venceu há ${Math.round(atraso / 60)} min e passou da janela de ${ATRASO_MAX_SEG / 60} min.`,
      atrasada: true,
    });
  }

  let payload = {};
  try { payload = JSON.parse(acao.payload || '{}'); } catch { payload = {}; }

  let resultado;
  if (acao.tipo === 'mensagem') {
    resultado = await enviarTexto(env, acao.group_jid, payload.texto, fetchImpl);
    if (resultado.ok) resultado.resumo = 'Mensagem enviada.';
  } else if (acao.tipo === 'renomear') {
    resultado = await renomearGrupo(env, acao, payload, fetchImpl);
  } else {
    resultado = { ok: false, erro: `Tipo de ação desconhecido: ${acao.tipo}` };
  }

  return finalizar(env, acao, agora, resultado);
}

// Renomeia o grupo e, se pedido, o par da Comunidade. Os dois grupos vêm com
// o mesmo nome: renomear só um deixa a Comunidade com metade do título velho,
// e isso passa despercebido porque o WhatsApp mostra os dois em lugares
// diferentes. Sequencial, não em paralelo: são duas escritas no mesmo número,
// e a Evolution responde melhor a uma de cada vez.
async function renomearGrupo(env, acao, payload, fetchImpl) {
  const alvos = [acao.group_jid];
  if (payload.aplicar_no_par) {
    const grupo = await grupoMonitorado(env, acao.group_jid);
    if (!grupo?.parent_jid) return { ok: false, erro: 'O grupo par não está identificado — renomeio só este.' };
    alvos.push(grupo.parent_jid);
  }
  const feitos = [];
  for (const jid of alvos) {
    const r = await renomear(env, jid, payload.titulo, fetchImpl);
    if (!r.ok) return { ok: false, erro: `${r.erro} (já renomeados: ${feitos.length} de ${alvos.length})` };
    feitos.push(jid);
  }
  return { ok: true, resumo: feitos.length > 1 ? 'Grupo e par renomeados.' : 'Grupo renomeado.' };
}

/**
 * Grava o desfecho. Aqui mora a regra de retentativa, e ela é assimétrica de
 * propósito:
 *
 * - `mensagem` NUNCA volta para a fila. Reenviar para centenas de pessoas é
 *   como um erro vira dano irreversível, e "não tenho certeza se saiu" é
 *   exatamente o caso em que ele acontece. Falhou, fica vermelho, a decisão é
 *   humana.
 * - `renomear` volta, até MAX_TENTATIVAS. É idempotente: aplicar duas vezes dá
 *   o mesmo grupo com o mesmo nome.
 * - Ação atrasada nunca volta, seja qual for o tipo — o problema dela é a
 *   hora, e ela só ficaria mais atrasada.
 */
async function finalizar(env, acao, agora, resultado) {
  const tentativas = (acao.tentativas || 0) + 1;

  if (resultado.ok) {
    await env.DB.prepare(
      "UPDATE whatsapp_group_actions SET status='concluida', tentativas=?, erro=NULL, resultado=?, executada_em=? WHERE id=?"
    ).bind(tentativas, resultado.resumo || 'Concluída.', agora, acao.id).run();
    return { id: acao.id, status: 'concluida', resultado: resultado.resumo };
  }

  const podeRetentar = acao.tipo === 'renomear' && !resultado.atrasada && tentativas < MAX_TENTATIVAS;
  const status = podeRetentar ? 'agendada' : 'falhou';

  await env.DB.prepare(
    `UPDATE whatsapp_group_actions SET status=?, tentativas=?, erro=?, executada_em=? WHERE id=?`
  ).bind(status, tentativas, resultado.erro, podeRetentar ? null : agora, acao.id).run();

  return { id: acao.id, status, erro: resultado.erro, tentativas };
}

/**
 * Todas as ações vencidas, uma a uma. Sequencial de propósito: são escritas no
 * mesmo número de WhatsApp, e disparar em paralelo é justamente o padrão de
 * tráfego que faz a Meta olhar torto para um número.
 *
 * Uma ação que falha não interrompe as outras — senão uma mensagem quebrada
 * seguraria o renomear da semana seguinte.
 */
export async function executarVencidas(env, agora, fetchImpl = fetch) {
  const { results } = await env.DB.prepare(
    "SELECT id FROM whatsapp_group_actions WHERE status = 'agendada' AND agendada_para <= ? ORDER BY agendada_para ASC LIMIT 20"
  ).bind(agora).all();

  const executadas = [];
  for (const { id } of results || []) {
    try {
      executadas.push(await executarAcao(env, id, agora, fetchImpl));
    } catch (e) {
      console.error('grupos-acoes: ação', id, 'quebrou:', e?.message || e);
      executadas.push({ id, status: 'falhou', erro: String(e?.message || e) });
    }
  }

  return {
    executadas,
    total: executadas.filter((e) => e.status !== 'ignorada').length,
    falhas: executadas.filter((e) => e.status === 'falhou').length,
  };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- tests/grupos-acoes.test.js`
Esperado: PASS (21 testes).

- [ ] **Step 5: Commit**

```bash
git add functions/api/_grupos-acoes.js tests/grupos-acoes.test.js
git commit -m "feat(grupos): executor com trava de corrida, janela de atraso e retentativa"
```

---

### Task 5: Endpoint do painel

**Files:**
- Create: `functions/api/grupos-acoes.js`
- Modify: `tests/grupos-acoes.test.js`

**Interfaces:**
- Consumes: `criarAcao`, `cancelarAcao`, `listarAcoes`, `executarAcao`
- Produces: `onRequestGet`, `onRequestPost`

Contrato HTTP:

| Rota | Corpo | Devolve |
|---|---|---|
| `GET /api/grupos-acoes?key=` | — | `{ agora, grupos: [{group_jid,label,tem_par}], agendadas: [], historico: [] }` |
| `POST /api/grupos-acoes?key=` | `{group_jid,tipo,texto\|titulo,aplicar_no_par,agendada_para}` | `{ ok: true, id }` |
| `POST /api/grupos-acoes?key=&acao=cancelar` | `{id}` | `{ ok: true }` |
| `POST /api/grupos-acoes?key=&acao=agora` | `{group_jid,tipo,...}` | `{ ok: true, id, status }` |

`acao=agora` **cria e executa na mesma chamada**, com `agendada_para = agora`. Assim o histórico registra também o que foi feito na mão — um disparo manual que não deixa rastro é um disparo que ninguém consegue investigar depois.

- [ ] **Step 1: Escrever os testes**

Acrescentar a `tests/grupos-acoes.test.js`:

```js
import { onRequestGet as acoesGet, onRequestPost as acoesPost } from '../functions/api/grupos-acoes.js';

const req = (url, init) => new Request('https://exemplo.com' + url, init);
const post = (qs, corpo) => req('/api/grupos-acoes?key=k' + qs, { method: 'POST', body: JSON.stringify(corpo) });

test('sem a chave do dash, 401', async () => {
  const env = { DB: d1(novoBanco()), DASH_KEY: 'k' };
  assert.equal((await acoesGet({ request: req('/api/grupos-acoes'), env })).status, 401);
  assert.equal((await acoesPost({ request: post2('errada'), env })).status, 401);
  function post2(k) { return req(`/api/grupos-acoes?key=${k}`, { method: 'POST', body: '{}' }); }
});

test('GET devolve os grupos que aceitam ação, com o par sinalizado', async () => {
  const env = { DB: d1(novoBanco()), DASH_KEY: 'k' };
  const r = await acoesGet({ request: req('/api/grupos-acoes?key=k'), env });
  const j = await r.json();
  assert.equal(j.grupos.length, 1, 'grupo desligado não pode aparecer');
  assert.equal(j.grupos[0].group_jid, AVISOS);
  assert.equal(j.grupos[0].tem_par, true);
});

test('POST agenda e o erro de validação volta como 400 legível', async () => {
  const env = { DB: d1(novoBanco()), DASH_KEY: 'k', ...ENV_EVO };
  const bom = await acoesPost({ request: post('', { group_jid: AVISOS, tipo: 'mensagem', texto: 'oi', agendada_para: Math.floor(Date.now() / 1000) + 3600 }), env });
  assert.equal(bom.status, 200);
  assert.ok((await bom.json()).id);
  const ruim = await acoesPost({ request: post('', { group_jid: AVISOS, tipo: 'mensagem', texto: '', agendada_para: Math.floor(Date.now() / 1000) + 3600 }), env });
  assert.equal(ruim.status, 400);
  assert.match((await ruim.json()).error, /texto/i);
});

test('POST com JSON quebrado responde 400, não 500', async () => {
  const env = { DB: d1(novoBanco()), DASH_KEY: 'k' };
  const r = await acoesPost({ request: req('/api/grupos-acoes?key=k', { method: 'POST', body: 'nao é json' }), env });
  assert.equal(r.status, 400);
});

test('acao=agora cria, executa e deixa rastro no histórico', async () => {
  const db = novoBanco();
  const env = { DB: d1(db), DASH_KEY: 'k', ...ENV_EVO };
  let chamou = 0;
  const r = await acoesPost({
    request: post('&acao=agora', { group_jid: AVISOS, tipo: 'mensagem', texto: 'teste' }),
    env,
    fetchImpl: async () => { chamou++; return new Response('{}', { status: 200 }); },
  });
  const j = await r.json();
  assert.equal(chamou, 1);
  assert.equal(j.status, 'concluida');
  assert.equal(db.prepare('SELECT status FROM whatsapp_group_actions WHERE id=?').get(j.id).status, 'concluida');
});

test('acao=cancelar responde 409 quando já não dá mais', async () => {
  const env = { DB: d1(novoBanco()), DASH_KEY: 'k' };
  const criada = await acoesPost({ request: post('', { group_jid: AVISOS, tipo: 'mensagem', texto: 'oi', agendada_para: Math.floor(Date.now() / 1000) + 3600 }), env });
  const { id } = await criada.json();
  assert.equal((await acoesPost({ request: post('&acao=cancelar', { id }), env })).status, 200);
  assert.equal((await acoesPost({ request: post('&acao=cancelar', { id }), env })).status, 409);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/grupos-acoes.test.js`
Esperado: FAIL — módulo `grupos-acoes.js` não existe.

- [ ] **Step 3: Implementar**

```js
// functions/api/grupos-acoes.js
//
// GET  /api/grupos-acoes?key=...              → agenda, histórico e grupos disponíveis
// POST /api/grupos-acoes?key=...              → agenda uma ação
// POST /api/grupos-acoes?key=...&acao=cancelar → cancela (só enquanto agendada)
// POST /api/grupos-acoes?key=...&acao=agora    → cria e executa na hora
//
// Consome a aba "Grupos" do dashboard. Endpoint ADITIVO: /api/grupos e
// /api/grupos-conexao não foram tocados.
//
// A regra de negócio não está aqui — está em _grupos-acoes.js, para que o cron
// e o botão "fazer agora" passem exatamente pelo mesmo caminho.
//
// `acao=agora` também grava a ação antes de executar: disparo manual que não
// deixa rastro é disparo que ninguém consegue investigar depois.

import { criarAcao, cancelarAcao, listarAcoes, executarAcao } from './_grupos-acoes.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!autorizado(request, env)) return json({ error: 'Unauthorized' }, 401);

  const agora = Math.floor(Date.now() / 1000);
  const { results } = await env.DB.prepare(
    'SELECT group_jid, label, parent_jid FROM whatsapp_groups_tracked WHERE enabled = 1 ORDER BY label'
  ).all();

  const lista = await listarAcoes(env, agora);
  return json({
    ...lista,
    // `tem_par` em vez do JID do par: o navegador não precisa do identificador
    // do grupo para desenhar uma caixinha de seleção.
    grupos: (results || []).map((g) => ({ group_jid: g.group_jid, label: g.label, tem_par: !!g.parent_jid })),
  });
}

export async function onRequestPost(context) {
  // fetchImpl injetável só para o teste; em produção é o fetch do Worker.
  const { request, env, fetchImpl = fetch } = context;
  if (!autorizado(request, env)) return json({ error: 'Unauthorized' }, 401);

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const agora = Math.floor(Date.now() / 1000);
  const acao = new URL(request.url).searchParams.get('acao');

  if (acao === 'cancelar') {
    const r = await cancelarAcao(env, corpo?.id);
    // 409 e não 400: o pedido estava bem formado, o estado é que mudou — e a
    // tela precisa saber a diferença para dizer "já saiu" em vez de "erro".
    return r.ok ? json({ ok: true }) : json({ error: r.erro }, 409);
  }

  const quando = acao === 'agora' ? agora : corpo?.agendada_para;
  const criada = await criarAcao(env, { ...corpo, agendada_para: quando }, agora);
  if (criada.erro) return json({ error: criada.erro }, criada.status || 400);

  if (acao !== 'agora') return json({ ok: true, id: criada.id });

  const r = await executarAcao(env, criada.id, agora, fetchImpl);
  return json({ ok: r.status === 'concluida', id: criada.id, status: r.status, erro: r.erro || null });
}

function autorizado(request, env) {
  const url = new URL(request.url);
  return !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- tests/grupos-acoes.test.js`
Esperado: PASS (27 testes).

- [ ] **Step 5: Commit**

```bash
git add functions/api/grupos-acoes.js tests/grupos-acoes.test.js
git commit -m "feat(grupos): endpoint do painel para a agenda de acoes"
```

---

### Task 6: Endpoint de sync (cron) e alerta no Slack

**Files:**
- Create: `functions/api/sync/grupo-acoes.js`
- Modify: `tests/grupos-acoes.test.js`

**Interfaces:**
- Consumes: `executarVencidas`
- Produces: `onRequestPost`

O alerta reusa o secret `SLACK_WEBHOOK_META` (mesmo canal do CAPI) em vez de criar um segundo. **O webhook ainda não foi cadastrado pela usuária** — sem ele, `entregarSlack` devolve `sem_canal` e a rodada continua normalmente. O alerta é um extra; ele nunca pode fazer a rodada falhar.

- [ ] **Step 1: Escrever os testes**

Acrescentar a `tests/grupos-acoes.test.js`:

```js
import { onRequestPost as syncPost } from '../functions/api/sync/grupo-acoes.js';

const syncReq = (secret) => new Request('https://exemplo.com/api/sync/grupo-acoes', {
  method: 'POST', headers: secret ? { 'x-sync-secret': secret } : {},
});

test('sync exige o x-sync-secret', async () => {
  const env = { DB: d1(novoBanco()), SYNC_SECRET: 's' };
  assert.equal((await syncPost({ request: syncReq(), env })).status, 401);
  assert.equal((await syncPost({ request: syncReq('errado'), env })).status, 401);
});

test('sync executa as vencidas e responde o resumo', async () => {
  const db = novoBanco();
  const env = { DB: d1(db), SYNC_SECRET: 's', ...ENV_EVO };
  const passado = Math.floor(Date.now() / 1000) - 60;
  db.prepare("INSERT INTO whatsapp_group_actions (group_jid,tipo,payload,agendada_para,status,criada_em) VALUES (?,?,?,?,'agendada',?)")
    .run(AVISOS, 'mensagem', JSON.stringify({ texto: 'oi' }), passado, passado);
  const r = await syncPost({ request: syncReq('s'), env, fetchImpl: async () => new Response('{}', { status: 200 }) });
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.total, 1);
  assert.equal(j.falhas, 0);
});

test('falha avisa no Slack quando o canal existe', async () => {
  const db = novoBanco();
  const env = { DB: d1(db), SYNC_SECRET: 's', SLACK_WEBHOOK_META: 'https://hooks.slack.com/x', ...ENV_EVO };
  const passado = Math.floor(Date.now() / 1000) - 60;
  db.prepare("INSERT INTO whatsapp_group_actions (group_jid,tipo,payload,agendada_para,status,criada_em) VALUES (?,?,?,?,'agendada',?)")
    .run(AVISOS, 'mensagem', JSON.stringify({ texto: 'oi' }), passado, passado);
  const urls = [];
  const r = await syncPost({
    request: syncReq('s'), env,
    fetchImpl: async (url) => { urls.push(String(url)); return new Response('x', { status: url.includes('slack') ? 200 : 500 }); },
  });
  assert.ok(urls.some((u) => u.includes('slack')), 'falha precisa gritar no Slack');
  assert.equal((await r.json()).falhas, 1);
});

test('Slack fora do ar não derruba a rodada', async () => {
  const db = novoBanco();
  const env = { DB: d1(db), SYNC_SECRET: 's', SLACK_WEBHOOK_META: 'https://hooks.slack.com/x', ...ENV_EVO };
  const passado = Math.floor(Date.now() / 1000) - 60;
  db.prepare("INSERT INTO whatsapp_group_actions (group_jid,tipo,payload,agendada_para,status,criada_em) VALUES (?,?,?,?,'agendada',?)")
    .run(AVISOS, 'mensagem', JSON.stringify({ texto: 'oi' }), passado, passado);
  const r = await syncPost({
    request: syncReq('s'), env,
    fetchImpl: async (url) => { if (String(url).includes('slack')) throw new Error('rede'); return new Response('x', { status: 500 }); },
  });
  assert.equal(r.status, 200, 'alerta é extra: não pode fazer a rodada falhar');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/grupos-acoes.test.js`
Esperado: FAIL — módulo `sync/grupo-acoes.js` não existe.

- [ ] **Step 3: Implementar**

```js
// functions/api/sync/grupo-acoes.js
//
// POST /api/sync/grupo-acoes — executa as ações de grupo que já venceram.
//
// Chamado por cron na VPS a cada 5 minutos, como os demais syncs. O Cloudflare
// Pages não tem Cron Triggers (só Workers), e sete syncs deste projeto já
// funcionam assim — inventar um oitavo padrão não traria ganho nenhum.
//
// Auth: header `x-sync-secret: <env.SYNC_SECRET>`.

import { executarVencidas } from '../_grupos-acoes.js';
import { FUSO_BRT } from '../_data-brt.js';

export async function onRequestPost(context) {
  const { request, env, fetchImpl = fetch } = context;
  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);

  const agora = Math.floor(Date.now() / 1000);

  let rodada;
  try {
    rodada = await executarVencidas(env, agora, fetchImpl);
  } catch (e) {
    console.error('grupo-acoes: rodada falhou', e?.message || e);
    return json({ ok: false, erro: String(e?.message || e) }, 200);
  }

  // Alerta é EXTRA: um Slack fora do ar não pode fazer a rodada parecer
  // quebrada, senão o cron vira fonte de alarme falso.
  let alerta = null;
  if (rodada.falhas > 0) {
    try {
      alerta = await avisarNoSlack(env, rodada, agora, fetchImpl);
    } catch (e) {
      alerta = { ok: false, erro: String(e?.message || e) };
    }
  }

  return json({ ok: rodada.falhas === 0, ...rodada, alerta });
}

async function avisarNoSlack(env, rodada, agora, fetchImpl) {
  if (!env.SLACK_WEBHOOK_META) return { ok: false, erro: 'sem_canal' };

  const quando = new Date(agora * 1000).toLocaleString('pt-BR', { timeZone: FUSO_BRT, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const falhas = rodada.executadas.filter((e) => e.status === 'falhou');
  const texto = [
    `:warning: *Ação de grupo não saiu* — ${quando}`,
    ...falhas.map((f) => `• ação #${f.id}: ${f.erro || 'motivo não registrado'}`),
    'Painel: https://tracking-ae.pages.dev/dash/#grupos',
  ].join('\n');

  try {
    const r = await fetchImpl(env.SLACK_WEBHOOK_META, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: texto }),
    });
    return r.ok ? { ok: true } : { ok: false, erro: `Slack HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, erro: `rede: ${e?.message || e}` };
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 4: Rodar a suíte inteira**

Run: `npm test`
Esperado: PASS — nenhum teste existente quebrado.

- [ ] **Step 5: Commit**

```bash
git add functions/api/sync/grupo-acoes.js tests/grupos-acoes.test.js
git commit -m "feat(grupos): sync das acoes vencidas com alerta no Slack"
```

---

### Task 7: Painel na aba Grupos

**Files:**
- Modify: `public/dash/index.html` (seção `#secao-grupos`, linha ~402; render `R.grupos`, linha ~1395)

**Interfaces:**
- Consumes: `GET/POST /api/grupos-acoes`
- Produces: nada consumido por outra tarefa

O dash é um arquivo só, em HTML/JS puro, sem framework e sem build. Segue o padrão da aba **Links**, que já faz exatamente isto (formulário, `datetime-local`, `paraUnixBRT`/`deUnixBRT`, POST com erro vindo do backend).

- [ ] **Step 1: Acrescentar o HTML dos três blocos**

Dentro de `<section class="secao" id="secao-grupos">`, logo depois de `<div id="grupos-aviso"></div>`:

```html
      <div class="card">
        <h2>Agenda do grupo <small>o que vai acontecer sozinho</small></h2>
        <div class="tabela-wrap" id="acoes-agenda"></div>
      </div>
      <div class="card">
        <h2>Agendar ação</h2>
        <form id="acoes-form" style="display:grid; gap:0.6rem; max-width:640px">
          <label>Grupo <select id="acoes-grupo" style="width:100%"></select></label>
          <label>O que fazer
            <select id="acoes-tipo" style="width:100%">
              <option value="mensagem">Mandar mensagem</option>
              <option value="renomear">Renomear o grupo</option>
            </select>
          </label>
          <label id="acoes-campo-texto">Mensagem
            <textarea id="acoes-texto" rows="4" style="width:100%" placeholder="Começou! Entra aqui: …"></textarea>
          </label>
          <label id="acoes-campo-titulo" hidden>Novo título
            <input type="text" id="acoes-titulo" style="width:100%" placeholder="24/09 às 12h | O jogo da escala">
          </label>
          <label id="acoes-campo-par" hidden style="display:flex; gap:0.4rem; align-items:center">
            <input type="checkbox" id="acoes-par" checked>
            <span>Renomear também o grupo par da Comunidade</span>
          </label>
          <label>Quando <input type="datetime-local" id="acoes-quando" style="width:100%"></label>
          <div id="acoes-erro" class="aviso falha" hidden></div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap">
            <button class="btn" type="submit">Agendar</button>
            <button class="btn sec" type="button" id="acoes-agora">Fazer agora</button>
          </div>
        </form>
      </div>
      <div class="card">
        <h2>Histórico <small>o que já foi executado</small></h2>
        <div class="tabela-wrap" id="acoes-historico"></div>
      </div>
```

- [ ] **Step 2: Acrescentar o JS**

No fim do render `R.grupos`, chamar `await desenharAcoes();`. E, junto das outras funções da aba (depois do bloco `// ---------- links ----------` é um bom lugar), acrescentar:

```js
// ---------- ações de grupo ----------
// Toda a validação é do backend: o formulário só mostra o erro que volta. É a
// mesma escolha da aba Links, e é o que impede a tela e o servidor de
// discordarem sobre o que é um agendamento válido.
const ACOES_TIPOS = { mensagem: 'Mensagem', renomear: 'Renomear' };

async function desenharAcoes() {
  const dados = await fetchJson('/api/grupos-acoes');

  const sel = $('#acoes-grupo');
  sel.innerHTML = (dados.grupos || [])
    .map((g) => `<option value="${esc(g.group_jid)}" data-par="${g.tem_par ? 1 : 0}">${esc(g.label)}</option>`).join('');

  const resumo = (a) => a.tipo === 'mensagem' ? (a.payload.texto || '') : (a.payload.titulo || '');

  const agendadas = dados.agendadas || [];
  if (agendadas.length) {
    tabela($('#acoes-agenda'), [
      { titulo: 'Quando', campo: 'agendada_para', render: (a) => `<span class="mini">${quandoBRT(a.agendada_para)}</span>` },
      { titulo: 'Grupo', campo: 'label', render: (a) => esc(a.label) },
      { titulo: 'Ação', campo: 'tipo', render: (a) => ACOES_TIPOS[a.tipo] || esc(a.tipo) },
      { titulo: 'Conteúdo', render: (a) => esc(resumo(a).slice(0, 80)) },
      { titulo: '', render: (a) => a.status === 'agendada'
          ? `<button class="btn sec" type="button" data-cancelar="${a.id}">cancelar</button>`
          : '<span class="mini">executando…</span>' },
    ], agendadas);
  } else {
    $('#acoes-agenda').innerHTML = '<p class="mini">Nada agendado. O grupo só muda se alguém mexer nele à mão.</p>';
  }

  // Listener no contêiner porque `tabela()` redesenha a tabela ao ordenar.
  // Cancelar não tem desfazer, então pede confirmação na própria linha —
  // `confirm()` do navegador travaria a página inteira.
  $('#acoes-agenda').onclick = (ev) => {
    const btn = ev.target.closest('[data-cancelar]');
    if (!btn) return;
    const acao = agendadas.find((a) => String(a.id) === btn.dataset.cancelar);
    pedirConfirmacao(btn, 'Cancelar esta ação?', async () => {
      const r = await fetch(`/api/grupos-acoes?key=${encodeURIComponent(key)}&acao=cancelar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(btn.dataset.cancelar) }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        $('#acoes-erro').textContent = j.error || 'Não foi possível cancelar.';
        $('#acoes-erro').hidden = false;
      } else {
        // "Editar" é cancelar e agendar de novo: o formulário volta preenchido
        // com o que estava marcado, para não redigitar a mensagem inteira.
        preencherAcao(acao);
      }
      await desenharAcoes();
    });
  };

  const hist = dados.historico || [];
  if (hist.length) {
    tabela($('#acoes-historico'), [
      { titulo: 'Quando', campo: 'executada_em', render: (a) => `<span class="mini">${quandoBRT(a.executada_em || a.agendada_para)}</span>` },
      { titulo: 'Grupo', campo: 'label', render: (a) => esc(a.label) },
      { titulo: 'Ação', campo: 'tipo', render: (a) => ACOES_TIPOS[a.tipo] || esc(a.tipo) },
      { titulo: 'Conteúdo', render: (a) => esc(resumo(a).slice(0, 60)) },
      // Falha em vermelho com o motivo: é aqui que se descobre que o aviso da
      // live não saiu, e um rótulo sem motivo não ajudaria a consertar nada.
      { titulo: 'Situação', campo: 'status', render: (a) => a.status === 'concluida'
          ? '<span style="color:var(--up)">Feita</span>'
          : a.status === 'cancelada'
            ? '<span class="mini">Cancelada</span>'
            : `<span style="color:var(--down)">Falhou</span> <span class="mini">${esc(a.erro || '')}</span>` },
    ], hist);
  } else {
    $('#acoes-historico').innerHTML = '<p class="mini">Nada executado ainda.</p>';
  }
}

// Devolve ao formulário uma ação que acabou de ser cancelada.
function preencherAcao(a) {
  if (!a) return;
  $('#acoes-grupo').value = a.group_jid;
  $('#acoes-tipo').value = a.tipo;
  $('#acoes-texto').value = a.payload?.texto || '';
  $('#acoes-titulo').value = a.payload?.titulo || '';
  $('#acoes-quando').value = deUnixBRT(a.agendada_para);
  acoesAtualizarCampos();
  if (a.payload?.aplicar_no_par) $('#acoes-par').checked = true;
}

// Campos conforme o tipo. O "renomear o par" só aparece quando o grupo
// escolhido tem par conhecido — oferecer o que o backend vai recusar seria
// prometer o que não dá.
function acoesAtualizarCampos() {
  const tipo = $('#acoes-tipo').value;
  const opt = $('#acoes-grupo').selectedOptions[0];
  $('#acoes-campo-texto').hidden = tipo !== 'mensagem';
  $('#acoes-campo-titulo').hidden = tipo !== 'renomear';
  $('#acoes-campo-par').hidden = tipo !== 'renomear' || opt?.dataset.par !== '1';
}

function acoesCorpo() {
  return {
    group_jid: $('#acoes-grupo').value,
    tipo: $('#acoes-tipo').value,
    texto: $('#acoes-texto').value,
    titulo: $('#acoes-titulo').value,
    aplicar_no_par: !$('#acoes-campo-par').hidden && $('#acoes-par').checked,
    agendada_para: paraUnixBRT($('#acoes-quando').value),
  };
}

async function acoesEnviar(qs) {
  const err = $('#acoes-erro');
  err.hidden = true;
  const r = await fetch(`/api/grupos-acoes?key=${encodeURIComponent(key)}${qs}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(acoesCorpo()),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.erro) {
    err.textContent = j.error || j.erro || 'Não foi possível concluir.';
    err.hidden = false;
    return;
  }
  $('#acoes-form').reset();
  acoesAtualizarCampos();
  await desenharAcoes();
}

$('#acoes-tipo').onchange = acoesAtualizarCampos;
$('#acoes-grupo').onchange = acoesAtualizarCampos;
$('#acoes-form').onsubmit = (ev) => { ev.preventDefault(); return acoesEnviar(''); };
// "Fazer agora" manda de verdade, no grupo de verdade: confirmação inline
// (o confirm() do navegador travaria a página e o painel já tem a sua).
$('#acoes-agora').onclick = (ev) => {
  const alvo = $('#acoes-grupo').selectedOptions[0]?.textContent || 'o grupo';
  pedirConfirmacao(ev.target, `Executar agora em "${alvo}"?`, () => acoesEnviar('&acao=agora'));
};
```

Helpers já existentes usados acima, **não recriar**: `$`, `esc`, `tabela(el, colunas, linhas)` com colunas `{ titulo, campo?, render }`, `quandoBRT(unix)`, `paraUnixBRT(valorDoInput)`, `deUnixBRT(unix)`, `pedirConfirmacao(btn, pergunta, aoConfirmar)`, `fetchJson(caminho)` (que já anexa a `key`).

- [ ] **Step 3: Verificar no navegador**

Run: `npm run build`
Esperado: build sem erro. Abrir `dist/dash/index.html` e conferir que a aba Grupos desenha os três blocos (sem backend responde vazio — é esperado).

- [ ] **Step 4: Commit**

```bash
git add public/dash/index.html
git commit -m "feat(dash): agenda de acoes de grupo na aba Grupos"
```

---

### Task 8: Pôr no ar

**Files:**
- Modify: `docs/grupos-whatsapp.md`
- Create (na VPS): `/root/scripts/grupo-acoes-sync/sync.sh`

**Interfaces:**
- Consumes: tudo das tarefas anteriores
- Produces: feature rodando em produção

Ordem importa: **migration antes do deploy**. O código novo lê a tabela nova; se o deploy chegar primeiro, a aba Grupos quebra para a usuária enquanto a migration não roda.

- [ ] **Step 1: Aplicar a migration no D1 remoto**

**Nunca** `migrations apply --remote` neste projeto.

```bash
npx wrangler d1 execute tracking-ae-db --remote --file=migrations/0043_grupos_acoes.sql
npx wrangler d1 execute tracking-ae-db --remote --command="SELECT name FROM sqlite_master WHERE name='whatsapp_group_actions';"
```
Esperado: a segunda consulta devolve a linha da tabela.

- [ ] **Step 2: Descobrir e conferir o par de cada grupo monitorado**

Os JIDs do grupo pai registrados na spec de julho podem ter mudado (a Comunidade da live não é permanente). Conferir contra a Evolution antes de gravar — `parent_jid` errado renomeia o grupo errado.

```bash
curl -s "{EVOLUTION_BASE_URL}/group/fetchAllGroups/{EVOLUTION_INSTANCE}?getParticipants=false" \
  -H "apikey: <EVOLUTION_APIKEY_NOTIF>" | jq '.[] | {id, subject, size}'
```

Os pares aparecem com o **mesmo `subject`**: o de muitos membros é o grupo de avisos (o que já está monitorado), o de poucos é o pai. Com os pares confirmados:

```bash
npx wrangler d1 execute tracking-ae-db --remote \
  --command="UPDATE whatsapp_groups_tracked SET parent_jid='<JID_DO_PAI>' WHERE group_jid='<JID_DOS_AVISOS>';"
```

Se um grupo não tiver par identificável, deixar `NULL` — a validação recusa `aplicar_no_par` e a caixinha some da tela. Nunca chutar.

- [ ] **Step 3: Merge para a main (dispara o deploy automático)**

```bash
npm test
git checkout main && git merge --no-ff feat/grupos-acoes && git push
```

O Pages é git-connected: o push já publica. **`Active` no painel do Cloudflare significa "ainda construindo"** — sucesso é o status virar tempo relativo; falha é `Failure`. Conferir cedo demais dá falso positivo de "no ar".

- [ ] **Step 4: Verificar em produção, antes de qualquer agendamento real**

```bash
curl -s "https://atacadoexponencial.com/api/grupos-acoes?key=<DASH_KEY>" | jq '{grupos, agendadas, historico}'
curl -s -X POST "https://atacadoexponencial.com/api/sync/grupo-acoes" -H "x-sync-secret: <SYNC_SECRET>" | jq
```
Esperado: o GET lista os grupos monitorados; o sync responde `{"ok":true,"total":0,"falhas":0}` com a fila vazia.

- [ ] **Step 5: Instalar o cron na VPS**

```bash
ssh root@31.97.241.169
mkdir -p /root/scripts/grupo-acoes-sync
cat > /root/scripts/grupo-acoes-sync/sync.sh <<'SH'
#!/bin/sh
# Executa as ações de grupo que já venceram. A cada 5 minutos: é a
# granularidade do agendamento (12:00 sai entre 12:00 e 12:05).
curl -fsS -m 60 -X POST https://atacadoexponencial.com/api/sync/grupo-acoes \
  -H "x-sync-secret: $SYNC_SECRET"
SH
chmod +x /root/scripts/grupo-acoes-sync/sync.sh
printf 'SYNC_SECRET=<valor>\n' > /root/scripts/grupo-acoes-sync/.env
chmod 600 /root/scripts/grupo-acoes-sync/.env
```

Ajustar `sync.sh` para carregar o `.env` no mesmo padrão dos outros scripts (`set -a && . ./.env && set +a`) — conferir `/root/scripts/meta-reenvio-sync/sync.sh` e **seguir o que estiver lá**, em vez de inventar um formato novo.

Linha no `crontab -e`:

```
*/5 * * * * /root/scripts/grupo-acoes-sync/sync.sh >> /var/log/tracking-grupo-acoes.log 2>&1
```

- [ ] **Step 6: Teste de fumaça com disparo real — em grupo de teste**

**Nunca no grupo da live.** Criar (ou usar) um grupo de teste, adicioná-lo à allowlist:

```bash
npx wrangler d1 execute tracking-ae-db --remote \
  --command="INSERT INTO whatsapp_groups_tracked (group_jid,label,enabled) VALUES ('<JID_TESTE>','Teste de ações',1);"
```

Então, pelo painel: **Fazer agora** com uma mensagem no grupo de teste (deve chegar), e depois **Agendar** uma mensagem para 6 minutos à frente e conferir no log (`tail -f /var/log/tracking-grupo-acoes.log`) que o cron a executou sozinha.

- [ ] **Step 7: Documentar e commitar**

Acrescentar a `docs/grupos-whatsapp.md` uma seção "Agenda de ações" com: as quatro regras de execução, a linha do cron, o que fazer quando uma ação falha, e o aviso de que `parent_jid` precisa ser reconferido sempre que a Comunidade for recriada.

```bash
git add docs/grupos-whatsapp.md
git commit -m "docs(grupos): agenda de acoes, cron e operacao" && git push
```

---

## Pendência para a usuária (não bloqueia a entrega)

`SLACK_WEBHOOK_META` ainda não foi cadastrado — está pendente desde 16/09. Sem ele, uma ação que falha só aparece em vermelho no painel, e só para quem abrir a aba. Cadastrar com:

```bash
printf '<url-do-webhook>' | npx wrangler pages secret put SLACK_WEBHOOK_META --project-name tracking-ae
```

`printf`, nunca `echo` e nunca colar no painel: BOM ou `\n` no fim do secret já quebrou a integração do Meta neste projeto por 47 dias.
