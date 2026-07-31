# 179: Registrar cada clique no /links

**Tipo:** Implementação
**Página:** Rota pública /links

## Descrição

Gravar em `short_link_clicks` um registro por acesso (destino que serviu, data/hora, dia local em -03:00, UTMs, user-agent e IP), sem nunca atrasar nem quebrar o redirect em caso de falha.
