# 383: Campanhas agendadas

**Tipo:** Implementação
**Página:** Dash › E-mail › Campanhas (spec `spec-email-proprio.md`, módulos 5 e 6)

## Descrição

Agendar campanha para data e hora, editar ou cancelar antes do horário, e envio automático no horário pelo cron, recalculando o segmento na hora (entra quem chegou depois, sai quem se descadastrou).

## Pronto quando

A usuária agenda uma campanha para daqui a alguns minutos, edita, cancela outra, e vê a agendada sair sozinha no horário com a lista recalculada.

> **Notas do plano:**
> - **Horário:** a data e a hora vão para o servidor como "dia" e "hora" de Brasília, e o servidor converte (mesmo helper de data do dash). A agendada sai na primeira rodada depois do horário. Para sair pontual, a rodada das campanhas na VPS passa de 5 minutos para **1 minuto** (quando não há nada a fazer, são duas consultas leves).
> - **Bloqueios na hora de sair:** dá para agendar com o marketing marcado como não liberado (o protótipo aprovado já previa isso). Na hora do envio, o servidor confere tudo de novo (marketing liberado, chave, modelo, lista não vazia, limite do mês). Se algo barrar, a campanha vira "falhou" com o motivo, sem sair nada.
> - **Travas que a 378 e a 381 deixaram prontas:** modelo usado em campanha agendada não pode ser arquivado nem trocar de canal; segmento usado em campanha agendada não pode ser excluído. As duas passam a valer aqui.

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Campanhas:** `functions/api/_email-campanhas.js` (382): `disparar()` já faz a troca única de situação, recalcula a lista de ativos e grava os destinatários; `processarEnvio()` manda os lotes; `resumo()` traz quem recebe, quem fica de fora e o bloqueio. O começo do envio passa a servir aos dois caminhos (rascunho → enviando, agendada → enviando).
- **Rodada:** `functions/api/sync/email-campanhas.js` (382) e o script da VPS `/root/scripts/email-campanhas-sync/sync.sh`.
- **Data de Brasília:** `inicioDoDiaBrt()` de `functions/api/_data-brt.js` + hora e minuto.
- **Travas:** `consultasDeUso` em `functions/api/_email-modelos.js` (378) e em `functions/api/_email-segmentos.js` (381).
- **Tela:** formulário e lista da 382 em `public/dash/email-mkt.js`; o protótipo aprovado (`formCampanha` da 375) já tinha "Agora" ou "Agendar para data e hora", "Revisar e agendar", "Editar" e "Cancelar envio" na lista e no detalhe, e o texto "o segmento é recalculado na hora do envio".

### Pesquisa externa

- Nenhuma. O Postmark não agenda envio: o horário é controlado pelo dash.

## Cenários

### Happy Path

1. No formulário da campanha, a usuária escolhe "Agendar para data e hora", informa dia e hora (Brasília) e clica em "Revisar e agendar".
2. O resumo mostra quantos receberiam agora e avisa que a lista é recalculada na hora do envio. "Agendar para 20/10 às 09:00" pede confirmação.
3. O servidor valida (modelo, segmentos, horário no futuro) e troca rascunho → agendada, com `agendada_para`.
4. Na lista, a campanha aparece "Agendada" com o horário; no detalhe e na engrenagem há "Editar" e "Cancelar envio".
5. **Editar** antes do horário: muda nome, modelo, segmentos e horário (continua agendada).
6. **Cancelar** antes do horário: vira "cancelada"; ninguém recebe; dá para duplicar.
7. A rodada (cron a cada 1 minuto) acha a agendada cujo horário chegou, troca agendada → enviando (uma vez só), recalcula a lista (entra quem chegou depois, sai quem se descadastrou) e manda os lotes como no disparo da 382.

### Edge Cases

- **Horário no passado ou a menos de 5 minutos:** recusado ("Escolha um horário pelo menos 5 minutos à frente.").
- **Horário a mais de 90 dias:** recusado.
- **Editar ou cancelar depois que a rodada pegou** (já enviando): recusado ("A campanha já começou a sair."). A troca de situação é condicional, então editar e a rodada não se atropelam.
- **Duas rodadas ao mesmo tempo:** só uma troca agendada → enviando.
- **Contato que entrou depois do agendamento:** recebe. **Descadastrado nesse meio tempo:** não recebe.
- **Marketing não liberado, chave ausente, modelo arquivado ou inválido, lista vazia ou acima do limite na hora de sair:** a campanha vira "falhou" com o motivo e nada sai.
- **Modelo usado em campanha agendada:** arquivar ou trocar de canal é recusado ("Este modelo está em uso em: campanha agendada "X"").
- **Segmento usado em campanha agendada:** excluir é recusado.
- **Agendada volta a rascunho?** Não nesta issue: dá para editar ou cancelar e duplicar.
- **Campanha cancelada:** fica no histórico, não se exclui; duplicar cria um rascunho novo.

### Cenário de Erro

- **Falha ao agendar, editar ou cancelar** (validação): 400/409 com a mensagem do servidor na gaveta.
- **Rodada falha no meio:** a próxima rodada continua pelos lotes pendentes (mesma retomada da 382).
- **Campanha inexistente:** 404 "Campanha não encontrada."

## Banco de Dados

Migration `migrations/0056_email_campanhas_agendadas.sql` (só adição):

- Tabela: `email_campanhas`
  - `agendada_para` (INTEGER) — horário do envio (unix), só nas agendadas
  - `cancelada_em` (INTEGER)
  - Índice: `(situacao, agendada_para)`
- Situações novas: `agendada` e `cancelada`.
- Aplicação no remoto com `wrangler d1 execute tracking-ae-db --remote --file migrations/0056_email_campanhas_agendadas.sql`.

## Arquivos

- **Criar:** `migrations/0056_email_campanhas_agendadas.sql` — colunas `agendada_para` e `cancelada_em`.
- **Modificar:** `functions/api/_email-campanhas.js` — `quandoBrt(dia, hora)` (validação do horário); `agendar(env, id, { dia, hora })`; `salvarCampanha` aceita agendada (e reagenda); `cancelar(env, id)`; o começo do envio vira comum a rascunho e agendada; `processarAgendadas(env, t)` (as que chegaram na hora, com os bloqueios conferidos de novo e "falhou" com motivo); `usosEmAgendadas` para modelos e segmentos.
- **Modificar:** `functions/api/email/campanhas.js` — `POST { acao: 'agendar' | 'cancelar' }` e `salvar` com `dia` e `hora` para agendada.
- **Modificar:** `functions/api/sync/email-campanhas.js` — antes dos lotes, `processarAgendadas`.
- **Modificar:** `functions/api/_email-modelos.js` — `consultasDeUso` ganha as campanhas agendadas.
- **Modificar:** `functions/api/_email-segmentos.js` — `consultasDeUso` ganha as campanhas agendadas.
- **Modificar:** `public/dash/email-mkt.js` — no formulário, "Agora" ou "Agendar para data e hora" (dia e hora de Brasília), "Revisar e agendar"; na lista, filtros "Agendada" e "Cancelada", horário na coluna Envio, "Editar" e "Cancelar envio" na engrenagem e no detalhe.
- **Modificar:** `tests/email-campanhas.test.js` — agendar (horário válido, passado, perto demais, longe demais), editar e cancelar antes, recusa depois de começar, rodada dispara no horário com lista recalculada (entra novo, sai descadastrado), bloqueio na hora vira "falhou", duas rodadas juntas disparam uma vez, travas de modelo e segmento.
- **VPS (fora do repositório):** a linha do crontab de `/root/scripts/email-campanhas-sync/sync.sh` passa de `*/5` para `* * * * *` (a cada minuto).

> Não toca: relatório (384), fluxos (385+), `functions/tracker.js`, GHL.

## Dependências Externas

- Nenhuma.

## Checklist

- [ ] Migration `0056_email_campanhas_agendadas.sql` aplicada no D1 remoto com `d1 execute --file`
- [ ] Agendar, editar, cancelar e começo de envio comum no `_email-campanhas.js`
- [ ] Rodada dispara as agendadas no horário, com bloqueios conferidos de novo
- [ ] `POST /api/email/campanhas` com `agendar` e `cancelar`
- [ ] Travas de modelo e segmento valendo para campanha agendada
- [ ] Formulário, lista e detalhe com agendamento
- [ ] Cron das campanhas a cada minuto na VPS
- [ ] Testes `email-campanhas` passando (`npm test`)
- [ ] Usuária agenda uma campanha para daqui a alguns minutos, edita, cancela outra, e vê a agendada sair sozinha no horário com a lista recalculada
