# S2-01: Coleta diária das consultorias do Calendly

**Tipo:** Implementação
**Página:** Coleta diária das consultorias do Calendly
**Spec:** `spec-reunioes-calendly.md`

## Descrição

Uma vez por dia, a VPS busca no Calendly as consultorias "Consultoria Individual" e
guarda uma cópia no banco do dash, com e-mail, quando agendou, quando é a reunião,
situação e se a equipe marcou em nome do lead. Na primeira vez, traz o histórico
desde 01/09/2026.

## Pronto quando

A cópia guardada tem as consultorias do Calendly desde 01/09/2026, atualiza sozinha
toda madrugada e bate com o Calendly (incluindo cancelamentos), sem duplicar ao rodar
de novo.

## Critérios de aceite

- **CA-S2-01** (automática) — A coleta guarda as consultorias do Calendly. Dado um Calendly com consultorias "Consultoria Individual" e um agendamento de outro tipo (ex.: workshop), quando a coleta roda, então a cópia guardada tem uma linha por convidado das consultorias, com e-mail, quando agendou, quando é a reunião, situação e se foi marcada pela equipe; o agendamento do workshop não entra.
- **CA-S2-02** (automática) — Rodar a coleta de novo não duplica. Dado uma coleta já feita, quando a coleta roda outra vez com os mesmos agendamentos, então a cópia guardada continua com o mesmo número de linhas.
- **CA-S2-03** (automática) — Cancelamento no Calendly chega à cópia. Dado uma consultoria guardada como ativa, quando ela é cancelada no Calendly e a coleta roda, então a cópia guardada passa a mostrá-la como cancelada.
- **CA-S2-04** (automática) — Calendly fora do ar não apaga o que já existe. Dado uma cópia guardada com consultorias, quando a coleta roda e o Calendly responde com erro, então a cópia guardada continua igual e a falha fica registrada no log da coleta.
- **CA-S2-05** (manual) — A coleta roda sozinha todo dia. Dado a coleta agendada na VPS, quando passa um dia, então a cópia guardada traz as consultorias agendadas no dia anterior (conferido contra o Calendly).

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S2-01 | "Marcada pela equipe" = o Calendly registra quem agendou em nome do convidado; sem esse registro, foi o próprio lead. | confirmada | Usuária, 19/10/2026. Testado na API em 19/10: 2 de 40 convidados têm o registro, ambos agendados pela conta Atacado Exponencial (anfitriã da consultoria) com "agendar em nome"; os outros 38 não têm |
| SUP-S2-02 | A coleta diária roda de madrugada (ex.: 05h, Brasília) e traz até o fim do dia anterior; o dia de hoje fica sem as reuniões do próprio dia até a próxima coleta. | confirmada | Usuária, 19/10/2026 |
| SUP-S2-03 | A carga inicial traz as consultorias desde 01/09/2026, o bastante para comparar os períodos usados no dash. | confirmada | Usuária, 19/10/2026 |
| SUP-S2-05 | Só o tipo de evento "Consultoria Individual" é reunião comercial; se o nome mudar no Calendly, a coleta precisa ser ajustada. | confirmada | Usuária, 19/10/2026 |
| SUP-S2-06 | A coleta diária olha consultorias com início entre 45 dias atrás e 120 dias à frente: agendamento feito ontem para mais de 120 dias à frente, ou cancelamento de reunião de mais de 45 dias atrás, não seria visto. | confirmada | Usuária, 19/10/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S2-03 | Com que frequência buscar as reuniões no Calendly? | respondida | Uma vez por dia (usuária, 19/10/2026) |

## Cenários

### Happy Path
1. Às 05h (Brasília) o cron da VPS roda `scripts/calendly-sync/sync.mjs`.
2. O coletor pergunta ao Calendly a organização (`/users/me`) e lista os agendamentos com início entre hoje − 45 dias e hoje + 120 dias (ativos e cancelados, todas as páginas).
3. Só os eventos "Consultoria Individual" seguem; para cada um, lê os convidados (todas as páginas).
4. O coletor manda tudo num POST para `/api/sync/calendly` com `x-sync-secret`.
5. O endpoint transforma cada convidado em uma linha (e-mail normalizado, quando agendou, início, situação, marcada pela equipe, remarcada) e grava tudo numa consulta só, atualizando o que já existia.
6. O endpoint responde quantas linhas recebeu; o coletor escreve isso no log.

Carga inicial: a mesma coleta rodada uma vez à mão com `DESDE=2026-09-01`.

### Edge Cases
- Remarcação: o convidado original vira cancelado (com `rescheduled`) e o novo entra como outra linha ativa.
- Evento inteiro cancelado pela equipe: os convidados ficam como cancelados.
- E-mail com maiúscula/espaço: gravado em minúsculas e sem espaço nas pontas.
- Mais de 100 eventos ou convidados: o coletor segue as páginas até o fim.
- Nenhuma consultoria na janela: POST com lista vazia é aceito e não muda nada.

### Cenário de Erro
- Calendly responde erro (token vencido, fora do ar, limite): o coletor para, NÃO manda nada ao endpoint, escreve a falha no log e sai com código 1. A cópia guardada fica como estava.
- Segredo errado no POST: endpoint responde 401 e não grava.
- Corpo inválido (sem a lista de eventos): endpoint responde 400 e não grava.
- O endpoint nunca apaga linhas: só insere ou atualiza.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S2-01 | automática | `tests/calendly-sync.test.js` | Calendly simulado com consultoria (2 convidados, 1 marcado pela equipe) e workshop: a tabela fica com 2 linhas da consultoria com e-mail, agendou_em, início, situação e marcada pela equipe certos; nada do workshop |
| CA-S2-02 | automática | `tests/calendly-sync.test.js` | duas coletas iguais seguidas deixam o mesmo número de linhas |
| CA-S2-03 | automática | `tests/calendly-sync.test.js` | convidado gravado como ativo vira cancelado depois de uma coleta em que o Calendly o devolve cancelado |
| CA-S2-04 | automática | `tests/calendly-sync.test.js` | Calendly respondendo 500: o coletor não chama o endpoint, registra a falha e a tabela continua igual |
| CA-S2-05 | manual | roteiro abaixo | a coleta automática da madrugada trouxe as consultorias do dia anterior |

### Roteiro manual — CA-S2-05
1. No dia seguinte ao deploy, ver o log na VPS: `tail -5 /var/log/tracking-calendly-sync.log`. Deve ter uma linha da madrugada com `ok` e o número de consultorias.
2. No Calendly, contar as "Consultoria Individual" agendadas no dia anterior.
3. Conferir no D1 que essas consultorias estão lá: `SELECT COUNT(*) FROM calendly_consultorias WHERE agendou_em` dentro do dia anterior. Os dois números devem bater.

## Banco de Dados

- Tabela nova: `calendly_consultorias` (migration `migrations/0063_calendly_consultorias.sql`)
  - `invitee_uri` (TEXT, chave) — identificador do convidado no Calendly; é o que impede duplicar
  - `event_uri` (TEXT) — o agendamento a que o convidado pertence
  - `email` (TEXT) — e-mail do convidado, em minúsculas e sem espaço nas pontas
  - `agendou_em` (INTEGER, unix) — quando a pessoa agendou
  - `inicio` (INTEGER, unix) — quando é a reunião
  - `situacao` (TEXT) — `ativa` ou `cancelada`
  - `marcada_pela_equipe` (INTEGER 0/1) — 1 quando a equipe agendou em nome do convidado
  - `remarcada` (INTEGER 0/1) — 1 quando este convidado foi cancelado por remarcação
  - `atualizado_em` (INTEGER, unix) — última coleta que tocou a linha
  - Índice em `agendou_em` (os cards contam pela data em que agendou)
- Aplicar no remoto só este arquivo: `wrangler d1 execute tracking-ae-db --remote --file migrations/0063_calendly_consultorias.sql` (nunca `migrations apply --remote`).

## Arquivos

- **Criar:** `migrations/0063_calendly_consultorias.sql` — tabela e índice acima
- **Criar:** `functions/api/sync/calendly.js` — POST `/api/sync/calendly`: confere `x-sync-secret`, transforma os eventos recebidos em linhas e grava com um único `INSERT … SELECT FROM json_each(?) ON CONFLICT DO UPDATE` (uma consulta só, por causa do limite de consultas por chamada no plano Free)
- **Criar:** `scripts/calendly-sync/coletar.mjs` — busca no Calendly (organização, agendamentos paginados, convidados paginados), só "Consultoria Individual"; recebe `fetch` por parâmetro para o teste
- **Criar:** `scripts/calendly-sync/sync.mjs` — lê o `.env`, calcula a janela (ou `DESDE`), chama o coletor, faz o POST e escreve uma linha no log; erro do Calendly → não posta e sai com 1
- **Criar:** `scripts/calendly-sync/README.md` — instalação na VPS, `.env`, cron e carga inicial (mesmo formato do `workshop-sync`)
- **Criar:** `tests/calendly-sync.test.js` — os testes da tabela Prova, com SQLite real (adaptador `d1` de `tests/_fluxos-banco.js`) e Calendly simulado


Reuso: padrão de auth e de log dos syncs (`functions/api/sync/workshops.js`, `scripts/grupo-conversoes-sync/sync.sh`); paginação do Calendly igual à de `scripts/workshop-sync/collect_calendly.py`; adaptador `d1(db)` de `tests/_fluxos-banco.js`.

Na VPS (fora do repo): copiar `scripts/calendly-sync/` para `/root/scripts/calendly-sync/`, criar o `.env` (CALENDLY_TOKEN, SYNC_SECRET do meta-leads-sync, SYNC_ENDPOINT), rodar a carga inicial e acrescentar a linha do cron preservando o crontab atual (nunca `| crontab -`).

## Dependências Externas

- API v2 do Calendly (`/users/me`, `/scheduled_events`, `/scheduled_events/{uuid}/invitees`) — já usada pelo `workshop-sync`. Sem pacote novo: `fetch` nativo do Node 22 (versão da VPS).

## Checklist

- [x] Migration 0063 com a tabela e o índice
- [x] Endpoint `/api/sync/calendly` (auth, validação, transformação, gravação em uma consulta)
- [x] Coletor `coletar.mjs` com paginação e filtro "Consultoria Individual"
- [x] `sync.mjs` com janela, `DESDE`, POST e log; erro não posta
- [x] README do script
- [x] Testes CA-S2-01 a CA-S2-04
- [x] Aplicar a migration no remoto (só o arquivo 0063)
- [x] Instalar na VPS e agendar o cron das 05h
- [x] Rodar a carga inicial desde 01/09 (feita em 19/10 direto no D1 com a mesma transformação e a mesma consulta do endpoint: 76 consultorias)
