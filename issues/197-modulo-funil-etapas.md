# 197: Módulo puro que monta os degraus do funil

**Tipo:** Implementação
**Página:** functions/api/_funil-etapas.js
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`

## Descrição

Criar `functions/api/_funil-etapas.js` transformando as linhas do banco nos degraus com o percentual de passagem sobre o degrau anterior, marcando a maior queda, e criar `tests/funil-etapas.test.js`.

## Por que assim

Módulo puro, sem DOM e sem I/O, testável com `node --test` — mesmo precedente de `_ab-estatistica.js`, `_canal.js` e `_cpl-calculo.js`. Precisa normalizar o funil que "sobe" (etapa perdida por falha de rede) para a tela nunca exibir um funil crescente, e não dividir por zero quando o degrau anterior for 0.

## Pesquisa da base de codigo

- **Precedentes de modulo puro em `functions/api/`:** `_cpl-calculo.js`
  (recebe dados ja lidos do D1 e devolve o recorte pronto -- "o endpoint so faz
  I/O e o dashboard so desenha"), `_ab-estatistica.js`, `_canal.js`,
  `_funil-campanha.js`. Seguir esse contrato: **nada de `env.DB` aqui dentro**.
- **Precedentes de teste:** `tests/cpl-calculo.test.js`, `tests/ab-estatistica.test.js`,
  `tests/lotes-workshop.test.js` -- todos `node --test` com `assert/strict`,
  importando o modulo direto.
- **`src/data/lotes-workshop.js`** e o modelo de modulo puro bem documentado
  (instante injetado, nunca lido de dentro) -- mesma disciplina aqui: a data de
  "agora" e o inicio da coleta entram por parametro.

## Contrato

```js
montarFunil({
  visitantes,        // numero: sessoes que chegaram na pagina
  cliques,           // numero: sessoes com CTAClick OU InitiateCheckout
  formStarts,        // numero: sessoes com FormStart
  etapas,            // [{ step: 1, sessoes: 140 }, ...] -- ordem irrelevante
  leads,             // numero: sessoes com Lead
  inicioColetaMs,    // epoch do 1o CTAClick/FormStep do site, ou null
  periodoInicioMs,   // epoch do inicio do periodo consultado
})
// devolve
{
  degraus: [{ chave, rotulo, sessoes, passagem, novo, maiorQueda }],
  avisoInicioColetaMs,   // null quando nao deve aparecer
}
```

`passagem` e a fracao sobre o degrau anterior (o primeiro degrau vem `null`).
`novo: true` marca os degraus que so existem a partir da coleta (`clique` e as
etapas) -- e o que leva o asterisco no dash.

## Cenarios

### Happy Path

1. O endpoint passa os numeros ja contados pelo SQL.
2. O modulo ordena as etapas por `step`, monta os degraus na ordem
   visita -> clique -> formStart -> etapas -> lead, calcula cada `passagem` sobre
   o degrau anterior e marca `maiorQueda` na menor delas.
3. `avisoInicioColetaMs` vem preenchido so quando `periodoInicioMs < inicioColetaMs`.

### Edge Cases

- **Funil que sobe** (etapa perdida por falha de rede: 140 na etapa 1, 95 na 2,
  mas 110 leads): normalizar da direita para a esquerda -- cada degrau vale no
  minimo o do degrau seguinte. A tela nunca exibe funil crescente.
- **Degrau anterior igual a 0:** `passagem` vira `null`, nunca `Infinity` nem
  `NaN`. Zero de zero nao e 0%, e ausencia de dado.
- **Sem etapas** (formulario de etapa unica): `etapas: []` e o funil sai sem
  nenhum degrau de etapa -- nao devolver lista vazia para o dash desenhar.
- **Etapas fora de ordem ou com buraco** (`step` 1 e 3, sem o 2): ordenar por
  `step` e usar o que existe; nao inventar o degrau ausente nem reindexar.
- **`inicioColetaMs` nulo** (nenhum evento novo gravado ainda): todos os degraus
  novos ficam em 0 e `avisoInicioColetaMs` vem `null` -- nao ha data para
  anunciar.
- **Numeros nao finitos** vindos do banco (`null` de um `COUNT` sem linhas):
  tratar como 0.

### Cenario de Erro

O modulo e puro: nao lanca por I/O. Entrada ausente ou malformada vira 0 ou
`null`, nunca excecao -- o dashboard prefere um funil incompleto a uma tela
quebrada. Mesma escolha do `loteVigente`, que devolve o primeiro lote em vez de
falhar.

## Arquivos

- **Criar:** `functions/api/_funil-etapas.js` -- `montarFunil()`, puro.
- **Criar:** `tests/funil-etapas.test.js` -- `node --test`.

## Checklist

- [x] `montarFunil()` sem `env`, sem `fetch`, sem `Date.now()` interno
- [x] Degraus na ordem visita -> clique -> formStart -> etapas (por `step`) -> lead
- [x] `passagem` sobre o degrau anterior; primeiro degrau `null`
- [x] Divisao por zero devolve `null`
- [x] Funil normalizado: nunca crescente
- [x] `maiorQueda` na menor passagem
- [x] `novo: true` nos degraus de clique e etapa
- [x] `avisoInicioColetaMs` so quando o periodo comeca antes da coleta
- [x] Sem etapas -> sem degraus de etapa
- [x] Etapas fora de ordem e com buraco tratadas
- [x] `tests/funil-etapas.test.js` cobrindo todos os itens acima
- [x] `npm test` passa
