# 182: API de gravação dos links

**Tipo:** Implementação
**Página:** /api/links

## Descrição

Criar o `POST /api/links?key=<DASH_KEY>` para criar, editar e apagar destinos, validando no backend que a URL é `http`/`https`, que o fim não é anterior ao início, que as duas datas vêm juntas ou nenhuma, e que só existe um destino padrão por vez.

## Cenários

### Happy Path
A usuária salva um destino na telinha. O backend valida, grava em `short_links` e devolve `{ ok: true }`. O dash recarrega a aba e mostra a linha nova.

### Edge Cases
- **Novo destino padrão** (sem datas): o padrão anterior recebe `apagado_em`, para nunca existirem dois — a escolha no clique ficaria ambígua.
- **Editar** um destino existente: mesmo endpoint, com `id`.
- **Apagar:** grava `apagado_em`; a linha some da telinha mas os cliques permanecem no histórico.
- **Janelas sobrepostas** são aceitas (a issue 177 desempata), mas não é erro de validação.

### Cenário de Erro
Todas com `400` e mensagem em português:
- URL que não seja `http`/`https` → recusada. **Isto é segurança, não formalidade:** uma rota que redireciona para qualquer coisa que chegue vira vetor de phishing usando o domínio da marca como fachada, e `javascript:` seria XSS.
- `ends_at` anterior a `starts_at` → recusada.
- Só uma das duas datas → recusada.
- `label` vazio → recusado.
- Chave inválida → `401`.

## Banco de Dados

Escreve em `short_links` (issue 176).

## Arquivos

- **Modificar:** `functions/api/links.js` — acrescentar `onRequestPost` ao arquivo criado na issue 181.

## Código reutilizável

- `functions/api/campaign-funnel.js` — padrão do `onRequestPost`: guarda da chave, `request.json()` com try/catch, respostas via `json()`.

## Checklist

- [x] Acrescentar `onRequestPost` a `functions/api/links.js`
- [x] Guardar com `?key=<DASH_KEY>`
- [x] Recusar URL fora de `http`/`https`, com comentário explicando o risco
- [x] Recusar `ends_at` < `starts_at`, datas pela metade e `label` vazio
- [x] Criar, editar (por `id`) e apagar (marcando `apagado_em`)
- [x] Ao gravar um novo destino padrão, marcar o padrão anterior como apagado
- [x] Toda validação no backend — nenhuma regra de negócio no formulário
