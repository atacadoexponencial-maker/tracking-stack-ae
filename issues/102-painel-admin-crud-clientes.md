# 102: Admin — cadastro de clientes

**Tipo:** Implementação
**Página:** Admin — Clientes

## Descrição

CRUD de clientes (nome, IDs das contas) + geração/revogação do slug secreto, ligado ao
protótipo. Cadastrar o piloto UP Semijoias (Meta Ads `628094463950329`, GA4 `315016683`,
sem Google Ads).

## Resultado

- [x] Implementado: `painel/src/pages/admin.astro` + `painel/public/admin.js` + `painel/functions/api/admin/` (_auth, _middleware, login, clientes, metas, status)
- [x] Sessão por cookie HMAC (7d) derivado de ADMIN_PASSWORD (secret no projeto Pages); middleware protege todo /api/admin/* exceto login; validações no backend
- [x] Verificado em produção: 401 sem sessão/senha errada; login ok; CRUD clientes (UP Semijoias listada, link secreto exibido, ações editar/novo link/revogar); meta 2026-07 salva (R$ 80k/20k/1,2%); status mostra meta+ga4 em 🟡 (sem sync ainda — correto)
