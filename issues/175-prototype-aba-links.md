# 175: Protótipo da aba "Links" no dashboard

**Tipo:** Protótipo
**Página:** /dash — aba Links

## Descrição

Criar a aba "Links" no dashboard com dados fictícios: bloco de topo mostrando o destino que está no ar (com o motivo e botão de copiar o link) e, abaixo, a tabela de destinos com rótulo, URL, janela, situação e cliques, mais o formulário de criar destino.

## Cenários

### Happy Path
Abrir `/dash#links` mostra a aba montada com dados fictícios: o destino no ar em destaque, a tabela de destinos e o formulário de criar. Nenhuma chamada de rede acontece ainda.

### Edge Cases
Estado vazio: quando não há destinos, a tabela mostra uma linha de "nenhum destino cadastrado" em vez de tabela vazia sem explicação.

### Cenário de Erro
Não se aplica ao protótipo — o tratamento de falha de carga já existe no `render()` do dash.

## Arquivos

- **Modificar:** `public/dash/index.html` — acrescentar o item "Links" ao `<nav id="nav">`, a `<section id="secao-links">`, a entrada em `TITULOS` e um `R.links` provisório com dados fictícios.

## Código reutilizável

- `tabela(el, colunas, linhas)` (linha 330) — mesma função usada por todas as outras abas.
- `esc()` (linha 268) — escape obrigatório em tudo que vier do banco.
- A seção `#secao-grupos` serve de modelo de marcação (cards + `tabela-wrap`).

## Checklist

- [ ] Acrescentar `<a href="#links" data-secao="links">Links</a>` ao nav
- [ ] Criar `<section class="secao" id="secao-links">` com o card do destino no ar, a tabela e o formulário
- [ ] Acrescentar `links: 'Links'` a `TITULOS`
- [ ] Criar `R.links` com dados fictícios, usando `tabela()` e `esc()`
- [ ] Cobrir o estado vazio
- [ ] Não tocar em nenhuma outra seção do dash
