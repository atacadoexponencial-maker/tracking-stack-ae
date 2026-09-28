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

## Desvio registrado

A quebra original previa `GET /api/argo/placar`. O protótipo aprovado (325)
fixou o placar **dentro** de `GET /api/argo/registro` (`registro.placar`),
com o período em `placar_dias` | `placar_de`+`placar_ate` na mesma query. O
contrato que a tela usa é o que vale: o placar entra na resposta do registro
e não há endpoint novo. A agregação continua num módulo puro próprio.

## Pesquisa (27/09)

- `argo/registro.js` já lê `config_conta.regua` (328/329) e já tem `SQL_REATIVACAO` (tipo efetivo); `_argo-db.js` dá `conectar`/`CONTA`; `_data-brt.js` dá `ymdBrt`.
- O Slack usa `argo_estado.placar_vereditos` (gestor-ae): `acertos/erros/inconclusivas` pela data da ação, origem `argo`, e `linha_placar` calcula `taxa = acertos ÷ (acertos + erros)` arredondada. A mesma fórmula fica documentada nos dois lados; nenhuma mudança no Python.
- `gasto` nas erradas: `vereditos.depois->>'gasto'` está em REAIS (o Python grava `round(gasto, 2)`); na realocação `depois` é `{origem, destino}` → usar `destino.gasto`. A aba espera **centavos**.
- A tela desenha `cartoes` na ordem recebida: primeiro `chave: 'argo'`, depois um por tipo, e `chave: 'manual'`; cartão de tipo sem avaliada mostra "—" — por isso os 7 tipos vão SEMPRE, com zeros.

## Contrato (o que a 325 já espera)

```json
"placar": {
  "periodo": { "de": "2026-08-28", "ate": "2026-09-27", "preset": 30 },
  "regua_alterada_em": "2026-09-23T14:10:00Z",
  "manuais_ligadas": true,
  "cartoes": [
    { "chave": "argo", "origem": "argo", "tipo": null, "avaliadas": 12, "acertos": 8, "erros": 2, "inconclusivas": 2, "taxa_pct": 80, "gasto_erradas_centavos": 41250 },
    { "chave": "pausar_campanha_trafego", "origem": "argo", "tipo": "pausar_campanha_trafego", "...": "..." },
    { "chave": "manual", "origem": "manual", "tipo": null, "...": "..." }
  ]
}
```

`preset` = 30 | 60 | 90 | "custom". `taxa_pct` = `Math.round(100 × acertos ÷ (acertos + erros))`, ou `null` sem conclusivas. `regua_alterada_em` só quando `config_conta.regua_atualizada_em` cai dentro do período (senão `null`).

## Período

- `placar_dias` ∈ {30, 60, 90} (padrão 30): `ate` = hoje BRT, `de` = hoje − (dias − 1).
- `placar_de` e `placar_ate` em `YYYY-MM-DD`, `de ≤ ate`, no máximo 366 dias; `preset: "custom"`. Inválido → cai no padrão de 30 dias (nunca 400: a lista de rodadas não pode sumir por causa do placar).
- Conta pela data da AÇÃO em Brasília: `(a.criada_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN de AND ate`.

## Arquivos

- **Criar:** `functions/api/_argo-placar.js` — módulo puro:
  - `TIPOS_PLACAR` (os 7 tipos, na ordem da aba) e `SITUACOES_CONCLUSIVAS`.
  - `resolverPeriodo({ placar_dias, placar_de, placar_ate }, hojeYmd)` → `{ de, ate, preset }` com as regras acima.
  - `montarPlacar({ linhas, periodo, reguaAlteradaEm, manuaisLigadas })` → o objeto do contrato. `linhas` = `[{ situacao, origem, tipo, gasto_reais }]`; `gasto_erradas_centavos` soma `Math.round(gasto × 100)` das linhas `errou`.
- **Modificar:** `functions/api/argo/registro.js`
  - Lê `regua_atualizada_em` junto com `regua`; `manuaisLigadas = montarRegua(regua).valores.avaliacao_manuais`.
  - `resolverPeriodo` a partir da query; um SELECT novo em `argo.vereditos JOIN argo.acoes` filtrado pelo período, devolvendo `situacao`, `origem`, tipo efetivo (`CASE WHEN ${SQL_REATIVACAO} THEN 'reativar_anuncio' ELSE a.tipo END`) e `COALESCE(v.depois->'destino'->>'gasto', v.depois->>'gasto')::numeric AS gasto_reais`.
  - Resposta: `{ ...montarRegistro(...), placar: montarPlacar(...) }`. Se só o SELECT do placar falhar, a resposta sai **sem** `placar` (a aba mostra "não foi possível ler o placar") e o registro continua.
- **Criar:** `tests/argo-placar.test.js` — período (preset, custom, inválidos, teto de 366 dias), cartões sempre presentes e na ordem, taxa `null` sem conclusivas, gasto das erradas em centavos, manual separado do argo, `regua_alterada_em` dentro/fora do período.

Nenhuma alteração em `public/dash/index.html` nem no `gestor-ae` (a fórmula do Slack já é a mesma).

## Dependências Externas

Nenhuma.

## Checklist

- [x] Agregação com testes (inclui "—" e gasto das erradas) — `_argo-placar.js`, `tests/argo-placar.test.js`; 851 verdes.
- [x] Cartões, período e clique-filtro na aba — entregues no protótipo 325; backend agora responde `registro.placar` com `placar_dias`/`placar_de`/`placar_ate`.
- [x] Aviso de régua alterada (`regua_atualizada_em` dentro do período).
- [x] Slack e aba usam a mesma fórmula (acertos ÷ (acertos + erros), pela data da ação); conferência com número real fica para a 1ª semana de vereditos.
