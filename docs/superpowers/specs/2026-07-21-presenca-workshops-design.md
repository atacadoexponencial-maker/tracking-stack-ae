# Presença nos Workshops — Design

**Data:** 2026-07-21
**Status:** Aprovado (brainstorm) — aguardando revisão da spec antes do plano

## Objetivo

Medir presença e engajamento nos workshops quinzenais (Google Meet), cruzando
**inscritos** (Calendly) com **presentes** (Meet), e exibir isso numa aba nova do
dashboard. Métrica-chave: **taxa de presença** (compareceram ÷ inscritos) por
workshop, mais o tempo que cada pessoa ficou.

Objetivo secundário, semeado mas **não construído agora**: começar a acumular o
mapa `google_user_id → email`, que no futuro liga a presença ao CRM (quanto tempo
o lead levou pra fechar, de quais workshops participou).

## Contexto e descobertas (validadas na VPS, 2026-07-21)

- **Service account** `vega-agente@focal-pathway-478113-n5` com chave em
  `/root/.hermes/vega-google-key.json` na VPS, delegação para
  `marcelle@seteads.com`.
- A **Meet REST API v2** já funciona com o escopo
  `https://www.googleapis.com/auth/meetings.space.readonly` — **a delegação já
  autoriza o Meet, não é preciso mexer no Google Admin.**
- O que o Meet entrega por participante:
  - `signedinUser.user` = `users/<id>` — **ID numérico estável do Google**, o
    mesmo em todos os workshops (chave de identidade sem depender de email).
  - `signedinUser.displayName` — nome de exibição (texto livre).
  - `participantSessions` — entradas/saídas granulares (inclui reconexões) →
    somando dá o tempo real assistido.
  - `earliestStartTime` / `latestEndTime` — primeira entrada e última saída.
  - **Não há email em lugar nenhum** (confirmado; Directory API não resolve
    externos e nem tem o escopo).
- **Calendly:** `CALENDLY_TOKEN` já está no `.env` da raiz do repo. O uso atual
  de Calendly no código é só URL de redirect de agendamento — **ler inscritos via
  API é greenfield.** A API do Calendly entrega, por evento, os *invitees* com
  **nome e email**.
- **Um evento por workshop**, título sempre contém "Workshop". Não há event type
  fixo conhecido — a detecção é por título + janela de horário.
- **Stack:** dashboard é Cloudflare Pages + D1; syncs de fundo já rodam por
  **cron na VPS gravando no D1** (padrão do Windsor). Reutilizamos esse padrão.

## Arquitetura

```
Cron diário na VPS (Python)
   │  roda 1x/dia; detecta se houve workshop nas últimas ~24h
   ├─ Calendly API ─► inscritos do evento "Workshop" na janela (nome, email, registered_at)
   ├─ Meet API v2  ─► participantes do conferenceRecord na mesma janela de horário
   │                    (google_user_id, displayName, sessões join/leave, tempo total)
   ├─ CASA Meet ↔ Calendly  (nome normalizado, dentro da lista daquele evento)
   ├─ aprende google_user_id → email (mapa de identidade)
   └─ grava no D1 (upsert idempotente)
                    │
Dashboard (Pages Function) ─► lê do D1 ─► nova aba "Presença nos Workshops"
```

Roda na VPS porque a chave do Google vive lá e o padrão cron→D1 já existe.
O cron **detecta** o workshop (não hardcoda horário), então reagendamento/adiamento
não quebram, e reprocessar é seguro (idempotente).

### Componentes (unidades isoladas)

1. **Coletor Calendly** (VPS) — dado um intervalo de datas, devolve os inscritos
   (nome, email, registered_at) dos eventos cujo título contém "Workshop".
   Depende de: `CALENDLY_TOKEN`. Não sabe nada de Meet nem de D1.
2. **Coletor Meet** (VPS) — dado um intervalo, devolve os `conferenceRecords` e,
   por participante, `google_user_id`, `display_name`, `total_minutes`,
   `first_join`, `last_leave`. Depende de: chave da service account + delegação.
   Não sabe nada de Calendly nem de D1.
3. **Casador (matcher)** — puro, sem I/O. Recebe as duas listas de um evento e
   devolve: presentes (com registrant casado), faltaram, sem inscrição, e os
   pares aprendidos `google_user_id → email`. Testável isoladamente.
4. **Gravador D1** (VPS) — faz upsert idempotente das tabelas abaixo.
5. **API de leitura** (Pages Function) — endpoints que a aba consome a partir do D1.
6. **Aba do dashboard** (frontend) — só exibe; nenhuma lógica de negócio.

## Modelo de dados (novas tabelas no D1 do tracking)

```sql
-- um registro por workshop (sessão do Meet detectada)
workshops (
  id              TEXT PRIMARY KEY,   -- meet_record_name normalizado (estável)
  title           TEXT,               -- título do evento Calendly
  started_at      TEXT,               -- ISO; início do conferenceRecord
  ended_at        TEXT,
  calendly_event_uri TEXT,
  meet_record_name   TEXT,
  synced_at       TEXT
)

-- inscritos vindos do Calendly
workshop_registrants (
  workshop_id     TEXT,
  name            TEXT,
  email           TEXT,
  registered_at   TEXT,
  PRIMARY KEY (workshop_id, email)
)

-- participantes vindos do Meet (+ resultado do match)
workshop_participants (
  workshop_id     TEXT,
  google_user_id  TEXT,               -- "users/<id>", estável entre workshops
  display_name    TEXT,
  total_minutes   INTEGER,
  first_join      TEXT,
  last_leave      TEXT,
  registrant_email TEXT,              -- NULL = "Sem inscrição" (walk-in)
  PRIMARY KEY (workshop_id, google_user_id)
)

-- mapa de identidade acumulado (semeia a ponte futura com o CRM)
meet_identity_map (
  google_user_id  TEXT PRIMARY KEY,
  email           TEXT,
  display_name    TEXT,
  first_seen      TEXT,
  last_seen       TEXT
)
```

Métricas (nº inscritos, nº presentes, taxa de presença, tempo médio, faltaram,
sem inscrição) são **derivadas na leitura** — não são colunas materializadas.

- **Presentes** = participante com `registrant_email` preenchido.
- **Faltaram** = registrant sem participante correspondente.
- **Sem inscrição** = participante com `registrant_email` nulo.

## Lógica de casamento

- **Qual evento do Calendly é o workshop:** eventos na janela de ~24h cujo título
  contém "Workshop" (case-insensitive).
- **Qual `conferenceRecord` do Meet é o workshop:** o registro cujo `startTime`
  cai dentro de uma janela (± algumas horas) do horário do evento Calendly.
- **Casar pessoa ↔ pessoa:** normaliza o nome (minúsculas, remove acentos, ordena
  tokens) e casa dentro da lista daquele evento. Se o `google_user_id` já estiver
  no `meet_identity_map`, usa o email conhecido direto (dispensa o match por nome).
  Sem match confiável → fica "Sem inscrição" (participante) ou "Faltaram"
  (registrant), sem intervenção manual no MVP.

## Nomenclatura da UI

- **Presentes** — inscreveu e compareceu
- **Faltaram** — inscreveu e não veio *(antes: "no-show")*
- **Sem inscrição** — veio mas não estava inscrito *(antes: "walk-in")*

## A aba do dashboard

- **Lista de workshops** (mais recente primeiro): data, nº inscritos, nº
  presentes, **taxa de presença**, tempo médio.
- **Detalhe do workshop** (ao clicar): três grupos — **Presentes** (nome, tempo),
  **Faltaram**, **Sem inscrição**.
- **Recorrência por pessoa:** indicador leve tipo "apareceu em 3 dos últimos 5",
  usando `google_user_id` como chave estável.

## Cadência e tratamento de erros

- **Cron diário na VPS.** Idempotente: reprocessar o mesmo workshop faz upsert,
  não duplica.
- Se o `conferenceRecord` do Meet ainda não apareceu (lag da API), pula e tenta
  no dia seguinte.
- Falhas: registra no log da VPS. (Alertas por WhatsApp estão sendo desativados —
  Evolution saindo — então não dependemos disso.)

## Passos manuais de setup (usuária)

1. **`CALENDLY_TOKEN` na VPS:** hoje está no `.env` do repo; o sync roda na VPS, então
   o token precisa estar disponível no ambiente da VPS também.
2. **Nenhuma mudança no Google Admin** — a delegação já autoriza o Meet (validado).

## Fora de escopo (YAGNI / adiado)

- Ligar presença ao CRM / tempo até fechar (só *semeamos* o mapa de identidade agora).
- Confirmação humana de matches ambíguos (painel de reconciliação).
- Resolver identidade de participantes 100% anônimos (sem conta Google).
- Qualquer coisa com participantes por telefone.

## Perguntas em aberto (resolver no plano)

- Como a VPS grava no D1 hoje no sync do Windsor (HTTP API do D1 vs wrangler) —
  reutilizar exatamente o mesmo caminho.
- Nome/binding exato do D1 do tracking usado pelas Pages Functions.
- Endpoint/arquivo onde a aba nova se encaixa no dashboard atual.
