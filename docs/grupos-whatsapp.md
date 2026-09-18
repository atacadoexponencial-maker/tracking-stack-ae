# Aba "Grupos" — entradas e saídas nos grupos de WhatsApp

A aba **Grupos** do dash mede entradas, saídas e remoções nos grupos de avisos
das Comunidades (Lives Semanais e Workshops), lendo do D1. Mesmo desenho das
outras abas: o dash nunca fala com a Evolution no caminho da requisição — só o
card de conexão faz isso, em endpoint separado.

## Por onde o dado entra

```
Evolution (webhook GROUP_PARTICIPANTS_UPDATE)
  → n8n, fluxo "Evolution -> Postgres | Grupos clientes read-only"
    → nó novo, ligado a uma 2ª saída do nó Webhook (fan-out, não filtra nada)
      → POST /api/webhooks/whatsapp-grupo
        → D1 (whatsapp_group_events / whatsapp_groups_tracked / whatsapp_groups_seen)
          → GET /api/grupos → dash
```

A Evolution só aceita uma URL de webhook por instância, e ela já aponta para o
n8n — por isso o fan-out é um nó novo no fluxo existente, não um redirect.

## Nó novo no n8n

Ligado a uma **segunda saída do nó `Webhook`**, em paralelo ao `Normalize
Evolution Payload` já existente. Quem responde à Evolution continua sendo o
ramo original — este nó é ponta solta.

| Campo | Valor |
|---|---|
| Method | `POST` |
| URL | `https://atacadoexponencial.com/api/webhooks/whatsapp-grupo` |
| Header | `x-grupos-secret` = valor de `GRUPOS_WEBHOOK_SECRET` |
| Body | JSON → `={{ $json.body }}` (payload cru) |
| Timeout | `5000` |
| On Error | **Continue (using regular output)** |
| Retry on Fail | desligado |

`On Error: Continue` é **obrigatório**: sem ele, o tracking fora do ar (ou
lento) derruba a execução inteira do fluxo, e o monitor de mensagens do n8n
para junto — um problema nosso vira um problema da Evolution.

## Variáveis no Cloudflare Pages

| Variável | O que é |
|---|---|
| `GRUPOS_WEBHOOK_SECRET` | segredo próprio deste endpoint (não é o `SYNC_SECRET` — aquele abre 4 endpoints de sync, e colá-lo no n8n daria poder de escrita em todos eles) |
| `EVOLUTION_BASE_URL` | base da API da Evolution (ex.: `https://api.marcellemesquita.com.br`), sem path — usada só pelo card de conexão |
| `EVOLUTION_INSTANCE` | nome da instância (ex.: `MarcelleProfissional`) |
| `EVOLUTION_APIKEY_NOTIF` | **reusada**, não duplicada — é a mesma instância que já manda os alertas de WhatsApp, não faz sentido cadastrar a chave de novo |

`EVOLUTION_BASE_URL`/`EVOLUTION_INSTANCE` não são deduzidas de
`EVOLUTION_API_URL` porque aquela é a URL completa de ENVIO de mensagem
(`POST {number, text}`) e fica encriptada — não dá para inspecionar o formato
com segurança.

## Trocar de Comunidade (contingência — não é rotina)

**Os dois grupos são fixos.** O que muda com frequência é o **título** da
Comunidade da live, renomeada a cada semana para anunciar a próxima ("30/07 às
12h | O jogo da escala no atacado"). Renomear **não** afeta a coleta: o
monitoramento é fixado no JID, que não muda, e o `group_name` guardado na
`whatsapp_groups_tracked` é só rótulo humano — pode ficar desatualizado sem
consequência.

Esta seção existe para o dia em que a operação decidir criar uma Comunidade
nova (ou o WhatsApp forçar isso). A lista de grupos monitorados vive em tabela,
não em código, para esse dia ser um `INSERT` e não um deploy.

Como perceber que aconteceu: o gráfico para de crescer enquanto o card de
conexão continua verde, e o aviso de "grupo não monitorado" no topo da aba passa
a mostrar um JID novo.

### 1. Identificar o grupo certo

```bash
curl -s "{EVOLUTION_BASE_URL}/group/fetchAllGroups/{EVOLUTION_INSTANCE}" \
  -H "apikey: <EVOLUTION_APIKEY_NOTIF>" | jq '.[] | {id, subject, isCommunity, isCommunityAnnounce, size}'
```

Os grupos da Comunidade vêm em **pares com o mesmo nome** (`subject`):

- `isCommunity: true`, poucos membros → é o grupo **pai**. **Não cadastrar.**
  Uma entrada na Comunidade gera evento nos dois grupos do par; cadastrar o pai
  faria cada entrada contar em dobro.
- `isCommunityAnnounce: true`, muitos membros → é o grupo de **avisos**. É este
  que se monitora.

O `/grupo-da-live` (env `LEAD_REDIRECT_LIVE`) aponta para o convite da
Comunidade em uso — serve para confirmar qual par é o atual.

### 2. Trocar no D1

```sql
INSERT OR IGNORE INTO whatsapp_groups_tracked (group_jid, label, group_name, enabled) VALUES
  ('<jid do grupo de avisos novo>', 'Lives Semanais', '<nome do grupo>', 1);

UPDATE whatsapp_groups_tracked SET enabled = 0
  WHERE group_jid = '<jid do grupo de avisos antigo>' AND label = 'Lives Semanais';
```

Não apagar a linha antiga — `enabled = 0` preserva o histórico dela e ela some
das telas sem quebrar os eventos já gravados. O mesmo padrão vale para trocar o
grupo de `Workshops`.

## Diagnosticar quando o gráfico ficar vazio

Em ordem:

1. **Card de conexão** (topo da aba) — se estiver "Desconectado" ou "Não foi
   possível consultar", o problema é na Evolution, não no pipeline de eventos.
2. **Logs do endpoint** (`wrangler pages deployment tail` ou o painel do
   Cloudflare Pages) — `POST /api/webhooks/whatsapp-grupo` loga com
   `console.error` toda rejeição (401 por segredo divergente), todo corpo
   inválido (JSON malformado) e todo evento ignorado (payload que não bate com
   `GROUP_PARTICIPANTS_UPDATE` de grupo válido). Esses três casos respondem
   `200` para o n8n não travar, então só aparecem no log — não em nenhuma
   métrica visível no dash.
3. **Execução do nó no n8n** — abrir o fluxo "Evolution -> Postgres | Grupos
   clientes read-only" e conferir as últimas execuções do nó novo: se ele não
   está dando erro silencioso (`On Error: Continue` engole falhas) e se o
   corpo enviado é mesmo `{{ $json.body }}`.

Nenhuma dessas três fontes reentrega evento perdido — a Evolution não reenvia.
Um buraco identificado é irrecuperável; o valor do diagnóstico é parar de
perder, não recuperar o que já passou.

---

# Agenda de ações — agendar mensagem e renomear

A aba Grupos deixou de só observar em 17/09/2026: ela agora **age** no grupo.
Spec: `docs/superpowers/specs/2026-09-17-gestao-grupos-whatsapp-design.md`.

Não é um agendador de mensagens, é uma fila de **ações**. Renomear e enviar são
a mesma coisa com hora marcada, e por isso a semana inteira da live cabe numa
tela só. Tipo novo (trancar o grupo, revogar o link) entra sem tabela nova.

## Por onde o dado passa

```
Painel (aba Grupos) ──POST /api/grupos-acoes──▶ D1 whatsapp_group_actions
                                                  ▲
cron VPS (5/5 min) ──POST /api/sync/grupo-acoes───┘
                       │
                       ▼
              _grupos-acoes.js   (executor)
                       │
                       ▼
            _evolution-grupos.js (ÚNICA porta para a Evolution)
```

O botão "fazer agora" do painel entra pelo **mesmo** executor. Um caminho de
código, dois gatilhos: o que se testa clicando é o que roda às 12h.

`_evolution-grupos.js` é o único arquivo desta feature que conhece a Evolution.
Quando ela for aposentada, é ele que muda — não a funcionalidade.

## As quatro regras que seguram o risco

1. **Trava de corrida** — a reserva é `UPDATE ... WHERE status='agendada'`. Zero
   linhas mudadas significa que outra passada do cron já pegou. Sem isto, um
   cron lento sobrepondo o seguinte manda a mesma mensagem duas vezes para o
   grupo inteiro.
2. **Ação vencida não sai** — passados 30 min da hora marcada, vira
   `falhou: atrasada` sem disparar. Aviso de live que chega depois da live é
   pior que aviso nenhum. A constante é `ATRASO_MAX_SEG`.
3. **Mensagem nunca retenta sozinha** — falhou, fica vermelha no painel e a
   decisão é humana. `renomear` retenta até 3 vezes porque é idempotente.
4. **Falha grita** — alerta no Slack pelo `SLACK_WEBHOOK_META` (mesmo canal do
   CAPI). ⚠️ Enquanto esse secret não existir, a resposta do sync traz
   `alerta: {"erro":"sem_canal"}` e o único aviso é o vermelho no painel.

## Cron

```
*/5 * * * * /root/scripts/grupo-acoes-sync/sync.sh >> /var/log/tracking-grupo-acoes.log 2>&1
```

Cinco minutos é a granularidade prometida: 12:00 sai entre 12:00 e 12:05. O
script reusa o `.env` do `meta-leads-sync` (mesmo `SYNC_SECRET`), como os
demais. O Cloudflare **Pages** não tem Cron Triggers — só Workers — e por isso
o relógio mora na VPS, como nos outros sete syncs.

## `parent_jid`: o par da Comunidade

Os grupos da Comunidade vêm **em par com o mesmo nome** (grupo de avisos +
grupo pai). Renomear só um deixa metade com o título velho, e isso passa
despercebido. A coluna `whatsapp_groups_tracked.parent_jid` guarda o par.

**Ela nasce nula, de propósito.** Nulo significa "não sei", e nesse caso a
opção "renomear também o par" nem aparece na tela e é recusada no backend —
adivinhar qual é o outro grupo levaria a renomear o grupo errado.

Para preencher, identificar o par contra a Evolution (os dois vêm com o mesmo
`subject`; o de muitos membros é o de avisos, o de poucos é o pai):

```bash
curl -s "{EVOLUTION_BASE_URL}/group/fetchAllGroups/{EVOLUTION_INSTANCE}?getParticipants=false" \
  -H "apikey: <EVOLUTION_APIKEY_NOTIF>" | jq '.[] | {id, subject, size}'

npx wrangler d1 execute tracking-ae-db --remote \
  --command="UPDATE whatsapp_groups_tracked SET parent_jid='<JID_DO_PAI>' WHERE group_jid='<JID_DOS_AVISOS>';"
```

Refazer sempre que a Comunidade for recriada — ela não é permanente.

## Quando uma ação falha

O motivo fica no histórico da aba, em vermelho, junto da linha. Os casos:

| Motivo no painel | O que aconteceu |
|---|---|
| `venceu há N min e passou da janela` | a fila ficou parada (VPS, deploy). A ação **não** foi executada |
| `A Evolution recusou … (HTTP 4xx/5xx)` | chegou na Evolution e ela negou — número desconectado, sem permissão de admin, grupo inexistente |
| `Não foi possível falar com a Evolution` | timeout de 5s ou rede. **Não se sabe** se a ação aconteceu do outro lado |

O terceiro caso é o que exige olho: não dá para saber se a mensagem saiu. Por
isso ela não é retentada automaticamente — conferir no WhatsApp antes de
reagendar.

## Fora de escopo (Fase 1)

Adicionar e remover participantes, criar grupo, link de convite e roster ao
vivo ficaram desenhados na spec e **não** foram implementados. O `add` em
especial é a operação que queima número — add de estranho, em lote, com timing
de máquina — e vai precisar de throttle próprio e de fallback por convite.

---

# Aba Disparos — mídia agendada (18/09/2026)

A composição saiu da aba Grupos e virou aba própria, **Disparos**. A aba Grupos
voltou a ser só medição. Spec:
`docs/superpowers/specs/2026-09-18-disparos-midia-design.md`.

Cinco tipos: texto, imagem, vídeo, áudio (nota de voz) e documento, mais o
renomear. A tela tem três andares: compor com prévia ao vivo, a semana em sete
colunas, e o histórico.

## Onde o arquivo mora

No **KV** da Cloudflare (binding `MIDIA`), não no D1: o D1 limita 1 MB por
valor e um vídeo não caberia. A ficha (nome, mimetype, tamanho) fica no D1, em
`whatsapp_group_media`; os bytes ficam no KV.

⚠️ **O binding `MIDIA` é configurado no PAINEL da Cloudflare**, não no
`wrangler.toml` — o Pages com integração git ignora esse arquivo. Pages project
→ Settings → Bindings → KV namespace, nome `MIDIA`. Sem ele, o upload responde
500 e nenhum disparo com mídia sai.

A Evolution baixa o arquivo de `GET /m/<chave>`, uma rota **pública** de
propósito: quem baixa é o servidor dela, que não tem como se autenticar. A
proteção é a chave de 32 hex, que não se adivinha.

## Regras que vêm do comportamento real da Evolution

| Regra | Por quê |
|---|---|
| Sempre URL, **nunca** base64 | vídeo em base64 derruba a Evolution (bug aberto #1885, sem correção) |
| Sempre `fileName` com extensão certa, **nunca** `mimetype` junto | o service sobrescreve o mimetype pela extensão; extensão desconhecida vira a string `"false"` e entrega o arquivo corrompido |
| Aquecer o grupo antes de enviar | com o cache de metadados frio, a Evolution responde `404 Group not found` para grupo que existe |
| `delay` sempre 0 | ele é implementado com "digitando…" e segura a requisição HTTP inteira |

Por isso a lista de extensões aceitas é **fechada** (`_midia.js`): arquivo com
extensão fora dela é recusado no upload, e não na hora do envio.

## Áudio são duas mensagens

Nota de voz não aceita legenda no WhatsApp. Se houver texto, ele vai como uma
segunda mensagem, depois do áudio. E se o **áudio falha, o texto não é
enviado** — legenda solta sem o áudio que ela explica confunde o grupo. Se o
áudio foi e o texto falhou, o histórico diz isso com todas as letras, para
ninguém reenviar tudo e duplicar a nota de voz.

## Limites e expurgo

Imagem 5 MB, vídeo e áudio 16 MB, documento 20 MB — tetos práticos do WhatsApp,
todos abaixo do teto de 25 MB por valor do KV.

Arquivo de ação encerrada há mais de 30 dias é apagado do KV na mesma passada
do cron, e a ficha marca `apagada_em`. O histórico fica inteiro; só o arquivo
some. Mídia que subiu e nunca foi agendada também entra, pela data de criação.

---

# Renomear renomeia a COMUNIDADE, não o grupo de avisos (18/09/2026)

Sintoma: renomear devolvia
`HTTP 500 {"message":["Error updating group subject","Error: bad-request"]}`.

**Causa raiz:** os grupos monitorados são os **grupos de Avisos** de
Comunidades, e o nome do Avisos **espelha** o da Comunidade — ele não tem nome
próprio. Pedir ao WhatsApp para editar esse campo devolve `bad-request`.

Confirmado em produção, não deduzido:

```
avisos 120363427499061913  isCommunityAnnounce: true   isCommunity: false
                           restrict: false   size: 207
                           linkedParent: 120363429583787754
pai    120363429583787754  isCommunity: true           size: 6
                           subject IDÊNTICO ao do avisos
```

`restrict: false` descarta permissão; 23 caracteres descartam o limite (que é
100); duas tentativas com o mesmo erro descartam rede e limite de taxa.

**Correção:** o executor pergunta à Evolution quem é o `linkedParent` e
renomeia o **pai**. O grupo de avisos acompanha, e é isso que os membros veem.
O pai descoberto é guardado em `whatsapp_groups_tracked.parent_jid`, que passa
a ser só **reserva** para quando a Evolution não responder.

A descoberta é automática de propósito: cadastrar o pai à mão quebraria de novo
quando a Comunidade fosse recriada.

A opção "renomear também o par" saiu da tela — a escolha do alvo não é de quem
agenda.

## Diagnóstico de estrutura de grupo

```bash
curl -s -X POST "https://atacadoexponencial.com/api/sync/grupo-acoes?acao=diagnostico"   -H "x-sync-secret: $SYNC_SECRET" | jq
```

Só leitura. Devolve, para cada grupo monitorado e para o pai dele: `subject`,
`size`, `isCommunity`, `isCommunityAnnounce`, `linkedParent`, `announce`,
`restrict`. É o caminho mais rápido para responder "que tipo de grupo é este"
quando algo for recusado com `bad-request`.

**Como testar um renomear sem mudar nada:** agendar um renomear com o título
**igual ao nome atual**. Se concluir, o caminho funciona e ninguém vê diferença.
