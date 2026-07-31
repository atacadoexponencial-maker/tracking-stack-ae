# 181: API de leitura dos links

**Tipo:** Implementação
**Página:** /api/links

## Descrição

Criar o `GET /api/links?key=<DASH_KEY>` devolvendo os destinos não apagados com a contagem de cliques já agregada e qual deles está no ar no momento, com o motivo (janela ou padrão).

## Cenários

### Happy Path
O dash chama o endpoint e recebe: a lista de destinos (com rótulo, URL, janela, situação e cliques) e qual está no ar agora, com o motivo. A agregação de cliques é feita em SQL, não no navegador.

### Edge Cases
- **Nenhum destino cadastrado:** devolve lista vazia e `ativo: null` — não é erro.
- **Destino apagado:** fora da lista, mas seus cliques continuam somando no total geral.
- **Situação de cada linha** é calculada no backend (`agendado` / `no-ar` / `encerrado` / `padrao`), não no frontend.

### Cenário de Erro
Chave ausente ou errada → `401`. Falha do D1 → `500` com JSON de erro; o dash já mostra "Não foi possível carregar os dados agora".

## Banco de Dados

Lê `short_links` e `short_link_clicks` (issue 176).

## Arquivos

- **Criar:** `functions/api/links.js` — `onRequestGet`.

## Código reutilizável

- `functions/api/campaign-funnel.js` — copiar o padrão do guarda `?key=<DASH_KEY>` e do helper `json()`.
- A escolha do destino ativo é a MESMA regra da issue 177. Extrair para
  `functions/_links-destino.js` (prefixo `_` = não vira rota) e importar nos dois
  lugares, para regra de negócio não existir duplicada.

## Checklist

- [ ] Criar `functions/api/links.js` com `onRequestGet`
- [ ] Guardar com `?key=<DASH_KEY>`, devolvendo 401 quando inválida
- [ ] Extrair a escolha do destino para `functions/_links-destino.js` e usar nas duas rotas
- [ ] Agregar cliques por destino em SQL
- [ ] Devolver a situação de cada linha calculada no backend
- [ ] Devolver o destino no ar com o motivo (janela ou padrão)
