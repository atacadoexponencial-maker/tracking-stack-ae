# S6-01: Etapas do formulário gravadas com nome (novas e histórico)

**Tipo:** Implementação
**Página:** Chat de inscrição, formulário de aplicação em cartão, registro das etapas e histórico
**Spec:** `spec-etapas-com-nome.md`

## Descrição

O chat e o formulário em cartão passam a mandar o nome de cada etapa concluída junto com a posição, o backend guarda esse nome, e uma carga única dá nome às etapas já gravadas pela ordem que cada formulário tinha na época.

## Pronto quando

No banco de produção, toda etapa concluída nova chega com o nome da pergunta (ex.: "cargo"), e as etapas antigas do chat e do cartão já têm nome; a contagem de etapas sem nome é zero ou explicada.

## Critérios de aceite

- **CA-S6-01** (automática) — Responder uma pergunta do chat registra o nome dela. Dado uma pessoa no chat de inscrição, quando ela responde a pergunta do cargo, então a etapa concluída fica registrada com o nome "cargo", e não só com a posição.
- **CA-S6-02** (automática) — Pergunta nova sem nome é barrada antes de ir ao ar. Dado alguém que acrescenta uma pergunta ao chat sem dar nome a ela, quando os testes do projeto rodam, então um teste falha dizendo qual pergunta está sem nome.
- **CA-S6-03** (automática) — Nomes repetidos no mesmo formulário são barrados. Dado duas perguntas do chat com o mesmo nome, quando os testes do projeto rodam, então um teste falha apontando o nome repetido.
- **CA-S6-04** (automática) — Avançar um cartão registra o nome dele. Dado uma pessoa no formulário de aplicação, quando ela conclui o cartão 1 e depois o cartão 2, então as duas etapas ficam registradas com os nomes "contato" e "perfil", respectivamente.
- **CA-S6-05** (automática) — O nome da etapa fica guardado. Dado uma etapa concluída que chega com nome e posição, quando ela é registrada, então o registro guarda o nome e a posição.
- **CA-S6-06** (automática) — Nome inválido não derruba a etapa. Dado uma etapa que chega com nome vazio, longo demais (mais de 40 caracteres) ou com caracteres fora de letras minúsculas, números e hífen, quando ela é registrada, então a etapa é guardada com a posição e sem nome, como acontecia antes desta mudança.
- **CA-S6-07** (automática) — Etapa antiga do chat ganha o nome certo. Dado uma etapa 6 do chat gravada antes de 05/11 20h32, quando a carga do histórico roda, então ela passa a se chamar "desafio".
- **CA-S6-08** (automática) — Etapa do chat entre a pergunta nova e esta mudança ganha o nome certo. Dado uma etapa 6 e uma etapa 7 do chat gravadas depois de 05/11 20h32 e antes desta mudança no ar, quando a carga do histórico roda, então elas passam a se chamar "cargo" e "desafio".
- **CA-S6-09** (automática) — Etapa antiga do cartão ganha o nome certo. Dado etapas 1 e 2 do formulário em cartão gravadas antes desta mudança, quando a carga do histórico roda, então elas passam a se chamar "contato" e "perfil".
- **CA-S6-10** (manual) — Depois da carga, nenhuma etapa conhecida fica sem nome. Dado o banco de produção depois da carga do histórico, quando se conta quantas etapas concluídas estão sem nome, então o número é zero, ou as que sobraram são explicadas uma a uma (ex.: página que não tem chat nem cartão).

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S6-01 | Os nomes internos das etapas são: chat = nome, whatsapp, email, instagram, faturamento, cargo, desafio; cartão = contato, perfil. No dash aparecem como "responderam o …" (chat) e "preencheram o contato / o perfil" (cartão). | confirmada | Usuária, 05/11 (aprovação da spec) |
| SUP-S6-02 | A ordem do chat antes de 05/11 20h32 foi sempre a mesma desde que as etapas começaram a ser medidas (31/08). | confirmada | Histórico do Git (05/11): de 31/08 até 93078bd o chat só mudou o texto da pergunta do desafio (7a15faf, 16/10), não a ordem; o cartão ganhou a folha de rosto (470bee8), que não é etapa |
| SUP-S6-03 | O corte da carga do histórico é o horário do commit 93078bd (05/11 20h32 BRT). Quem abriu a página antes do deploy e respondeu depois pode cair do lado errado do corte; são poucos casos e ficam aceitos. | confirmada | Usuária, 05/11 (aprovação da spec) |

## Perguntas em aberto

Nenhuma.

## Cenários

### Happy Path
1. A pessoa responde a pergunta do cargo no chat. O chat chama `enviarFormStep(6, { funnel, nome: 'cargo' })`.
2. O evento `FormStep` vai ao `/tracker` com `step: 6` e `step_nome: 'cargo'`.
3. O `/tracker` valida o nome e grava `step = 6` e `step_nome = 'cargo'` na `event_log`.
4. No formulário em cartão, avançar do cartão 1 manda `step: 1, step_nome: 'contato'`; do cartão 2, `step: 2, step_nome: 'perfil'`. O nome sai do atributo `data-etapa-nome` do cartão.
5. Depois do deploy, a carga do histórico preenche `step_nome` das linhas antigas que estão sem nome.

### Edge Cases
- Página aberta antes do deploy (JS antigo) manda `FormStep` sem `step_nome`: grava só a posição; a carga do histórico, rodada depois do deploy, dá o nome.
- Linha do chat gravada antes de 20h32 de 05/11 (timestamp < 1793921561): ordem antiga, 6 = desafio. Depois do corte: 6 = cargo, 7 = desafio.
- Funil que não é do chat (`sessao-estrategica`, `diagnostico`) nem do cartão (`aplicacao-mentoria`, `trafego-atacado`, `iscas-manychat`): a carga não mexe; fica sem nome. Em produção, em 05/11, só esses funis têm `FormStep`.
- Carga rodada duas vezes: só atualiza linhas com `step_nome IS NULL`, então a segunda rodada não muda nada.

### Cenário de Erro
- `step_nome` vazio, com mais de 40 caracteres ou com caractere fora de `[a-z0-9-]`: grava `step_nome = NULL` e mantém a posição; o evento não é recusado.
- Se a coluna não existir no banco quando o código novo entrar no ar, o INSERT da `event_log` falha para TODOS os eventos. Por isso a coluna vai ao remoto antes do push (checklist).

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S6-01 | automática | `tests/etapas-com-nome.test.js` | a pergunta do cargo no chat tem o nome "cargo" e o envio da etapa leva esse nome no evento (`step_nome`) junto da posição |
| CA-S6-02 | automática | `tests/etapas-com-nome.test.js` | a conferência dos nomes do chat aponta a pergunta sem nome, e todas as perguntas reais do chat têm nome |
| CA-S6-03 | automática | `tests/etapas-com-nome.test.js` | a conferência aponta o nome repetido, e o chat real não tem nomes repetidos |
| CA-S6-04 | automática | `tests/etapas-com-nome.test.js` | os cartões 1 e 2 do formulário se chamam "contato" e "perfil" e o avanço do cartão manda esse nome |
| CA-S6-05 | automática | `tests/etapas-com-nome.test.js` | um `FormStep` com `step: 6, step_nome: 'cargo'` passa pelo `/tracker` e a linha da `event_log` tem os dois |
| CA-S6-06 | automática | `tests/etapas-com-nome.test.js` | nome vazio, com 41 caracteres ou com maiúscula/espaço vira `step_nome` nulo e a posição continua gravada |
| CA-S6-07 | automática | `tests/etapas-com-nome.test.js` | a carga (`migrations/0069_backfill_step_nome.sql` num SQLite de teste) dá "desafio" à etapa 6 do chat antes do corte |
| CA-S6-08 | automática | `tests/etapas-com-nome.test.js` | a carga dá "cargo" à etapa 6 e "desafio" à 7 depois do corte |
| CA-S6-09 | automática | `tests/etapas-com-nome.test.js` | a carga dá "contato" e "perfil" às etapas 1 e 2 dos funis do cartão |
| CA-S6-10 | manual | roteiro abaixo | contagem de etapas sem nome no banco de produção depois da carga |

### Roteiro manual — CA-S6-10
1. Depois do deploy e da carga, rodar no banco de produção: `SELECT funnel, step, COUNT(*) FROM event_log WHERE event_name = 'FormStep' AND step_nome IS NULL GROUP BY funnel, step`.
2. Ver zero linhas, ou cada linha que sobrou explicada (funil sem chat nem cartão).
3. Rodar `SELECT funnel, step, step_nome, COUNT(*) FROM event_log WHERE event_name = 'FormStep' GROUP BY 1,2,3` e ver no chat 6 = desafio (antes de 05/11) e 6 = cargo / 7 = desafio (depois).

## Banco de Dados

- Tabela: `event_log`
  - `step_nome` (TEXT, NULL) — nome da etapa concluída (`cargo`, `desafio`, `contato`…). NULL fora do `FormStep` e quando o nome chega inválido.

## Arquivos

- **Criar:** `migrations/0068_event_log_step_nome.sql` — acrescenta a coluna `step_nome`.
- **Criar:** `migrations/0069_backfill_step_nome.sql` — carga única: nomes do histórico por funil, posição e corte de 05/11 20h32 (só onde `step_nome IS NULL`).
- **Criar:** `functions/_etapa-nome.js` — função pura `nomeDeEtapa(valor)`: devolve o nome válido (`^[a-z0-9-]{1,40}$`) ou `null`. Mesmo formato de `functions/_fbc.js`.
- **Criar:** `src/scripts/etapas-nome.ts` — função pura `conferirNomesDasEtapas(lista)`: devolve os problemas (pergunta sem nome, nome repetido). Usada pelo teste.
- **Criar:** `tests/etapas-com-nome.test.js` — testes de CA-S6-01 a CA-S6-09.
- **Modificar:** `src/scripts/funil.ts` — `enviarFormStep` aceita `nome` e manda `step_nome`.
- **Modificar:** `src/components/LeadChat.astro` — cada pergunta ganha `etapa` (nome, whatsapp, email, instagram, faturamento, cargo, desafio, objetivo) e `anunciarEtapa` passa o nome.
- **Modificar:** `src/components/AplicacaoForm.astro` — cartões 1 e 2 ganham `data-etapa-nome` ("contato", "perfil") e o `avancar` passa o nome.
- **Modificar:** `functions/tracker.js` — lê `body.step_nome` com `nomeDeEtapa` só no `FormStep` e grava na coluna nova.

Reuso: `enviarEventoInterno` (funil.ts) segue sendo o único envio; `d1()` + `node:sqlite` nos testes, no padrão de `tests/agenda-tracker.test.js`; `onRequestPost` do tracker chamado direto, como lá.

## Checklist

- [x] Criar `migrations/0068_event_log_step_nome.sql` e `migrations/0069_backfill_step_nome.sql`
- [x] Criar `functions/_etapa-nome.js` e ligar no `functions/tracker.js` (coluna no INSERT)
- [x] `enviarFormStep` com nome em `src/scripts/funil.ts`
- [x] Nomes no `LeadChat.astro` e no `AplicacaoForm.astro`
- [x] Criar `src/scripts/etapas-nome.ts`
- [x] Testes em `tests/etapas-com-nome.test.js` e suíte inteira verde
- [x] Aplicar `0068` no remoto (`wrangler d1 execute tracking-ae-db --remote --file`) ANTES do push
- [x] Aplicar `0069` no remoto antes do commit (cobre o histórico até agora; 1.850 linhas em 05/11)
- [x] Rodar as contagens do roteiro do CA-S6-10 e mostrar à usuária

## Observações para o plano

- Depois do commit e do deploy, rodar a `0069` de novo no remoto: ela só toca linha sem nome, então cobre os `FormStep` gravados entre a primeira carga e o deploy (JS antigo), sem mexer no resto. (Ajuste do plano pela lição L-02: tudo que dava para fazer antes do commit foi feito antes.)

- A carga do histórico depende da coluna nova já existir no banco remoto: planejar a ordem (coluna no remoto → deploy → carga) para o checklist não travar o auditor. A carga do intervalo "depois de 20h32 e antes desta mudança" precisa rodar depois do deploy desta issue, para não deixar buraco.
- Migration no remoto só com `wrangler d1 execute --remote`, nunca `migrations apply --remote`.

## Testes manuais

| Critério | Conferido por | Dia |
|---|---|---|
| CA-S6-10 | Marcelle | 06/11/2026 |
