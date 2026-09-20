# Argo opera a conta do Atacado Exponencial — design

Data: 2026-09-20
Status: aprovado para virar plano de implementação
Revisão: reescrito em 2026-09-20 após conferência na VPS, que contradisse o
repositório em pontos centrais (ver "O que a VPS mostrou").

## O que a VPS mostrou

O repositório `gestor-ae` está muito atrás da máquina: 46 pastas de cliente na
VPS contra 34 no git, allowlist de 4 contas contra 6, e a pasta da conta do
Atacado Exponencial **não existe no git**. O git não é fonte confiável do que
roda; a VPS é.

E o que roda é mais do que o repositório sugere:

**A conta já está registrada desde 2026-07-22** em
`profiles/gestor-ia/clientes/atacado-exponencial/`, com `act_4577256079174658`
(`CA_AtacadoExponencial`, business "Sete Ads 2"), orçamento mensal de Meta de
R$ 10.000, teto de tráfego de 10% e régua de pausa escrita.

**O Argo já opera a conta sozinho.** O cron `AE tráfego diário — monitor +
pausas automáticas` roda `ae_trafego_monitor.py` (422 linhas, `no_agent: true`)
todo dia útil às 8h50 e pausa campanhas por `POST status=PAUSED`, sem aprovação.
Quatro pausas reais, com `ACTIVE → PAUSED` verificado:

| Data | Campanha | Motivo |
|---|---|---|
| 2026-08-12 | "No atacado, a primeira compra..." | gasto 7d R$ 120,91, CPV R$ 0,30 |
| 2026-08-13 | "Negócio consolidado que..." | gasto 7d R$ 109,77, CPV R$ 0,32 |
| 2026-09-08 | "Atacado faz ou não faz na..." | gasto 7d R$ 107,27, CPV R$ 0,32 |
| 2026-09-08 | "O TikTok acabou de investir R$..." | gasto 7d R$ 103,38, CPV R$ 0,37 |

São 44 execuções registradas em `cron/output/191d4eb26d3c/`.

**A grade de permissões já existe, em forma primitiva.** O script lê por regex a
linha `**Execução automática de pausas:** ATIVA` do `configuracoes.md` da conta.
É exatamente a ideia deste design — para uma ação só, guardada em markdown, num
arquivo que também diz, três linhas abaixo, "antes de qualquer alteração em conta
Meta, pedir confirmação expressa da equipe". O arquivo se contradiz.

**Há dois caminhos paralelos que não se conhecem.** O `ae_trafego_monitor.py`
age; a esteira `otimizacao/` tem executor, guardrails, auditoria e rollback, está
em `DRY_RUN = True` e não tem a AE na allowlist.

## O problema

Não é falta de capacidade, e não é falta de automação. É que **o que opera não
lembra, e o que lembra não opera.**

**A régua estava congelada há dois meses.** A referência de custo por visita era
R$ 0,3004, calculada sobre R$ 139,69 e 465 visitas na janela de 15 a 21/07,
enquanto a conta rodava a R$ 0,14 — menos da metade. Ele pausava só o que
passasse de R$ 0,30, deixando livre tudo que estivesse ao dobro do normal atual.
Corrigido à mão em 2026-09-20 para R$ 0,1433 (janela 10 a 16/09, R$ 92,27 ÷ 644
visitas), com backup em `configuracoes.md.bak-2026-09-20`. É um remendo: nada
garante que não congele de novo.

**Nada do que ele conclui vira memória.** `analise_quinta.py` lê `objetivos.md`,
consulta três dias de Meta, compara com benchmark fixo e termina em
`print(json.dumps(...))`. O `ae_trafego_monitor.py` grava no output do cron —
markdown numa pasta da VPS, legível só por SSH, arquivo por arquivo. Nenhum dos
dois sabe o que fez na véspera, nem se a pausa anterior melhorou a conta.

**Os mecanismos de memória existem e estão todos parados.**
`otimizacao/aprendizado.py` consolida rejeições para recalibrar limiares — nunca
recebeu uma. `preferencias-feedback.md` deveria ser preenchido toda segunda às
18h pela skill `aprender-feedbacks`, que tem cron ativo — diz "nenhum
aprendizado registrado ainda". Os `historico.md` dos clientes estão congelados em
2026-06-06.

**A régua é de mídia, não de dinheiro.** Ele julga a conta da casa por custo por
visita, a mesma métrica que usaria num cliente qualquer — ignorando que aqui
existe o funil inteiro, com MQL no CRM e receita na Greenn.

## O que este ciclo entrega

O que já opera ganha memória, auditoria consultável e controle pela tela; a régua
passa a ser MQL e CPL real em vez de custo por visita; e as ações que faltam —
realocar verba e aumentar orçamento — nascem na esteira, lendo a mesma
configuração.

## Decisões tomadas

**Um cérebro, duas caras.** O Argo pensa. A aba no dash do tracking é a cara dele
para a conta da casa. O `gestor-exponencial` (Next.js, Neon, parado desde
2026-06-05, nunca foi ao ar) será a cara dele para os clientes da agência, num
ciclo futuro — e o `modules/feedback/actions/gerar-feedback.ts`, que hoje chama a
Anthropic por fora, passará a consumir o Argo em vez de ser um segundo cérebro. A
premissa original daquele projeto ("substitui processos manuais e scripts Python
que hoje rodam localmente") está revogada.

**O estado vai para a Neon, não para o D1.** O D1 guardaria o estado num silo que
o `gestor-exponencial` nunca enxergaria, e a segunda cara nasceria cega. A Neon
já existe, já é o banco do outro painel, e o driver serverless dela funciona nas
Functions do Cloudflare Pages. Banco novo na VPS foi descartado: somaria um
serviço a uma máquina que já carrega n8n em fila, Traefik, Evolution e o Hermes;
se ela cair, cairia o agente e a memória dele juntos; e o backup viraria problema
novo.

**Absorção pela borda, não fusão de código.** O `ae_trafego_monitor.py` opera
dinheiro real e funciona. A lógica de decisão dele **não é tocada**. Muda só o
que entra e o que sai: passa a ler a grade da Neon em vez do regex no markdown, e
a gravar cada rodada e cada ação na Neon além do output do cron. As ações novas
nascem na esteira, lendo a mesma grade. Os dois caminhos convergem pelo estado
compartilhado, não por uma reescrita arriscada.

**A régua da AE é MQL e CPL real por funil.** `/api/feedback-marketing` já
entrega lead, MQL do CRM, compra na Greenn e origem, calculados. O Argo passa a
julgar anúncio pelo que acontece depois do clique. O custo por visita continua
existindo como sinal precoce, não como veredito.

**A autonomia é configurada por tipo de ação**, com três estados — desligado,
propor, executar — no lugar do `DRY_RUN` global e do `ATIVA` em markdown.

**Escopo: só a conta do Atacado Exponencial.** As 4 contas da allowlist atual e
os demais clientes seguem como estão.

## Arquitetura

```
Meta Marketing API ──┐
                     ├─> ae_trafego_monitor.py (pausas, já no ar) ──┐
                     └─> esteira otimizacao/ (realocar, aumentar) ──┤
/api/feedback-marketing ─> régua de MQL e CPL real ─────────────────┤
  (D1 do tracking, só leitura)                                      v
                                                        Neon (schema `argo`)
                                                                    │
                        aba "Argo" no dash <── /api/argo/* (Pages Functions)
```

Os dois executores leem a mesma grade e gravam no mesmo lugar. A aba lê a Neon e
escreve só na configuração. O D1 não ganha nenhuma tabela.

## Peça 1 — Descongelar a régua e trocá-la por dinheiro

A referência de custo por visita passa a ser **recalculada a cada rodada** a
partir do histórico real da própria conta, em vez de ficar num campo que alguém
precisa lembrar de atualizar. A correção manual de 2026-09-20 é o remendo que
esta peça substitui.

Sobre isso entra a régua nova: `objetivos.md` da AE ganha meta de **CPL real por
funil** e de **MQL do CRM**, e o `analise_quinta.py` passa a ler
`/api/feedback-marketing` para esta conta — com a chave `FEEDBACK_MARKETING_KEY`,
que já existe no `.env` do profile e já é usada pelos crons `AE feedback
marketing diário` e `AE comparativo 7d`.

**Pendência conhecida, decisão separada:** o gatilho de pausa exige gasto ≥
R$ 100 em 7 dias. Com a conta gastando cerca de R$ 13/dia em tráfego, isso exige
que uma campanha consuma quase todo o orçamento sozinha — foi o caso das quatro
pausas, todas entre R$ 103 e R$ 121. Na prática o piso de R$ 100 manda mais que o
CPV. Não é alterado aqui.

## Peça 2 — A memória, no schema `argo` da Neon

Quatro tabelas, com migrations versionadas no repositório `gestor-ae`.

| Tabela | Guarda | Escreve |
|---|---|---|
| `rodadas` | cada execução: quando, o que leu do Meta e do funil, o que concluiu, se falhou | os dois executores |
| `acoes` | cada ação: alvo, o que mudou, **estado anterior** (base do rollback), resultado | os dois executores |
| `propostas` | o que ele sugere mas não pode executar: alvo, motivo, validade, decisão | Argo escreve, painel decide |
| `config_conta` | a grade de permissões, os limites e o teto mensal | **painel** |

Regras de acesso, para não repetir os incidentes de D1 de 01/09 e 04/09 — que
foram de padrão de leitura, não de volume: tabelas próprias indexadas por conta e
data, sem tocar `event_log` nem `sessions`; a aba lê uma janela limitada, nunca
"tudo"; sem polling, carrega ao abrir e para; a rodada compara só com a anterior.
O volume esperado é de dezenas de linhas por mês.

O que essa peça destrava: o Argo passa a comparar a rodada com a dele próprio,
para de repetir proposta já rejeitada, sabe que já pausou determinada campanha
antes, e alimenta o `aprendizado.py`, ocioso por nunca ter recebido uma rejeição.

## Peça 3 — A grade de permissões

Três estados por ação: **desligado**, **propor** ou **executar**.

| Ação | Onde vive hoje | Trava |
|---|---|---|
| Pausar campanha de tráfego | `ae_trafego_monitor.py`, no ar | máximo de pausas por rodada |
| Pausar anúncio / conjunto | `executor.py`, em dry-run | idem |
| Realocar verba | `executor.py`, em dry-run | 20% do orçamento da origem |
| Reduzir orçamento | `executor.py`, em dry-run | — |
| **Aumentar orçamento** | **não existe — peça 4** | pacing do teto mensal + limite por ação |

Junto: teto mensal de Meta da AE (hoje R$ 10.000 no markdown), limite por ação,
máximo de pausas por rodada e botão de parada geral.

O `ATIVA` do `configuracoes.md` e o `DRY_RUN` do `parametros.py` são substituídos
pela grade, **para a AE apenas**. As demais contas continuam lendo
`parametros.py` no git. A allowlist permanece como segunda barreira. O
`_KILL_SWITCH` por arquivo é mantido como trava de emergência independente do
banco.

A contradição do `configuracoes.md` ("pausa automática" versus "pedir confirmação
expressa") é resolvida: o arquivo deixa de ser fonte de permissão, e o texto de
segurança passa a descrever o que de fato vale.

Estado inicial: pausar campanha de tráfego em **executar** (é o que já acontece
hoje — desligar seria regressão), pausar anúncio e conjunto em **propor**,
aumentar orçamento em **propor**.

## Peça 4 — Aumentar orçamento

É a única ação que gasta mais do que se gastaria. Realocar é neutro — tira da
origem e põe no destino — e por isso o teto mensal nunca foi determinante.

O `pacing.py` já calcula:

```
diário disponível = (teto do mês − gasto real do mês) ÷ dias restantes
```

com o gasto real vindo do Meta. Duas mudanças: o teto vem da `config_conta` e não
do campo "ORÇAMENTO MENSAL" do ClickUp, que é contrato de cliente e não se aplica
à casa; e precisa ser **só de Meta**, porque a operação também roda Google Ads e
o total faria o Argo enxergar folga inexistente.

Ele só aumenta se a soma dos orçamentos diários após a ação couber no disponível.
Sem teto configurado, não aumenta — default seguro que já existe no `pacing.py`.

## Peça 5 — A aba no dash

Duas telas em `public/dash/index.html`, servidas por Functions novas em
`functions/api/argo/`, com o driver serverless da Neon.

**Registro.** As rodadas da mais recente para trás, dos dois executores, com o
que ele leu, o que executou e o que propôs. Propostas pendentes têm decisão na
tela; ações executadas têm desfazer enquanto a auditoria permitir. No topo:
quando rodou, se falhou, e se a grade está configurada. Isso substitui abrir
arquivo por arquivo em `cron/output/` por SSH.

**Grade.** Interruptores por ação, limites, teto mensal e parada geral. Vale a
partir da próxima rodada.

A aba segue a convenção do dash, escrita em três pontos do `index.html`: **a aba
não decide nada**.

## Regras duras

**A aba não decide nada.** Toda regra vive no backend ou no Argo.

**A lógica de decisão do `ae_trafego_monitor.py` não é reescrita.** Só entrada e
saída mudam.

**Proposta é interna; feedback de cliente é relato do passado.** O comentário do
ClickUp é escrito na primeira pessoa do gestor, vai para a cliente e relata o que
já foi feito — "pausei", "ativei", "substituí". Nunca recomenda ação à cliente. A
regra entra no `SOUL.md`, onde hoje não está: o Argo acerta por imitação dos
comentários anteriores. Na AE não há cliente externa, então o registro interno é
o único destino.

**Nenhuma ação fora da allowlist**, mesmo com a grade permitindo.

**Toda ação guarda o estado anterior** antes de aplicar, senão não há rollback.

**Sem teto mensal configurado, não há aumento de orçamento.**

**Falha fechada:** sem conseguir gravar a rodada na Neon, não executa ação.

## Fora de escopo, de propósito

Subir campanha; trocar criativo; mexer em público; o piso de R$ 100 do gatilho de
pausa; as contas da agência; retomar o `gestor-exponencial`; a redação do
feedback de cliente. Cada um vira spec própria.

## Riscos conhecidos

**Mexer no que está operando dinheiro.** O `ae_trafego_monitor.py` é a única
automação que de fato funciona na conta. Trocar a fonte da configuração e
adicionar escrita na Neon pode quebrá-la. Por isso a lógica de decisão fica
intacta e a grade nasce com "pausar campanha de tráfego" já em `executar`.

**A esteira nunca girou.** Executor, guardrails e rollback estão escritos desde
junho e nunca executaram. Realocar e aumentar orçamento serão o primeiro teste
real deles — numa conta só, a da casa.

**Aumentar orçamento erra para mais.** Pausar, no pior caso, deixa de gastar.

**O git do `gestor-ae` não reflete a VPS.** Qualquer leitura de comportamento tem
que ser feita na máquina. Sincronizar os dois é trabalho à parte e não entra
aqui.

**Dependência da Neon.** Indisponível, o Argo perde onde gravar — e a regra de
falha fechada faz a automação parar. É uma escolha deliberada: parar é melhor do
que agir sem registro.
