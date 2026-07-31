# 179: Registrar cada clique no /links

**Tipo:** Implementação
**Página:** Rota pública /links

## Descrição

Gravar em `short_link_clicks` um registro por acesso (destino que serviu, data/hora, dia local em -03:00, UTMs, user-agent e IP), sem nunca atrasar nem quebrar o redirect em caso de falha.

## Cenários

### Happy Path
O clique é redirecionado imediatamente e o `INSERT` roda em segundo plano via `context.waitUntil()`, sem somar latência à resposta.

### Edge Cases
- **Nenhum destino cadastrado:** o clique ainda é gravado, com `link_id` NULL — perder o registro esconderia justamente o caso que precisa de conserto.
- **Sem UTMs na URL:** colunas gravadas vazias.
- **User-agent ausente:** grava vazio, não falha.

### Cenário de Erro
Falha no `INSERT` é engolida (o `waitUntil` não pode derrubar a resposta). O visitante já foi redirecionado — contagem é secundária ao redirect funcionar.

## Banco de Dados

Escreve em `short_link_clicks` (criada na issue 176).

## Arquivos

- **Modificar:** `functions/links.js` — gravar o clique antes de devolver o 302.

## Código reutilizável

- `diaLocalDeUnix()` de `functions/api/webhooks/_classificar.js` — importar em vez de recalcular o fuso. Já é a função usada por `whatsapp_group_events` e é coberta por teste.
- `cf-connecting-ip` como fonte do IP — mesmo header usado em `functions/_middleware.js`.

## Checklist

- [x] Importar `diaLocalDeUnix` de `./api/webhooks/_classificar.js`
- [x] Gravar `link_id`, `occurred_at`, `day_local`, UTMs, `user_agent` e `ip`
- [x] Usar `context.waitUntil()` para não atrasar o redirect
- [x] Engolir falha de escrita sem afetar a resposta
- [x] Gravar o clique mesmo quando não há destino cadastrado (`link_id` NULL)
