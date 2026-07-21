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
