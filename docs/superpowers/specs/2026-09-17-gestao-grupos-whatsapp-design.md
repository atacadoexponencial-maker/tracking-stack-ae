# Gestão de grupos de WhatsApp — agenda de ações

**Data:** 2026-09-17
**Status:** desenho aprovado, pronto para plano de implementação
**Escopo desta spec:** Fase 1 (mensagem e renomear agendados). As fases 2 a 4
estão descritas no fim, sem detalhamento, para justificar as escolhas de
estrutura — não fazem parte da entrega.

## Problema

A aba "Grupos" só **observa**: conta entradas e saídas desde julho e mostra o
estado da conexão. Toda ação continua manual, dentro do WhatsApp, na mão.

A rotina da semana da live é sempre a mesma: renomear a Comunidade com a data e
o tema, mandar o aviso quando a live começa, mandar o lembrete no dia seguinte.
Três tarefas em horários fixos que hoje dependem de alguém lembrar e estar
disponível na hora.

## Objetivo

Preparar a semana inteira de uma vez: uma agenda onde cada linha é uma ação com
hora marcada, executada sozinha quando chega a hora, visível e cancelável até
lá.

## Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde mora | Dentro do tracking | Escopo é só a operação do Atacado Exponencial: um número, uma instância. O gateway próprio (`whatsapp-gateway`, Baileys, Parte A concluída) exclui grupos do escopo e exigiria plugar o número em uma segunda sessão Baileys — mais superfície de queda no número que não pode cair |
| Provedor | Evolution API (a instância que já existe) | Escolha da usuária: número antigo, conexão estável. Contraria a orientação de "não usar Evolution em features novas" — por isso toda a conversa com ela passa por **um** arquivo |
| API oficial | Descartada | A Groups API da Cloud API (jun/2026) tem teto de **8 participantes por grupo** e não tem `POST /participants`. Não serve para grupo de audiência. Vale revisitar se o teto mudar |
| Agendamento | Tabela no D1 + cron da VPS | Cloudflare **Pages** não tem Cron Triggers (só Workers). Sete syncs já rodam assim; um oitavo padrão não traria ganho |
| Modelo de dados | Fila de **ações**, não de mensagens | Renomear e enviar são a mesma coisa com hora marcada. Tipos futuros (trancar, revogar link) entram sem tabela nova |
| Alvo da ação | Só grupos de `whatsapp_groups_tracked` | Trava contra o pior erro possível: mandar o aviso no grupo errado |
| Ao vencer a hora | Sai sozinha, cancelável até o minuto anterior | Confirmação na hora deixa de ser agendamento — se ninguém estiver na frente do computador, não sai |
| Reenvio automático | **Nunca**, para mensagem | Retentar envio para centenas de pessoas é como o risco de duplicata vira dano real |

## Restrição dura: nada que está no ar pode cair

Três consequências concretas:

1. **O webhook da Evolution não se mexe.** A Evolution aceita **uma** URL por
   instância, e ela aponta para o n8n; o tracking recebe por fan-out. Repontar
   derruba junto o monitor de mensagens de clientes. Esta feature só faz
   chamadas HTTP **de saída** para a Evolution.
2. **Nada de `d1 migrations apply --remote`** neste projeto — as migrations
   0021/0022/0025 quebram ao reaplicar. A tabela nova entra por SQL direto no
   remoto, como as últimas.
3. **Arquivos novos, não reescrita.** `grupos.js` e `grupos-conexao.js`
   sustentam a aba viva e não são tocados; ganham vizinhos.

## Arquitetura

```
Painel (aba Grupos) ──POST /api/grupos-acoes──▶ D1  (status=agendada)
                                                 ▲
cron VPS (5/5 min) ──POST /api/sync/grupo-acoes──┘
                       │
                       ▼
              _grupos-acoes.js   (executor: uma ação → um resultado)
                       │
                       ▼
            _evolution-grupos.js (ÚNICA porta para a Evolution)
                       │
                       ▼
                    Evolution
```

O botão **"fazer agora"** do painel entra pelo mesmo executor. Um caminho de
código, dois gatilhos: o que se testa clicando é o que roda às 12h.

### Arquivos

| Arquivo | Papel |
|---|---|
| `functions/api/_evolution-grupos.js` | Única porta para a Evolution. `enviarTexto`, `renomear`, `participantes`, `linkConvite`. Timeout 5s, erro tipado, apikey nunca sai do servidor |
| `functions/api/_grupos-acoes.js` | Executor: reserva a ação, chama a fronteira, grava o resultado. Sem HTTP, sem autenticação — lógica pura, testável |
| `functions/api/grupos-acoes.js` | `GET` (agenda + histórico), `POST` (agendar), `POST ?acao=cancelar`, `POST ?acao=agora`. Autenticado por `DASH_KEY` |
| `functions/api/sync/grupo-acoes.js` | Chamado pelo cron. Autenticado por `x-sync-secret` |
| `src/...` (aba Grupos) | Três blocos novos na aba existente |

### Tabela `whatsapp_group_actions` (migration `0043`)

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | INTEGER PK | |
| `group_jid` | TEXT NOT NULL | precisa existir em `whatsapp_groups_tracked` com `enabled=1` |
| `tipo` | TEXT NOT NULL | `mensagem` \| `renomear` |
| `payload` | TEXT NOT NULL | JSON. `mensagem`: `{texto}`. `renomear`: `{titulo, aplicar_no_par}` |
| `agendada_para` | TEXT NOT NULL | ISO 8601 **UTC**. Exibido em BRT (`_data-brt.js`) |
| `status` | TEXT NOT NULL | `agendada` \| `executando` \| `concluida` \| `falhou` \| `cancelada` |
| `tentativas` | INTEGER NOT NULL DEFAULT 0 | |
| `erro` | TEXT | motivo legível quando `falhou` |
| `criada_em` / `executada_em` | TEXT | |

Índice: `(status, agendada_para)` — é a única consulta quente (o cron varrendo
vencidas). Sem ele, cada passada do cron lê a tabela inteira, que é exatamente
o tipo de varredura que já estourou o limite de leitura do D1 duas vezes neste
projeto.

Nenhuma tabela de grupos nova: a allowlist continua sendo
`whatsapp_groups_tracked`.

## Regras de execução

Quatro regras carregam o risco da feature inteira.

**1. Trava de corrida.** A reserva é
`UPDATE ... SET status='executando' WHERE id=? AND status='agendada'`. Zero
linhas afetadas significa que outra passada já pegou — o executor desiste em
silêncio. Sem isso, um cron lento sobrepondo o seguinte manda a mensagem duas
vezes.

**2. Ação vencida não sai.** Passados **30 minutos** da hora marcada, a ação
não dispara: vai para `falhou` com `erro = "atrasada"`. Um aviso de live
chegando quatro horas depois é pior que não chegar. Os 30 minutos são
constante nomeada no executor.

**3. Mensagem não se retenta.** Falhou, fica vermelha no painel e a decisão é
humana. `renomear` **pode** ser retentado — é idempotente — com teto de 3
tentativas.

**4. Falha grita.** Alerta no Slack pelo caminho já existente
(`_saude-alertas.js`). ⚠️ **O webhook do Slack ainda não foi cadastrado pela
usuária** (pendente desde 16/09) — sem ele o alerta não chega a ninguém. Sem o
webhook, a feature entrega, mas o único aviso de falha é o vermelho no painel.

## Painel — aba "Grupos"

Três blocos abaixo do que já existe. O card de conexão e o gráfico não mudam.

**Agenda** — o que vai acontecer, em ordem de hora, com `cancelar` enquanto
`agendada`. Não existe "editar": editar é cancelar e agendar de novo, com o
formulário já preenchido. Menos código, menos estado, e o histórico continua
contando a verdade do que foi programado.

```
qua 24/09  09:00   Renomear   "24/09 às 12h | O jogo da escala"
qua 24/09  12:00   Mensagem   "Começou! Entra aqui: …"
qui 25/09  11:00   Mensagem   "Último dia pra ver a gravação…"
```

**Agendar** — grupo (só os monitorados), tipo, o campo daquele tipo, data e
hora em BRT. Botões **Agendar** e **Fazer agora** — o segundo existe para
testar o texto num grupo de teste antes de agendar no grupo grande.

**Histórico** — as últimas executadas, verde ou vermelha com o motivo
("Evolution fora do ar", "atrasada: venceu há 2h"). É onde se descobre que algo
não saiu.

### O par da Comunidade

Os grupos da Comunidade vêm **em par com o mesmo nome** (grupo de avisos +
subgrupo). `renomear` pergunta uma vez e aplica nos dois (`aplicar_no_par`);
senão renomeia-se metade e não se percebe. O par é resolvido pelo JID
registrado, não por busca de nome.

## Horários

Guardado em UTC, exibido e digitado em BRT. Cron de 5 em 5 minutos, então o
agendamento tem granularidade de 5 minutos: 12:00 sai entre 12:00 e 12:05.

Linha do cron, no padrão dos outros sete:

```
*/5 * * * * /root/scripts/grupo-acoes-sync/sync.sh >> /var/log/tracking-grupo-acoes.log 2>&1
```

## Erros e como aparecem

| Situação | O que acontece |
|---|---|
| Evolution fora do ar / timeout | `falhou`, motivo legível, alerta. Mensagem não retenta; renomear retenta |
| Grupo saiu da allowlist | Agendamento é recusado na criação, não na hora |
| Ação venceu há mais de 30 min | `falhou: atrasada` — não dispara |
| Duas passadas do cron ao mesmo tempo | A segunda não reserva nada e desiste |
| Cancelamento durante a execução | Perde: a reserva já mudou o status. O painel mostra `executando` e o botão some |

## Testes

Com `node:sqlite` de verdade, não mock — a trava de corrida e a regra de
"vencida não sai" são exatamente o tipo de coisa que passa em mock e falha em
produção.

- reserva concorrente: duas chamadas, uma executa, a outra desiste
- ação vencida há mais de 30 min não dispara e vira `falhou: atrasada`
- mensagem que falha não é retentada; renomear é, até 3 vezes
- agendar em grupo fora da allowlist é recusado na criação
- payload inválido (texto vazio, hora no passado) é recusado
- a fronteira da Evolution é dublada nos testes do executor; o executor é real

**Validação em produção:** o primeiro disparo real acontece num grupo de teste,
nunca no da live.

## Fases seguintes (fora desta entrega)

| | O quê | Por que nessa ordem |
|---|---|---|
| **2** | Roster ao vivo cruzado com lead/CRM | Só leitura. Resolve "não sei quem está dentro". É onde o `@lid` precisa ser tratado: ler o campo PN dedicado (`participantAlt`), **nunca** o número antes do `@` — a lição dos 199 contatos falsos de setembro |
| **3** | Criar grupo + link de convite, atualizando o `/links` | Fecha a rotina semanal num clique. Depende da Fase 1 rodando |
| **4** | Adicionar / remover participante | **Isolado e por último.** É a operação que queima número: add de estranho, em lote, com timing de máquina. Throttle na casa de poucos adds por 10 minutos, fallback para convite por DM quando a privacidade bloqueia (o add falha em silêncio e o WhatsApp manda convite válido por 72h) |

Limites de produto, para referência: 1.024 participantes por grupo; Comunidade
até 100 grupos e 2.000 membros no total.

## Fora de escopo

- Multi-instância / múltiplos números (é o gateway, não isto)
- Mídia no disparo (só texto na Fase 1)
- Responder mensagens de dentro do grupo
- Qualquer mudança no webhook da Evolution ou no fluxo do n8n
