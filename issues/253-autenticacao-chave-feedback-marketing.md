# 253: Autenticação por chave própria do feedback de marketing

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Proteger `GET /api/feedback-marketing` com uma chave própria enviada como credencial da requisição, isolada da chave do dashboard.

## Comportamentos cobertos

- Chave correta: responde com o relatório
- Sem chave ou chave errada: acesso negado, mesma resposta, sem dados
- Chave do dashboard: acesso negado
- Chave própria em outra rota do dashboard ou da API: recusada
- Chave não configurada no servidor: toda consulta recusada
- Chave no endereço da consulta: "Envie a chave como credencial da requisição, não no endereço."
- Método diferente de leitura: método não permitido

## Cenários

### Happy Path
1. O agente chama `GET /api/feedback-marketing` com o cabeçalho `Authorization: Bearer <FEEDBACK_MARKETING_KEY>`.
2. `autorizarFeedbackMarketing` confere a chave em tempo constante contra `env.FEEDBACK_MARKETING_KEY`.
3. Conferiu → o endpoint segue e responde `200` com o relatório.

### Edge Cases
- **Sem cabeçalho, cabeçalho sem `Bearer`, chave errada, chave com um caractere a mais/menos:** `401 { "error": "Acesso negado." }` — corpo idêntico em todos os casos, sem nenhum dado.
- **Esquema `bearer` em minúsculas / espaços extras:** aceito (o esquema HTTP não diferencia caixa); a chave em si é comparada exata.
- **Chave do dashboard (`DASH_KEY`) no cabeçalho:** `401` igual ao de chave errada — só `FEEDBACK_MARKETING_KEY` abre.
- **`FEEDBACK_MARKETING_KEY` igual a `DASH_KEY` (configuração errada):** toda consulta recusada (`401`) — senão a chave do dashboard abriria esta rota e a chave própria abriria o dashboard.
- **Chave própria em outra rota:** as demais rotas só aceitam `DASH_KEY`/`SYNC_SECRET`/slugs próprios; com a guarda acima, a chave própria nunca coincide com elas → recusada. Nenhuma outra rota é alterada.
- **Variável não configurada ou vazia:** toda consulta recusada (`401`), inclusive com cabeçalho — a rota nunca fica aberta por falta de configuração.
- **Chave no endereço** (parâmetro `key`, `chave`, `token`, `access_token` ou `authorization` na query, com qualquer valor): `400 { "error": "Envie a chave como credencial da requisição, não no endereço." }` — mesmo se o cabeçalho estiver certo. Conferido antes de tudo, então a mensagem não revela se a chave estava certa.
- **Comparação em tempo constante:** percorre sempre o maior dos dois tamanhos e acumula a diferença de comprimento, sem retorno antecipado (mesmo cuidado de `tokenConfere` em `webhooks/greenn.js`, mas em JS puro para rodar também no `node --test`, onde `crypto.subtle.timingSafeEqual` não existe).

### Cenário de Erro
- **Método diferente de GET** (POST, PUT, DELETE, PATCH, HEAD...): `405 { "error": "Método não permitido." }` com `Allow: GET`; nada é lido nem alterado. A rota passa a exportar `onRequest` e decide o método ela mesma, em vez de depender do comportamento padrão do Pages.

## Banco de Dados

Não se aplica.

## Arquivos

- **Criar:** `functions/api/_feedback-marketing-auth.js` — puro: `chaveNoEndereco(url)`, `compararEmTempoConstante(a, b)` e `autorizarFeedbackMarketing({ url, authorization }, env)` → `{ ok: true }` ou `{ ok: false, status, corpo }`.
- **Criar:** `tests/feedback-marketing-auth.test.js` — chave certa, sem chave, errada, DASH_KEY, variável ausente/vazia, variável igual à DASH_KEY, chave na query, esquema em minúsculas, comparação em tempo constante.
- **Modificar:** `functions/api/feedback-marketing.js` — troca `onRequestGet` por `onRequest`: 405 para não-GET; aplica `autorizarFeedbackMarketing` antes de montar a resposta.
- **Modificar:** `wrangler.toml.example` — documenta `FEEDBACK_MARKETING_KEY` na lista de variáveis (onde o projeto documenta env vars).

## Dependências Externas

- Variável de ambiente nova `FEEDBACK_MARKETING_KEY` no Cloudflare Pages (produção) — **não criada aqui**; a usuária cadastra depois. Até lá a rota recusa tudo.

## Reuso (pesquisado na base)

- Padrão de comparação sem retorno antecipado de `tokenConfere` (`functions/api/webhooks/greenn.js`), que é privado e usa `crypto.subtle.timingSafeEqual` (indisponível no Node dos testes).
- Helper `json()` dos demais endpoints.

## Checklist

- [x] `_feedback-marketing-auth.js` puro com comparação em tempo constante
- [x] Chave só pelo cabeçalho `Authorization: Bearer`
- [x] Sem chave / chave errada / DASH_KEY → mesma resposta 401 sem dados
- [x] Variável ausente ou vazia → tudo recusado
- [x] Variável igual à DASH_KEY → tudo recusado
- [x] Chave na query → 400 com a mensagem da spec
- [x] Método diferente de GET → 405
- [x] `FEEDBACK_MARKETING_KEY` documentada em `wrangler.toml.example`
- [x] Testes do módulo puro
- [x] `npm test` passando
