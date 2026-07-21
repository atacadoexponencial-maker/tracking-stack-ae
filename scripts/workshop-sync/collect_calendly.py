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
