# Webhook da Greenn

A Greenn é a plataforma de checkout de um produto **separado** do restante do
tracking. Os eventos dela caem numa tabela isolada (`greenn_webhook_event`) e
não aparecem em nenhuma aba atual do dashboard — isso é intencional.

## URL

    https://atacadoexponencial.com/api/webhooks/greenn

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

Se o token da Greenn não estiver visível no painel dela, cadastre a URL mesmo
assim: o primeiro POST vai levar 401 e o valor aparece no log do Pages, junto
da requisição. Configure o secret e a partir daí os eventos passam a gravar.

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
| Evento desconhecido ou JSON inválido | 200 (registra no log, não grava) |
| Token ausente ou divergente | 401 |
| Falha de escrita no D1 | 500 |

O 200 em evento desconhecido é deliberado: a Greenn não promete reentrega, e um
erro nosso viraria perda de dado dela.

## Conferir se está chegando

    npx wrangler d1 execute tracking-ae-db --remote \
      --command "SELECT id, event, entity_id, current_status, amount, datetime(received_at,'unixepoch','-3 hours') AS recebido FROM greenn_webhook_event ORDER BY id DESC LIMIT 20;"

Tabela vazia significa uma de três coisas: nenhuma venda aconteceu, a URL não
foi cadastrada no produto, ou o token está errado (procure `greenn — token`
nos logs do Pages).

## Recuperar o que se perdeu

A Greenn não reentrega. Se o endpoint ficou fora do ar, as vendas ainda podem
ser recuperadas pela API:

    GET https://apiadm.greenn.com.br/api/v1/sales?filter[created_after]=2026-08-01
    Authorization: Bearer grn_live_...

Não há limite de janela nesse filtro. O que não se recupera é o evento no
instante em que aconteceu.

## Limites conhecidos

- **Sem HMAC.** O `X-Webhook-Token` é o único fator de autenticação. Quem
  descobrir o token pode forjar eventos.
- **`oldStatus` não é confiável.** A doc da Greenn avisa que ele pode vir igual
  ao `currentStatus`. Use sempre `currentStatus`.
- **`productMetas` e `proposalMetas` mudam de tipo** — `[]`, `{}` ou objeto
  preenchido. A ingestão não os lê; quem for consumir o `raw_json` precisa
  tratar os três formatos.
