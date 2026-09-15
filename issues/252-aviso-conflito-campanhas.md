# 252: Aviso de conflito de campanhas no cadastro

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Calcular no servidor as campanhas com investimento nos últimos 30 dias que casam com mais de um funil ativo ou com nenhum, e exibi-las na caixa acima da lista.

## Comportamentos cobertos

- Ao abrir a aba: a caixa lista cada campanha em conflito com o valor
- Nenhum conflito: a caixa não aparece

## Cenários

### Happy Path
1. A usuária abre a aba "Funis do relatório".
2. Em paralelo com a lista, a tela chama `GET /api/funis-relatorio-conflitos?key=...`.
3. O servidor lê: investimento por campanha dos últimos 30 dias de Brasília (terminando hoje) em `ad_spend`, a classificação manual (`campaign_funnel_map`), os funis ativos e `listarFunisConhecidos`.
4. `listarConflitosCampanhas` reconhece cada campanha com investimento na ordem da spec — (1) classificação manual, (2) trecho de funil ativo, (3) regra automática pelo último segmento, incluindo impulsionamento como `aquisicao` — e liga ao bloco pelo funil do tracking.
5. Campanhas que casam com **mais de um** funil ativo ou com **nenhum** voltam com nome, valor (reais, duas casas) e motivo, do maior para o menor valor.
6. A caixa acima da lista mostra "Campanhas dos últimos 30 dias que não casam com exatamente um funil ativo:" e uma linha por campanha com valor e motivo.

### Edge Cases
- Nenhum conflito → a caixa não aparece.
- Campanha com investimento 0 no período → ignorada.
- Motivos: "casou com mais de um funil" (trecho de dois ativos); "funil <x> não cadastrado no relatório" (reconhecida para um funil do tracking sem bloco ativo — inclusive por classificação manual para funil arquivado ou não cadastrado); "nenhum funil reconhecido".
- Classificação manual vence o trecho (spec, módulo 3).
- Trecho comparado sem caixa, como o reconhecimento de hoje (`/workshop-pago/i`).
- Nenhum funil ativo → toda campanha com investimento aparece na caixa.
- Campanha sem nome → aparece pelo id.
- O reconhecimento fica num módulo puro próprio (`_funis-relatorio-conflitos.js`) para a issue 255 reaproveitar a mesma regra no endpoint de feedback, sem segunda cópia.

### Cenário de Erro
- Sem chave → 401.
- Falha do endpoint de conflitos (ex.: D1) → a lista continua visível e a caixa mostra "Não foi possível conferir as campanhas dos últimos 30 dias agora." — falha não pode se passar por "sem conflito".

## Banco de Dados

Só leitura: `ad_spend` (`platform = 'meta'`, `date` em dia de Brasília, soma por `campaign_id`), `campaign_funnel_map`, `funis_relatorio` (ativos). Sem migration.

## Arquivos

- **Criar:** `functions/api/_funis-relatorio-conflitos.js` — puro: `reconhecerCampanha(nome, { override, funisAtivos, funisConhecidos })` e `listarConflitosCampanhas(gastos, {...})`.
- **Criar:** `tests/funis-relatorio-conflitos.test.js` — reconhecimento (automática, trecho, impulsionamento, manual vence trecho, dois trechos, não cadastrado, nada reconhecido) e lista de conflitos.
- **Criar:** `functions/api/funis-relatorio-conflitos.js` — `GET` com `DASH_KEY`; lê os dados dos últimos 30 dias e devolve `{ inicio, fim, conflitos }`.
- **Modificar:** `public/dash/index.html` — `R['funis-relatorio']` busca os conflitos no servidor (sai o `FUNISREL_PROTOTIPO`); `desenharConflitosFunisRel` esconde a caixa sem conflito e mostra a falha de leitura.

## Reuso (pesquisado na base)

- `resolverFunilAuto` e `listarFunisConhecidos` (`_funil-campanha.js`) — mesma regra automática da aba Meta Ads e do `/api/cpl`.
- Mapa de override por `campaign_id` e soma por campanha em `ad_spend` de `functions/api/campaign-funnel.js` / `_cpl-calculo.js`.
- `ymdBrt` (`_data-brt.js`) para o recorte em dia de Brasília.

## Checklist

- [x] Reconhecimento na ordem manual → trecho → automática/impulsionamento
- [x] Ligação ao bloco pelo funil do tracking
- [x] Conflito = mais de um bloco ou nenhum, com motivo
- [x] Só campanhas com investimento nos últimos 30 dias, maior valor primeiro
- [x] Testes do módulo puro
- [x] `GET /api/funis-relatorio-conflitos` com `DASH_KEY`
- [x] Caixa aparece com campanha e valor; some sem conflito; falha avisada sem derrubar a lista
- [x] Dados fixos do protótipo removidos
- [x] `npm test` passando
