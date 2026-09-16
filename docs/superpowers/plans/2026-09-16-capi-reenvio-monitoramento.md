# Plano: reenvio garantido ao Meta + Saúde do Meta

Spec: `spec-capi-reenvio-monitoramento.md` · Issues 268–288.

As 21 issues compartilham a mesma tabela, a mesma rotina periódica e a mesma aba. Por isso o plano é um desenho único, e cada issue aponta para a parte dele que implementa.

## Desenho

### Banco (migration `0041_meta_envios.sql`)

- **`meta_envios`**: uma linha por conversão do site ou venda que foi ao Meta. `UNIQUE(origem, event_id)` impede a mesma conversão em duas linhas.
  - `origem` (`site` | `venda`), `event_id`, `event_name`, `event_time` (horário original), `referencia` (página ou produto)
  - `situacao` (`aceita` | `pendente` | `falhou`), `categoria` (`credencial` | `evento` | `passageira` | `expirou` | `esgotou`), `motivo` (frase legível)
  - `tentativas`, `aceita_por_reenvio`
  - `payload`: JSON enviado na 1ª tentativa, apagado quando aceita
  - `ultimo_status`, `ultima_resposta`
  - `proxima_tentativa_em`, `em_envio_ate` (trava contra duas rodadas simultâneas)
  - `criado_em`, `ultima_tentativa_em`, `aceita_em`, `falhou_em`
  - Índices: `(situacao, proxima_tentativa_em)`, `(situacao, event_time)`, `(event_time)`, `(aceita_em)`, `(ultima_tentativa_em)`.
- **`meta_reenvio_rodadas`**: resumo de cada rodada que teve trabalho.
- **`meta_alertas_estado`**: uma linha por condição de alerta (ativa, desde, último aviso).
- **`meta_alertas_log`**: histórico de mensagens (alerta, lembrete, recuperação, teste), com `entregue` e `erro`.

### Regras puras (`functions/api/_meta-envio.js`, testadas em `tests/meta-envio.test.js`)

- `classificarRespostaMeta({ ok, status, corpo, erroRede, semCredencial })` devolve `{ situacao, categoria, motivo, consomeTentativa }`.
  - **credencial:** HTTP 401/403, `code` 190/102/10, ou `code` entre 200 e 299. Não usa `type: OAuthException`, porque o Meta também manda esse tipo em parâmetro inválido (code 100).
  - **passageira:** HTTP 5xx ou 429, `is_transient`, `code` 1/2/4/17/32/341/613, ou erro de rede.
  - **evento:** qualquer outra recusa.
- `proximaTentativaEm(agora, tentativas)`: 15 min, 30 min, 1 h, 2 h…
- Constantes: `MAX_TENTATIVAS = 5`, `DIAS_JANELA = 6`, `TAMANHO_RODADA = 50`.
- `avaliarCondicoes(metricas, agora)`: condições de alerta ativas.
- `estadoGeral(metricas, condicoes, agora)`: Saudável, Atenção ou Incidente.

### Fila no banco (`functions/api/_meta-fila.js`)

- `registrarPrimeiraTentativa(env, {...})`: grava a situação depois do envio original. Falha só vai para o log e nunca derruba o registro principal.
- `executarRodada(env, agora)`: expira as pendentes; seleciona as que venceram a espera; trava cada linha; reenvia; decide; interrompe na credencial; grava o resumo.
- `recuperarRecentes(env, agora)`: joga para a fila as recusas dos últimos 6 dias do `event_log` e do `purchase_log`. É idempotente.
- `metricasSaude(env, agora)`: números baratos, só de janelas recentes.

### Pontos de entrada

- `functions/tracker.js`: depois do envio ao Meta, registra a situação em `waitUntil`. Não vale para bots, bloqueados, eventos internos nem PageView. O `sendToMeta` passa a devolver o payload mesmo quando falta credencial.
- `functions/webhook/_core.js`: depois do `handleTracking`, registra a situação do Purchase. O `sendToMeta` também devolve o payload sem credencial.
- `functions/api/sync/meta-reenvio.js` (POST, `x-sync-secret`): rodada de reenvio, depois avaliação e entrega de alertas. Com `?acao=recuperar`, faz a recuperação do passado recente.
- `functions/api/meta-saude.js`:
  - GET: aba (`view=falhas`, `view=detalhe`);
  - POST: `tentar-de-novo`, `alerta-teste`.
  - Autenticação por `DASH_KEY`.
- `functions/api/_meta-alerta.js`: monta as mensagens e entrega no Slack (`SLACK_WEBHOOK_META`, secret só no servidor).
- `public/dash/index.html`: aba "Saúde do Meta" no grupo Diagnóstico.

### EntrouGrupo (só leitura)

`whatsapp_group_conversions` entra na tabela por tipo, nas pendentes, nas falhas e nas condições de alerta como o tipo `EntrouGrupo`. A fila dele não é alterada. O "Tentar de novo" fica desabilitado nas linhas dele, com a dica de que ele tem fila própria.

### Ajuste consciente da spec

A condição "nenhuma conversão aceita há 6 h", aplicada ao pé da letra, dispararia toda madrugada: são cerca de 5 leads por dia. Ela foi implementada como **"houve conversões nas últimas 6 h e nenhuma foi aceita"**, que detecta a quebra sem ruído. A condição "nenhuma Lead aceita há 24 h" segue a spec.

### Operação (depende de ok da usuária)

1. Aplicar a `0041` no D1 remoto com `wrangler d1 execute --file`, nunca `migrations apply`.
2. Publicar.
3. Rodar a recuperação uma vez.
4. Criar o cron de 15 min na VPS.
5. Cadastrar `SLACK_WEBHOOK_META` e enviar o alerta de teste.
