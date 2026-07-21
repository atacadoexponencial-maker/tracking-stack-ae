# Presença nos Workshops — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova aba "Workshops" no dashboard que mostra, por workshop quinzenal, a taxa de presença cruzando inscritos (Calendly) com presentes (Google Meet), com tempo assistido por pessoa.

**Architecture:** Um coletor Python roda por cron na VPS (onde vive a chave da service account do Google), busca participantes do Meet + inscritos do Calendly, casa os dois por nome e faz `POST` do JSON pronto para um endpoint fino de escrita nas Pages Functions, que faz upsert no D1. O dashboard (HTML estático) lê de um endpoint de leitura. Toda a lógica de negócio (busca de APIs + casamento) fica na VPS/backend; o front só exibe.

**Tech Stack:** Python 3 + `google-api-python-client` + `google-auth` (VPS, já instalados), Calendly REST API v2, Cloudflare Pages Functions + D1 (binding `DB`), HTML/JS estático no dashboard.

## Global Constraints

- **D1 binding:** `DB` (database `tracking-ae-db`) — copiado de `wrangler.toml`.
- **Auth de escrita (sync):** header `x-sync-secret: <env.SYNC_SECRET>`; secret já existe no Pages (reusado do `/api/sync/meta-ads`). Requisição sem/errada → 401.
- **Auth de leitura (dash):** query `?key=<env.DASH_KEY>`; já existe. Errada → 401.
- **Nenhum secret novo no Cloudflare.** Reusa `SYNC_SECRET` e `DASH_KEY`.
- **Chave Google (VPS):** `/root/.hermes/vega-google-key.json`, delegação `marcelle@seteads.com`, escopo `https://www.googleapis.com/auth/meetings.space.readonly` (já autorizado — validado 2026-07-21).
- **Migrations:** próximo número é `0024`. Formato: `CREATE TABLE IF NOT EXISTS` + índices, igual `migrations/0023_email_campaign_stats.sql`.
- **Upsert D1:** idioma `INSERT ... ON CONFLICT(...) DO UPDATE`, `stmt.bind(...)`, `db.batch([...])` (padrão de `functions/api/sync/meta-ads.js`).
- **Nomenclatura da UI (verbatim):** grupos são **Presentes**, **Faltaram**, **Sem inscrição**. Nunca "no-show"/"walk-in" na interface.
- **Idempotência:** reprocessar o mesmo workshop faz upsert, nunca duplica. Chave estável do workshop = `meet_record_name` (ex.: `conferenceRecords/<id>`).
- **Sem dependências novas no `package.json`** (o endpoint JS não precisa de libs; roda no runtime das Pages Functions).

---

### Task 1: Migration do schema no D1

**Files:**
- Create: `migrations/0024_workshops.sql`

**Interfaces:**
- Produces: tabelas `workshops`, `workshop_registrants`, `workshop_participants`, `meet_identity_map` consumidas pelos endpoints das Tasks 6 e 7.

- [ ] **Step 1: Escrever a migration**

Create `migrations/0024_workshops.sql`:

```sql
-- Presença nos Workshops (feature: cruzamento Meet x Calendly no dashboard).
-- Alimentado por /api/sync/workshops (coletor Python na VPS via POST), lido por
-- /api/workshops. Mesmo padrão de ad_spend/email_campaign_stats: o dash lê daqui,
-- nunca toca Meet/Calendly no caminho da requisição.

-- Um registro por sessão de workshop detectada (conferenceRecord do Meet).
CREATE TABLE IF NOT EXISTS workshops (
    id                 TEXT PRIMARY KEY,   -- = meet_record_name (estável)
    title              TEXT,               -- título do evento Calendly casado
    started_at         TEXT,               -- ISO 8601 UTC, início do conferenceRecord
    ended_at           TEXT,               -- ISO 8601 UTC, fim
    calendly_event_uri TEXT,               -- URI do evento Calendly casado (nullable)
    meet_record_name   TEXT,               -- conferenceRecords/<id>
    synced_at          INTEGER NOT NULL     -- unix da última sincronização
);
CREATE INDEX IF NOT EXISTS idx_workshops_started_at ON workshops(started_at);

-- Inscritos vindos do Calendly (nome + email por evento).
CREATE TABLE IF NOT EXISTS workshop_registrants (
    workshop_id   TEXT NOT NULL,
    name          TEXT,
    email         TEXT NOT NULL,
    registered_at TEXT,                    -- ISO 8601 UTC (created_at do invitee)
    PRIMARY KEY (workshop_id, email)
);

-- Participantes vindos do Meet + resultado do casamento.
CREATE TABLE IF NOT EXISTS workshop_participants (
    workshop_id      TEXT NOT NULL,
    google_user_id   TEXT NOT NULL,        -- "users/<id>", estável entre workshops
    display_name     TEXT,
    total_minutes    INTEGER DEFAULT 0,    -- soma das participantSessions
    first_join       TEXT,                 -- ISO 8601 UTC
    last_leave       TEXT,                 -- ISO 8601 UTC
    registrant_email TEXT,                 -- NULL = "Sem inscrição"
    PRIMARY KEY (workshop_id, google_user_id)
);

-- Mapa de identidade acumulado (semeia a ponte futura com o CRM).
CREATE TABLE IF NOT EXISTS meet_identity_map (
    google_user_id TEXT PRIMARY KEY,
    email          TEXT,
    display_name   TEXT,
    first_seen     TEXT,
    last_seen      TEXT
);
```

- [ ] **Step 2: Aplicar no D1 local e verificar as tabelas**

Run:
```bash
npx wrangler d1 execute tracking-ae-db --local --file=migrations/0024_workshops.sql
npx wrangler d1 execute tracking-ae-db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'workshop%' OR name='meet_identity_map';"
```
Expected: lista contendo `workshops`, `workshop_registrants`, `workshop_participants`, `meet_identity_map`.

- [ ] **Step 3: Commit**

```bash
git add migrations/0024_workshops.sql
git commit -m "feat: migration 0024 — tabelas de presença nos workshops"
```

---

### Task 2: Matcher (função pura, TDD com pytest)

O casador é o único trecho com lógica não-trivial. É I/O-free e testado com pytest. Normaliza nomes, casa participantes do Meet com inscritos do Calendly, classifica em Presentes/Faltaram/Sem inscrição e devolve os pares aprendidos `google_user_id → email`.

**Files:**
- Create: `scripts/workshop-sync/match.py`
- Test: `scripts/workshop-sync/tests/test_match.py`
- Create: `scripts/workshop-sync/tests/__init__.py` (vazio)

**Interfaces:**
- Produces:
  - `normalize_name(name: str) -> str` — minúsculas, sem acento, tokens ordenados, espaços colapsados.
  - `match_workshop(participants: list[dict], registrants: list[dict], identity_map: dict[str, str]) -> dict`
    - `participants`: `[{"google_user_id","display_name","total_minutes","first_join","last_leave"}]`
    - `registrants`: `[{"name","email","registered_at"}]`
    - `identity_map`: `{google_user_id: email}` já conhecido (cache).
    - retorna `{"participants": [...], "learned": [{"google_user_id","email","display_name"}]}` onde cada participant ganha `registrant_email` (str ou None). `learned` só traz pares novos/atualizados.
- Consumed by: `scripts/workshop-sync/sync.py` (Task 5).

- [ ] **Step 1: Escrever os testes que falham**

Create `scripts/workshop-sync/tests/__init__.py` (arquivo vazio).

Create `scripts/workshop-sync/tests/test_match.py`:

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from match import normalize_name, match_workshop


def test_normalize_strips_accents_and_orders_tokens():
    assert normalize_name("Cláudio Alves") == normalize_name("alves claudio")
    assert normalize_name("  João   Silva ") == "joao silva"


def test_exact_name_match_marks_present():
    parts = [{"google_user_id": "users/1", "display_name": "Claudio Alves",
              "total_minutes": 50, "first_join": "t0", "last_leave": "t1"}]
    regs = [{"name": "Cláudio Alves", "email": "c@x.com", "registered_at": "r0"}]
    out = match_workshop(parts, regs, {})
    assert out["participants"][0]["registrant_email"] == "c@x.com"
    assert out["learned"] == [{"google_user_id": "users/1", "email": "c@x.com",
                               "display_name": "Claudio Alves"}]


def test_no_name_match_is_sem_inscricao():
    parts = [{"google_user_id": "users/9", "display_name": "Fulano Anonimo",
              "total_minutes": 10, "first_join": "t0", "last_leave": "t1"}]
    regs = [{"name": "Outra Pessoa", "email": "o@x.com", "registered_at": "r0"}]
    out = match_workshop(parts, regs, {})
    assert out["participants"][0]["registrant_email"] is None
    assert out["learned"] == []


def test_identity_map_wins_without_name_match():
    # mesmo com nome diferente, o google_user_id conhecido resolve o email
    parts = [{"google_user_id": "users/1", "display_name": "iPhone da Ana",
              "total_minutes": 30, "first_join": "t0", "last_leave": "t1"}]
    regs = [{"name": "Ana Souza", "email": "ana@x.com", "registered_at": "r0"}]
    out = match_workshop(parts, regs, {"users/1": "ana@x.com"})
    assert out["participants"][0]["registrant_email"] == "ana@x.com"
    # já era conhecido: não re-aprende
    assert out["learned"] == []


def test_learned_only_new_pairs():
    parts = [{"google_user_id": "users/2", "display_name": "Bia Lima",
              "total_minutes": 20, "first_join": "t0", "last_leave": "t1"}]
    regs = [{"name": "Bia Lima", "email": "bia@x.com", "registered_at": "r0"}]
    out = match_workshop(parts, regs, {"users/2": "bia@x.com"})
    assert out["learned"] == []
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `cd scripts/workshop-sync && python -m pytest tests/test_match.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'match'`.

- [ ] **Step 3: Implementar o matcher**

Create `scripts/workshop-sync/match.py`:

```python
"""Casamento puro (sem I/O) entre participantes do Meet e inscritos do Calendly."""
import unicodedata


def normalize_name(name):
    s = unicodedata.normalize("NFKD", (name or "").strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    tokens = [t for t in s.split() if t]
    return " ".join(sorted(tokens))


def match_workshop(participants, registrants, identity_map):
    by_norm = {}
    for r in registrants:
        by_norm.setdefault(normalize_name(r["name"]), r["email"])

    out_parts = []
    learned = []
    for p in participants:
        gid = p["google_user_id"]
        email = identity_map.get(gid)
        if not email:
            email = by_norm.get(normalize_name(p["display_name"]))
            if email:
                learned.append({
                    "google_user_id": gid,
                    "email": email,
                    "display_name": p["display_name"],
                })
        out_parts.append({**p, "registrant_email": email})

    return {"participants": out_parts, "learned": learned}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `cd scripts/workshop-sync && python -m pytest tests/test_match.py -v`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/workshop-sync/match.py scripts/workshop-sync/tests/
git commit -m "feat: matcher puro Meet x Calendly com testes"
```

---

### Task 3: Coletor do Calendly

Adapter de I/O: dado um intervalo de datas, devolve os inscritos dos eventos cujo título contém "Workshop".

**Files:**
- Create: `scripts/workshop-sync/collect_calendly.py`

**Interfaces:**
- Consumes: env `CALENDLY_TOKEN`.
- Produces: `fetch_workshop_events(token: str, since_iso: str, until_iso: str) -> list[dict]`
  retornando `[{"event_uri","title","start_time","registrants":[{"name","email","registered_at"}]}]`.
- Consumed by: `sync.py` (Task 5).

- [ ] **Step 1: Implementar o coletor**

Create `scripts/workshop-sync/collect_calendly.py`:

```python
"""Coletor do Calendly: eventos de workshop + seus inscritos (invitees)."""
import requests

BASE = "https://api.calendly.com"


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _current_org(token):
    r = requests.get(f"{BASE}/users/me", headers=_headers(token), timeout=30)
    r.raise_for_status()
    return r.json()["resource"]["current_organization"]


def fetch_workshop_events(token, since_iso, until_iso):
    org = _current_org(token)
    events = []
    url = f"{BASE}/scheduled_events"
    params = {
        "organization": org,
        "min_start_time": since_iso,
        "max_start_time": until_iso,
        "status": "active",
        "count": 100,
    }
    while True:
        r = requests.get(url, headers=_headers(token), params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        for ev in data.get("collection", []):
            if "workshop" not in (ev.get("name") or "").lower():
                continue
            events.append({
                "event_uri": ev["uri"],
                "title": ev.get("name"),
                "start_time": ev.get("start_time"),
                "registrants": _fetch_invitees(token, ev["uri"]),
            })
        page = data.get("pagination", {}).get("next_page")
        if not page:
            break
        url, params = page, None
    return events


def _fetch_invitees(token, event_uri):
    invitees = []
    url = f"{event_uri}/invitees"
    params = {"count": 100}
    while True:
        r = requests.get(url, headers=_headers(token), params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        for inv in data.get("collection", []):
            invitees.append({
                "name": inv.get("name"),
                "email": inv.get("email"),
                "registered_at": inv.get("created_at"),
            })
        page = data.get("pagination", {}).get("next_page")
        if not page:
            break
        url, params = page, None
    return invitees
```

- [ ] **Step 2: Smoke test contra a API real (janela ampla)**

Run (com `CALENDLY_TOKEN` no ambiente):
```bash
cd scripts/workshop-sync
python -c "import os,json;from collect_calendly import fetch_workshop_events as f;print(json.dumps(f(os.environ['CALENDLY_TOKEN'],'2026-07-01T00:00:00Z','2026-07-31T23:59:59Z'),indent=2,ensure_ascii=False)[:1500])"
```
Expected: JSON com ≥1 evento cujo título contém "Workshop" e uma lista `registrants` com name/email. Se vier `[]`, ampliar a janela ou confirmar que houve workshop no período.

- [ ] **Step 3: Commit**

```bash
git add scripts/workshop-sync/collect_calendly.py
git commit -m "feat: coletor de inscritos do Calendly (eventos de workshop)"
```

---

### Task 4: Coletor do Meet

Adapter de I/O: dado um intervalo, devolve os `conferenceRecords` e seus participantes com tempo somado.

**Files:**
- Create: `scripts/workshop-sync/collect_meet.py`

**Interfaces:**
- Consumes: chave da service account (path) + subject de delegação.
- Produces:
  - `build_service(key_path: str, subject: str)` — devolve o client do Meet v2.
  - `fetch_conference_records(svc, since_iso: str, until_iso: str) -> list[dict]`
    retornando `[{"meet_record_name","started_at","ended_at","participants":[{"google_user_id","display_name","total_minutes","first_join","last_leave"}]}]`.
- Consumed by: `sync.py` (Task 5).

- [ ] **Step 1: Implementar o coletor**

Create `scripts/workshop-sync/collect_meet.py`:

```python
"""Coletor do Google Meet (REST API v2): conferenceRecords + participantes."""
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/meetings.space.readonly"]


def build_service(key_path, subject):
    creds = service_account.Credentials.from_service_account_file(
        key_path, scopes=SCOPES).with_subject(subject)
    return build("meet", "v2", credentials=creds, cache_discovery=False)


def _minutes(sessions):
    total = 0.0
    for s in sessions:
        st, en = s.get("startTime"), s.get("endTime")
        if not st or not en:
            continue
        a = datetime.fromisoformat(st.replace("Z", "+00:00"))
        b = datetime.fromisoformat(en.replace("Z", "+00:00"))
        total += (b - a).total_seconds()
    return round(total / 60)


def fetch_conference_records(svc, since_iso, until_iso):
    flt = f'start_time>="{since_iso}" AND start_time<="{until_iso}"'
    out = []
    page = None
    while True:
        resp = svc.conferenceRecords().list(
            filter=flt, pageSize=50, pageToken=page).execute()
        for rec in resp.get("conferenceRecords", []):
            out.append({
                "meet_record_name": rec["name"],
                "started_at": rec.get("startTime"),
                "ended_at": rec.get("endTime"),
                "participants": _participants(svc, rec["name"]),
            })
        page = resp.get("nextPageToken")
        if not page:
            break
    return out


def _participants(svc, record_name):
    parts = []
    page = None
    while True:
        resp = svc.conferenceRecords().participants().list(
            parent=record_name, pageSize=100, pageToken=page).execute()
        for p in resp.get("participants", []):
            signed = p.get("signedinUser")
            if not signed:
                continue  # anônimo/telefone fora de escopo (spec)
            sessions = _all_sessions(svc, p["name"])
            parts.append({
                "google_user_id": signed["user"],
                "display_name": signed.get("displayName"),
                "total_minutes": _minutes(sessions),
                "first_join": p.get("earliestStartTime"),
                "last_leave": p.get("latestEndTime"),
            })
        page = resp.get("nextPageToken")
        if not page:
            break
    return parts


def _all_sessions(svc, participant_name):
    sessions, page = [], None
    while True:
        resp = svc.conferenceRecords().participants().participantSessions().list(
            parent=participant_name, pageSize=100, pageToken=page).execute()
        sessions.extend(resp.get("participantSessions", []))
        page = resp.get("nextPageToken")
        if not page:
            break
    return sessions
```

- [ ] **Step 2: Smoke test na VPS (onde a chave existe)**

Este passo roda **na VPS** (a chave está lá). Copiar o arquivo e rodar:
```bash
scp scripts/workshop-sync/collect_meet.py root@31.97.241.169:/root/collect_meet_probe.py
ssh root@31.97.241.169 'cd /root && python3 -c "import json;from collect_meet_probe import build_service,fetch_conference_records as f;svc=build_service(\"/root/.hermes/vega-google-key.json\",\"marcelle@seteads.com\");print(json.dumps(f(svc,\"2026-07-20T00:00:00Z\",\"2026-07-21T00:00:00Z\"),indent=2,ensure_ascii=False)[:1500])"; rm -f /root/collect_meet_probe.py'
```
Expected: JSON com ≥1 `conferenceRecord` do dia 20/07 e participantes com `google_user_id`, `display_name`, `total_minutes` > 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/workshop-sync/collect_meet.py
git commit -m "feat: coletor do Google Meet (participantes + tempo somado)"
```

---

### Task 5: Orquestrador do sync (VPS)

Cola tudo: busca Calendly + Meet na janela, casa cada evento com o conferenceRecord por proximidade de horário, aplica o matcher, monta o payload e faz `POST` no endpoint de escrita.

**Files:**
- Create: `scripts/workshop-sync/sync.py`
- Create: `scripts/workshop-sync/requirements.txt`
- Create: `scripts/workshop-sync/.env.example`

**Interfaces:**
- Consumes: `collect_calendly.fetch_workshop_events`, `collect_meet.build_service` / `fetch_conference_records`, `match.match_workshop`.
- Produces (payload POSTado, contrato consumido pela Task 6):
  ```json
  {
    "workshops": [{
      "id": "conferenceRecords/<id>",
      "title": "Workshop ...",
      "started_at": "ISO", "ended_at": "ISO",
      "calendly_event_uri": "https://.../<uri>",
      "meet_record_name": "conferenceRecords/<id>",
      "registrants": [{"name","email","registered_at"}],
      "participants": [{"google_user_id","display_name","total_minutes","first_join","last_leave","registrant_email"}]
    }],
    "learned": [{"google_user_id","email","display_name"}]
  }
  ```

- [ ] **Step 1: requirements + .env.example**

Create `scripts/workshop-sync/requirements.txt`:
```
google-api-python-client
google-auth
requests
```

Create `scripts/workshop-sync/.env.example`:
```
# Copiar para .env na VPS (fora do git). Valores reais NÃO vão no repo.
CALENDLY_TOKEN=
SYNC_SECRET=
SYNC_ENDPOINT=https://atacadoexponencial.com/api/sync/workshops
GOOGLE_KEY_PATH=/root/.hermes/vega-google-key.json
GOOGLE_SUBJECT=marcelle@seteads.com
```

- [ ] **Step 2: Implementar o orquestrador**

Create `scripts/workshop-sync/sync.py`:

```python
"""Orquestrador: Calendly + Meet -> match -> POST no endpoint de escrita.

Roda na VPS por cron. Janela padrão: últimas 30h (pega o workshop do dia
mesmo com folga de fuso/lag da API do Meet). Idempotente no lado do servidor.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

import requests

from collect_calendly import fetch_workshop_events
from collect_meet import build_service, fetch_conference_records
from match import match_workshop

WINDOW_HOURS = 30
MATCH_TOLERANCE_HOURS = 3


def _iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def _pick_record(event, records):
    """Escolhe o conferenceRecord mais próximo do horário do evento Calendly."""
    ev_start = _parse(event["start_time"])
    best, best_gap = None, None
    for rec in records:
        if not rec.get("started_at"):
            continue
        gap = abs((_parse(rec["started_at"]) - ev_start).total_seconds())
        if gap <= MATCH_TOLERANCE_HOURS * 3600 and (best_gap is None or gap < best_gap):
            best, best_gap = rec, gap
    return best


def main():
    token = os.environ["CALENDLY_TOKEN"]
    now = datetime.now(timezone.utc)
    since, until = now - timedelta(hours=WINDOW_HOURS), now
    since_iso, until_iso = _iso(since), _iso(until)

    events = fetch_workshop_events(token, since_iso, until_iso)
    if not events:
        print("Nenhum evento de workshop na janela. Nada a sincronizar.")
        return 0

    svc = build_service(os.environ["GOOGLE_KEY_PATH"], os.environ["GOOGLE_SUBJECT"])
    records = fetch_conference_records(svc, since_iso, until_iso)
    identity_map = {}  # cache futuro: o servidor devolve o mapa conhecido (v2)

    workshops, learned_all = [], []
    for ev in events:
        rec = _pick_record(ev, records)
        if not rec:
            print(f"Sem conferenceRecord casando com '{ev['title']}' — pulando (lag?).")
            continue
        matched = match_workshop(rec["participants"], ev["registrants"], identity_map)
        workshops.append({
            "id": rec["meet_record_name"],
            "title": ev["title"],
            "started_at": rec["started_at"],
            "ended_at": rec["ended_at"],
            "calendly_event_uri": ev["event_uri"],
            "meet_record_name": rec["meet_record_name"],
            "registrants": ev["registrants"],
            "participants": matched["participants"],
        })
        learned_all.extend(matched["learned"])

    if not workshops:
        print("Nenhum workshop casou com sessão do Meet. Nada enviado.")
        return 0

    payload = {"workshops": workshops, "learned": learned_all}
    resp = requests.post(
        os.environ["SYNC_ENDPOINT"],
        headers={"x-sync-secret": os.environ["SYNC_SECRET"],
                 "Content-Type": "application/json"},
        json=payload, timeout=120)
    print(f"POST {resp.status_code}: {resp.text[:300]}")
    return 0 if resp.ok else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Commit**

```bash
git add scripts/workshop-sync/sync.py scripts/workshop-sync/requirements.txt scripts/workshop-sync/.env.example
git commit -m "feat: orquestrador do sync de workshops (VPS)"
```

---

### Task 6: Endpoint de escrita `/api/sync/workshops`

Writer fino nas Pages Functions: valida `SYNC_SECRET`, faz upsert das 4 tabelas, registra em `sync_log`. Nenhuma chamada externa.

**Files:**
- Create: `functions/api/sync/workshops.js`

**Interfaces:**
- Consumes: payload da Task 5; env `SYNC_SECRET`; binding `DB`.
- Produces: rows nas tabelas da Task 1. Response `{ ok, workshops_upserted, participants_upserted, learned_upserted }`.

- [ ] **Step 1: Implementar o endpoint**

Create `functions/api/sync/workshops.js`:

```javascript
// POST /api/sync/workshops
//
// Recebe o payload já montado pelo coletor Python da VPS (Meet + Calendly já
// casados) e faz UPSERT idempotente nas tabelas de workshops. NÃO chama Meet
// nem Calendly — toda a busca acontece na VPS (onde vive a chave do Google).
//
// Auth: header `x-sync-secret: <env.SYNC_SECRET>` (mesmo secret dos outros syncs).
// Body: ver contrato em docs/superpowers/plans/2026-07-21-presenca-workshops.md
//
// Idempotente: reprocessar o mesmo workshop (mesmo meet_record_name) faz update.

export async function onRequestPost(context) {
  const { request, env } = context;

  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try { body = await request.json(); } catch (_) {
    return json({ error: 'invalid JSON' }, 400);
  }
  const workshops = Array.isArray(body.workshops) ? body.workshops : [];
  const learned = Array.isArray(body.learned) ? body.learned : [];

  const now = Math.floor(Date.now() / 1000);
  const nowIso = new Date(now * 1000).toISOString();
  const stmts = [];

  const upWorkshop = env.DB.prepare(
    `INSERT INTO workshops (id, title, started_at, ended_at, calendly_event_uri, meet_record_name, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, started_at=excluded.started_at, ended_at=excluded.ended_at,
       calendly_event_uri=excluded.calendly_event_uri, meet_record_name=excluded.meet_record_name,
       synced_at=excluded.synced_at`);

  const upReg = env.DB.prepare(
    `INSERT INTO workshop_registrants (workshop_id, name, email, registered_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(workshop_id, email) DO UPDATE SET
       name=excluded.name, registered_at=excluded.registered_at`);

  const upPart = env.DB.prepare(
    `INSERT INTO workshop_participants
       (workshop_id, google_user_id, display_name, total_minutes, first_join, last_leave, registrant_email)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(workshop_id, google_user_id) DO UPDATE SET
       display_name=excluded.display_name, total_minutes=excluded.total_minutes,
       first_join=excluded.first_join, last_leave=excluded.last_leave,
       registrant_email=excluded.registrant_email`);

  const upIdentity = env.DB.prepare(
    `INSERT INTO meet_identity_map (google_user_id, email, display_name, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(google_user_id) DO UPDATE SET
       email=excluded.email, display_name=excluded.display_name, last_seen=excluded.last_seen`);

  let pCount = 0;
  for (const w of workshops) {
    stmts.push(upWorkshop.bind(
      w.id, w.title || null, w.started_at || null, w.ended_at || null,
      w.calendly_event_uri || null, w.meet_record_name || w.id, now));
    for (const r of (w.registrants || [])) {
      if (!r.email) continue;
      stmts.push(upReg.bind(w.id, r.name || null, r.email, r.registered_at || null));
    }
    for (const p of (w.participants || [])) {
      stmts.push(upPart.bind(
        w.id, p.google_user_id, p.display_name || null, p.total_minutes || 0,
        p.first_join || null, p.last_leave || null, p.registrant_email || null));
      pCount++;
    }
  }
  for (const l of learned) {
    if (!l.google_user_id || !l.email) continue;
    stmts.push(upIdentity.bind(l.google_user_id, l.email, l.display_name || null, nowIso, nowIso));
  }

  if (stmts.length) await env.DB.batch(stmts);

  await env.DB.prepare(
    `INSERT INTO sync_log (platform, status, rows_upserted, date_from, date_to, error_message, duration_ms, run_at)
     VALUES ('workshops', 'ok', ?, NULL, NULL, NULL, 0, ?)`
  ).bind(pCount, nowIso).run();

  return json({
    ok: true,
    workshops_upserted: workshops.length,
    participants_upserted: pCount,
    learned_upserted: learned.length,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: Verificar o schema de `sync_log`**

Run: `cat migrations/0014_sync_log.sql`
Expected: confirmar que `sync_log` tem as colunas `platform, status, rows_upserted, date_from, date_to, error_message, duration_ms, run_at`. Se `run_at` for unix e não ISO, ajustar o `.bind` (usar `now` em vez de `nowIso`) — casar exatamente com o tipo usado por `meta-ads.js` no mesmo INSERT.

- [ ] **Step 3: Testar o writer com payload de exemplo (D1 local)**

Iniciar o dev server (`npx wrangler pages dev dist --local` após `npm run build`, ou o comando de dev do projeto) e:
```bash
curl -s -X POST http://localhost:8788/api/sync/workshops \
  -H "x-sync-secret: $SYNC_SECRET_LOCAL" -H "Content-Type: application/json" \
  -d '{"workshops":[{"id":"conferenceRecords/test1","title":"Workshop Teste","started_at":"2026-07-20T18:00:00Z","ended_at":"2026-07-20T19:30:00Z","calendly_event_uri":"https://x/ev1","meet_record_name":"conferenceRecords/test1","registrants":[{"name":"Ana Souza","email":"ana@x.com","registered_at":"2026-07-19T10:00:00Z"},{"name":"Zé Faltou","email":"ze@x.com","registered_at":"2026-07-19T11:00:00Z"}],"participants":[{"google_user_id":"users/1","display_name":"Ana Souza","total_minutes":80,"first_join":"2026-07-20T18:02:00Z","last_leave":"2026-07-20T19:22:00Z","registrant_email":"ana@x.com"},{"google_user_id":"users/2","display_name":"Convidado","total_minutes":15,"first_join":"2026-07-20T18:40:00Z","last_leave":"2026-07-20T18:55:00Z","registrant_email":null}]}],"learned":[{"google_user_id":"users/1","email":"ana@x.com","display_name":"Ana Souza"}]}'
```
Expected: `{"ok":true,"workshops_upserted":1,"participants_upserted":2,"learned_upserted":1}`.
Depois: `npx wrangler d1 execute tracking-ae-db --local --command="SELECT workshop_id, google_user_id, registrant_email FROM workshop_participants;"` → 2 linhas, `users/1` com `ana@x.com`, `users/2` com NULL.

- [ ] **Step 4: Rodar de novo o mesmo curl (idempotência)**

Expected: mesma resposta; a query `SELECT COUNT(*) FROM workshop_participants` continua 2 (upsert, não duplica).

- [ ] **Step 5: Commit**

```bash
git add functions/api/sync/workshops.js
git commit -m "feat: endpoint de escrita /api/sync/workshops (upsert idempotente)"
```

---

### Task 7: Endpoint de leitura `/api/workshops`

Lê do D1 e devolve a lista de workshops com métricas derivadas + o detalhe (presentes/faltaram/sem inscrição) e a recorrência por pessoa.

**Files:**
- Create: `functions/api/workshops.js`

**Interfaces:**
- Consumes: env `DASH_KEY`; binding `DB`.
- Produces: `GET /api/workshops?key=...` →
  ```json
  { "rows": [{
    "id","title","started_at",
    "registered","attended","attendance_rate","avg_minutes",
    "presentes":[{"name","email","minutes","recorrencia"}],
    "faltaram":[{"name","email"}],
    "sem_inscricao":[{"display_name","minutes"}]
  }], "last_synced_at": <unix|null> }
  ```
- Consumed by: dashboard (Task 8).

- [ ] **Step 1: Implementar o endpoint**

Create `functions/api/workshops.js`:

```javascript
// GET /api/workshops?key=...
//
// Presença nos workshops para a aba "Workshops" do dash. Lê SÓ do D1
// (workshops / workshop_registrants / workshop_participants), alimentado por
// /api/sync/workshops. Métricas (taxa de presença, tempo médio) são derivadas
// aqui. Grupos: Presentes (compareceu+inscrito), Faltaram (inscrito sem
// participante), Sem inscrição (participante sem inscrição).

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { results: ws } = await env.DB.prepare(
    `SELECT id, title, started_at FROM workshops ORDER BY started_at DESC LIMIT 60`
  ).all();

  const { results: regs } = await env.DB.prepare(
    `SELECT workshop_id, name, email FROM workshop_registrants`
  ).all();

  const { results: parts } = await env.DB.prepare(
    `SELECT workshop_id, google_user_id, display_name, total_minutes, registrant_email
     FROM workshop_participants`
  ).all();

  // recorrência: nº de workshops distintos em que cada google_user_id apareceu
  const recorrencia = {};
  for (const p of parts) {
    recorrencia[p.google_user_id] = (recorrencia[p.google_user_id] || 0) + 1;
  }

  const regsByW = groupBy(regs, 'workshop_id');
  const partsByW = groupBy(parts, 'workshop_id');

  const rows = (ws || []).map((w) => {
    const wRegs = regsByW[w.id] || [];
    const wParts = partsByW[w.id] || [];
    const matchedEmails = new Set(wParts.filter((p) => p.registrant_email).map((p) => p.registrant_email));

    const presentes = wParts
      .filter((p) => p.registrant_email)
      .map((p) => ({
        name: nameFor(p.registrant_email, wRegs) || p.display_name,
        email: p.registrant_email,
        minutes: p.total_minutes || 0,
        recorrencia: recorrencia[p.google_user_id] || 1,
      }));
    const faltaram = wRegs
      .filter((r) => !matchedEmails.has(r.email))
      .map((r) => ({ name: r.name, email: r.email }));
    const sem_inscricao = wParts
      .filter((p) => !p.registrant_email)
      .map((p) => ({ display_name: p.display_name, minutes: p.total_minutes || 0 }));

    const registered = wRegs.length;
    const attended = presentes.length;
    const allMinutes = wParts.map((p) => p.total_minutes || 0);
    const avg_minutes = allMinutes.length
      ? Math.round(allMinutes.reduce((a, b) => a + b, 0) / allMinutes.length) : 0;

    return {
      id: w.id, title: w.title, started_at: w.started_at,
      registered, attended,
      attendance_rate: registered ? (attended / registered) * 100 : null,
      avg_minutes,
      presentes, faltaram, sem_inscricao,
    };
  });

  const last = await env.DB.prepare(`SELECT MAX(synced_at) AS ultimo FROM workshops`).first();
  return json({ rows, last_synced_at: last?.ultimo || null });
}

function groupBy(arr, key) {
  const out = {};
  for (const item of arr) (out[item[key]] = out[item[key]] || []).push(item);
  return out;
}
function nameFor(email, regs) {
  const r = regs.find((x) => x.email === email);
  return r ? r.name : null;
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: Testar leitura (usa os dados da Task 6)**

Run:
```bash
curl -s "http://localhost:8788/api/workshops?key=$DASH_KEY_LOCAL" | head -c 800
```
Expected: JSON com 1 row; `registered=2`, `attended=1`, `attendance_rate=50`, `presentes` com Ana, `faltaram` com Zé, `sem_inscricao` com "Convidado".

- [ ] **Step 3: Verificar 401 sem key**

Run: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:8788/api/workshops"`
Expected: `401`.

- [ ] **Step 4: Commit**

```bash
git add functions/api/workshops.js
git commit -m "feat: endpoint de leitura /api/workshops (métricas de presença)"
```

---

### Task 8: Aba "Workshops" no dashboard

Adiciona link na nav, a seção, a entrada em `TITULOS` e o render `R.workshops` — espelhando o padrão de `R.email`.

**Files:**
- Modify: `public/dash/index.html`

**Interfaces:**
- Consumes: `GET /api/workshops` (Task 7), helpers existentes `fetchJson`, `tabela`, `esc`, `fmtInt`, `$`.

- [ ] **Step 1: Adicionar o link na nav**

Em `public/dash/index.html`, dentro de `<nav class="nav" id="nav">` (após a linha `<a href="#email" ...>Email</a>`, ~linha 124), inserir:
```html
      <a href="#workshops" data-secao="workshops">Workshops</a>
```

- [ ] **Step 2: Adicionar a seção**

Após o fechamento da `<section class="secao" id="secao-email">...</section>` (~linha 198), inserir:
```html
    <section class="secao" id="secao-workshops">
      <div class="card"><h2>Workshops <small id="workshops-sync-nota"></small></h2><div class="tabela-wrap" id="workshops-lista"></div></div>
      <div class="card" id="workshops-detalhe-card" hidden><h2 id="workshops-detalhe-titulo">Detalhe</h2>
        <div style="display:grid;gap:1rem">
          <div><h2 style="margin-top:0.2rem;font-size:0.95rem">Presentes</h2><div class="tabela-wrap" id="workshops-presentes"></div></div>
          <div><h2 style="margin-top:0.2rem;font-size:0.95rem">Faltaram</h2><div class="tabela-wrap" id="workshops-faltaram"></div></div>
          <div><h2 style="margin-top:0.2rem;font-size:0.95rem">Sem inscrição</h2><div class="tabela-wrap" id="workshops-sem-inscricao"></div></div>
        </div>
      </div>
    </section>
```

- [ ] **Step 3: Registrar o título**

Na definição `const TITULOS = { ... }` (~linha 690), adicionar `workshops: 'Workshops'`:
```javascript
const TITULOS = { visao: 'Visão geral', leads: 'Leads', vendas: 'Vendas', atribuicao: 'Atribuição', metaads: 'Meta Ads', email: 'Email', jornada: 'Jornada', eventos: 'Eventos', workshops: 'Workshops' };
```

- [ ] **Step 4: Implementar o render `R.workshops`**

Logo após o bloco `R.email = async () => { ... };` (termina ~linha 563), inserir:
```javascript
R.workshops = async () => {
  const dados = await fetchJson('/api/workshops');
  $('#workshops-sync-nota').textContent = dados.last_synced_at
    ? `última sincronização ${new Date(dados.last_synced_at * 1000).toLocaleString('pt-BR')}`
    : 'sincronização de workshops ainda não configurada';
  const dataBR = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const pct = (v) => v == null ? '—' : v.toFixed(0) + '%';

  const linhas = dados.rows || [];
  tabela($('#workshops-lista'), [
    { titulo: 'Workshop', campo: 'title', render: (r) => `${esc(r.title || '—')}<br><span class="mini">${dataBR(r.started_at)}</span>` },
    { titulo: 'Inscritos', num: true, campo: 'registered', render: (r) => fmtInt(r.registered) },
    { titulo: 'Presentes', num: true, campo: 'attended', render: (r) => fmtInt(r.attended) },
    { titulo: 'Taxa', num: true, campo: 'attendance_rate', render: (r) => pct(r.attendance_rate) },
    { titulo: 'Tempo médio', num: true, campo: 'avg_minutes', render: (r) => `${fmtInt(r.avg_minutes)} min` },
  ], linhas, (r) => mostraDetalheWorkshop(r));

  if (linhas.length) mostraDetalheWorkshop(linhas[0]);
};

function mostraDetalheWorkshop(r) {
  $('#workshops-detalhe-card').hidden = false;
  $('#workshops-detalhe-titulo').textContent = r.title || 'Detalhe';
  tabela($('#workshops-presentes'), [
    { titulo: 'Nome', campo: 'name', render: (p) => esc(p.name || '—') },
    { titulo: 'Tempo', num: true, campo: 'minutes', render: (p) => `${fmtInt(p.minutes)} min` },
    { titulo: 'Recorrência', num: true, campo: 'recorrencia', render: (p) => `${fmtInt(p.recorrencia)}×` },
  ], r.presentes || []);
  tabela($('#workshops-faltaram'), [
    { titulo: 'Nome', campo: 'name', render: (p) => esc(p.name || '—') },
    { titulo: 'Email', campo: 'email', render: (p) => `<span class="mini">${esc(p.email || '—')}</span>` },
  ], r.faltaram || []);
  tabela($('#workshops-sem-inscricao'), [
    { titulo: 'Nome no Meet', campo: 'display_name', render: (p) => esc(p.display_name || '—') },
    { titulo: 'Tempo', num: true, campo: 'minutes', render: (p) => `${fmtInt(p.minutes)} min` },
  ], r.sem_inscricao || []);
}
```

- [ ] **Step 5: Confirmar que `fmtInt` existe**

Run: `grep -n "fmtInt" public/dash/index.html | head -1`
Expected: uma definição `const fmtInt = ...` ou `function fmtInt`. Se **não** existir, usar `String(n)` no lugar de `fmtInt(n)` nos renders acima. (Verificação necessária porque o render depende desse helper.)

- [ ] **Step 6: Build + verificação visual**

Run: `npm run build`
Expected: build sem erro. Abrir `/dash/#workshops` com a `DASH_KEY`, confirmar: a lista aparece, clicar numa linha troca o detalhe (Presentes/Faltaram/Sem inscrição).

- [ ] **Step 7: Commit**

```bash
git add public/dash/index.html
git commit -m "feat: aba Workshops no dashboard (presença + detalhe)"
```

---

### Task 9: Deploy do coletor na VPS + cron + docs

Coloca o coletor rodando: instala deps na VPS, cria o `.env` (fora do git), agenda o cron e documenta.

**Files:**
- Create: `scripts/workshop-sync/README.md`

**Interfaces:**
- Consumes: `sync.py` e módulos das Tasks 2–5; endpoint da Task 6 já em produção (merge + deploy do Pages antes deste passo).

- [ ] **Step 1: Escrever o README de operação**

Create `scripts/workshop-sync/README.md`:
```markdown
# Coletor de Presença nos Workshops (VPS)

Roda por cron na VPS (Hostinger 31.97.241.169). Busca participantes do Google
Meet + inscritos do Calendly, casa por nome e faz POST em
`/api/sync/workshops` (Cloudflare Pages), que grava no D1.

## Setup na VPS

    mkdir -p /root/scripts/workshop-sync
    # copiar match.py collect_meet.py collect_calendly.py sync.py requirements.txt
    cd /root/scripts/workshop-sync
    python3 -m venv .venv && . .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env    # preencher CALENDLY_TOKEN e SYNC_SECRET

`.env` (fora do git):
- `CALENDLY_TOKEN` — mesmo valor do `.env` do repo.
- `SYNC_SECRET` — o mesmo secret dos outros syncs de tracking no Pages.
- `SYNC_ENDPOINT=https://atacadoexponencial.com/api/sync/workshops`
- `GOOGLE_KEY_PATH=/root/.hermes/vega-google-key.json`
- `GOOGLE_SUBJECT=marcelle@seteads.com`

## Cron (uma vez por dia, de manhã — pega o workshop da véspera com folga)

    30 8 * * * cd /root/scripts/workshop-sync && set -a && . ./.env && set +a && .venv/bin/python sync.py >> /var/log/tracking-workshops-sync.log 2>&1

## Rodar manualmente

    cd /root/scripts/workshop-sync && set -a && . ./.env && set +a && .venv/bin/python sync.py
```

- [ ] **Step 2: Deploy dos arquivos e instalação na VPS**

Run:
```bash
ssh root@31.97.241.169 'mkdir -p /root/scripts/workshop-sync'
scp scripts/workshop-sync/{match.py,collect_meet.py,collect_calendly.py,sync.py,requirements.txt,.env.example} root@31.97.241.169:/root/scripts/workshop-sync/
ssh root@31.97.241.169 'cd /root/scripts/workshop-sync && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt'
```
Expected: pip instala `google-api-python-client`, `google-auth`, `requests` sem erro.

- [ ] **Step 3: Criar o `.env` na VPS (manual — secrets)**

A usuária/operador preenche `/root/scripts/workshop-sync/.env` com os valores reais (`CALENDLY_TOKEN`, `SYNC_SECRET`). Confirmar:
```bash
ssh root@31.97.241.169 'cd /root/scripts/workshop-sync && test -f .env && grep -q CALENDLY_TOKEN=. .env && grep -q SYNC_SECRET=. .env && echo ".env OK"'
```
Expected: `.env OK`.

- [ ] **Step 4: Rodada manual end-to-end (produção)**

**Pré-requisito:** o branch já mergeado na `main` e o Pages já deployado (endpoints `/api/sync/workshops` e `/api/workshops` no ar).
Run:
```bash
ssh root@31.97.241.169 'cd /root/scripts/workshop-sync && set -a && . ./.env && set +a && .venv/bin/python sync.py'
```
Expected: `POST 200: {"ok":true,"workshops_upserted":...}`. Depois abrir `/dash/#workshops` em produção e conferir que o último workshop apareceu com taxa de presença plausível.

- [ ] **Step 5: Agendar o cron**

Run:
```bash
ssh root@31.97.241.169 '(crontab -l 2>/dev/null; echo "30 8 * * * cd /root/scripts/workshop-sync && set -a && . ./.env && set +a && .venv/bin/python sync.py >> /var/log/tracking-workshops-sync.log 2>&1") | crontab -'
ssh root@31.97.241.169 'crontab -l | grep workshop-sync'
```
Expected: a linha do cron aparece.

- [ ] **Step 6: Commit**

```bash
git add scripts/workshop-sync/README.md
git commit -m "docs: operação do coletor de workshops na VPS"
```

---

## Self-Review

**Spec coverage:**
- Coleta Meet (id estável, displayName, sessões, tempo) → Task 4. ✓
- Coleta Calendly (nome, email, registered_at) → Task 3. ✓
- Casamento por nome + cache de identidade → Task 2. ✓
- Detecção do evento por título "Workshop" + janela de horário → Tasks 3 e 5. ✓
- Casamento Meet↔Calendly por proximidade de horário → Task 5 (`_pick_record`). ✓
- Tabelas D1 (4) incluindo `meet_identity_map` → Task 1. ✓
- Cron na VPS gravando no D1 via endpoint fino → Tasks 5, 6, 9. ✓
- Aba no dash: lista + taxa + tempo médio + detalhe (Presentes/Faltaram/Sem inscrição) + recorrência → Tasks 7, 8. ✓
- Nomenclatura Presentes/Faltaram/Sem inscrição → Tasks 7, 8. ✓
- Setup: CALENDLY_TOKEN na VPS; Google sem mudança → Task 9 / Global Constraints. ✓
- Idempotência → Task 6 (ON CONFLICT) + Task 5. ✓
- Fora de escopo (ponte CRM, reconciliação manual, telefone/anônimo) → não há tasks. ✓

**Placeholder scan:** sem "TBD"/"TODO". As duas verificações condicionais (Task 6 Step 2 sobre tipo de `run_at`; Task 8 Step 5 sobre `fmtInt`) são checagens reais contra o código existente, com ação concreta definida — não placeholders.

**Type consistency:** contrato do payload idêntico entre Task 5 (produz) e Task 6 (consome): `id`, `title`, `started_at`, `ended_at`, `calendly_event_uri`, `meet_record_name`, `registrants[{name,email,registered_at}]`, `participants[{google_user_id,display_name,total_minutes,first_join,last_leave,registrant_email}]`, `learned[{google_user_id,email,display_name}]`. `match_workshop` retorna `{participants, learned}` (Task 2) e é chamado exatamente assim na Task 5. Chave estável do workshop = `meet_record_name` em todas as tasks.

## Notas de execução

- **Ordem:** Tasks 1→8 podem ser feitas e mergeadas antes da Task 9 (deploy VPS). A Task 9 Step 4 exige o Pages já em produção.
- **Sem infra de teste JS no repo:** endpoints JS são verificados por curl contra `wrangler pages dev` (não há framework de teste JS — decisão consciente, segue o padrão do repo). Só o matcher Python tem testes automatizados (pytest), por ser a lógica pura de maior valor.
