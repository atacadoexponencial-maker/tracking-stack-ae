# S5-01: Protótipo da aba Árvore

**Tipo:** Protótipo
**Página:** Árvore
**Spec:** `spec-arvore-metricas.md`

## Descrição

Desenhar a aba Árvore com números de exemplo, para a usuária aprovar a ordem e o visual antes de ligar os dados: seletor de funil, topo (meta, vendas esperadas, consolidado do 🎯 CON, taxa RR → Compra e ticket com os meses de base), tronco com volume e taxa entre etapas, galho do anúncio, galho da página, "precisa · tem · faltam" em cada etapa com o gargalo destacado e a lista por campanha/anúncio ao clicar num galho.

## Pronto quando

A usuária abre a prévia (no computador e no celular), troca entre SE, AQUISIÇÃO e WO PAGO e vê a tela inteira com números de exemplo, incluindo os estados "sem meta", "sem vídeo", "funil sem mídia paga", "sem página", "sem dado" e o aviso de coorte jovem, e aprova o desenho.

## Critérios de aceite

Nenhum.

## Suposições

Nenhuma.

## Perguntas em aberto

Nenhuma.

## Cenários

### Happy Path
1. A usuária clica em "Árvore" no grupo Resultados do menu (logo depois de "Detalhado").
2. A aba mostra o selo "Protótipo" e um seletor de cenário, e abre no funil SE com números de exemplo.
3. De cima para baixo: **topo** (meta de vendas do período, vendas esperadas com o selo "estimativa", compras e arrecadado do 🎯 CON, taxa RR → Compra e ticket com "base: abr–set/2026"); **tronco** (uma faixa por etapa com volume, taxa da etapa anterior e "precisa · tem · faltam", com o gargalo destacado); **galho do anúncio** (investimento, impressões, CPM, hook, hold, CTR do link, CPC, CPL, custo por MQL); **galho da página** (connect rate, CTA, formulário, conversão).
4. Ela troca o seletor de funil para WO PAGO: o tronco passa a começar em "Comprou o workshop → Entrou no grupo"; em AQUISIÇÃO o galho do anúncio vira "funil sem mídia paga".
5. Ela clica no galho do anúncio ou da página: abre a lista por campanha e anúncio (com a linha "sem anúncio identificado"), com títulos que ordenam ao clicar; um botão volta à árvore.

### Edge Cases
- Cenário "sem meta": o topo mostra "sem meta" e o "precisa · tem · faltam" some do tronco.
- Cenário "coorte jovem": aparece o aviso de que parte dos leads ainda pode avançar.
- Cenário "sem vídeo": hook e hold mostram "sem vídeo".
- Cenário "sem página": o galho da página mostra "sem página".
- Cenário "sem dado": uma taxa aparece como "sem dado" e, dali para baixo, "sem base para calcular".
- Cenário "base curta": o topo avisa "base de 2 meses".
- Celular: as faixas e os galhos empilham numa coluna, a lista por anúncio rola dentro do próprio quadro (sem rolagem lateral da página).

### Cenário de Erro
Protótipo não chama o backend; não há erro de rede. O filtro de datas aparece (a aba vai usá-lo na S5-02), mas no protótipo não muda os números de exemplo, e o selo diz isso.

## Prova

Nenhum critério de aceite nesta issue (protótipo). A aprovação do desenho fica para o CA-S5-35 na S5-07; aqui a usuária só aprova a prévia para seguir.

## Banco de Dados

Nenhum.

## Arquivos

- **Criar:** `public/dash/arvore.js` — desenha a aba com números de exemplo fixos por funil e o seletor de cenário. Segue o padrão de `public/dash/cloudflare.js`: IIFE que expõe `window.ArvoreMetricas.abrir(raiz, ctx)` e recebe `esc`, `fmtInt`, `fmtPct`, `fmtBRL` do index. Na S5-02 em diante os números de exemplo saem e entra a chamada ao backend, que entrega tudo calculado (o JS só desenha).
- **Modificar:** `public/dash/index.html` — (1) link `<a href="#arvore" data-secao="arvore">Árvore</a>` no grupo Resultados, depois de "Detalhado"; (2) `<section class="secao" id="secao-arvore"></section>`; (3) `arvore: 'Árvore'` em `TITULOS` e `arvore: { periodo: true }` em `FILTROS`; (4) `R.arvore` chamando `ArvoreMetricas.abrir` com o mesmo tratamento de erro de `R.cloudflare`; (5) `<script src="/dash/arvore.js?v=2026-10-29a"></script>` junto dos outros; (6) regras CSS `.av-*` só para o que não existe: faixa do tronco com "precisa · tem · faltam", destaque do gargalo e a disposição dos dois galhos lado a lado (empilhados no celular).

Reaproveitados do dash, sem criar outros: `.em-proto`/`.em-proto__selo`/`.em-proto__cen` (selo e seletor de cenário), `.bloco`, `.grid-etiquetas`/`.etiqueta` (números do topo e dos galhos), `.carimbo` (estimativa, gargalo), `.semdado` ("sem dado", "sem meta"), `.tabela-wrap` + `table` (lista por anúncio), `.mini`. O desenho das faixas do tronco parte do funil vertical da Visão geral (`.vr-etapa`, `.vr-faixa` em `public/dash/visao-reuniao.js`), que ela já aprovou: nome à esquerda, número dentro da faixa, taxa entre as faixas.

## Dependências Externas

Nenhuma.

## Checklist

- [x] Criar `public/dash/arvore.js` com os números de exemplo de SE, AQUISIÇÃO e WO PAGO
- [x] Seletor de funil dentro da aba e seletor de cenário no selo de protótipo (normal, sem meta, coorte jovem, sem vídeo, sem página, sem dado, base curta)
- [x] Topo, tronco com "precisa · tem · faltam" e gargalo, galho do anúncio, galho da página
- [x] Lista por campanha/anúncio ao clicar num galho, ordenável, com "sem anúncio identificado" e botão de voltar
- [x] Ligar a aba no `index.html` (menu, seção, TITULOS, FILTROS, R.arvore, script, CSS `.av-*`)
- [x] Conferir no computador e em 375 px de largura, sem rolagem lateral
- [x] Publicar a prévia e pedir a aprovação da usuária no ar
