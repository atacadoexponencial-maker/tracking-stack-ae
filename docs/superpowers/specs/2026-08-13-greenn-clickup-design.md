# Ponte Greenn → ClickUp — design

Data: 2026-08-13
Status: aprovado, pronto para planejamento

## Problema

Desde 2026-08-12 as vendas da Greenn chegam e são gravadas em
`greenn_webhook_event` (ver `2026-08-10-greenn-webhook-design.md`). Mas quem
compra não vira contato em lugar nenhum: a LP do workshop não tem formulário,
então nenhum evento `Lead` é disparado e o `/tracker` nunca aciona o ClickUp.

Na prática, hoje a pessoa compra e some. Os dados dela existem — o webhook traz
nome, e-mail, celular e CPF — mas ficam só no `raw_json`.

Esta spec cobre a ponte: **comprador da Greenn vira card no 🤑 CRM**.

## A restrição que manda em tudo

A usuária foi explícita, em 2026-08-10, que **a Greenn é um produto à parte e
não pode se misturar com os dados atuais**. O ClickUp é o CRM de sempre, então
a ponte precisa marcar os cards de forma que dê para separar venda da Greenn de
lead do funil antigo — e, acima de tudo, não pode injetar a receita da Greenn na
contabilidade existente.

Decisões tomadas com a usuária em 2026-08-13:

| Campo | Valor | Por quê |
|---|---|---|
| 🔻 Funil | `WO PAGO` | Opção que já existia na lista; evita criar dropdown novo |
| 🛒 Produto | `AE` | Coerente com o resto do CRM |
| Status inicial | `leads de entrada` | Quem comprou o workshop de R$ 27 não é cliente da mentoria: entra por cima da esteira |
| Tag | `greenn` | É o que separa na busca e nos filtros |

## 🚨 A armadilha da receita

A lista 🤑 CRM tem o status **`contrato assinado`**. Quando um card entra nele,
`functions/webhook/clickup.js` lê o campo **💰 Arrecadado** e registra a venda
pelo pipeline principal (`processPurchase`) — `purchase_log`, Receita e ROAS do
dashboard, e conversão na Meta.

Se um card da Greenn passar por ali com o Arrecadado preenchido, a receita dela
entra na contabilidade antiga em silêncio. Duas defesas, aplicadas juntas:

1. **O card nasce em `leads de entrada`**, nunca em `contrato assinado`.
2. **`💰 Arrecadado` fica vazio.** O valor da venda vai para **`💵 Valor`**
   (`67bc0514-2f0b-4317-a081-6fa69904681e`), que aquele webhook não lê.

Risco residual aceito: alguém arrastar o card para `contrato assinado` à mão.
Com o Arrecadado vazio, o webhook registraria receita zero — ruído, não
contaminação.

## Gatilho

Só **`saleUpdated` com `currentStatus === 'paid'`**.

Reembolso, estorno, recusa, aguardando pagamento e abandono de checkout **não**
criam card. (Hoje só "Venda Paga" está cadastrado no painel da Greenn, então os
outros nem chegam — mas a regra é do código, não do cadastro.)

Roda em `context.waitUntil` dentro de `functions/api/webhooks/greenn.js`, depois
da gravação: a resposta 200 para a Greenn sai na hora e a ponte nunca pode
atrasá-la nem derrubá-la. Mesmo padrão do `/tracker`.

## A atribuição

É o que diferencia esta ponte de um "cria card com nome e e-mail".

O payload traz `sf_trk` — confirmado com venda real (9606659) em 2026-08-12 —
que é o mesmo UUID gravado em `checkout_sessions.trk` quando a pessoa visitou a
LP. Com ele:

```
sf_trk → SELECT ... FROM checkout_sessions WHERE trk = ?
       → utm_source, utm_medium, utm_campaign, utm_content da VISITA
```

Essas UTMs vão para os custom fields correspondentes do card. O card nasce
sabendo de qual anúncio veio o comprador.

Quando `sf_trk` vier nulo (compra direta no checkout, sem passar pela LP) ou a
sessão não existir, os campos de UTM ficam vazios. Não se inventa origem.

## Card novo × comprador que já era lead

A busca é a mesma que o `/tracker` já faz: por **e-mail OU telefone** na lista.

**Não encontrado — cria** com:

| Campo | Origem |
|---|---|
| Nome da task | `client.name` |
| 👤 Nome | `client.name` |
| 📩 E-mail | `client.email` |
| ☎️ Whatsapp | `client.cellphone`, normalizado |
| 🔻 Funil | `WO PAGO` |
| 🛒 Produto | `AE` |
| 💵 Valor | `sale.amount` |
| utm_source / utm_medium / utm_campaign / utm_content | da `checkout_sessions` |
| Status | `leads de entrada` |
| Tag | `greenn` |

Mais um comentário com os dados da venda.

**Encontrado — NÃO sobrescreve Funil nem Produto.** Se a pessoa veio de
`LIVES SEMANAIS`, ela continua vindo de lá: carimbar `WO PAGO` por cima apagaria
a origem verdadeira e mentiria sobre como ela entrou. O card existente recebe
apenas:

- a **tag `greenn`**
- um **comentário** com os dados da compra

Essa assimetria é deliberada. O comentário e a tag são aditivos; os campos de
funil são a identidade do lead e não se reescrevem.

## Erros e recuperação

Uma coluna nova em `greenn_webhook_event`:

```sql
ALTER TABLE greenn_webhook_event ADD COLUMN clickup_task_id TEXT;
```

Migration `0033_greenn_clickup.sql`.

Sucesso grava o id da task. Falha deixa `NULL`. Como o `raw_json` íntegro já
está guardado, **nenhuma venda é perdida**: o que não foi pontado é encontrável
com uma consulta e recuperável a qualquer momento.

```sql
SELECT id, entity_id FROM greenn_webhook_event
WHERE event = 'saleUpdated' AND current_status = 'paid' AND clickup_task_id IS NULL;
```

Toda falha registra `console.error` com o id da venda — nunca com o `raw_json`,
que carrega CPF, telefone e endereço do comprador.

**Não haverá retry automático nesta feature.** O dado sustenta a recuperação
quando ela for necessária; construir o reprocessador agora seria código sem uso.
A escrita no ClickUp reaproveita o `clickupWrite` existente, que já faz 1 retry
em erro transitório (429/5xx/rede).

## Componentes

**`functions/api/webhooks/_greenn-clickup.js`** — lógica pura, sem I/O. Recebe o
payload da Greenn e a linha de `checkout_sessions` (ou `null`) e devolve o corpo
da task e o texto do comentário. É a unidade testável.

**`functions/api/webhooks/greenn.js`** — passa a disparar a ponte em
`waitUntil`. O que envolve I/O (buscar sessão, buscar task, criar, comentar,
taguear) vive aqui, junto do resto do endpoint.

**`migrations/0033_greenn_clickup.sql`** — a coluna.

**Reuso:** as constantes de custom field, `toClickUpPhone`, `clickupFetch`,
`searchClickUpTask`, `clickupWrite` e `addClickUpTag` já existem em
`functions/tracker.js`. Serão extraídas para um módulo compartilhado
(`functions/api/webhooks/_clickup-api.js`) e importadas nos dois lugares, em vez
de duplicadas — duplicar IDs de custom field é como eles divergem em silêncio.

## Testes

`tests/greenn-clickup.test.js`, com `node --test`, sobre o módulo puro:

- venda paga com sessão encontrada → task com as UTMs preenchidas
- venda paga sem `sf_trk` → task sem UTMs, resto igual
- `sf_trk` presente mas sessão inexistente → mesmo caso acima
- telefone normalizado (`+55…`)
- 💰 Arrecadado **ausente** do corpo (o teste que trava a armadilha)
- status é `leads de entrada` e nunca `contrato assinado`
- Funil `WO PAGO` e Produto `AE` com os IDs corretos
- comentário contém id da venda, valor, método e líquido

O caminho HTTP não é coberto por teste automatizado: o projeto não tem harness
para handlers do Pages, e inventar um foge do escopo.

## Verificação

Localmente: `npm test`.

Ponta a ponta: **só com uma venda real**. A venda 9606659 já está gravada e
serve de fixture para os testes, mas a criação do card só se prova comprando de
novo — ou reprocessando aquela linha à mão depois que a ponte estiver no ar.

## Fora de escopo

- Retry automático das pontes que falharem
- Reembolso/estorno refletindo no card
- Qualquer leitura da Greenn no dashboard (segue sendo ciclo próprio)
- Enviar `Purchase` da Greenn para Meta/GA4
- Mexer no `💰 Arrecadado` ou no fluxo de `contrato assinado`
- Backfill dos compradores anteriores à ponte
