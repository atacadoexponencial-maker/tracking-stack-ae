# 87: Acesso por link secreto

**Tipo:** Implementação
**Página:** Todas (dashboard do cliente)

## Descrição

Rota /c/[slug] que resolve o cliente pelo slug secreto e libera o dashboard só com os
dados dele; slug inválido ou revogado retorna 404. Backend valida em toda requisição de dados.
