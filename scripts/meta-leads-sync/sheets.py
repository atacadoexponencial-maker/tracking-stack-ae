"""Leitura da planilha de leads do formulário nativo do Meta (Google Sheets API).

Usa a MESMA service account do coletor de workshops (chave vega, delegação
domain-wide impersonando o GOOGLE_SUBJECT). Pegadinha do escopo: a delegação
casa por string EXATA e só o escopo `drive` (completo) está autorizado — os
escopos `spreadsheets`/`spreadsheets.readonly`/`drive.readonly` retornam
`unauthorized_client`.
"""
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive"]


def build_service(key_path, subject):
    creds = service_account.Credentials.from_service_account_file(
        key_path, scopes=SCOPES).with_subject(subject)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def read_rows(svc, spreadsheet_id, tab):
    """Retorna as linhas da aba como lista de dicts (cabeçalho -> valor)."""
    res = svc.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range=f"'{tab}'!A:Z").execute()
    values = res.get("values", [])
    if not values:
        return []
    headers = values[0]
    rows = []
    for raw in values[1:]:
        rows.append({headers[i]: (raw[i] if i < len(raw) else "")
                     for i in range(len(headers))})
    return rows
