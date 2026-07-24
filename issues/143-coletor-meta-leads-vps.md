# 143: Coletor Python na VPS (`scripts/meta-leads-sync/`)

**Tipo:** Implementação
**Página:** scripts/meta-leads-sync/ (VPS)

## Descrição

Criar o coletor Python (irmão de `scripts/workshop-sync/`) que lê a aba `SessaoEstrategica-Nova` via Sheets API (chave `vega`, escopo `drive`, impersona `marcelle@seteads.com`), seleciona só leads novos pelo marco de corte (`created_time` > cursor), normaliza os campos (remove prefixos `p:`/`l:`, mapeia colunas, normaliza faturamento) e faz POST para `/api/sync/meta-leads` com `x-sync-secret`. Inclui `.env.example` e README de setup/cron. Referência: spec, "Componente 1 — Coletor" e "Colunas relevantes → destino".

## Cenários

### Happy Path
Cron roda `sync.py`: lê a planilha, filtra leads com `created_ts > cursor`, normaliza e faz POST. Servidor responde `{ created, skipped, failed }`; se `failed=0`, o cursor avança para o último lead enviado.

### Edge Cases
- **Primeira execução (sem `.cursor`)**: grava o topo atual e envia 0 — marco de corte "só daqui pra frente".
- `created_time` com offset `+0000` (Python 3.10 não parseia): `to_ts` normaliza `+0000`→`+00:00` e `Z`→`+00:00`.
- Telefone com prefixo `p:`: removido por `strip_phone`.
- Sem leads novos: sai limpo sem POST.

### Cenário de Erro
- POST não-2xx: cursor NÃO avança (retenta na próxima run).
- Servidor reporta `failed>0`: cursor NÃO avança; a idempotência do servidor evita duplicar os que já entraram.
- Escopo Google não autorizado: `unauthorized_client` (só `drive` funciona) — documentado no README.

## Arquivos
- **Criar:** `scripts/meta-leads-sync/sheets.py` — build_service + read_rows (Sheets API, escopo drive).
- **Criar:** `scripts/meta-leads-sync/sync.py` — orquestrador (cursor, normalização, POST).
- **Criar:** `scripts/meta-leads-sync/.env.example` — variáveis de ambiente.
- **Criar:** `scripts/meta-leads-sync/README.md` — setup/cron/cutover.
- **Criar:** `scripts/meta-leads-sync/requirements.txt` — referência de pacotes.

## Dependências Externas
- `google-api-python-client`, `google-auth`, `requests` — já no Python3 do sistema da VPS.

## Checklist
- [x] `sheets.py` (escopo `drive`, impersona subject)
- [x] `sync.py` com cursor/marco de corte e normalização dos campos
- [x] Mapeamento de colunas + atribuição (platform→utm_source, adset/campaign/ad)
- [x] `.env.example`, `README.md`, `requirements.txt`
- [x] Sintaxe validada (`py_compile`)
- [ ] [PAUSA/VPS] Copiar para `/root/scripts/meta-leads-sync/`, preencher `.env`, primeira execução (marco de corte)
