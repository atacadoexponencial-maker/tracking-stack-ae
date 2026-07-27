# Aba "Grupos" no dashboard — entradas e saídas nos grupos de WhatsApp

**Data:** 2026-07-27
**Status:** desenho aprovado, pronto para plano de implementação

## Problema

Não há medição das entradas e saídas nos grupos de WhatsApp das Lives Semanais e
dos Workshops. Hoje só se sabe o tamanho atual do grupo olhando o WhatsApp — não
há série histórica, não se sabe qual dia puxou mais gente, e uma debandada depois
de uma live passa despercebida.

## Objetivo

Uma aba nova no dashboard mostrando, por grupo e por dia, quantas pessoas
entraram e quantas saíram, com destaque para o dia de maior entrada e o de maior
saída.

## Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Fonte dos eventos | Evolution API (`GROUP_PARTICIPANTS_UPDATE`) | Escolha da usuária, ciente de que a Evolution está sendo aposentada e o número corre risco de bloqueio |
| Rota até o tracking | Fan-out no n8n existente | A Evolution só aceita **uma** URL por instância; repontar quebraria o monitor de mensagens de clientes que já roda |
| Grupos | 2 fixos, identificados por JID | O nome do grupo da live muda a cada semana; o JID não |
| Nível de detalhe | Com identificação das pessoas | Responde "quem saiu depois da live", ao mesmo custo de implementação |
| Gráfico | Duas linhas (entradas e saídas) no mesmo eixo | Saldo líquido sozinho esconde volume: 50 entradas + 50 saídas ficaria igual a um dia parado |
| Estado da conexão | Consulta ao vivo, em requisição própria | Estado de conexão defasado não serve para nada; requisição separada impede que a Evolution travada trave a aba inteira |

## Descobertas da investigação

**Os grupos são Comunidades do WhatsApp, não grupos comuns.** Cada comunidade
tem um grupo "pai" (poucos membros, admins) e um **grupo de avisos**, onde estão
todos. Uma pessoa que entra gera evento nos dois — contar ambos dobraria o
número. O grupo de avisos é a fonte da verdade; o pai é ignorado.

JIDs identificados (via `GET /group/fetchAllGroups`):

| Grupo | Pai | Avisos (monitorado) | Membros em 27/07 |
|---|---|---|---|
| `📦 Workshop \| Atacado Exponencial` | `120363397317313470@g.us` | `120363380235066572@g.us` | 555 |
| `30/07 às 12h \| O jogo da escala no atacado` (Lives Semanais) | `120363429583787754@g.us` | `120363427499061913@g.us` | 95 |

O `/grupo-da-live` (env `LEAD_REDIRECT_LIVE`) aponta hoje para o convite da
comunidade da live — confirmando qual é a comunidade em uso.

O grupo `Lives Semanais — Willian Baldan #2` (270 membros) **não é da operação** —
o número apenas participa dele. Fica fora.

**A comunidade da live não é permanente** (a atual foi criada em 23/06/2026).
Quando um ciclo novo começar, o JID muda. Por isso a lista de grupos monitorados
vive em tabela, não em código.

**A instância já está inscrita no evento.** `GET /webhook/find/{instance}`
confirma `GROUP_PARTICIPANTS_UPDATE` na lista e `webhookByEvents: false` — tudo
chega na mesma URL do n8n. Nenhuma mudança na configuração da Evolution.

**Os eventos já chegam no n8n e são descartados.** O fluxo
`Evolution -> Postgres | Grupos clientes read-only` filtra por `MESSAGES_*` no nó
`Mensagem útil?`, então `GROUP_PARTICIPANTS_UPDATE` cai no ramo
"Responder ignorado ruído". O dado já bate na porta.

## Arquitetura

```
WhatsApp → Evolution → n8n (webhook da7990f1…) ─┬─→ fluxo de mensagens (intacto)
                                                └─→ HTTP Request (novo)
                                                         ↓
                              POST /api/webhooks/whatsapp-grupo  (Pages Function)
                                                         ↓
                                                        D1
                                                         ↓
                              GET /api/grupos  →  aba "Grupos" no dash
```

Mesmo princípio dos outros coletores do projeto: o caminho da requisição do dash
nunca toca a Evolution. O dash lê do D1 e pronto.

### Nó novo no n8n

Ligado a uma **segunda saída do próprio nó `Webhook`**, em paralelo ao
`Normalize Evolution Payload` — assim não passa por nenhum filtro do fluxo atual
e não tem como quebrá-lo. É ponta solta: quem responde ao webhook continua sendo
o ramo original.

| Campo | Valor |
|---|---|
| Method | `POST` |
| URL | `https://atacadoexponencial.com/api/webhooks/whatsapp-grupo` |
| Header | `x-grupos-secret` = valor de `GRUPOS_WEBHOOK_SECRET` |
| Body | JSON → `={{ $json.body }}` (payload cru) |
| Timeout | `5000` |
| On Error | **Continue (using regular output)** |
| Retry on Fail | desligado |

Os dois últimos são obrigatórios: sem eles, tracking fora do ar derruba a
execução inteira e o monitor de mensagens para junto.

### Segredo

`GRUPOS_WEBHOOK_SECRET` — **novo e exclusivo deste endpoint**, cadastrado como
secret encriptado no Cloudflare Pages (Production e Preview). Deliberadamente
**não** reusa o `SYNC_SECRET`: aquele abre quatro endpoints de sync, e colá-lo no
n8n daria a quem tem acesso ao n8n poder de escrita em todos eles.

### Variáveis no Cloudflare Pages

Inventário conferido em 27/07/2026 (`wrangler pages secret list`): o projeto já
tem `EVOLUTION_API_URL`, `EVOLUTION_APIKEY_ALERTA`, `EVOLUTION_APIKEY_NOTIF`,
`EVOLUTION_NUMERO_ALERTA`, `EVOLUTION_NUMERO_NOTIF`, `SYNC_SECRET` e
`GRUPOS_WEBHOOK_SECRET` (este já cadastrado pela usuária).

O card de conexão **reusa `EVOLUTION_APIKEY_NOTIF`** como `apikey` — é a mesma
instância, não faz sentido cadastrar a chave duas vezes.

Faltam apenas duas variáveis, ambas **sem Encrypt** (não são segredo):

| Variável | Valor |
|---|---|
| `EVOLUTION_BASE_URL` | `https://api.marcellemesquita.com.br` |
| `EVOLUTION_INSTANCE` | `MarcelleProfissional` |

Por que não deduzir da `EVOLUTION_API_URL`: ela é a URL completa de envio de
mensagem (`POST` com `{number, text}`), e está encriptada — não dá para
inspecionar o formato para confirmar que o recorte funcionaria. Deduzir errado
deixaria o card permanentemente em "não foi possível consultar", sem dizer por
quê. Duas variáveis explícitas custam 30 segundos e eliminam a dúvida.

## Endpoint de escrita — `POST /api/webhooks/whatsapp-grupo`

Auth: `x-grupos-secret` conferido contra `env.GRUPOS_WEBHOOK_SECRET`. Ausente ou
divergente → `401`.

Responde `200` rápido inclusive quando ignora o evento, para o n8n nunca segurar
a resposta do webhook da Evolution.

### Classificação do evento

Do payload interessam `data.id` (grupo), `data.participants[]` e `data.action`.
Uma linha por participante da lista.

| `action` | Registro | Observação |
|---|---|---|
| `add` | `entrou` | |
| `remove`, autor = a própria pessoa | `saiu` | saiu por vontade própria |
| `remove`, autor ≠ a pessoa | `removido` | tirado por admin |
| `promote` / `demote` | ignorado | mudança de papel, não de composição |

Separar `saiu` de `removido` evita que uma limpeza manual no grupo vire um pico
falso de abandono.

**Momento do evento:** `date_time` do envelope da Evolution; se ausente, a hora
de recebimento. O dia local é gravado já calculado em `-03:00` (mesmo tratamento
de `functions/webhook/_core.js`), para o "por dia" não escorregar de fuso.

**Escopo de gravação:** eventos de grupos fora da lista monitorada **não** têm
participantes gravados — o número está em 119 grupos, a maioria de terceiros.
Deles registra-se apenas nome do grupo e contador, em `whatsapp_groups_seen`.

## Schema — migration `0026`

**`whatsapp_group_events`** — uma linha por pessoa por evento: `group_jid`,
`participant_jid`, `action` (`entrou` / `saiu` / `removido`), `actor_jid`,
`occurred_at` (ISO UTC), `day_local` (`YYYY-MM-DD` em `-03:00`, pré-calculado),
`received_at`, `raw_json`.

Índice **único** em (`group_jid`, `participant_jid`, `action`, `occurred_at`) com
`INSERT OR IGNORE`: o evento da Evolution não tem ID próprio, e reentrega do n8n
não pode duplicar contagem.

**`whatsapp_groups_tracked`** — `group_jid` (PK), `label`
(`Lives Semanais` / `Workshops`), `group_name` (último nome visto, só rótulo),
`enabled`. Semeada com os dois grupos de avisos da tabela acima. **Trocar de
comunidade no futuro é um `INSERT` aqui, sem deploy.**

**`whatsapp_groups_seen`** — `group_jid` (PK), `group_name`, `events`,
`last_event_at`. Sem dados de pessoas. É a rede de segurança: comunidade nova
aparece no dash como "grupo não monitorado" em vez de sumir em silêncio.

## Endpoint de leitura — `GET /api/grupos`

Auth: `DASH_KEY`, como as demais abas. Aceita o mesmo intervalo de datas do dash.

Retorna, por grupo monitorado: série diária de entradas/saídas/removidos; totais
e saldo líquido no período; dia recorde de entradas e dia recorde de saídas;
últimos eventos com participante e horário; e o momento do último evento recebido
(qualquer grupo), para a nota de saúde.

Também retorna os grupos vistos e ainda não classificados.

## Endpoint de conexão — `GET /api/grupos-conexao`

Auth: `DASH_KEY`. Consulta `GET {EVOLUTION_BASE_URL}/instance/connectionState/{EVOLUTION_INSTANCE}`
com header `apikey: {EVOLUTION_APIKEY_NOTIF}`, timeout de 5 s, e traduz o
resultado:

| `state` da Evolution | Card mostra |
|---|---|
| `open` | **Conectado** |
| `connecting` | **Reconectando** |
| `close` | **Desconectado** |
| erro, timeout ou HTTP ≠ 200 | **Não foi possível consultar** |

A chamada é isolada num endpoint próprio, requisitada em paralelo ao
`/api/grupos`: Evolution lenta ou fora do ar deixa apenas este card em estado
indefinido, sem atrasar o resto da aba. A `apikey` nunca chega ao navegador — a
consulta acontece na Pages Function.

Resposta validada em 27/07/2026:
`{"instance":{"instanceName":"MarcelleProfissional","state":"open"}}`

## Aba "Grupos" no dash

Em `public/dash/index.html`, seguindo o padrão das abas existentes e respeitando
o filtro de datas do topo:

- **Card de conexão do WhatsApp**, no topo da aba: estado da conexão ao vivo
  (ver endpoint acima), a instância consultada e, ao lado, o **último evento
  recebido** vindo do D1. Os dois juntos porque contam coisas diferentes:
  conexão caída explica um gráfico que parou; conexão aberta há dias sem nenhum
  evento é outro problema, e sem esse par ele passaria por "semana fraca".
- **KPIs por grupo:** entradas, saídas, removidos, saldo líquido no período.
- **Gráfico diário** com duas linhas (entradas e saídas). Exige estender o helper
  `grafico()` para aceitar mais de uma série, **mantendo compatibilidade** com as
  chamadas atuais de Visão geral e Vendas.
- **Cards de recorde:** dia com mais entradas e dia com mais saídas, com data e número.
- **Tabela dia a dia:** Dia | Entradas | Saídas | Saldo.
- **Eventos recentes:** quem, grupo, ação, quando.
- **Aviso de grupo não monitorado**, quando houver.

O card de conexão ocupa o papel que a "nota de saúde" tem nas outras abas (o
`workshops-sync-nota`): sem ele, uma Evolution caída vira uma linha reta que se
confunde com semana fraca.

## Testes

O projeto não tem runner de testes JS. A classificação do evento (payload →
linhas) fica isolada em função pura, coberta por testes com o runner nativo do
Node (`node --test`), sem dependência nova: `add` com vários participantes, saída
própria vs. remoção por admin, `promote`/`demote` ignorados, grupo fora da
allowlist, payload malformado, e idempotência da reentrega.

Endpoints verificados por smoke test com `curl`, como os outros syncs do projeto.

## Fora de escopo (deliberado)

- **Tamanho atual do grupo e taxa de retenção** — exigiriam um retrato diário do
  grupo inteiro, que é outra peça. Encaixa depois sem retrabalho.
- **Cruzar quem entrou no grupo com os leads do tracking** (por telefone) — vale
  muito, mas é outra feature.

## Limitações honestas

1. **Sem histórico retroativo.** A medição vale daqui pra frente. Os 555 do
   workshop e os 95 da live são ponto de partida, não histórico.
2. **Buraco de coleta é possível.** Se a instância da Evolution cair ou o número
   for bloqueado, os eventos daquele período se perdem para sempre — a Evolution
   não reentrega. A nota de saúde torna o buraco visível, mas não o preenche.
3. **Dependência do n8n.** Enquanto o fan-out existir, o tracking depende de um
   sistema que está sendo aposentado. Quando o n8n sair, a Evolution passa a
   apontar direto para este endpoint — o endpoint é o mesmo, sem retrabalho.
