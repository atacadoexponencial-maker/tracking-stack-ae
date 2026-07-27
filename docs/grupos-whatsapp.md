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

## Trocar de Comunidade quando abrir o ciclo novo das lives

A Comunidade da live **não é permanente** — a cada ciclo novo, o WhatsApp cria
um grupo novo com JID novo. A lista de grupos monitorados vive em tabela
(`whatsapp_groups_tracked`), não em código, exatamente para isso ser um
`INSERT`, sem deploy.

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
