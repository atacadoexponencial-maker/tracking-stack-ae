# Coletor de Leads do Formulário Nativo do Meta (VPS)

Roda por cron na VPS (Hostinger 31.97.241.169). Lê a aba ativa da planilha
"Leads SE - Formulario Nativo" via Google Sheets API, seleciona só leads novos
(cursor local) e faz POST em `/api/sync/meta-leads` (Cloudflare Pages), que
reusa o pipeline do tracking (ClickUp + GHL + D1), **sem Meta CAPI**.

Substitui o papel do n8n que hoje lê a planilha e cria o card no ClickUp.

## Pré-requisito no Google Workspace

A chave `vega` (mesma do coletor de workshops) precisa do escopo **`drive`**
autorizado na delegação domain-wide — Admin Console → Segurança → Controles de
API → Delegação em todo o domínio, client ID `102486734109244662030`. Já estava
autorizado em 2026-07-24 (é o escopo que a usuária usa para ler planilhas).

## Setup na VPS

O Python3 do sistema (3.10) já tem `googleapiclient`, `google-auth` e `requests`
instalados globalmente — **não** usamos venv (mesma situação do workshop-sync).

    mkdir -p /root/scripts/meta-leads-sync
    # copiar sheets.py sync.py para lá
    cd /root/scripts/meta-leads-sync
    cp .env.example .env    # preencher SYNC_SECRET

`.env` (fora do git):
- `META_LEADS_SHEET_ID` — id da planilha.
- `META_LEADS_SHEET_TAB` — `SessaoEstrategica-Nova` (aba ativa).
- `META_LEADS_SYNC_ENDPOINT=https://atacadoexponencial.com/api/sync/meta-leads`
- `SYNC_SECRET` — o mesmo secret dos outros syncs.
- `GOOGLE_KEY_PATH=/root/.hermes/vega-google-key.json`
- `GOOGLE_SUBJECT=marcelle@seteads.com`

## Primeira execução (marco de corte)

A primeira run sem `.cursor` só registra o topo atual e **não envia** nada
retroativo. A partir dela, só leads com `created_time` maior são enviados.

    cd /root/scripts/meta-leads-sync && set -a && . ./.env && set +a && /usr/bin/python3 sync.py

## Cron (a cada 15 min)

    */15 * * * * cd /root/scripts/meta-leads-sync && set -a && . ./.env && set +a && /usr/bin/python3 sync.py >> /var/log/tracking-meta-leads-sync.log 2>&1

## Cutover

Só depois de validar (lead de teste chegando ao ClickUp com a tag
`formulario-meta` e aparecendo no /dash), **desligar o workflow do n8n** que lê
a planilha, para não processar em duplicidade. O dedup do `sendToClickUp`
(telefone/email) cobre a janela de sobreposição.
