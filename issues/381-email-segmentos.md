# 381: Segmentos

**Tipo:** Implementação
**Página:** Dash › E-mail › Segmentos (spec `spec-email-proprio.md`, módulo 5)

## Descrição

Montador de segmentos por regra (funil, origem, data de entrada, estágio no CRM, abriu/clicou em campanha), com contagem ao vivo de ativos, amostra, duplicar e excluir (bloqueado se ligado a campanha agendada).

## Pronto quando

A usuária monta um segmento "leads do workshop gratuito nos últimos 30 dias", vê a contagem mudar enquanto ajusta a regra, confere a amostra, e só contatos ativos entram na conta.

> **Nota do plano:** as condições "abriu campanha" e "clicou em campanha" dependem de campanhas enviadas, que só existem a partir da 382. Aqui a regra já é avaliada pelo servidor (pelos envios de origem `campanha`), mas a lista de campanhas começa vazia e essas duas condições só aparecem no montador quando houver campanha enviada. A trava de excluir segmento "ligado a campanha agendada" segue o mesmo caminho da trava de modelos (378): a regra existe e é testada aqui, e a 383 liga as campanhas agendadas a ela.

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Contatos:** `email_contatos` e `email_contatos_entradas` (380). Funil pela entrada (qualquer formulário que a pessoa preencheu), origem e data de entrada pelo contato. Só `situacao = 'ativo'` conta.
- **Estágio no CRM:** mesma leitura da aba Leads (`functions/api/leads.js`): último status do card em `crm_status_log` (ordem `COALESCE(hist_date, recebido_em) DESC, id DESC`), card achado pelo e-mail em `lead_dispatch.task_id`. Estágios reais gravados hoje: leads de entrada, qualificação, reunião, desqualificado, proposta/negociação, nutrição, contrato, contrato assinado e outros poucos.
- **Origem:** códigos de `CANAIS` em `functions/api/_canal.js` (meta-ads, bio, manychat, email, outro, direto); a tela mostra os mesmos rótulos da vista Contatos.
- **Abriu/clicou:** `email_envios` (`origem = 'campanha'`, `ref_id` = campanha, `aberto_em`, `clicado_em`), gravado pelo webhook da 377.
- **Trava de uso:** mesmo padrão de `consultasDeUso` em `functions/api/_email-modelos.js`.
- **Endpoint e testes:** padrão de `functions/api/email/contatos.js` e `tests/email-contatos.test.js` (380).
- **Tela:** protótipo aprovado em `public/dash/email-mkt.js` (`segmentos` e `montador`): lista com nome, regra resumida e ativos agora; gaveta larga com condições "quem … e …", contagem ao vivo e amostra. As vistas que ainda são protótipo (campanhas, fluxos) seguem com os dados de exemplo.
- **D1:** a contagem ao vivo roda a cada ajuste da regra. Para não repetir o histórico de estouro de leitura, a consulta do estágio no CRM só entra quando a regra usa estágio, e o dash espera 400 ms parado antes de pedir a contagem.

### Pesquisa externa

- Nenhuma. Tudo é consulta ao D1.

## Cenários

### Happy Path

1. A usuária abre Marketing › E-mail › Segmentos: lista com nome, regra resumida e contatos ativos agora (calculados na hora).
2. Clica em "Novo segmento": gaveta com nome e a primeira condição ("quem funil é Workshop gratuito").
3. Acrescenta "e data de entrada nos últimos 30 dias". A cada mudança, o dash pede `POST { acao: 'previa', regras }` e mostra "N contatos ativos com essa regra · mais M fora do marketing" e a amostra dos 10 primeiros ativos (nome, e-mail, funil, entrada).
4. Salva. O servidor valida e grava; a lista mostra o segmento novo com a contagem.
5. Duplica um segmento: nasce "Cópia de …" com a mesma regra.
6. Exclui um segmento que não está em campanha agendada: confirmação na linha e some da lista.
7. No detalhe do contato (380), aparece "Segmentos em que está".

### Edge Cases

- **Regra vazia:** pega todos os contatos ativos ("todos os contatos").
- **Funil "não é":** quem nunca preencheu formulário daquele funil (nenhuma entrada com ele).
- **Funil "é":** basta uma entrada com aquele funil, mesmo que não seja a primeira.
- **Data de entrada:** "nos últimos N dias" e "há mais de N dias", contados da hora da consulta (7, 15, 30, 60 ou 90 dias). A contagem muda sozinha com o tempo: é recalculada a cada abertura e, na 382, na hora do disparo.
- **Estágio no CRM "não é":** inclui quem não tem card (não está naquele estágio).
- **Contato sem card no CRM** com "estágio é X": fica de fora.
- **Duas condições iguais** (funil é A e funil é B): vale o "e", e o resultado é quem preencheu os dois funis.
- **Nome repetido:** recusado ("Já existe um segmento com esse nome").
- **Condição inválida** (campo, comparação ou valor fora da lista; mais de 10 condições): 400 com a mensagem do servidor.
- **Abriu/clicou sem campanha enviada:** a condição não aparece no montador; se chegar ao servidor, é recusada ("Ainda não há campanha enviada para usar nesta condição.").
- **Segmento em campanha agendada:** excluir é recusado com "Este segmento está na campanha agendada …" (a lista vem da 383; aqui a regra existe e é testada).
- **Duplo clique em salvar:** botão trava enquanto a chamada corre.

### Cenário de Erro

- **Falha ao contar** (D1): a contagem mostra "Não foi possível contar agora." e o salvar continua possível.
- **Segmento inexistente:** 404 "Segmento não encontrado."
- **Falha no banco ao salvar:** mensagem genérica e nada gravado pela metade (uma escrita só).

## Banco de Dados

Migration `migrations/0054_email_segmentos.sql` (só adição):

- Tabela: `email_segmentos`
  - `id` (INTEGER, PK)
  - `nome` (TEXT, único)
  - `regras_json` (TEXT) — lista de `{ campo, op, valor }`
  - `criado_em`, `atualizado_em` (INTEGER)
- Aplicação no remoto com `wrangler d1 execute tracking-ae-db --remote --file migrations/0054_email_segmentos.sql`.

## Arquivos

- **Criar:** `migrations/0054_email_segmentos.sql` — tabela `email_segmentos`.
- **Criar:** `functions/api/_email-segmentos.js` — campos e comparações aceitos; `validarRegras(env, regras)`; `sqlDasRegras(regras, agora)` (monta o WHERE sobre `email_contatos`, com o estágio do CRM só quando a regra usa); `contar(env, regras)` (ativos e fora do marketing); `amostra(env, regras)`; `contatosDoSegmento(env, regras)` (a lista na hora do disparo, para a 382); `opcoes(env)` (funis, origens, estágios, campanhas enviadas); `segmentosDoContato(env, contatoId)`; salvar, duplicar e excluir; `consultasDeUso` e `usosDoSegmento` (trava de campanha agendada, vazia até a 383).
- **Criar:** `functions/api/email/segmentos.js` — `GET` (segmentos com ativos agora e opções do montador) e `POST { acao: 'salvar' | 'previa' | 'duplicar' | 'excluir' }`, protegido por `DASH_KEY`.
- **Modificar:** `functions/api/email/contatos.js` — o detalhe (`?id=`) devolve também `segmentos` (os segmentos em que o contato está agora).
- **Modificar:** `public/dash/email-mkt.js` — vista `segmentos` e montador ligados ao backend (lista, contagem ao vivo com espera de 400 ms, amostra, salvar, duplicar, excluir), sem selo de protótipo; "Segmentos em que está" no detalhe real do contato. O `montador` e os `D.segmentos` do protótipo continuam só para as vistas de exemplo (campanhas, fluxos).
- **Criar:** `tests/email-segmentos.test.js` — cada condição (funil é/não é pela entrada, origem, entrada nos últimos/há mais de, estágio é/não é com e sem card, abriu/clicou pelos envios), só ativos na conta, amostra, regra vazia, validação, nome repetido, duplicar, excluir com trava simulada, opções do montador, segmentos do contato.

> Não toca: campanhas (382/383), fluxos (385+), `functions/tracker.js`.

## Dependências Externas

- Nenhuma.

## Checklist

- [ ] Migration `0054_email_segmentos.sql` aplicada no D1 remoto com `d1 execute --file`
- [ ] `_email-segmentos.js` com validação, SQL das regras, contagem, amostra, lista para o disparo, opções, trava e segmentos do contato
- [ ] `GET/POST /api/email/segmentos`
- [ ] Segmentos no detalhe do contato
- [ ] Vista Segmentos e montador ligados ao backend
- [ ] Testes `email-segmentos` passando (`npm test`)
- [ ] Usuária monta "leads do workshop gratuito nos últimos 30 dias", vê a contagem mudar enquanto ajusta a regra, confere a amostra, e só ativos entram na conta
