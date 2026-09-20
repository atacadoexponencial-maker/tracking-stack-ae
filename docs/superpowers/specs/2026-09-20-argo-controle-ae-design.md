# Argo opera a conta do Atacado Exponencial — design

Data: 2026-09-20
Status: aprovado para virar plano de implementação

## O problema

O Argo (profile `gestor-ia` do Hermes, na VPS) analisa contas de Meta Ads desde
junho. Ele tem 33 contas de clientes registradas, análises agendadas em segunda e quinta,
uma esteira de otimização com executor, guardrails, auditoria e rollback — e
uma conversa no Slack como única interface.

Nada disso está ligado para a conta do Atacado Exponencial, e três coisas
explicam por que ele parece subutilizado:

**1. Ele não lembra de nada.** `scripts/analise_quinta.py` lê `objetivos.md` e
`configuracoes.md`, consulta os últimos três dias no Meta, compara com um
benchmark fixo escrito por um humano e termina em `print(json.dumps(...))`. O
agente formata no Slack e o resultado evapora. Na quinta seguinte ele recomeça
do zero: não sabe que apontou a mesma campanha pela terceira semana, nem se a
recomendação anterior funcionou.

**2. Os mecanismos de memória existem e estão todos parados.**
`otimizacao/aprendizado.py` consolida rejeições para recalibrar limiares — nunca
recebeu uma rejeição. `preferencias-feedback.md` deveria ser preenchido toda
segunda às 18h pela skill `aprender-feedbacks` — diz "nenhum aprendizado
registrado ainda". Os `historico.md`, `analise-meta.md` e `comentarios-clickup.md`
de cada cliente estão congelados em 2026-06-06, gerados uma vez num onboarding em
lote. O `historico.md`, além disso, não é o histórico dele: são comentários da
gestora raspados do ClickUp.

**3. A esteira nunca executou nada.** `DRY_RUN = True` em `parametros.py` desde
2026-06-18, com allowlist de seis contas. A máquina que pausa e realoca verba
está pronta e nunca girou uma vez.

A conta do Atacado Exponencial, que é a da casa e a que sustenta o faturamento,
está fora de tudo isso: não tem pasta em `clientes/`, não está na allowlist, não
tem régua. Ele a analisa de improviso quando alguém pede, porque o token alcança
qualquer conta do Business — e nada do que ele conclui fica.

## O que este ciclo entrega

O Argo passa a **operar** a conta do Atacado Exponencial — pausar, realocar,
reduzir e aumentar orçamento — dentro de uma grade de permissões que a gestora
controla pelo painel, guardando tudo o que vê e faz num banco que sobrevive à
rodada.

## Decisões tomadas

**Um cérebro, duas caras.** O Argo pensa. A aba no dash do tracking é a cara dele
para a conta da casa. O `gestor-exponencial` (Next.js, Neon, parado desde
2026-06-05, nunca foi ao ar) será a cara dele para os clientes da agência,
num ciclo futuro — e o `modules/feedback/actions/gerar-feedback.ts`, que hoje
chama a Anthropic por fora, passará a consumir o Argo em vez de ser um segundo
cérebro. A spec original do `gestor-exponencial` dizia "substitui processos
manuais e scripts Python que hoje rodam localmente"; essa premissa está
revogada.

**O estado vai para a Neon, não para o D1.** O D1 do tracking guardaria o estado
num silo que o `gestor-exponencial` nunca enxergaria, e a segunda cara nasceria
cega. A Neon já existe, já é o banco do outro painel, e o driver serverless dela
funciona dentro das Functions do Cloudflare Pages. Banco novo na VPS foi
descartado: somaria mais um serviço a uma máquina que já carrega n8n em fila,
Traefik, Evolution e o Hermes; se ela cair, cairia o agente e a memória dele
juntos; e o backup viraria problema novo.

**A régua da AE é MQL e CPL real por funil, não métrica de mídia.** Nos clientes da agência o Argo só enxerga o Meta: CPM, CPC, frequência, custo por resultado. Na
conta da casa existe o funil inteiro, e `/api/feedback-marketing` já entrega
lead, MQL do CRM, compra na Greenn e origem, tudo calculado. Ele passa a julgar
anúncio pelo que acontece depois do clique.

**A autonomia é configurada por tipo de ação.** O `DRY_RUN` global, que é
tudo-ou-nada, dá lugar a uma grade com três estados por ação — desligado, propor,
executar — que a gestora ajusta pelo painel sem pedir deploy.

**Escopo: só a conta do Atacado Exponencial.** As seis contas da allowlist atual
e os demais clientes seguem exatamente como estão, com a régua no git.

## Arquitetura

```
Meta Marketing API ──┐
                     ├──> Argo (VPS, profile gestor-ia) ──> Neon (schema `argo`)
/api/feedback-marketing ─┘                                        │
  (D1 do tracking, só leitura)                                    │
                                                                  v
                          aba "Argo" no dash <── /api/argo/* (Pages Functions)
```

O Argo puxa Meta e funil, decide, age e grava. A aba lê da Neon e escreve só na
configuração. O D1 do tracking não ganha nenhuma tabela: continua sendo apenas a
fonte de leitura do funil, pelo endpoint que já existe.

## Peça 1 — A AE vira conta registrada

Nasce `profiles/gestor-ia/clientes/atacado-exponencial/` no mesmo formato das
demais contas registradas, com `configuracoes.md`, `objetivos.md` e `historico.md`.

A diferença está na régua. Onde as outras contas têm benchmark de Meta, esta tem
meta de **CPL real por funil** e de **MQL do CRM**, e o `analise_quinta.py`
ganha, apenas para esta conta, uma leitura de `/api/feedback-marketing` antes de
concluir — com a chave `FEEDBACK_MARKETING_KEY`, que já existe.

A conta entra na allowlist do executor. As seis contas atuais permanecem.

## Peça 2 — A memória, no schema `argo` da Neon

Quatro tabelas, com migrations versionadas no repositório `gestor-ae` — o cérebro
é dono do próprio estado, sem depender de uma migration do Prisma do
`gestor-exponencial`.

| Tabela | Guarda | Escreve |
|---|---|---|
| `rodadas` | cada análise: quando rodou, o que leu do Meta e do funil, o que concluiu, se falhou | Argo |
| `acoes` | cada ação executada: alvo, o que mudou, **estado anterior** (base do rollback), resultado | Argo |
| `propostas` | o que ele sugere mas não pode executar: alvo, motivo, validade, decisão | Argo escreve, painel decide |
| `config_conta` | a grade de permissões, os limites e o teto mensal | **painel** |

Regras de acesso, para não repetir os incidentes de D1 de 01/09 e 04/09 — que
foram de padrão de leitura, não de volume:

- tabelas próprias, indexadas por conta e data; a aba nunca toca `event_log` nem
  `sessions`;
- a aba lê uma janela limitada (as N rodadas mais recentes), nunca "tudo";
- sem polling: carrega ao abrir a aba e para;
- a esteira lê só a rodada anterior para comparar, nunca o histórico inteiro.

O volume esperado é de dezenas de linhas por mês para uma conta.

O que essa peça destrava, além do registro: o Argo passa a comparar a rodada
atual com a **dele próprio**, para de repetir proposta já rejeitada, e alimenta
o `aprendizado.py`, que existe e está ocioso por nunca ter recebido uma
rejeição.

## Peça 3 — A grade de permissões

Cada tipo de ação tem três estados: **desligado**, **propor** ou **executar**.

| Ação | Existe hoje | Trava |
|---|---|---|
| Pausar anúncio | sim, no `executor.py` | máximo de pausas por rodada |
| Pausar conjunto | sim | idem |
| Pausar campanha | sim | idem |
| Realocar verba entre conjuntos | sim | 20% do orçamento da origem por ação |
| Reduzir orçamento | sim | — |
| **Aumentar orçamento** | **não — peça 4** | pacing do teto mensal + limite por ação |

Junto: teto mensal de Meta da AE, limite de reais por ação, máximo de pausas por
rodada e um botão de parada geral. O kill switch hoje exige criar o arquivo
`scripts/otimizacao/_KILL_SWITCH` por SSH; passa a ser um campo da
`config_conta` que o `guardrails.py` consulta, com o arquivo mantido como trava
de emergência independente do banco.

O `guardrails.py` passa a ler a grade da Neon **para a conta da AE**. As demais
contas continuam lendo `parametros.py` no git. A allowlist permanece como
segunda barreira: uma conta fora dela é recusada mesmo que a grade diga
"executar".

Estado inicial sugerido, a ser ajustado pela gestora na primeira semana: pausar
anúncio em "executar", pausar campanha em "propor", aumentar orçamento em
"propor".

## Peça 4 — Aumentar orçamento

É a única ação que gasta mais do que se gastaria. Realocar é neutro — tira da
origem e põe no destino, o total do mês não muda — e por isso o teto mensal
nunca foi determinante até agora.

O `pacing.py` já calcula o que é preciso:

```
diário disponível = (teto do mês − gasto real do mês) ÷ dias restantes
```

usando o gasto real vindo do Meta, não o valor manual do ClickUp. Duas mudanças
para a AE:

**O teto vem da `config_conta`, não do ClickUp.** O campo "ORÇAMENTO MENSAL" da
task é contrato de cliente e não se aplica à conta da casa. Além disso, o teto
precisa ser **só de Meta**: a operação também roda Google Ads, e usar o total da
empresa faria o Argo enxergar folga inexistente.

**A regra de aumento:** ele só aumenta se a soma dos orçamentos diários após a
ação couber no diário disponível. Sem teto configurado, não aumenta — esse
default seguro já existe no `pacing.py` e é mantido. O limite por ação impede que
ele empurre a folga do mês inteiro numa única mudança.

## Peça 5 — A aba no dash

Duas telas em `public/dash/index.html`, servidas por Functions novas em
`functions/api/argo/`, com o driver serverless da Neon.

**Registro.** As rodadas da mais recente para trás. Cada uma abre mostrando o que
ele leu (investimento, CPL por funil, MQLs, comparação com a rodada anterior), o
que executou e o que propôs. Propostas pendentes têm decisão na tela. Ações
executadas têm desfazer, enquanto a auditoria permitir. No topo: quando rodou,
se a última rodada falhou, e se a grade está configurada.

**Grade.** Os interruptores por ação, os limites, o teto mensal e a parada geral.
Salvar vale a partir da próxima rodada.

A aba segue a convenção do dash, escrita em três pontos do `index.html`: **a aba
não decide nada**. Motivo de bloqueio, veredito, validade de proposta e limites
vêm prontos do backend.

## Regras duras

**A aba não decide nada.** Toda regra vive no backend ou no Argo.

**Proposta é interna; feedback de cliente é relato do passado.** O comentário que
vai para a cliente no ClickUp é escrito na primeira pessoa do gestor e relata o
que já foi feito — "pausei", "ativei", "substituí". Nunca recomenda ação à
cliente. A proposta só atravessa para esse texto depois de executada, no passado.
Hoje isso não está escrito em lugar nenhum; o Argo acerta por imitação dos
comentários anteriores. A regra entra no `SOUL.md` dele. Na AE não há cliente
externa, então o registro interno é o único destino — a redação do feedback dos
clientes da agência fica para a spec daquele ciclo.

**Nenhuma ação fora da allowlist**, mesmo com a grade permitindo.

**Toda ação guarda o estado anterior** antes de aplicar, senão não há rollback.

**Sem teto mensal configurado, não há aumento de orçamento.**

## Fora de escopo, de propósito

Subir campanha; trocar criativo; mexer em público ou segmentação; as seis contas
da allowlist atual e os demais clientes da agência; retomar o `gestor-exponencial`;
a redação do feedback de cliente. Cada um vira spec própria.

## Riscos conhecidos

**A máquina nunca girou.** Executor, guardrails e rollback estão escritos desde
junho e nunca executaram uma ação real. O primeiro ciclo é também o primeiro
teste deles, e é por isso que o escopo é uma conta só — a da casa, onde o erro
custa dinheiro de vocês e não de cliente.

**Aumentar orçamento erra para mais.** Pausar, no pior caso, deixa de gastar.
Aumentar gasta. É a peça nova e a que mais depende de uma trava correta.

**O repositório local pode ter divergido da VPS.** Todo este design foi lido da
cópia local do `gestor-ae`; a VPS é a verdade em execução. Conferir lá antes da
primeira linha de código.

**Dependência da Neon.** Se ela ficar indisponível, o Argo perde onde gravar. A
esteira deve falhar fechada: sem conseguir escrever a rodada, não executa ação.
