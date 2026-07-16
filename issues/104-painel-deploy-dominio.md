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
- [ ] **Pendente (manual, usuária)**: dashboard Cloudflare → Workers & Pages → painel-atacadoexponencial → Custom domains → adicionar `painel.atacadoexponencial.com` (o wrangler não gerencia domínios de Pages; a zona já está na conta, o CNAME é criado sozinho)
- [ ] **Pendente (manual, usuária)**: agendar o cron externo do sync (POST /api/sync/run com x-sync-secret, a cada 6h)
