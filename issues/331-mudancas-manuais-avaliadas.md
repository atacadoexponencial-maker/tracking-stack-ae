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

## Arquivos

- **Criar:** `gestor-ae/migrations/argo/0007_mudancas_manuais.sql` — só DDL idempotente.
- **Criar:** `gestor-ae/profiles/gestor-ia/scripts/argo_manuais.py` — detecção, inferência de tipo, gravação.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_veredito.py` — fila inclui manuais.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/ae_anuncios_monitor.py` (`_antes_depois_se`) e `ae_trafego_monitor.py` (bloco ~l.1677) — texto passa a vir dos registros.
- **Modificar:** `functions/api/_argo-registro.js`, `functions/api/argo/registro.js`, `functions/api/_argo-placar.js`, `public/dash/index.html` — linha manual e filtro "só manuais".
- **Criar:** `gestor-ae/.../test_argo_manuais.py`; **modificar** testes do registro e do placar.

## Checklist

- [ ] Migration 0007 aplicada (só DDL).
- [ ] Detecção + descarte de ações do Argo com testes.
- [ ] Bloco "Mudanças recentes" lendo dos registros, texto igual ao atual.
- [ ] Manuais na fila, no Registro da aba e no placar.
- [ ] Chave `avaliacao_manuais` respeitada.
