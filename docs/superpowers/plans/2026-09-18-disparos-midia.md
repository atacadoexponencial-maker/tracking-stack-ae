# Aba Disparos com mídia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba própria "Disparos" com composição e prévia, calendário da semana, e agendamento de texto, imagem, vídeo, áudio e documento.

**Architecture:** O arquivo sobe para o KV e ganha uma URL pública com chave aleatória; o executor manda essa URL à Evolution na hora do envio. `_midia.js` é a única porta para o armazenamento, como `_evolution-grupos.js` é para a Evolution.

**Tech Stack:** Cloudflare Pages Functions (JS, ESM), D1, KV (`MIDIA`, id `47c9d029a5a841f393293a607551f3bd`), `node --test` + `node:sqlite`, dash em HTML/JS puro.

**Spec:** `docs/superpowers/specs/2026-09-18-disparos-midia-design.md`

## Global Constraints

Valem todas as da Fase 1 (`2026-09-17-grupos-acoes.md`), e mais:

- **Nunca mandar mídia em base64** — bug aberto #1885 derruba a Evolution com vídeo. Sempre URL.
- **Sempre mandar `fileName` com extensão correta e NUNCA `mimetype` junto** — o service sobrescreve o mimetype pela extensão, e extensão desconhecida vira a string `"false"`, corrompendo o arquivo.
- **Aquecer o grupo** (`findGroupInfos`) antes de qualquer envio, contra o `404 Group not found` com cache frio.
- `delay` sempre 0 — ele bloqueia a requisição HTTP enquanto simula digitação.
- A rota pública do arquivo precisa ignorar query desconhecida (a Evolution acrescenta `?timestamp=` sozinha).
- Design: DESIGN.md manda. Fundo carvão, cards grafite, contorno cinza quente, cor só com motivo, profundidade por tom e nunca por sombra. **Sem paleta do WhatsApp na prévia.**

### Constantes

| Constante | Valor | Onde |
|---|---|---|
| `TETOS` | image 5 MB, video 16 MB, audio 16 MB, document 20 MB | `_midia.js` |
| `EXPURGO_DIAS` | 30 | `_grupos-acoes.js` |
| `TAMANHO_CHAVE` | 32 hex | `_midia.js` |

---

### Task 1: Armazenamento (binding, tabela, módulo)

**Files:**
- Modify: `wrangler.toml`
- Create: `migrations/0044_grupos_midia.sql`
- Create: `functions/api/_midia.js`
- Create: `tests/grupos-midia.test.js`

**Interfaces:**
- Produces:
  - `TETOS`, `TIPOS_ACEITOS`
  - `classificar(nome, mimetype) → { mediatype, extensao } | { erro }`
  - `validarTamanho(mediatype, bytes) → { erro } | {}`
  - `guardar(env, { bytes, nome, mimetype, mediatype }, agora) → { id, chave }`
  - `ficha(env, id) → linha | null`
  - `lerBytes(env, chave) → { bytes, mimetype, nome } | null`
  - `apagar(env, chave)`
  - `urlPublica(env, chave) → string`

`urlPublica` precisa de uma base absoluta porque quem baixa é a Evolution, não o navegador: usa `env.SITE_BASE_URL` com queda para `https://atacadoexponencial.com`.

- [ ] **Step 1: Binding do KV no wrangler.toml**

```toml
[[kv_namespaces]]
binding = "MIDIA"
id = "47c9d029a5a841f393293a607551f3bd"
```

- [ ] **Step 2: Migration**

```sql
-- migrations/0044_grupos_midia.sql
-- Ficha dos arquivos agendados. Os BYTES ficam no KV; aqui fica só o que
-- precisa ser consultado, filtrado e expurgado — o D1 limita 1 MB por valor,
-- e este projeto já estourou o limite de leitura dele duas vezes.

CREATE TABLE IF NOT EXISTS whatsapp_group_media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chave      TEXT NOT NULL UNIQUE,  -- 32 hex: é a URL pública e a chave no KV
  nome       TEXT NOT NULL,         -- nome original COM extensão (vira fileName)
  mimetype   TEXT NOT NULL,
  mediatype  TEXT NOT NULL,         -- image | video | audio | document
  tamanho    INTEGER NOT NULL,
  criada_em  INTEGER NOT NULL,
  apagada_em INTEGER
);

CREATE INDEX IF NOT EXISTS idx_group_media_expurgo
  ON whatsapp_group_media (apagada_em, criada_em);
```

- [ ] **Step 3: Testes do módulo** (KV dublado por um Map com `get/put/delete`)

Cobrir: classificação por extensão; extensão desconhecida recusada; mimetype que não bate com a extensão recusado; teto por tipo; `guardar` grava no KV e na ficha; `lerBytes` devolve o mimetype guardado; `apagar` some do KV; `urlPublica` monta URL absoluta.

- [ ] **Step 4: Implementar `_midia.js`**

- [ ] **Step 5: Rodar os testes e commitar**

---

### Task 2: Upload

**Files:**
- Create: `functions/api/grupos-midia.js`
- Modify: `tests/grupos-midia.test.js`

**Interfaces:**
- `POST /api/grupos-midia?key=` — `multipart/form-data`, campo `arquivo`
- Devolve `{ id, chave, nome, mediatype, tamanho, url }`

Validação inteira no backend. O formulário não confere nada.

- [ ] **Step 1: Testes** — 401 sem chave; 400 sem arquivo; 413 acima do teto com o tamanho e o teto na mensagem; 415 extensão desconhecida; 200 grava e devolve a ficha.
- [ ] **Step 2: Implementar**
- [ ] **Step 3: Rodar e commitar**

---

### Task 3: Rota pública do arquivo

**Files:**
- Create: `functions/m/[chave].js`
- Modify: `tests/grupos-midia.test.js`

É **pública de propósito**: quem baixa é o servidor da Evolution, que não tem como se autenticar. A proteção é a chave de 32 hex, impossível de adivinhar — e o arquivo vai para um grupo de centenas de pessoas de qualquer forma.

- [ ] **Step 1: Testes** — 200 com `Content-Type` guardado e `Content-Disposition` com o nome; 404 para chave inexistente; 404 para mídia expurgada; ignora `?timestamp=`.
- [ ] **Step 2: Implementar**
- [ ] **Step 3: Rodar e commitar**

---

### Task 4: Fronteira — aquecer e enviar mídia

**Files:**
- Modify: `functions/api/_evolution-grupos.js`
- Modify: `tests/evolution-grupos.test.js`

**Interfaces:**
- `aquecerGrupo(env, jid, fetchImpl?) → { ok }` — `GET /group/findGroupInfos/{inst}?groupJid=`; nunca lança, nunca importa o resultado
- `enviarMidia(env, jid, { mediatype, url, fileName, caption }, fetchImpl?)` — `POST /message/sendMedia/{inst}`
- `enviarAudio(env, jid, url, fetchImpl?)` — `POST /message/sendWhatsAppAudio/{inst}`

Corpo do `sendMedia`: `{ number, mediatype, media: url, fileName, caption?, delay: 0 }`.
**Sem `mimetype`** — mandá-lo junto de `fileName` é inútil (é sobrescrito) e mascara o bug da extensão.

- [ ] **Step 1: Testes** — rota e corpo exatos de cada um; `mimetype` ausente do corpo; `caption` omitido quando vazio; áudio não manda `caption`; erro vira `{ok:false, erro}` sem lançar.
- [ ] **Step 2: Implementar**
- [ ] **Step 3: Rodar e commitar**

---

### Task 5: Executor — tipos novos

**Files:**
- Modify: `functions/api/_grupos-acoes.js`
- Modify: `tests/grupos-acoes.test.js`

Mudanças:
- `TIPOS` ganha `imagem`, `video`, `audio`, `documento`
- `validarAcao` valida `midia_id` para os tipos de mídia; legenda opcional; `audio` usa `texto` (não `caption`)
- `criarAcao` confere que a ficha existe e **não** está expurgada, e que o `mediatype` da ficha bate com o tipo da ação
- `executarAcao` aquece o grupo, monta a URL e envia
- `audio` com texto: áudio primeiro; áudio que falha **não** manda o texto
- Mídia nunca retenta (mesma regra da mensagem); só `renomear` retenta

- [ ] **Step 1: Testes** — um por regra acima, mais: tipo da ação que não bate com o mediatype da ficha é recusado; aquecimento chamado antes do envio; aquecimento que falha não aborta.
- [ ] **Step 2: Implementar**
- [ ] **Step 3: Rodar e commitar**

---

### Task 6: Expurgo

**Files:**
- Modify: `functions/api/_grupos-acoes.js` (`expurgarMidiaAntiga`)
- Modify: `functions/api/sync/grupo-acoes.js`
- Modify: `tests/grupos-acoes.test.js`

Apaga do KV a mídia de ação encerrada há mais de 30 dias e marca `apagada_em`. O histórico fica; só o arquivo some. Roda na mesma passada do cron, depois das ações — expurgo que falha não pode fazer a rodada parecer quebrada.

- [ ] **Step 1: Testes** — apaga a antiga, não toca na recente, não toca em mídia de ação ainda agendada, e falha de expurgo não derruba a rodada.
- [ ] **Step 2: Implementar**
- [ ] **Step 3: Rodar e commitar**

---

### Task 7: Aba Disparos

**Files:**
- Modify: `public/dash/index.html`

1. Item `Disparos` no menu, grupo "Operação", antes de `Links`.
2. Seção `#secao-disparos` com os três cards: **Compor** (form + prévia), **Semana** (7 colunas), **Já foram**.
3. `R.disparos` novo; os blocos de ação **saem** de `#secao-grupos` e de `R.grupos`.
4. Prévia com `URL.createObjectURL` do arquivo escolhido, revogada ao trocar.
5. Calendário: semana corrente, setas de navegação, hoje marcado, clique em dia preenche a data, clique em disparo cancela.

Helpers já existentes, **não recriar**: `$`, `esc`, `tabela`, `quandoBRT`, `paraUnixBRT`, `deUnixBRT`, `pedirConfirmacao`, `fetchJson`.

- [ ] **Step 1: HTML da seção + item de menu**
- [ ] **Step 2: JS (`R.disparos`, prévia, upload, calendário)**
- [ ] **Step 3: Tirar os blocos da aba Grupos**
- [ ] **Step 4: `npm run build` e checagem de sintaxe do script**
- [ ] **Step 5: Commit**

---

### Task 8: Pôr no ar

- [ ] **Step 1: Migration no D1 remoto** — `wrangler d1 execute tracking-ae-db --remote --file=migrations/0044_grupos_midia.sql`, conferindo depois. **Nunca** `migrations apply --remote`.
- [ ] **Step 2: Conferir que o binding do KV subiu** com o deploy (o Pages lê o `wrangler.toml`).
- [ ] **Step 3: Merge na main e push**, esperando o deploy publicar de verdade (`Active` significa construindo).
- [ ] **Step 4: Verificar em produção** — upload de um arquivo pequeno, baixar pela URL pública, conferir `Content-Type`.
- [ ] **Step 5: Teste de fumaça** com disparo real de imagem em grupo de teste, **nunca** no da live.
- [ ] **Step 6: Documentar em `docs/grupos-whatsapp.md` e commitar.**
