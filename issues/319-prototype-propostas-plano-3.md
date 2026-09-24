# 319: Protótipo — grade e cartões das três ações novas (pausar conjunto, realocar, aumentar)

**Tipo:** Protótipo
**Página:** Aba Argo do dash (`public/dash/index.html`, `#secao-argo`) — spec `spec-argo-plano-3.md`, módulo 5

## Descrição

Desenhar, com dados fictícios e sem backend, como as três ações aparecem na aba: a grade sem o grupo "Ainda não implementadas", o aviso do teto mensal de Meta vazio, e os cartões de proposta e do registro de pausar conjunto, realocar verba (dois lados, antes → depois) e aumentar orçamento (resultado × média e folga do mês), com todos os desfechos (conferida, não pegou, mudou, não completou, já estava) e o botão Desfazer.

## Pronto quando

Abrindo a aba Argo localmente dá para ver os três tipos de proposta pendente, vencida e executada, a realocação "não completou" em destaque e o aviso de teto vazio, no computador e no celular — e a usuária aprovou o visual.

## Onde o protótipo vive

Como na 307: a tela de verdade em `public/dash/index.html`, com os dados fictícios servidos pelo proxy local do scratchpad — **nunca no repositório**. O contrato de dados de cada tipo fica fixado aqui para as issues seguintes.

## Cenários

### Happy Path
1. A aba chama `/api/argo/propostas` (proxy local com fixture no scratchpad).
2. O backend (`montarPropostas`) devolve cada tipo novo já com `acao_rotulo`, `numeros` (rótulo/valor/referência), `verificacao` e, no histórico, `execucao` antes → depois e `pode_desfazer`.
3. A aba desenha os cartões com o mesmo componente genérico de hoje (`argoNumerosHtml`) — nada de lógica por tipo na tela.
4. Na grade, as três ações aparecem junto das demais (vêm em `acoes_com_consumidor`) e o grupo "Ainda não implementadas" some.
5. Com o teto mensal vazio, aparece o aviso "Sem teto, o Argo não aumenta orçamento".

### Edge Cases
- Realocar: os DOIS lados aparecem nos números (origem e destino, antes → depois).
- Realocar "não completou": situação em destaque (classe de falha), com o estado dos dois lados.
- Aumentar sem folga no teto nunca vira proposta — só aparece no relatório (não há cartão para isso).
- Número ausente some da lista, nunca vira R$ 0,00 (regra atual de `numerosDa`).

### Cenário de Erro
- Tipo desconhecido continua aparecendo com o rótulo cru (comportamento atual).

## Contrato de dados (fixado aqui para 320–323)

`detalhe` gravado pela VPS em `argo.propostas`:

- `pausar_conjunto`: `{adset_id, campanha, funil, anuncios: [nomes], gasto, leads_maduros, qualificados}`; `alvo_tipo = "conjunto"`, `alvo_id = adset_id`.
- `aumentar_orcamento`: `{funil, metrica: "cpv"|"cpl", valor, media, corte, mqls?, orcamento: {nivel, objeto_id, centavos, novo_centavos, pct}, folga: {teto_centavos, gasto_mes_centavos, dias_restantes, disponivel_dia_centavos, soma_depois_centavos}}`; `alvo_id = objeto_id`.
- `realocar_verba`: `{funil, metrica, media, valor_centavos, origem: {nome, nivel, objeto_id, centavos, novo_centavos, valor}, destino: {idem}}`; `alvo_tipo = "par"`, `alvo_id = "<origem>><destino>"`.

`execucao_detalhe.objetos` de orçamento: `{objeto, lado?, nivel, acao_id, antes, depois, resultado: "aplicou"|"mudou"|"nao_pegou"|"erro"|"devolvida"}` (centavos).

Realocação pela metade: o banco só aceita quatro estados de execução, então ela é gravada como `nao_conferida` com `execucao_detalhe.nao_completou = true` — é essa marca que a tela lê para mostrar "Não completou". Sem migration.

## Arquivos

- **Modificar:** `functions/api/_argo-propostas.js` — rótulos, `numerosDa`, `verificacaoDa`, `execucaoDa` e `pode_desfazer` para os três tipos; textos de situação do desfazer de orçamento.
- **Modificar:** `functions/api/_argo-config.js` — `ACOES_COM_CONSUMIDOR` passa a ter as seis ações (entra no deploy da última issue que ligar a VPS — ver 320–323).
- **Modificar:** `functions/api/_argo-registro.js` — desfecho de ação de orçamento ("orçamento alterado", "orçamento não mudou") e do desfazer de orçamento; conserta a redução, que hoje aparece como "pausada com sucesso".
- **Modificar:** `public/dash/index.html` — aviso do teto vazio na grade; descrições das três ações; classes dos desfechos novos.
- **Modificar:** `tests/argo-propostas.test.js`, `tests/argo-registro.test.js`, `tests/argo-config.test.js`.

Reusar: `argoNumerosHtml`, `desenharPropostasArgo`, `deCentavos`/`reais` de `_argo-propostas.js`.

## Checklist

- [ ] Fixture no scratchpad — NÃO feito: a usuária pediu para seguir sem parar; os cartões são genéricos e foram cobertos por testes do `montarPropostas`.
- [x] `_argo-propostas.js`: três tipos novos + testes.
- [x] `_argo-registro.js`: desfechos de orçamento + testes.
- [x] Dash: aviso de teto vazio e descrições.
- [ ] Conferir no navegador — pendente: fica para a gestora aprovar o visual na aba em produção.
