# Webhook da Greenn

A Greenn é a plataforma de checkout de um produto **separado** do restante do
tracking. Os eventos dela caem numa tabela isolada (`greenn_webhook_event`) e
não aparecem em nenhuma aba atual do dashboard — isso é intencional.

## URL

    https://atacadoexponencial.com/api/webhooks/greenn

## Antes de cadastrar: a tabela precisa existir em produção

O endpoint grava em `greenn_webhook_event`. Se a URL for cadastrada antes da
tabela existir no D1 remoto, todo POST cai no `catch` do endpoint → 500 → e
como a Greenn não reentrega, é perda definitiva do dado. Aplique a migration
antes de colar a URL em qualquer produto:

    npx wrangler d1 execute tracking-ae-db --remote --file=migrations/0032_greenn_webhook.sql

Não se usa `wrangler d1 migrations apply --remote` neste projeto: as
migrations antigas 0021/0022/0025 quebram ao serem reaplicadas nesse comando.
Rodar o arquivo da 0032 diretamente com `d1 execute --file` é seguro e
idempotente porque a migration usa `CREATE TABLE IF NOT EXISTS` — pode ser
executado de novo sem efeito colateral se houver dúvida se já rodou.

## Como cadastrar

Na Greenn, a URL de webhook é cadastrada **por produto** (campo `url_callback`).
Cole a URL acima em cada produto que deve ser rastreado. Produto sem a URL não
gera evento nenhum aqui — é assim que se escolhe o que entra.

## Segredo

O endpoint valida o header `X-Webhook-Token` que a Greenn envia em todo POST,
comparando com a variável `GREENN_WEBHOOK_TOKEN`:

- local: no `.env` (nunca commitado)
- produção: Cloudflare Pages → projeto `tracking-ae` → Settings → Environment
  variables → **Secret** (não "plaintext")

O caminho confiável é obter o token no painel da Greenn e cadastrá-lo como
secret antes de colar a URL no produto. Se a URL for cadastrada antes disso,
os POSTs vão levar 401 — o log do Pages serve para confirmar que a
requisição **chegou** (procure por `greenn — token`), não para revelar o
valor do token: o endpoint nunca loga o token recebido nem o esperado, e o
Pages não registra headers customizados nos logs padrão sem Logpush
configurado à parte. Configure o secret e a partir daí os eventos passam a
gravar.

## O que é gravado

Os três eventos que a Greenn envia: `saleUpdated` (venda mudou de status),
`contractUpdated` (assinatura) e `checkoutAbandoned` (visitante preencheu o
checkout e não comprou). Todos vão para a mesma tabela, com o payload íntegro
em `raw_json`.

Status de venda possíveis: `paid`, `waiting_payment`, `refused`, `refunded`,
`chargedback`, `unpaid`.

## Respostas

| Situação | HTTP |
|---|---|
| Gravado | 200 |
| Evento desconhecido | 200 (grava com `entity_type` nulo) |
| JSON inválido no corpo | 200 (registra no log, não grava) |
| Token ausente ou divergente | 401 |
| Falha de escrita no D1 | 500 |

O 200 em evento desconhecido é deliberado, e ele **grava** (com `entity_type`
nulo): a Greenn não promete reentrega, e descartar um tipo de evento novo
seria perda definitiva do dado.

## Conferir se está chegando

    npx wrangler d1 execute tracking-ae-db --remote \
      --command "SELECT id, event, entity_id, current_status, amount, datetime(received_at,'unixepoch','-3 hours') AS recebido FROM greenn_webhook_event ORDER BY id DESC LIMIT 20;"

Tabela vazia significa uma de quatro coisas: nenhuma venda aconteceu, a URL
não foi cadastrada no produto, o token está errado (procure `greenn — token`
nos logs do Pages), ou a tabela ainda não existe em produção (veja a seção
acima — rode a migration 0032 antes de cadastrar a URL).

## Recuperar o que se perdeu

A Greenn não reentrega. Se o endpoint ficou fora do ar, as vendas ainda podem
ser recuperadas pela API:

    GET https://apiadm.greenn.com.br/api/v1/sales?filter[created_after]=2026-08-01
    Authorization: Bearer grn_live_...

Não há limite de janela nesse filtro. O que não se recupera é o evento no
instante em que aconteceu.

## Comprador vira card no ClickUp

Quando uma venda é **paga**, o comprador vira card na lista 🤑 CRM:

- 🔻 Funil `WO PAGO`, 🛒 Produto `AE`, status `leads de entrada`
- tag **`wo-pago-09-09`** — ela nomeia a EDIÇÃO do workshop; a próxima turma
  precisa de tag nova, trocada em `functions/api/webhooks/_greenn-clickup.js`
- as UTMs da visita que gerou a compra, casadas pelo `sf_trk`
- um comentário com venda, método, taxa e líquido

Só venda paga. Reembolso, recusa e abandono não criam card.

**Se o comprador já era lead**, o card dele NÃO tem o funil trocado — só ganha a
tag e o comentário. A origem original dele continua valendo.

**O campo 💰 Arrecadado nunca é preenchido.** Ele é lido por
`functions/webhook/clickup.js` quando um card entra em `contrato assinado`, e
registraria a venda da Greenn na Receita e no ROAS do negócio antigo. O valor vai
para 💵 Valor.

### Vendas que não viraram card

    npx wrangler d1 execute tracking-ae-db --remote \
      --command "SELECT id, entity_id, datetime(received_at,'unixepoch','-3 hours') AS recebido FROM greenn_webhook_event WHERE event='saleUpdated' AND current_status='paid' AND clickup_task_id IS NULL;"

Lista vazia significa que todas as vendas pagas viraram card. Não há retry
automático: o `raw_json` guardado permite recriar qualquer uma à mão.

## Limites conhecidos

- **Sem HMAC.** O `X-Webhook-Token` é o único fator de autenticação. Quem
  descobrir o token pode forjar eventos.
- **`oldStatus` não é confiável.** A doc da Greenn avisa que ele pode vir igual
  ao `currentStatus`. Use sempre `currentStatus`.
- **`productMetas` e `proposalMetas` mudam de tipo** — `[]`, `{}` ou objeto
  preenchido. A ingestão não os lê; quem for consumir o `raw_json` precisa
  tratar os três formatos.
