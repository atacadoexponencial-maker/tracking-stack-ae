# 177: Redirecionar /links para o destino válido

**Tipo:** Implementação
**Página:** Rota pública /links

## Descrição

Criar `functions/links.js` respondendo `GET /links` com `302` e `Cache-Control: no-store`, escolhendo o destino nesta ordem: janela agendada que contém o instante do clique (em empate, a que começou mais tarde), destino padrão, e por fim `/`.
