#!/bin/sh
# Dispara o envio das conversões "EntrouGrupo" ao Meta (spec 2026-07-29).
#
# É só um POST: toda a lógica (elegibilidade, dedup, enriquecimento, retentativa)
# vive no endpoint, em /api/sync/grupo-conversoes. Aqui não há Python nem
# dependência nenhuma de propósito — o irmão meta-leads-sync precisa da Sheets
# API, este não precisa de nada.
#
# Reusa o .env do meta-leads-sync (mesmo SYNC_SECRET), em vez de duplicar o
# segredo em dois arquivos na VPS.
#
# Cron sugerido (a cada 15 min):
#   */15 * * * * /root/scripts/grupo-conversoes-sync/sync.sh >> /var/log/tracking-grupo-conversoes.log 2>&1

set -eu

ENV_FILE="${ENV_FILE:-/root/scripts/meta-leads-sync/.env}"
ENDPOINT="${ENDPOINT:-https://atacadoexponencial.com/api/sync/grupo-conversoes}"

if [ ! -f "$ENV_FILE" ]; then
  echo "$(date '+%F %T') ERRO: $ENV_FILE não encontrado"
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

if [ -z "${SYNC_SECRET:-}" ]; then
  echo "$(date '+%F %T') ERRO: SYNC_SECRET vazio"
  exit 1
fi

RESP=$(curl -sS -m 60 -X POST "$ENDPOINT" \
  -H "x-sync-secret: $SYNC_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{}')

# Silêncio quando não há nada a fazer manteria o log limpo, mas esconderia a
# fonte parada — que é justamente o risco desta feature. Sempre registra.
echo "$(date '+%F %T') $RESP"
