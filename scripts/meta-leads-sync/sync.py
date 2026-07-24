"""Coletor de leads do formulário nativo do Meta -> POST no endpoint de escrita.

Lê a aba ativa da planilha (Sheets API, chave vega), seleciona só leads NOVOS
(created_time > cursor guardado em .cursor), normaliza os campos e faz POST em
/api/sync/meta-leads. A idempotência real fica no servidor (event_id do Meta);
o cursor é só para não reprocessar o histórico a cada run.

Marco de corte ("só daqui pra frente"): a primeira execução, sem .cursor,
apenas registra o topo atual (maior created_time) e NÃO envia nada retroativo.
Rodar por cron na VPS (a cada 15 min).
"""
import os
import re
import sys
from datetime import datetime

import requests

from sheets import build_service, read_rows

CURSOR_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cursor")

# Cabeçalhos exatos da planilha "Leads SE - Formulario Nativo".
COL = {
    "id": "id",
    "created_time": "created_time",
    "nome": "nome_completo",
    "email": "email",
    "telefone": "telefone",
    "instagram": "qual_o_@instagram_da_sua_marca?_",
    "faturamento": "qual_o_faturamento_mensal_do_seu_negócio?",
    "justificativa": "qual_o_principal_desafio_do_seu_negócio_atualmente?",
    "objetivo": "e_qual_o_seu_maior_objetivo_para_2026?",
    "platform": "platform",
    "adset_name": "adset_name",
    "campaign_name": "campaign_name",
    "ad_name": "ad_name",
    "form_name": "form_name",
}

PLATFORM_UTM = {"ig": "instagram", "fb": "facebook"}


def to_ts(s):
    """created_time do Meta (ISO, ex '2026-07-23T15:55:00+0000') -> unix seconds.
    Python 3.10 não aceita offset sem ':', então normaliza antes."""
    s = (s or "").strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    m = re.search(r"([+-]\d{2})(\d{2})$", s)
    if m:
        s = s[:m.start()] + m.group(1) + ":" + m.group(2)
    try:
        return int(datetime.fromisoformat(s).timestamp())
    except ValueError:
        return None


def norm_faturamento(s):
    """'de_200_a_300_mil' -> 'De 200 A 300 Mil' (cosmético para o card)."""
    s = (s or "").strip()
    return s.replace("_", " ").title() if s else ""


def strip_phone(s):
    """'p:+5548996463298' -> '+5548996463298'."""
    s = (s or "").strip()
    return s[2:].strip() if s.startswith("p:") else s


def read_cursor():
    try:
        with open(CURSOR_FILE) as f:
            return int(f.read().strip())
    except (FileNotFoundError, ValueError):
        return None


def write_cursor(ts):
    with open(CURSOR_FILE, "w") as f:
        f.write(str(int(ts)))


def build_lead(ts, r):
    plat = (r.get(COL["platform"]) or "").strip().lower()
    return {
        "meta_id": (r.get(COL["id"]) or "").strip(),
        "created_ts": ts,
        "nome": (r.get(COL["nome"]) or "").strip(),
        "email": (r.get(COL["email"]) or "").strip(),
        "telefone": strip_phone(r.get(COL["telefone"], "")),
        "instagram": (r.get(COL["instagram"]) or "").strip(),
        "faturamento": norm_faturamento(r.get(COL["faturamento"], "")),
        "justificativa": (r.get(COL["justificativa"]) or "").strip(),
        "objetivo": (r.get(COL["objetivo"]) or "").strip(),
        "platform": plat,
        "utm_source": PLATFORM_UTM.get(plat, plat or "meta"),
        "utm_medium": (r.get(COL["adset_name"]) or "").strip(),
        "utm_campaign": (r.get(COL["campaign_name"]) or "").strip(),
        "utm_content": (r.get(COL["ad_name"]) or "").strip(),
        "form_name": (r.get(COL["form_name"]) or "").strip(),
    }


def main():
    sid = os.environ["META_LEADS_SHEET_ID"]
    tab = os.environ["META_LEADS_SHEET_TAB"]
    endpoint = os.environ["META_LEADS_SYNC_ENDPOINT"]
    secret = os.environ["SYNC_SECRET"]

    svc = build_service(os.environ["GOOGLE_KEY_PATH"], os.environ["GOOGLE_SUBJECT"])
    rows = read_rows(svc, sid, tab)
    if not rows:
        print("Planilha vazia. Nada a fazer.")
        return 0

    parsed, max_ts = [], 0
    for r in rows:
        ts = to_ts(r.get(COL["created_time"]))
        if ts is None:
            continue
        parsed.append((ts, r))
        max_ts = max(max_ts, ts)

    cursor = read_cursor()
    if cursor is None:
        write_cursor(max_ts)
        print(f"Cursor inicial gravado em {max_ts}; {len(parsed)} leads existentes "
              f"ignorados (marco de corte 'só daqui pra frente').")
        return 0

    novos = sorted([(ts, r) for ts, r in parsed if ts > cursor], key=lambda x: x[0])
    if not novos:
        print(f"Sem leads novos (cursor={cursor}).")
        return 0

    leads = [build_lead(ts, r) for ts, r in novos]
    resp = requests.post(
        endpoint,
        headers={"x-sync-secret": secret, "Content-Type": "application/json"},
        json={"leads": leads}, timeout=120)
    print(f"POST {resp.status_code}: {resp.text[:300]}")
    if not resp.ok:
        return 1

    # Só avança o cursor se o servidor não reportou falhas — leads que falharam
    # são retentados na próxima run (a idempotência do servidor evita duplicar
    # os que já entraram).
    data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    if data.get("failed", 0):
        print(f"{data['failed']} lead(s) falharam no servidor — cursor NÃO avançado.")
        return 1
    write_cursor(novos[-1][0])
    print(f"Cursor atualizado para {novos[-1][0]}. Enviados {len(leads)} lead(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
