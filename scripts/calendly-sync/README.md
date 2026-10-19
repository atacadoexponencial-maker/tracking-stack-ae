# Coletor das consultorias do Calendly (VPS)

Spec: `spec-reunioes-calendly.md` (issue S2-01). Uma vez por dia, lê no Calendly as
"Consultoria Individual" e seus convidados e faz POST em `/api/sync/calendly`, que
grava em `calendly_consultorias` no D1. Só lê o Calendly; não escreve no CRM.

Node 22 da VPS (`/usr/local/bin/node`), sem dependência (fetch nativo).

## Setup na VPS

    mkdir -p /root/scripts/calendly-sync
    # copiar coletar.mjs e sync.mjs
    cd /root/scripts/calendly-sync

`.env` (fora do git, `chmod 600`):
- `CALENDLY_TOKEN` — mesmo valor do `.env` do repo e do workshop-sync.
- `SYNC_SECRET` — o mesmo secret dos outros syncs de tracking no Pages.
- `SYNC_ENDPOINT=https://atacadoexponencial.com/api/sync/calendly`

## Carga inicial (uma vez, desde 01/09/2026)

    cd /root/scripts/calendly-sync && set -a && . ./.env && set +a && DESDE=2026-09-01 /usr/local/bin/node sync.mjs

## Cron (todo dia às 05h de Brasília)

A VPS está no fuso de Brasília (America/Sao_Paulo).

    0 5 * * * cd /root/scripts/calendly-sync && set -a && . ./.env && set +a && /usr/local/bin/node sync.mjs >> /var/log/tracking-calendly-sync.log 2>&1

Para acrescentar sem perder o crontab atual (nunca `| crontab -`):

    crontab -l > /tmp/cron.atual && cp /tmp/cron.atual /root/crontab.bak.$(date +%F) \
      && echo '<linha acima>' >> /tmp/cron.atual && crontab /tmp/cron.atual

## Conferir

    tail -5 /var/log/tracking-calendly-sync.log

Cada rodada escreve uma linha: `ok 200 N consultorias lidas: {...}` ou `ERRO ...`.
