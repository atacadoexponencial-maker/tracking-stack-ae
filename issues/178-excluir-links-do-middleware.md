# 178: Manter /links fora do middleware de tracking

**Tipo:** Implementação
**Página:** Rota pública /links

## Descrição

Adicionar `/links` à lista de exclusão de `functions/_middleware.js`, para que o clique que sai direto para fora não crie sessão nem cookies de tracking e não infle o tráfego do site.
