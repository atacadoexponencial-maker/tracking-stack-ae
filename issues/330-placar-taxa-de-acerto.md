# 330: Placar de taxa de acerto no topo do Registro

**Tipo:** Implementação
**Página:** Dash → aba Argo → vista Registro + `/api/argo/placar` — spec `spec-argo-veredito-acoes.md`, módulo 4 (decisão D3)

## Descrição

Cartões no topo da vista Registro com total avaliado, acertos, erros, inconclusivas e taxa de acerto, por tipo de ação e no geral, com as mudanças manuais em cartão separado. Clicar num cartão filtra a lista. O relatório do Slack passa a ler a mesma conta para a linha de placar.

## Pronto quando

Em produção, o topo do Registro mostra os cartões com os números do período escolhido (30, 60, 90 dias ou personalizado, pela data da ação), "—" onde não há ação avaliada, o gasto dos alvos nas ações *errou*, e o aviso "régua alterada em DD/MM" quando a régua mudou dentro do período. Clicar no cartão de um tipo filtra o Registro por aquele tipo. A linha de placar do Slack e o cartão geral batem número a número.

## Cenários

### Happy Path
1. `/api/argo/placar?from&to` agrupa vereditos por tipo e origem (`argo`/`manual`): avaliadas, acertos, erros, inconclusivas, taxa = acertos ÷ (acertos + erros), gasto dos alvos nas erradas (guardado no `depois` do veredito).
2. O período usa os presets do dash e conta pela `criada_em` da ação.
3. Aviso de régua: `regua_atualizada_em` dentro do período → "régua alterada em DD/MM".
4. Clique no cartão → filtro por tipo no Registro (issue 329).
5. `argo_veredito` usa a mesma regra de contagem para a linha do relatório (fonte única da fórmula documentada nos dois repos).

### Edge Cases
- Zero avaliadas conclusivas no período → taxa "—", nunca "0%".
- Só inconclusivas → cartão mostra total e "—" na taxa.
- Manual desligada na régua → cartão manual mostra "desligado".

### Cenário de Erro
- Endpoint falha → cartões mostram "não foi possível ler o placar" e o Registro continua funcionando.

## Arquivos

- **Criar:** `functions/api/_argo-placar.js` — agregação pura, testável.
- **Criar:** `functions/api/argo/placar.js` — endpoint autenticado como os demais de `argo/`.
- **Modificar:** `public/dash/index.html` — cartões, período e clique-filtro (marcação do protótipo 325).
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_veredito.py` — linha de placar do relatório com a mesma fórmula.
- **Criar:** `tests/argo-placar.test.js`.

## Checklist

- [ ] Agregação com testes (inclui "—" e gasto das erradas).
- [ ] Cartões, período e clique-filtro na aba.
- [ ] Aviso de régua alterada.
- [ ] Slack e aba batem no mesmo período.
