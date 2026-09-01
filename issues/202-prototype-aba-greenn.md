# 202: Protótipo: aba Greenn no dashboard

**Tipo:** Protótipo
**Página:** Módulo 3 — Aba Greenn

## Descrição

Criar a aba Greenn no menu lateral do dashboard, com a estrutura vazia dos três blocos: indicadores, tabela de campanhas e tabela de vendas.

## Spec

`spec-greenn-aba-dashboard.md`

## Cenários

### Happy Path
1. A usuária clica em "Greenn" no menu lateral.
2. A seção aparece com os cinco indicadores, o aviso de período, a tabela de campanhas e a tabela de vendas.
3. As demais abas seguem inalteradas.

### Edge Cases
- Nenhuma venda ainda → estado vazio explicando que ainda não houve venda (texto diferente do erro).
- Uma única venda → ticket médio igual ao valor dela, sem divisão por zero.
- Nome de campanha muito longo → a tabela rola horizontalmente (`.tabela-wrap` já faz isso).
- Acesso direto por `/dash/#greenn` → abre já na aba certa.

### Cenário de Erro
`fetchJson` lançando faz `render()` inserir o aviso `.aviso.falha` já existente. Requisito: a seção precisa ter um `.card` como primeiro filho, senão o seletor de erro de `index.html:1360` não acha onde inserir.

## Aviso de período (obrigatório)

Texto fixo no topo da seção, deixando explícito que os números somam o ciclo inteiro de cada campanha e **não** seguem o filtro de datas do cabeçalho. Sem ele a tela mente por omissão para quem abrir daqui a alguns meses.

## Arquivos

- **Criar:** `functions/api/_greenn-metricas.js` — módulo PURO (sem `env.DB`, sem `fetch`, sem `Date.now()`): recebe vendas, sessões de checkout e gastos já lidos e devolve `{ resumo, por_campanha, vendas }` prontos para desenhar. Mesmo contrato de `_cpl-calculo.js` e `_funil-etapas.js`.
- **Criar:** `functions/api/greenn.js` — endpoint `GET /api/greenn?key=...`. Só I/O: valida a chave, faz as três consultas, chama o módulo puro, devolve JSON. Sem `from`/`to`: a aba lê o ciclo inteiro (mesmo padrão de `/api/workshops`).
- **Criar:** `tests/greenn-metricas.test.js` — testes do módulo puro com `node --test`.
- **Modificar:** `public/dash/index.html` — entrada no `#nav`, `<section id="secao-greenn">`, verbete em `TITULOS` e o renderer `R.greenn`.

## Reuso (pesquisado na base)

Importar / usar o que já existe, sem recriar:

- `tabela(el, colunas, linhas, aoClicar)` (`public/dash/index.html:410`) — já entrega ordenação por coluna, escape e estado vazio.
- `tile(k)` (`index.html:~403`) — o cartão de indicador, com suporte a `nota` e `—` para valor ausente.
- `money`, `fmtNum`, `fmtInt`, `esc`, `fetchJson` (`index.html:348-358`).
- O roteador por hash e o `try/catch` de `render()` (`index.html:1353-1363`) — link direto e estado de erro saem de graça ao registrar a seção.
- Padrão de endpoint: `functions/api/cpl.js` (I/O puro + módulo de cálculo separado).
- Padrão de teste: `tests/cpl-calculo.test.js` e `tests/funil-etapas.test.js`.

## Checklist

- [x] `<a href="#greenn" data-secao="greenn">Greenn</a>` no `#nav`
- [x] `<section class="secao" id="secao-greenn">` com um `.card` como primeiro filho
- [x] Verbete `greenn: 'Greenn'` em `TITULOS` (é ele que valida o hash no roteador)
- [x] `R.greenn` registrado
- [x] Aviso de período visível no topo da seção
- [x] Reuso de `tile`, `tabela`, `money`, `fmtInt` — nada de helper novo
- [x] Conferido que as outras abas continuam com os mesmos números
