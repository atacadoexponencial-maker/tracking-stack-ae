# 101: Proteção do admin

**Tipo:** Implementação
**Página:** Admin (todas)

## Descrição

Proteger as rotas /admin com senha única da agência (variável de ambiente) e cookie de
sessão; toda API de escrita valida a sessão no backend.

## Resultado

- [x] Implementado: `painel/src/pages/admin.astro` + `painel/public/admin.js` + `painel/functions/api/admin/` (_auth, _middleware, login, clientes, metas, status)
- [x] Sessão por cookie HMAC (7d) derivado de ADMIN_PASSWORD (secret no projeto Pages); middleware protege todo /api/admin/* exceto login; validações no backend
- [x] Verificado em produção: 401 sem sessão/senha errada; login ok; CRUD clientes (UP Semijoias listada, link secreto exibido, ações editar/novo link/revogar); meta 2026-07 salva (R$ 80k/20k/1,2%); status mostra meta+ga4 em 🟡 (sem sync ainda — correto)
