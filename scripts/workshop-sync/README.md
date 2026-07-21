# Coletor de Presença nos Workshops (VPS)

Roda por cron na VPS (Hostinger 31.97.241.169). Busca participantes do Google
Meet + inscritos do Calendly, casa por nome e faz POST em
`/api/sync/workshops` (Cloudflare Pages), que grava no D1.

## Setup na VPS

O Python3 do sistema (3.10) já tem `googleapiclient`, `google-auth` e
`requests` instalados globalmente — **não** usamos venv (a VPS não tem
`python3-venv`/ensurepip). O `requirements.txt` fica só como referência.

    mkdir -p /root/scripts/workshop-sync
    # copiar match.py collect_meet.py collect_calendly.py sync.py
    cd /root/scripts/workshop-sync
    cp .env.example .env    # preencher CALENDLY_TOKEN e SYNC_SECRET

`.env` (fora do git):
- `CALENDLY_TOKEN` — mesmo valor do `.env` do repo.
- `SYNC_SECRET` — o mesmo secret dos outros syncs de tracking no Pages.
- `SYNC_ENDPOINT=https://atacadoexponencial.com/api/sync/workshops`
- `GOOGLE_KEY_PATH=/root/.hermes/vega-google-key.json`
- `GOOGLE_SUBJECT=marcelle@seteads.com`

## Cron (uma vez por dia, de manhã — pega o workshop da véspera com folga)

    30 8 * * * cd /root/scripts/workshop-sync && set -a && . ./.env && set +a && /usr/bin/python3 sync.py >> /var/log/tracking-workshops-sync.log 2>&1

## Rodar manualmente

    cd /root/scripts/workshop-sync && set -a && . ./.env && set +a && /usr/bin/python3 sync.py
