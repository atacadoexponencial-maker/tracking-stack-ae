# 87: Acesso por link secreto

**Tipo:** Implementação
**Página:** Todas (dashboard do cliente)

## Descrição

Rota /c/[slug] que resolve o cliente pelo slug secreto e libera o dashboard só com os
dados dele; slug inválido ou revogado retorna 404. Backend valida em toda requisição de dados.

## Arquivos

- **Criar:** `painel/public/_redirects` — rewrite `/c/* → /dash` (200)
- **Criar:** `painel/functions/api/_cliente.js` — resolver compartilhado slug→cliente ativo + helpers json/404
- **Criar:** `painel/functions/api/painel/cliente.js` — GET valida slug e retorna nome + fontes conectadas

## Checklist

- [x] Slug validado no backend em toda chamada (formato + existência + ativo=1)
- [x] Verificado em produção: slug válido 200 com fontes corretas; inválido 404; /c/* rewrite 200
