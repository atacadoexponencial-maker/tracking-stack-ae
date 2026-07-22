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
from team import TEAM_GOOGLE_USER_IDS

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
        # remove a equipe interna (por google_user_id) antes de casar/contar
        participants = [p for p in rec["participants"]
                        if p["google_user_id"] not in TEAM_GOOGLE_USER_IDS]
        matched = match_workshop(participants, ev["registrants"], identity_map)
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
