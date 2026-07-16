# 104: Deploy e domínio do painel

**Tipo:** Implementação
**Página:** —

## Descrição

Publicar o projeto Pages do painel em produção (D1 e cron ativos), apontar o subdomínio
`painel.atacadoexponencial.com` (mesma zona Cloudflare do site) e validar o fluxo
completo com o cliente piloto UP Semijoias.

## Resultado

- [x] Projeto Pages `painel-atacadoexponencial` em produção com D1 + secrets (WINDSOR_API_KEY, SYNC_SECRET, ADMIN_PASSWORD)
- [x] Fluxo completo validado com o piloto UP Semijoias: sync 5 fontes, backfill jan–jul, dashboard com dados reais, admin operante
- [x] Runbook em `painel/README.md`
- [x] Domínio `painel.atacadoexponencial.com` configurado pela usuária (health 200, db:true)
- [x] Cron do sync agendado no crontab da VPS (root@31.97.241.169): a cada 6h (minuto 15), POST /api/sync/run com x-sync-secret; log em /var/log/painel-sync.log; execução manual validada da própria VPS (5 fontes ok)
