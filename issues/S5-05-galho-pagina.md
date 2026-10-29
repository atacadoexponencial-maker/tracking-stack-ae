# S5-05: Galho da página

**Tipo:** Implementação
**Página:** Árvore
**Spec:** `spec-arvore-metricas.md`

## Descrição

Mostrar na árvore as perdas entre o clique no anúncio e o lead, nas páginas do funil: connect rate, clique no CTA, formulário concluído ÷ iniciado e conversão da página.

## Pronto quando

A usuária abre a árvore de um funil e vê o galho da página com as taxas reais do período, ou "sem página" quando o funil não passa por página do site.

## Critérios de aceite

- **CA-S5-24** (automática) — Connect rate compara visitas do anúncio com cliques no link. Dado 500 cliques no link nas campanhas do funil e 350 visitas às páginas do funil vindas dessas campanhas, quando a árvore é montada, então connect rate = 70%.
- **CA-S5-25** (automática) — Clique no CTA, formulário e conversão vêm das micro-conversões. Dado 350 visitas, 140 cliques no CTA, 60 formulários iniciados, 40 concluídos e 40 leads, quando a árvore é montada, então CTA = 40%, formulário = 67%, conversão da página = 11,4%.
- **CA-S5-26** (automática) — Funil sem página própria mostra "sem página". Dado um funil cujas entradas não passam por página do site no período, quando a árvore é montada, então o galho da página mostra "sem página", sem erro.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S5-07 | As campanhas de cada funil são as que o dash já atribui ao funil (regra automática + classificação manual da aba Meta Ads; WO PAGO pelo trecho "workshop-pago") | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |
| SUP-S5-08 | As páginas de cada funil são as do mapeamento de páginas por funil que o dash já usa nas micro-conversões | confirmada | Confirmada na aprovação da spec (Marcelle, 29/10/2026) |

## Perguntas em aberto

Nenhuma.
