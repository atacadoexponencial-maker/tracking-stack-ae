# 331: Mudanças manuais registradas, avaliadas e no relatório

**Tipo:** Implementação
**Página:** Monitores (gestor-ae) + Registro da aba Argo — spec `spec-argo-veredito-acoes.md`, módulo 2 e bloco "Mudanças recentes" do módulo 5 (decisão D3)

## Descrição

Toda mudança detectada na conta que não bate com uma ação do Argo vira um registro de mudança manual, avaliado com a mesma régua e a mesma janela. O bloco "Mudanças recentes — antes e depois" do Slack passa a ler desses registros em vez de recalcular a cada rodada, e as mudanças manuais aparecem no Registro da aba com o selo de veredito.

## Pronto quando

Alterando à mão o orçamento de um conjunto da SE, a próxima rodada grava uma mudança manual (alvo, tipo inferido "orçamento para cima", data do Meta, estado observado), o Slack a lista em "Mudanças recentes — antes e depois" com o mesmo texto de hoje, e 7 dias depois ela recebe veredito, visível no Registro da aba como linha "manual" e contada no cartão manual do placar. Uma ação do Argo na mesma data e alvo NÃO gera registro manual. A chave `avaliacao_manuais` desligada para a detecção.

## Cenários

### Happy Path
1. Migration idempotente cria a tabela de mudanças manuais (conta, alvo_tipo, alvo_id, alvo_nome, tipo_inferido, mudou_em, estado_antes JSONB, estado_depois JSONB, detectada_em) com índice único por (alvo_id, mudou_em).
2. Detecção reusa a leitura de `updated_time` que `_antes_depois_se` e o bloco do tráfego já fazem; mudança cuja data (±1 min) e alvo coincidem com uma linha de `argo.acoes` é descartada.
3. Tipo inferido pela diferença de estado: pausa, reativação, orçamento para cima, orçamento para baixo, outro.
4. A fila de avaliação da 326 passa a incluir as manuais, com origem `manual`.
5. `_antes_depois_se` e o bloco do tráfego passam a montar o texto a partir dos registros (e dos vereditos quando já existem), mantendo o formato "mudou em DD/MM: CPL antes → depois — veredito".
6. `/api/argo/registro` inclui as manuais na lista, marcadas `manual`, com quem fez quando o Meta informar ou "não identificado".

### Edge Cases
- Mesma data no mesmo alvo em duas rodadas → um único registro.
- Mudança com mais de 30 dias na primeira detecção → registrada mas não avaliada (motivo "detectada tarde").
- Estado antes indisponível → tipo "outro", avaliação segue só com o depois versus referência.

### Cenário de Erro
- Falha ao ler o Meta na detecção → o bloco do relatório mostra "não consegui ler mudanças recentes (Tipo)" e a rodada continua.

## Decisão de desenho (27/09)

Uma mudança manual é gravada como **linha em `argo.acoes` com `tipo = 'mudanca_manual'`**, na rodada que a detectou, com `aplicada = true`, `estado_anterior` = último estado que o Argo conhecia do alvo (ou `{}`) e `estado_posterior` = estado observado + `{mudou_em, subtipo}`. Motivos:

- `vereditos.acao_id` é `NOT NULL UNIQUE` → a fila, o write-ahead, o registro (JOIN) e o placar (origem `manual` em `vereditos.origem`) funcionam **sem** tabela nova, sem UNION e sem migration de dados.
- A idempotência vem de um índice único parcial: `(alvo_id, (estado_posterior->>'mudou_em')) WHERE tipo = 'mudanca_manual'` — a mesma data no mesmo alvo nunca cria dois registros (`ON CONFLICT DO NOTHING`).
- Desvio da issue original ("tabela própria"): registrado aqui; o comportamento visível é o mesmo.

Subtipo inferido pela diferença entre o estado conhecido e o observado: `pausa` (ACTIVE→PAUSED), `reativacao` (PAUSED→ACTIVE), `orcamento_para_cima`, `orcamento_para_baixo`, `outro`. O Meta não diz quem fez: `feita_por = 'não identificado'` sempre.

## Banco de Dados

Migration `gestor-ae/migrations/argo/0007_mudancas_manuais.sql` (só DDL idempotente):

- `CREATE UNIQUE INDEX IF NOT EXISTS idx_acoes_mudanca_manual_unica ON argo.acoes (alvo_id, (estado_posterior->>'mudou_em')) WHERE tipo = 'mudanca_manual';`
- `CREATE INDEX IF NOT EXISTS idx_acoes_manual_conta_data ON argo.acoes (conta, criada_em DESC) WHERE tipo = 'mudanca_manual';`

## Detecção (`argo_manuais.py`, gestor-ae)

Roda no começo de `bloco_no_relatorio` dos dois monitores (antes de `avaliar_pendentes`), só com `avaliacao_manuais` ligada na régua. Nunca levanta.

1. **Alvos vigiados:** campanhas de tráfego ativas (`ae_trafego_monitor.active_traffic_campaigns`) e os donos de orçamento da SE (`argo_conjuntos.ler_estrutura` + `donos_da_se(estrutura, ctx.juncao["linhas"])`). Um alvo por objeto (campanha ou conjunto).
2. **Data da mudança:** `argo_travas.dados_da_campanha` / `dados_do_conjunto` → maior `updated_time` do objeto e dos conjuntos dele, nos últimos 30 dias. Sem data → nada.
3. **Não é manual** se existe ação do Argo (qualquer tipo ≠ `mudanca_manual`) no mesmo `alvo_id` com `|criada_em − mudou_em| ≤ 5 min` (`argo_estado.acao_do_argo_perto`). Também se o objeto foi criado há menos de 5 min da mudança (criação, não mudança).
4. **Estado observado:** `argo_travas._get(objeto, {"fields": "status,effective_status,daily_budget"})`. **Estado conhecido:** `argo_estado.ultimo_estado_conhecido(alvo_id)` = `estado_posterior` da última ação do Argo ou da última `mudanca_manual` no alvo (a que tenha data anterior). Sem conhecido → subtipo `outro`.
5. `argo_estado.registrar_mudanca_manual(rodada_id, conta, alvo_tipo, alvo_id, alvo_nome, mudou_em, subtipo, anterior, observado)` → `INSERT ... ON CONFLICT DO NOTHING`, motivo `"mudança manual detectada na conta em DD/MM (subtipo), sem ação do Argo correspondente"`.

Teto de 30 leituras por rodada (as Graph API já são chamadas pelas travas; aqui é uma a mais por alvo).

## Avaliação

`fila_de_avaliacao` passa a aceitar `mudanca_manual` (tipo efetivo = `'manual:' || subtipo`). Em `argo_veredito._julgar`: `manual:pausa` → regra da pausa (campanha de tráfego → `ler_pausa_trafego`; conjunto → `ler_pausa_lead` nível campanha); `manual:orcamento_para_cima` → `julgar_orcamento("aumentar_orcamento", ...)`; `manual:orcamento_para_baixo` → `julgar_orcamento("reduzir_orcamento", ...)`; `manual:reativacao` → `julgar_orcamento("aumentar_orcamento", ...)` sem o teste de "gastou o aumento"; `manual:outro` → `sem_avaliacao` "mudança sem tipo identificável". `abrir_veredito`/`registrar_sem_avaliacao` com `origem='manual'`. `REGRA_VERSAO` ganha `manual/1`. A régua é a mesma (D3).

## Relatório

`_antes_depois_se` (anúncios) e o bloco "Mudanças recentes — antes e depois" (tráfego) passam a montar o texto a partir de `argo_estado.mudancas_recentes(conta, 30)` (as `mudanca_manual` com o veredito, se houver):

```
*Mudanças recentes — antes e depois*
• SE | Quente | Lookalike 1% — mudou em 18/09 (orçamento para cima): CPL antes R$ 98,20 → depois R$ 176,40 — ❌ errou
• Post do Instagram — mudou em 24/09 (pausa): aguardando avaliação (avalia em 02/10)
```

O texto muda de forma (o veredito entra no lugar de "manteve/piorou"); o lugar e a leitura são os mesmos. `argo_conjuntos.veredito_antes_depois` deixa de ser chamada (fica no módulo, sem consumidor; remoção é limpeza futura).

## Tracking (aba)

- `functions/api/_argo-registro.js`: `TIPO_MUDANCA_MANUAL = 'mudanca_manual'`; `desfechoDaAcao` devolve `mudança manual: <subtipo legível>` para esse tipo; `montarRegistro` põe `origem: 'manual'` e `feita_por: 'não identificado'` nessas ações; `classificarVeredito` não muda (a linha de veredito vem do JOIN; sem linha, segue a regra de janela).
- `functions/api/argo/registro.js`: nada (o SELECT já cobre; `tipo` efetivo da manual continua `mudanca_manual`, e o placar conta por `v.origem`).
- `functions/api/_argo-regua.js`: `avaliacao_manuais` passa a `ativa: true`.
- `public/dash/index.html`: **nada** — o filtro "Manuais" olha `origem`, o selo e o placar já existem. `ARGO_ROTULOS` sem `mudanca_manual` mostra a chave crua só no cartão de tipo, e a manual não gera cartão de tipo (o placar separa por origem).

## Arquivos

- **Criar:** `gestor-ae/migrations/argo/0007_mudancas_manuais.sql`.
- **Criar:** `gestor-ae/profiles/gestor-ia/scripts/argo_manuais.py` — `inferir_subtipo(anterior, observado)` (pura), `detectar(conta, rodada_id, regua, ctx, agora)` (I/O), `bloco_mudancas(conta, agora)` → `list[str]`.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_estado.py` — `registrar_mudanca_manual`, `acao_do_argo_perto`, `ultimo_estado_conhecido`, `mudancas_recentes`; `_SQL_TIPO_EFETIVO` com o ramo `mudanca_manual`.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_veredito.py` — `TIPOS_AVALIAVEIS` + `mudanca_manual`, `_julgar` com os ramos `manual:*`, `origem` na gravação, chamada a `argo_manuais.detectar` em `bloco_no_relatorio`, rótulo "mudança manual" nas linhas.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/ae_anuncios_monitor.py` (`_antes_depois_se`) e `ae_trafego_monitor.py` (bloco ~l.1677) — texto vindo de `argo_manuais.bloco_mudancas`.
- **Criar:** `gestor-ae/profiles/gestor-ia/scripts/test_argo_manuais.py`; **modificar** `test_argo_veredito.py` (ramos manuais).
- **Modificar:** `functions/api/_argo-registro.js`, `functions/api/_argo-regua.js`, `tests/argo-registro.test.js`, `tests/argo-regua.test.js`.

## Dependências Externas

Nenhuma.

## Deploy e verificação

`scp` dos arquivos + `aplicar.py` (0007 só índices) + `unittest` na VPS; sem rodar monitor à mão. Tracking: `npm test`; merge da branch na `main` ao final da issue.

## Checklist

- [x] Migration 0007 aplicada (só índices) — 27/09, via aplicar.py na VPS.
- [x] Detecção + descarte de ações do Argo com testes (`argo_manuais.py`, `test_argo_manuais.py`).
- [x] Bloco "Mudanças recentes" lendo dos registros — texto mudou de forma (veredito no lugar de manteve/piorou; desvio anotado no plano).
- [x] Manuais na fila (tipo efetivo `manual:<subtipo>`, janela pela data da mudança), no Registro (origem manual, feita_por "não identificado") e no placar (origem manual do veredito).
- [x] Chave `avaliacao_manuais` respeitada (detecção não roda com ela desligada; ativa na régua da aba).

## Incidente durante a execução (27/09)

A suíte de testes do `gestor-ae`, rodada na VPS, exercita os monitores com o
Meta simulado mas **sem simular a Neon** — e o bloco de vereditos novo fala
com as duas de verdade. Resultado: a suíte gravou **duas mudanças manuais
reais** em `argo.acoes` (ids 5 e 10) presas a rodadas antigas, com veredito.
Removidas na hora (as tabelas voltaram a 1 ação e 0 vereditos); o cron as
recria amanhã no lugar certo. Correção: os seis arquivos de teste dos
monitores isolam `argo_veredito.bloco_no_relatorio` em `setUpModule`. Prova:
a suíte na VPS caiu de 469 s para 61 s e não escreve mais nada. Lição
registrada na memória: teste que monta o relatório inteiro precisa isolar
tudo o que fala com a Neon, não só o que fala com o Meta.
