# 117: dash validacao substituicao

**Tipo:** Implementação
**Página:** /dash (tracking)

## Descrição

Validar números novo × antigo no mesmo período, conferência visual de todas as seções no preview, e substituição definitiva de public/dash/index.html.

## Progresso

- [x] Preview git validado (commit ee1d138 → 788c225f.tracking-ae.pages.dev): home 200, dash novo servido, /api/ad-spend 401 sem chave, nenhum arquivo do repo exposto
- [x] Incidente corrigido: o deploy acidental de 16/07 havia sincronizado `pages_build_output_dir="."` na config do projeto tracking-ae (build passou a publicar a raiz do repo). Config restaurada para `dist` via deploy de preview + wrangler.toml local corrigido; build git subsequente confirmado saudável
- [x] `painel/wrangler.toml` versionado (o .gitignore da raiz ignorava todo wrangler.toml)
- [ ] Validação com dados reais pela usuária (abrir o preview com a DASH_KEY e comparar com o dash antigo em produção)
- [ ] Merge na main (substitui o /dash em produção)
