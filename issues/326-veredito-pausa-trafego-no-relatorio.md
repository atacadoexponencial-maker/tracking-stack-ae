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

## Banco de Dados

Migration `gestor-ae/migrations/argo/0006_vereditos.sql` (só DDL idempotente):

- Tabela: `argo.vereditos` — um por ação, write-ahead.
  - `id` (BIGSERIAL PK)
  - `acao_id` (BIGINT NOT NULL UNIQUE, FK `argo.acoes` ON DELETE CASCADE) — a unicidade garante um veredito por ação mesmo com duas rodadas no mesmo dia
  - `rodada_id` (BIGINT, FK `argo.rodadas`) — a rodada que avaliou
  - `conta` (TEXT NOT NULL)
  - `origem` (TEXT NOT NULL DEFAULT 'argo') — `argo` ou `manual` (a 331 usa)
  - `situacao` (TEXT NOT NULL, CHECK em `avaliando`, `acertou`, `errou`, `inconclusivo`, `sem_avaliacao`)
  - `motivo` (TEXT) — a frase que a aba mostra
  - `antes` (JSONB NOT NULL DEFAULT '{}') — números crus de antes (cpv, gasto, visitas, referência)
  - `depois` (JSONB NOT NULL DEFAULT '{}') — números crus de depois
  - `numeros` (JSONB NOT NULL DEFAULT '[]') — lista já no formato da aba: `{rotulo, antes, depois, referencia}` com valores formatados
  - `janela_dias` (INTEGER NOT NULL)
  - `regra_versao` (TEXT NOT NULL) — ex.: `pausa_trafego/1`; muda quando a regra do julgamento mudar
  - `tentativas` (INTEGER NOT NULL DEFAULT 0), `ultimo_erro` (TEXT) — releituras
  - `criado_em` (TIMESTAMPTZ NOT NULL DEFAULT now()), `avaliada_em` (TIMESTAMPTZ) — nulo enquanto `avaliando`
  - Índice `idx_vereditos_conta_avaliada` em (`conta`, `avaliada_em` DESC).

Sem seed e sem UPDATE de dados. A régua nova NÃO ganha coluna: as chaves
`avaliacao_*` moram no JSONB `config_conta.regua` como as outras (a 328 as
expõe na aba; até lá valem os padrões).

## Regra do veredito da pausa de campanha de tráfego (D1, D2, D5, D6)

- **Janela:** `avaliacao_janela_dias` (padrão 7) dias COMPLETOS depois do dia
  da ação. Elegível quando `data(criada_em) + janela < hoje` (BRT).
- **Antes:** CPV da própria campanha nos 7 dias que antecedem o dia da ação
  (`campaign_metrics([cid], dia-7, dia-1)`) e a **referência** = CPV médio de
  todas as campanhas de tráfego da conta nos 30 dias que antecedem a ação
  (`campaign_metrics(traffic_campaigns(False), dia-30, dia-1)` →
  `media_da_conta`). É a mesma conta da decisão, refeita para o dia dela.
- **Depois (D2, onde o dinheiro ficou):** CPV médio das campanhas de tráfego
  ATIVAS hoje, exceto a pausada, nos dias `dia+1 .. dia+janela`
  (`campaign_metrics(ativas − {cid}, dia+1, dia+janela)` → `media_da_conta`).
- **Piso (D5):** gasto somado dessas campanhas na janela ≥
  `avaliacao_piso_visita_reais` (padrão 30 = `trafego_gasto_min_reais`); sem
  visita ou sem referência → **inconclusivo** com o motivo.
- **Julgamento:** `depois ≤ referência × (1 + avaliacao_tolerancia_pct/100)`
  → **acertou**; acima → **errou**. Tolerância padrão 30 (a mesma do tráfego).
- **D6:** `argo_travas.dados_da_campanha(cid)` → se algum `updated_time`
  (campanha ou conjuntos) for > `criada_em + 5 min` e ≤ fim da janela →
  **inconclusivo** "alvo mudou de novo em DD/MM antes de completar a janela".
  A pausa em si atualiza `updated_time` no instante da ação; daí a folga.
- **Motivo (uma frase):** "O custo por visita das campanhas de tráfego que
  continuaram ativas ficou em R$ X, abaixo/acima da referência de R$ Y
  (tolerância N%)."
- **`numeros`** no formato da aba: Custo por visita (antes = CPV da pausada,
  depois = média das ativas, referencia = "referência R$ Y"), Gasto, Visitas.

## Fila e write-ahead

- Entram: `acoes` da conta com `tipo = 'pausar_campanha_trafego'` (a 327
  amplia), `aplicada = true`, `desfeita_em IS NULL`, `estado_posterior IS NOT
  NULL`, janela completa, e sem linha em `vereditos` ou com `situacao =
  'avaliando'` (retomada).
- Saem sem veredito, com uma linha `sem_avaliacao` e motivo: `desfeita_em`
  preenchido ("desfeita antes da janela"); `aplicada = false` ("não
  aplicada"); `estado_posterior IS NULL` ("desfecho desconhecido"); janela
  terminada há mais de `avaliacao_releitura_dias` (padrão 3) na primeira vez
  que a ação é vista ("prazo de avaliação passou antes da primeira leitura",
  cobre as ações anteriores ao módulo).
- Write-ahead: `INSERT ... ON CONFLICT (acao_id) DO UPDATE SET tentativas =
  tentativas + 1` com `situacao = 'avaliando'` ANTES de ler o Meta; depois
  `UPDATE` para o veredito final com `avaliada_em = now()`.
- Falha de leitura: `ultimo_erro` = tipo da exceção (nunca a mensagem, pode
  ter segredo), a linha continua `avaliando`; quando `hoje > fim da janela +
  releitura_dias` → `inconclusivo` "sem leitura".
- Limite de `MAX_AVALIACOES_POR_RODADA = 20` por rodada, as mais antigas
  primeiro, para não estourar a Graph API.

## Bloco do relatório ("Vereditos de hoje")

Inserido em `_build_report_lines` logo depois de "Segurados por trava" e
ANTES de "Mudanças recentes — antes e depois" (assim a última linha do
relatório, que vira `conclusao` da rodada, não muda de natureza).

```
*Vereditos de hoje*
• Post do Instagram: Me mandaram… — pausa de campanha: ✅ acertou — CPV das ativas R$ 0,21 (referência R$ 0,25)
• Campanha X — pausa de campanha: ❌ errou — CPV das ativas R$ 0,41 (referência R$ 0,25)
• Campanha Y — pausa de campanha: ➖ inconclusivo — alvo mudou de novo em 24/09
Últimos 30 dias: 4 acertos, 1 erro, 1 inconclusiva (taxa 80%).
Aguardando avaliação: 2 ações (próxima em 03/10).
Sem leitura: 1 ação há 2 dias — tento de novo amanhã.
```

Sem ação avaliada hoje: "*Vereditos de hoje*: nenhuma ação completou a
janela." e as linhas de placar/aguardando continuam. Placar de 30 dias conta
pela data da AÇÃO (`acoes.criada_em`), origem `argo`; taxa = acertos ÷
(acertos + erros); sem conclusivas → "ainda sem ação avaliada".

## Arquivos

- **Criar:** `gestor-ae/migrations/argo/0006_vereditos.sql` — a tabela acima, tudo `IF NOT EXISTS` / `DO $$ ... $$` como a 0003.
- **Criar:** `gestor-ae/profiles/gestor-ia/scripts/argo_veredito.py`
  - `regua_avaliacao(grade)` → dict com `janela_dias`, `piso_visita_reais`, `tolerancia_pct`, `releitura_dias` via `argo_estado.regua_valor` (padrões 7 / 30 / 30 / 3).
  - `julgar_pausa_trafego(antes, depois, referencia, regua)` → `(situacao, motivo, numeros)` — função PURA, sem I/O.
  - `ler_antes_depois_pausa_trafego(acao, regua, agora)` → usa `ae_trafego_monitor.campaign_metrics`, `traffic_campaigns`, `media_da_conta` e `argo_travas.dados_da_campanha` / `_data` (D6).
  - `avaliar_pendentes(conta, rodada_id, agora)` → percorre a fila, write-ahead, julga, grava; devolve a lista de vereditos dados nesta rodada. Nunca levanta: erro por ação vira `ultimo_erro`.
  - `bloco_relatorio(conta, vereditos_de_hoje, agora)` → `list[str]` do bloco acima; lê placar e fila via `argo_estado`.
  - `REGRA_VERSAO = {"pausar_campanha_trafego": "pausa_trafego/1"}` e `MAX_AVALIACOES_POR_RODADA = 20`.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_estado.py` — funções SQL novas, todas com `_conectar()` como as existentes: `fila_de_avaliacao(conta, tipos, janela_dias, agora, limite)`, `acoes_fora_da_fila(conta, tipos, janela_dias, releitura_dias, agora)` (as que saem), `abrir_veredito(...)` (write-ahead, ON CONFLICT), `concluir_veredito(...)`, `registrar_falha_veredito(acao_id, tipo_erro)`, `placar_vereditos(conta, dias, origem)`, `fila_resumo(conta, tipos, janela_dias, agora)` (aguardando + próxima data + sem leitura).
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/ae_trafego_monitor.py` — em `_build_report_lines`, depois do bloco "Segurados por trava": `import argo_veredito` tardio; com `rodada_id` não nulo, `vereditos = argo_veredito.avaliar_pendentes(CONTA, rodada_id, now)`; `lines += argo_veredito.bloco_relatorio(CONTA, vereditos, now)`. Sem rodada (Neon fora), o bloco diz "sem rodada registrada — vereditos não avaliados". Qualquer exceção do módulo vira uma linha de aviso com o tipo, nunca derruba o relatório.
- **Criar:** `gestor-ae/profiles/gestor-ia/scripts/test_argo_veredito.py` — `unittest`, como `test_argo_orcamento.py`: `mock.patch.object(t, "campaign_metrics" / "traffic_campaigns")`, `mock.patch("argo_travas.dados_da_campanha")`, `mock.patch("argo_estado.<fn>")`. Casos: acertou, errou, inconclusivo por piso, por sem visita, por sem referência, D6, write-ahead antes da leitura, falha de leitura mantém `avaliando` e conta tentativa, "sem leitura" após o prazo, desfeita / não aplicada / desconhecida viram `sem_avaliacao`, limite por rodada, bloco do relatório com e sem veredito, placar sem conclusivas.

## Código a reutilizar (não recriar)

- `ae_trafego_monitor`: `campaign_metrics`, `traffic_campaigns`, `active_traffic_campaigns`, `media_da_conta`, `brl`, `BRT`, `CONTA`.
- `argo_travas`: `dados_da_campanha`, `_data`, `BRT`.
- `argo_estado`: `_conectar`, `ler_grade`, `regua_valor`; padrão de "só o tipo da exceção" nas mensagens.
- `argo_conjuntos.veredito_antes_depois` fica como está (texto do bloco "Mudanças recentes"); a 331 unifica.

## Dependências Externas

Nenhuma nova (`psycopg[binary]` e `requests` já estão no venv do profile).

## Deploy e verificação

1. `scp` dos arquivos para `root@31.97.241.169:/root/.hermes/profiles/gestor-ia/scripts/` e da migration para `.../migrations/argo/`.
2. `/root/.hermes/profiles/gestor-ia/.venv/bin/python /root/.hermes/profiles/gestor-ia/migrations/argo/aplicar.py` (reexecuta todas; a 0006 é só DDL).
3. Testes na VPS: `cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest discover -p "test_*.py"`.
4. **NÃO rodar `ae_trafego_monitor.py` à mão** (grade em Executar pausa de verdade). A verificação real é a rodada do cron das 8h50 do próximo dia útil: conferir o bloco no Slack e `SELECT * FROM argo.vereditos`.

## Checklist

- [x] Migration 0006 aplicada na Neon (só DDL) — 27/09, via aplicar.py na VPS.
- [x] Fila + write-ahead + idempotência com testes (test_argo_veredito.py, 21 casos).
- [x] Veredito de pausa de tráfego com testes (acertou/errou/inconclusivo/D6).
- [x] Bloco "Vereditos de hoje" no relatório, presente em toda rodada.
- [ ] Rodada real: fica para o cron das 8h50 de 28/09 (segunda). Não rodado à mão de propósito. Deploy na VPS feito em 27/09; 360 testes verdes lá.
