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
