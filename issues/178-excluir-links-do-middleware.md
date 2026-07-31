# 178: Manter /links fora do middleware de tracking

**Tipo:** Implementação
**Página:** Rota pública /links

## Descrição

Adicionar `/links` à lista de exclusão de `functions/_middleware.js`, para que o clique que sai direto para fora não crie sessão nem cookies de tracking e não infle o tráfego do site.

## Cenários

### Happy Path
Clique em `/links` → o middleware devolve `next()` de imediato, sem gerar `_krob_sid`, sem gravar sessão. O tráfego do site continua contando só visitas reais a páginas.

### Edge Cases
Nenhum outro caminho passa a ser excluído: a condição é acrescentada à lista que já existe, junto de `/tracker`, `/api/`, `/dash` etc.

### Cenário de Erro
Não se aplica.

## Arquivos

- **Modificar:** `functions/_middleware.js` — acrescentar `&& !url.pathname.startsWith('/links')` à condição `isPageRequest`.

## Checklist

- [x] Acrescentar `/links` à lista de exclusão de `isPageRequest`
- [x] Comentar por que (clique que sai do site não é visita ao site)
- [x] Não alterar nenhuma outra exclusão existente
