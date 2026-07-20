# 133: Cadastrar credenciais do GHL em produção

**Tipo:** Implementação
**Página:** —  (config/ops — Cloudflare Pages)

## Descrição

Cadastrar `TOKEN_GHL` e `LOCAL_ID` como secrets do Pages no projeto `tracking-ae` (produção) e forçar um novo deploy, já que secret nova só vale a partir do deployment seguinte. Validar com um lead de teste `marcelle@seteads.com` confirmando o contato e a tag no GHL.

## Cenários

### Happy Path
1. Ler `TOKEN_GHL` e `LOCAL_ID` do `.env` local (já preenchidos e testados nesta sessão).
2. `wrangler pages secret put TOKEN_GHL --project-name tracking-ae` e idem `LOCAL_ID`.
3. Fazer merge da branch na `main` (produção builda da main) → novo deployment.
4. Disparar lead de teste `marcelle@seteads.com` em `POST /tracker`.
5. Confirmar via API do GHL que o contato existe com a tag `funil-<...>`.

### Edge Cases
- Secret já existente → `wrangler` sobrescreve (ok).
- Deploy sem código novo (só secret) não bastaria; por isso o merge do código da issue 132 já dispara o deployment que carrega as secrets.

### Cenário de Erro
- Se o teste não mostrar o contato: tailar o deployment de produção e ler o `console.error` do `sendToGHL` (status/corpo do GHL) — mesmo método usado no diagnóstico do Evolution.

## Arquivos

- Nenhum arquivo de código. Tarefa de configuração + validação.
- **Não commitar** `.env` (já coberto por `.gitignore`).

## Checklist

- [ ] `wrangler pages secret put TOKEN_GHL --project-name tracking-ae`
- [ ] `wrangler pages secret put LOCAL_ID --project-name tracking-ae`
- [ ] Merge do código (issues 131+132) na `main` → deployment novo
- [ ] Lead de teste `marcelle@seteads.com` via `/tracker`
- [ ] Confirmar contato + tag no GHL
- [ ] Testar 2º funil e confirmar que a tag soma (não substitui)
