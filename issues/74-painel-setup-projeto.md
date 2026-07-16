# 74: Setup do projeto do painel

**Tipo:** Implementação
**Página:** —

## Descrição

Criar a fundação do painel na subpasta `painel/` deste repo: app Astro próprio com
adapter Cloudflare, banco D1 próprio (separado do tracking), estrutura de pastas por
comportamento, e segundo projeto Cloudflare Pages apontando para o mesmo repo com
root directory `painel/` e build watch paths — deploy inicial vazio funcionando sem
afetar o build do site.
