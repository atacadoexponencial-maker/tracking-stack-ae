# 326: Veredito da pausa de campanha de tráfego, gravado e no relatório

**Tipo:** Implementação
**Página:** Monitor de tráfego (gestor-ae) + Neon — spec `spec-argo-veredito-acoes.md`, módulos 1 e 5 (decisões D1, D2, D5, D6)

## Descrição

Criar a estrutura do veredito no banco, a fila de avaliação com write-ahead e o primeiro veredito de ponta a ponta: a pausa de campanha de tráfego, que é a ação que o Argo mais executa. O relatório do Slack ganha o bloco fixo "Vereditos de hoje", que aparece em toda rodada.

## Pronto quando

Com uma pausa de campanha de tráfego registrada há 7 dias completos (D1) em `argo.acoes`, a rodada de tráfego grava um veredito ligado a ela (acertou / errou / inconclusivo, motivo, números antes e depois, referência, janela, versão da regra) e o relatório do Slack mostra o bloco "Vereditos de hoje" com a linha da ação, a linha do placar de 30 dias, a fila de aguardando e os erros de leitura. Rodar a rodada duas vezes no mesmo dia não cria dois vereditos. Sem ação avaliada, o bloco diz isso em uma linha e não some.

## Cenários

### Happy Path
1. Migration idempotente cria a tabela de vereditos (ação, rótulo, motivo, antes JSONB, depois JSONB, referência, janela_dias, regra_versao, avaliada_em, tentativas, origem `argo`/`manual`) com índice único por ação, e a chave `avaliacao_*` na régua ganha padrões (janela 7, pisos por bloco iguais aos de julgar, tolerância igual à do tráfego, limite de releitura).
2. Fila: ações aplicadas com sucesso, não desfeitas, com `criada_em + janela` já passado e sem veredito.
3. Antes: os números guardados na proposta/ação na hora de decidir (`detalhe`/`estado_anterior`); se não houver, os 7 dias que antecedem a ação.
4. Depois (D2): média do custo por visita das campanhas de tráfego que continuaram ativas nos dias completos da janela, comparada à referência de antes. Igual ou menor (dentro da tolerância) = acertou; acima = errou; gasto abaixo do piso de visita (D5) = inconclusivo.
5. Write-ahead: grava a linha com rótulo `avaliando` antes de ler o Meta; completa depois.
6. Bloco do relatório com as quatro linhas (vereditos, placar, fila, erros).

### Edge Cases
- Alvo alterado de novo dentro da janela (`updated_time` do Meta depois da ação) → inconclusivo "alvo mudou de novo em DD/MM antes de completar a janela" (D6).
- Ação desfeita → sai da fila com motivo "desfeita antes da janela", sem veredito.
- Ação não aplicada ou com `estado_posterior` nulo → fora da fila com motivo gravado.
- Ação com menos de 7 dias completos → segue "aguardando", conta na linha de fila do relatório.

### Cenário de Erro
- Falha ao ler o Meta: a linha `avaliando` recebe `tentativas + 1` e fica na fila; passado o limite de dias após a janela, vira inconclusivo "sem leitura". O relatório conta essas ações na linha de erros.
- Processo morto entre o write-ahead e o veredito: a próxima rodada encontra a linha `avaliando` e retoma, sem duplicar.

## Arquivos

- **Criar:** `gestor-ae/migrations/argo/0006_vereditos.sql` — só DDL idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`); nenhum UPDATE de dados.
- **Criar:** `gestor-ae/profiles/gestor-ia/scripts/argo_veredito.py` — fila, fotografias antes/depois, regra de veredito por tipo (começa por `pausar_campanha_trafego`), bloco do relatório. Reusa `argo_conjuntos.veredito_antes_depois` como base do rótulo e a leitura de `updated_time` de `argo_travas`.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_estado.py` — funções de fila e gravação do veredito (write-ahead), leitura dos padrões `avaliacao_*` da régua.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/ae_trafego_monitor.py` — chama a avaliação no fim da rodada e anexa o bloco ao relatório.
- **Criar:** `gestor-ae/profiles/gestor-ia/scripts/test_argo_veredito.py` — regra pura, fila, idempotência, write-ahead, bloco do relatório. Testes SEMPRE simulam Meta e Neon.

## Checklist

- [ ] Migration 0006 aplicada na Neon (só DDL).
- [ ] Fila + write-ahead + idempotência com testes.
- [ ] Veredito de pausa de tráfego com testes (acertou/errou/inconclusivo/D6).
- [ ] Bloco "Vereditos de hoje" no relatório, presente em toda rodada.
- [ ] Rodada real na VPS com grade conferida antes (não pausar nada por acidente).
