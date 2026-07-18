# Backup dos bancos D1

Desde 2026-07-18: a VPS (root@31.97.241.169) exporta `tracking-ae-db` e
`painel-clientes-db` a cada 6h (cron `45 */6 * * *`, script `/opt/backups/d1/backup.sh`).

- **Destinos**: `/opt/backups/d1/*.sql.gz` (VPS) + Google Drive da agência (`gdrive:Backups-D1`)
- **Rotação**: 30 dias na VPS; exports do dia 01 de cada mês são preservados (histórico mensal); Drive acumula
- **Credenciais**: token Cloudflare D1-only em `/root/.cf-backup-token`; Drive via rclone (remote `gdrive`)
- **Log**: `/var/log/d1-backup.log`
- **Restauração testada** (18/07): `gunzip -kc arquivo.sql.gz | sqlite3 novo.db` — contagens idênticas à produção
- Para voltar dados ao D1: `npx wrangler d1 execute <db> --remote --file arquivo.sql` (em banco limpo) ou D1 Time Travel (até 30 dias)

⚠️ Manutenção futura: o rclone avisa que o client_id compartilhado do Google será
aposentado ao longo de 2026 — quando a cópia ao Drive começar a falhar, criar um
client_id próprio (https://rclone.org/drive/#making-your-own-client-id) e
reconfigurar o remote.
