# 73: Depoimentos em vídeo na seção Resultados da /trafego-atacado

**Tipo:** Implementação
**Página:** /trafego-atacado

## Descrição

Substituir os 3 depoimentos de texto (Keren/Viviane/Viviane, herdados do contexto da mentoria — resolve a Pendência 2 da spec) por 4 depoimentos em vídeo hospedados no Panda Video (library `vz-b39a2077-49e`):

1. Jaque — `7696b234-035c-4010-9d72-9e19a2494008`
2. Barraca do Willinha — `e6d5912d-fbbb-4ccd-8da6-4521c6dc0ed9`
3. Adriana — `36daecc6-f934-419c-930a-edd74d56777f`
4. Jossanclê — `cf66200c-f78a-4d11-ae75-c634d96b3685`

Todos 16:9 (1280×720), verificados ativos no player `player-vz-b39a2077-49e.tv.pandavideo.com.br`. Cards SEM rodapé (sem estrelas/nome — decisão da usuária); o nome fica só no `title` do iframe (acessibilidade). Mesmo molde visual da seção Resultados (eyebrow, título, fundo claro); iframes com `loading="lazy"`.

## Cenários

### Happy Path
1. Visitante chega na seção Resultados e vê 4 cards de vídeo (2×2 no desktop, slider com snap no mobile).
2. Clica no play → o player do Panda toca o vídeo dentro do card (fullscreen disponível).

### Edge Cases
- Vídeos abaixo da dobra: `loading="lazy"` evita carregar os 4 players no load da página.
- Mobile: mesmos 85% de largura com scroll-snap horizontal do padrão da seção de depoimentos.

### Cenário de Erro
- Vídeo removido/indisponível no Panda: o player exibe o próprio erro dentro do card; o restante da página não é afetado.

## Arquivos
- **Criar:** `src/components/sections/VideoTestimonials.astro` — seção Resultados com grid de vídeos do Panda (props: title, sub, videos[{name, videoId}]).
- **Modificar:** `src/pages/trafego-atacado.astro` — troca `<Testimonials … testimonials={results}>` por `<VideoTestimonials>` com os 4 vídeos; remove o array `results`.

## Dependências Externas
- Panda Video (player embed) — nenhuma chave necessária; embed público.

## Checklist
- [x] Componente VideoTestimonials criado no molde da seção Resultados
- [x] Página usa os 4 vídeos (nomes só no title do iframe; cards sem rodapé)
- [x] Build ok + 4 iframes do Panda no HTML gerado + Testimonials de texto ausente da página
- [x] /se-v1 e demais páginas inalteradas (Testimonials.astro não é tocado; 3 cards de texto conferidos no build da se-v1)
- [x] Verificação visual (grid 2×2 desktop, players do Panda carregando com play/controles)
