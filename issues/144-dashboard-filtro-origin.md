# 144: Dashboard expõe/filtra por `origin`

**Tipo:** Implementação
**Página:** functions/api/leads.js + public/dash (frontend do dash)

## Descrição

`leads.js` passa a devolver `origin` em cada lead; o `/dash` mostra um badge "form Meta" na linha do lead quando `origin='meta_form'`, mantendo a contagem somada no funil `sessao-estrategica`. É a "tag própria" no lado do dashboard. Referência: spec, seções "Componente 3 — D1" e "Atribuição e origem".

## Cenários

### Happy Path
`/api/leads` inclui `e.origin` no SELECT e o devolve em cada lead. Na tabela "Leads recentes" do `/dash`, leads com `origin='meta_form'` ganham um badge azul "form Meta" ao lado do e-mail; leads do site ficam sem badge. A contagem total (KPI Leads / Leads por funil) não muda — os do Meta somam em `sessao-estrategica`.

### Edge Cases
- Lead antigo (sem `origin` no dado): a coluna vem `'site'` (DEFAULT da migration) → sem badge.
- A coluna "Origem" existente (utm_source) segue mostrando `instagram`/`facebook`/`meta` para os leads do Meta — complementa o badge.

### Cenário de Erro
Nenhum caminho novo de erro — é leitura/exibição. Se `origin` vier ausente, o `=== 'meta_form'` é falso e nada quebra.

## Arquivos
- **Modificar:** `functions/api/leads.js` — adicionar `e.origin` ao SELECT da lista de leads.
- **Modificar:** `public/dash/index.html` — badge "form Meta" na coluna Email da tabela de leads recentes quando `origin='meta_form'`.

## Checklist
- [x] `leads.js` devolve `origin` em cada lead
- [x] Badge "form Meta" na tabela de leads recentes do `/dash`
- [x] Contagem total permanece somada (sem mexer em `funnelCounts`/KPIs)

## Fora de escopo (opcional futuro)
- Seletor/dropdown dedicado para **filtrar** só os leads de origem `meta_form`. Com apenas 2 valores (site/meta_form) e o badge já distinguindo visualmente, um filtro dedicado tem baixo retorno; fica como refinamento se a usuária pedir (exigiria `&origin=` no `leads.js` + seletor no HTML, análogo ao filtro de funil).
