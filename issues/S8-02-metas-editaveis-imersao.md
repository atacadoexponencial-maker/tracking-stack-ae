# S8-02: Metas editáveis da Imersão 2027

**Tipo:** Implementação
**Página:** Imersão 2027 → Visão geral do lançamento
**Spec:** `spec-imersao-2027.md`

## Descrição

Permitir que a usuária grave, na própria tela, as metas internas do lançamento (verba de
anúncios de ingresso, % esperado do tráfego, meta de conversão do bump, meta de conversão
na Mentoria e horário da oferta), salvas no servidor para todo mundo.

## Pronto quando

A usuária abre "Metas do lançamento" na Visão geral, troca um valor, salva, e os
indicadores que dependem dele (CPA teto, previsto do dia, metas do bump e da Mentoria)
mudam; outra pessoa abrindo a tela vê o mesmo valor.

## Critérios de aceite

- **CA-S8-05** (automática) — Meta salva vale para todo mundo. Dado que a pessoa grava a verba de anúncios de ingresso em R$ 5.000, quando outra pessoa abre a tela, então vê R$ 5.000 na verba, e o CPA teto é calculado com esse valor.
- **CA-S8-07** (automática) — Valor inválido é recusado com motivo. Dado que a pessoa digita -10 na verba ou 120% numa meta de conversão, quando tenta salvar, então o valor não é gravado e a tela diz o motivo (ex.: "a porcentagem vai de 0 a 100").

## Suposições

Nenhuma.

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S8-05 | Metas editáveis ficam salvas para todos? | respondida | Sim, no servidor (usuária, 09/11) |

## Cenários

### Happy Path
1. Na Visão geral da Imersão 2027, a usuária abre "Metas do lançamento" (fechado por padrão, acima do bloco 1).
2. Vê os campos: verba de anúncios de ingresso (R$), % esperado do tráfego pago (padrão 75), meta de conversão do bump (%), meta de conversão na Mentoria (%), horário da oferta (HH:MM). Meta de ingressos aparece fixa: 100.
3. Troca a verba para 5000 e clica em "Salvar metas".
4. O dash manda `POST /api/imersao/metas` com os campos do formulário; o servidor valida, grava em `imersao_metas` e devolve a Visão geral recalculada, que a tela redesenha.

### Edge Cases
- Campo apagado (vazio): grava como sem meta; o indicador volta a "defina a meta" (no exemplo, ao valor de exemplo).
- Vírgula decimal ("10,5"): aceita como 10.5.
- Campo desconhecido no corpo: ignorado.

### Cenário de Erro
- Valor inválido (negativo, % acima de 100, horário fora de HH:MM): 400 com o motivo de cada campo; nada é gravado (nem os campos válidos do mesmo envio); a tela mostra o motivo junto do campo.
- Falha de rede ou 500: "Não foi possível salvar as metas agora." e os valores digitados ficam no formulário.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S8-05 | automática | `tests/imersao.test.js` | POST com verba 5000 → um GET novo devolve verba 5000 e CPA teto 66,67 (com 75%) |
| CA-S8-07 | automática | `tests/imersao.test.js` | POST com verba -10 ou meta 120% → 400 com o motivo e nada gravado |

## Banco de Dados

Usa `imersao_metas` criada na S8-01 (INSERT ... ON CONFLICT(campo) DO UPDATE).

## Arquivos

- **Modificar:** `functions/api/_imersao.js` — `validarMetas(corpo)` (devolve `{ ok, metas }` ou `{ ok: false, erros: { campo: motivo } }`).
- **Criar:** `functions/api/imersao/metas.js` — `POST /api/imersao/metas?key=`: autoriza, valida, grava em lote e devolve a Visão geral recalculada (reaproveita `montarResposta` de `functions/api/imersao/index.js`).
- **Modificar:** `public/dash/imersao.js` — formulário "Metas do lançamento", envio e erros por campo.
- **Modificar:** `public/dash/index.html` — passa um `postJson` no `ctx` de `R.imersao`, CSS do formulário (`.im-metas`, `.im-campo`) e sobe a versão do script.
- **Modificar:** `tests/imersao.test.js` — testes CA-S8-05 e CA-S8-07.

## Dependências Externas

Nenhuma.

## Checklist

- [x] `validarMetas` em `_imersao.js`
- [x] `POST /api/imersao/metas` gravando e devolvendo a visão recalculada
- [x] Formulário de metas em `imersao.js` com erro por campo
- [x] `ctx.postJson`, CSS do formulário e versão do script em `index.html`
- [x] Testes CA-S8-05 e CA-S8-07 passando
