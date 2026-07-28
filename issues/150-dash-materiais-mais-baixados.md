# 150: Bloco "Materiais mais baixados" no dashboard

**Tipo:** Implementação
**Página:** `/dash` + `functions/api/leads.js`
**Spec:** `docs/superpowers/specs/2026-07-27-paginas-materiais-iscas-design.md`
**Depende de:** issue 148 (coluna `material`)

## Descrição

Mostrar no dashboard quantos leads cada material rico gerou no período
selecionado. Sem isso, o funil único `iscas-manychat` aparece como um número só e
não dá para comparar iscas.

## Cenários

### Happy Path
1. A usuária abre o `/dash` com o período de sempre.
2. Um card novo lista os materiais em ordem decrescente de leads, com o total de
   cada um.
3. Os filtros de data e de funil já existentes valem para o card.

### Edge Cases
- Nenhum lead de material no período → card exibe estado vazio, não some.
- Leads com `material` nulo ou vazio (todos os outros funis) → fora da contagem.
- Material que saiu do catálogo mas tem histórico → aparece pelo slug gravado.

## Arquivos

- **Modificar:** `functions/api/leads.js` — agregação nova por `e.material`,
  respeitando a janela, o filtro de funil e a exclusão de `is_junk`/bots já
  aplicados às demais consultas do endpoint; devolver em `materiais`.
- **Modificar:** `public/dash/index.html` — card "Materiais mais baixados" no
  mesmo padrão visual de "Leads por funil" (linha ~176) e a renderização
  correspondente.

## Restrições

- Não criar endpoint novo: a agregação vai no `/api/leads`, que o dash já
  consome, para não somar mais uma ida ao D1 por carregamento.
- Não alterar os demais cards nem a semântica do filtro de funil.

## Checklist

- [x] Agregação por `material` em `functions/api/leads.js`
- [x] `is_junk` e bots fora da contagem, como nos demais blocos
- [x] Card "Materiais mais baixados" renderizado no `/dash`
- [x] Estado vazio tratado
- [ ] Números batem com uma consulta manual ao D1
