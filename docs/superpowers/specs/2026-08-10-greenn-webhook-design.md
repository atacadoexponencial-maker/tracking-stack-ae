# Receptor de webhook da Greenn — design

Data: 2026-08-10
Status: aprovado, pronto para planejamento

## Problema

A Atacado Exponencial passou a vender por uma plataforma de checkout nova, a
**Greenn**. Hoje essas vendas não existem em lugar nenhum do tracking: a aba
Vendas do dash lê `purchase_log`, que é alimentada por outro caminho e cobre
outro negócio.

A decisão da usuária é explícita: **a Greenn é um produto à parte e não pode se
misturar com os dados atuais.** A visão dela no dashboard será separada.

Esta spec cobre **apenas a ingestão** — o endpoint que recebe os webhooks da
Greenn e os grava. A visão no dashboard é um ciclo posterior, deliberadamente
separado, e será desenhada em cima de vendas reais já gravadas em vez dos
exemplos fictícios da documentação.

## Por que ingestão primeiro

A Greenn envia webhook por POST na URL cadastrada e **não promete reentrega**.
Enquanto a URL não responder 200, todo evento que chegar está perdido em tempo
real. Existe rede de segurança — `GET /api/v1/sales` aceita
`filter[created_after]` sem limite de janela, então a venda em si é
recuperável — mas o evento no instante em que aconteceu, não.

Subir o receptor antes de cadastrar a URL elimina essa janela de perda.

## Como a Greenn cadastra o webhook

Por **produto** (campo `url_callback` de cada produto), não por conta. Isso tem
duas consequências de design:

1. **O filtro de escopo é operacional, não de código.** Quais produtos entram no
   tracking é decidido por onde a usuária cola a URL. O receptor não filtra
   produto nenhum.
2. **Mesmo assim gravamos `product_id`.** Se amanhã a URL for cadastrada em mais
   produtos, a separação já está no banco e não exige mudança de código.

## Contrato de entrada

Endpoint: `POST /api/webhooks/greenn`
URL pública: `https://atacadoexponencial.com/api/webhooks/greenn`

A Greenn envia três tipos de evento para a URL cadastrada:

| `event` | `type` | Quando |
|---|---|---|
| `saleUpdated` | `sale` | Venda muda de status |
| `contractUpdated` | `contract` | Assinatura muda de status |
| `checkoutAbandoned` | `lead` | Visitante preenche o checkout e não compra |

Todos os três chegam na mesma URL. O receptor aceita e grava os três — o custo
de gravar é baixo e o de descobrir depois que um evento foi descartado é alto.
A interpretação de cada tipo fica para o ciclo do dashboard.

Status possíveis de venda: `paid`, `waiting_payment`, `refused`, `refunded`,
`chargedback`, `unpaid`.

## Armazenamento

Tabela nova e isolada. **Não toca em `purchase_log`, `event_log`, `sessions` nem
em qualquer tabela que alimente as abas existentes.**

```sql
CREATE TABLE greenn_webhook_event (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  event          TEXT    NOT NULL,  -- saleUpdated | contractUpdated | checkoutAbandoned
  entity_type    TEXT,              -- sale | contract | lead
  entity_id      INTEGER,           -- sale.id / contract.id / lead.id
  current_status TEXT    NOT NULL,  -- paid, refused, ...; '' em checkoutAbandoned
  product_id     INTEGER,
  amount         REAL,              -- valor da venda em reais; NULL em checkoutAbandoned
  entity_updated TEXT,              -- updated_at da entidade, ISO 8601 da Greenn
  received_at    INTEGER NOT NULL,  -- unix seconds, relógio nosso
  raw_json       TEXT    NOT NULL   -- payload íntegro
);
```

De onde vem cada campo, por tipo de evento:

| Coluna | `saleUpdated` | `contractUpdated` | `checkoutAbandoned` |
|---|---|---|---|
| `entity_type` | `'sale'` | `'contract'` | `'lead'` |
| `entity_id` | `sale.id` | `contract.id` | `lead.id` |
| `current_status` | `currentStatus` | `currentStatus` | `''` |
| `product_id` | `product.id` | `product.id` | `product.id` |
| `amount` | `sale.amount` | `currentSale.amount` | `NULL` |
| `entity_updated` | `sale.updated_at` | `contract.updated_at` | `lead.updated_at` |

Nota: em `contractUpdated` o objeto da venda chama-se **`currentSale`**, não
`sale`. Em `checkoutAbandoned` não há venda — o `amount` fica nulo de propósito,
porque `product.amount` é o preço de tabela e registrá-lo como valor daria a
impressão de receita que não existe.

Migration: `0032_greenn_webhook.sql`.

As colunas extraídas existem só para consultar sem parsear JSON. **O `raw_json`
é a fonte da verdade** e é gravado íntegro, sem truncar: o payload da Greenn
passa de 4 KB e cortá-lo produziria JSON inválido — o oposto do propósito deste
endpoint. (O webhook do WhatsApp trunca em 2000 caracteres porque lá o payload
cru é material de depuração; aqui ele é o dado.)

### Idempotência

A documentação da Greenn avisa que `oldStatus` **pode vir igual a
`currentStatus`** e manda não usar a transição para detectar mudança. Somado à
ausência de garantia de entrega única, reentrega do mesmo estado é esperada.

Índice único e `INSERT OR IGNORE`:

```sql
CREATE UNIQUE INDEX idx_greenn_dedup
  ON greenn_webhook_event (event, entity_id, current_status, entity_updated);
```

Reentrega do mesmo estado é ignorada; mudança real de status entra como linha
nova. Mesmo padrão já usado em `whatsapp_group_events`.

Há também um índice não-único `idx_greenn_recebido` sobre `received_at`, para
consultas por período (ex.: "últimas vendas") sem varrer a tabela inteira.

**Por que `current_status` é `NOT NULL` com `''` no abandono:** em SQLite, `NULL`
nunca é igual a `NULL` num índice único. Se o abandono gravasse `NULL` ali, a
dedup não valeria para ele e cada reentrega viraria linha nova. A string vazia
compara normalmente, então os três tipos de evento são deduplicados pela mesma
regra. `checkoutAbandoned` tem `lead.id` e `lead.updated_at`, o que completa a
chave.

## Segurança

Todo POST da Greenn inclui o header **`X-Webhook-Token`** com o token do
vendedor. É o único fator de autenticação disponível — a Greenn não assina o
corpo com HMAC.

- Comparação com `env.GREENN_WEBHOOK_TOKEN` em **tempo constante**. Um `!==`
  comum interrompe na primeira diferença e vaza o prefixo do token por timing.
- Token ausente ou divergente → **401**, com `console.error` que **nunca**
  imprime o valor recebido nem o esperado.
- Secret no `.env` local e nos secrets do Cloudflare Pages. Nunca no
  repositório.

**Pendência operacional:** confirmar onde a Greenn exibe esse token. Se não
estiver visível no painel, ele pode ser lido do primeiro POST recebido (nos logs
do Pages, junto do 401) e então configurado. Isso é procedimento de implantação,
não um segundo caminho de código.

Como o payload traz dado pessoal do comprador — nome, e-mail, celular, CPF/CNPJ
e endereço completo — o `raw_json` **nunca** vai para `console.log`. Só os
identificadores mínimos (`event`, `entity_id`, `current_status`) aparecem em log.

## Tratamento de erros

**Responde 200 sempre que o token confere e a gravação funciona.** Um 5xx nosso
faz a Greenn tratar como falha de entrega, e não há reentrega garantida — um
erro de interpretação nosso viraria perda de dado dela. A exceção é a falha de
escrita no D1: ali o dado realmente não entrou, e um 200 mentiria sobre isso.

| Situação | Resposta | Ação |
|---|---|---|
| Token ausente/divergente | 401 | `console.error`, nada gravado |
| JSON inválido no corpo | 200 | `console.error`, nada gravado |
| `event` desconhecido | 200 | grava com `entity_type` NULL |
| Campo esperado faltando | 200 | grava o que der, resto NULL |
| Falha de escrita no D1 | 500 | `console.error` — único 5xx, e é real |

O 401 e o `console.error` de JSON inválido existem para distinguir "semana sem
venda" de "ingestão quebrada" nos logs do Pages.

### Armadilha de formato

`productMetas` e `proposalMetas` são serializados como `[]` (array) quando
vazios e como `{"chave": "valor"}` quando preenchidos — e os exemplos da própria
documentação mostram também `{}` para vazio, ou seja, os três formatos ocorrem.
A ingestão **não lê esses campos**, então a armadilha não a atinge; eles chegam
íntegros no `raw_json` e serão interpretados no ciclo do dashboard. Há teste
garantindo que nenhum dos formatos derruba o extrator.

O mesmo cuidado vale para `sale.refused`, que **só existe** quando
`status == "refused"`, e para `charge`, que só existe em venda de assinatura.
Nenhum dos dois é lido na ingestão.

## Componentes

**`functions/api/webhooks/_greenn-evento.js`** — lógica pura, sem I/O. Recebe o
body já parseado e devolve o objeto de colunas (`event`, `entity_type`,
`entity_id`, `current_status`, `product_id`, `amount`, `entity_updated`) ou
`null` se o corpo não for reconhecível como evento da Greenn. É a unidade
testável.

**`functions/api/webhooks/greenn.js`** — endpoint fino: valida o token, parseia
o corpo, chama o extrator, grava, responde. Segue o formato de
`functions/api/webhooks/whatsapp-grupo.js`.

**`migrations/0032_greenn_webhook.sql`** — a tabela e o índice.

**`docs/greenn-webhook.md`** — como cadastrar a URL nos produtos, onde fica o
secret, como conferir que está chegando.

## Testes

`tests/greenn-evento.test.js`, com `node --test`, sobre o módulo puro:

- os três payloads de exemplo da documentação (venda paga, venda recusada com
  `sale.refused`, assinatura com `charge`)
- `checkoutAbandoned` (sem `sale`, sem `client`, sem `saleMetas`)
- `productMetas` vazio (`[]`) e preenchido (`{}`)
- `event` desconhecido → `null`
- corpo vazio / sem `event` → `null`

O endpoint em si não é coberto por teste automatizado — o projeto não tem
harness para os handlers do Pages, e inventar um foge do escopo desta feature.

## Verificação

O que pode ser verificado localmente: `npm test` passando.

O que **não** pode: o recebimento real. A confirmação de ponta a ponta só vem da
primeira venda de verdade ou de um disparo de teste, se a Greenn oferecer esse
recurso no painel. Isso está declarado aqui para que não se confunda "testes
passando" com "integração funcionando".

## Fora de escopo

- Aba, tela ou endpoint de leitura no dashboard
- Qualquer alteração em `purchase_log` ou nas abas existentes
- Envio de `Purchase` para Meta/GA4 a partir das vendas da Greenn
- Backfill histórico via `GET /api/v1/sales`
- Uso das UTMs em `saleMetas` para atribuição
- Reembolso via `POST /sales/{id}/refund`

Cada um desses é um ciclo próprio, se e quando for pedido.
