# Spec: Argo avalia o resultado das próprias ações

> Escrita em 27/09/2026. **Aprovada pela gestora em 27/09/2026** ("concordo"),
> com as respostas propostas nas seis perguntas da última seção adotadas como
> decisões.

## Visão Geral

O Argo hoje age (pausa, reduz, aumenta, realoca, reativa) e registra o que fez,
mas nunca volta para perguntar **"deu certo?"**. A única avaliação que existe é
o bloco "Mudanças recentes — antes e depois" do relatório do Slack, que é
recalculado a cada rodada, não fica gravado, não se liga a nenhuma ação e não
cobre pausas. Resultado: a gestora não tem como saber se a régua está boa ou
ruim a não ser pela sensação.

Esta entrega fecha o ciclo. **Toda ação** do Argo, e toda mudança feita à mão
na conta, ganha um **veredito** alguns dias depois: *acertou*, *errou* ou
*inconclusivo*, sempre com os números de antes e de depois ao lado. O veredito
fica gravado junto da ação, aparece no Registro da aba Argo, é resumido no
relatório de toda rodada e alimenta um **placar** por tipo de ação, para a
gestora enxergar em números se o Argo está ajudando ou atrapalhando.

**Para quem:** a gestora de tráfego da AE, que decide a régua e as permissões
do Argo pelo dash.

**Problemas que resolve:**
1. Não dá para saber se uma pausa ou uma redução foi boa decisão. O Argo age e
   esquece.
2. A comparação antes/depois que existe some do relatório depois de 30 dias e
   nunca aponta *quem* fez a mudança nem *qual* ação a causou.
3. Ajustar a régua hoje é chute: não há taxa de acerto para comparar antes e
   depois de mexer num número.

**O que esta entrega NÃO faz (fora de escopo, decisão a registrar):**
- Não mexe na régua sozinha. O veredito **informa**; quem muda a régua é a
  gestora. (Ver pergunta P4.)
- Não reativa nem desfaz nada por conta do veredito. Errou fica registrado,
  não vira ação nova.
- Não cria tela nova. Tudo mora na aba Argo que já existe.

## Vocabulário

- **Ação:** um registro do que o Argo fez (ou tentou fazer) num alvo, com o
  estado antes e depois. Inclui as ações executadas por aprovação no dash e os
  desfazeres.
- **Mudança manual:** uma alteração detectada na conta que não corresponde a
  nenhuma ação do Argo (feita pela gestora ou por outra pessoa no Gerenciador).
- **Janela de avaliação:** quantos dias completos depois da ação o Argo espera
  antes de dar o veredito. Um único número, editável na régua.
- **Métrica-guia:** o número que decide o veredito de cada bloco. Tráfego usa
  custo por visita; lead usa CPL dos leads maduros (e MQL como apoio).
- **Veredito:** *acertou*, *errou* ou *inconclusivo*, com o motivo em uma frase
  e os números que o sustentam.

## Páginas / Módulos

### 1. Avaliação de ações (o veredito)

**Descrição:** o coração da entrega. Percorre as ações que já completaram a
janela de avaliação e ainda não têm veredito, lê os números de antes e de
depois, decide e grava. Roda no fim de toda rodada dos dois monitores, antes
do relatório.

**Componentes:**
- Fila de avaliação: as ações aplicadas com sucesso, não desfeitas, cuja data
  somada à janela já passou e que ainda não têm veredito.
- Fotografia de antes: os números do alvo nos 7 dias que antecedem a ação.
  Sempre que a proposta ou a ação já guardou esses números na hora de decidir,
  são esses que valem (não se relê o passado).
- Fotografia de depois: os mesmos números nos dias completos entre a ação e o
  fim da janela.
- Referência: a média do bloco no mesmo período de "depois" (tráfego: média
  do custo por visita das campanhas ativas de tráfego; lead: CPL médio do
  funil). O alvo é comparado **com a referência**, nunca só consigo mesmo.
- Veredito gravado: rótulo, motivo em uma frase, números de antes e de depois,
  referência usada, janela usada, data da avaliação e versão da regra que
  decidiu.

**Comportamentos:**
- Avaliar uma **pausa de campanha de tráfego**: acertou quando, nos dias depois,
  o custo médio por visita das campanhas de tráfego que continuaram ativas ficou
  igual ou menor que a referência de antes; errou quando ficou acima; inconclusivo
  quando não houve visitas suficientes para medir. (Ver P2.)
- Avaliar uma **pausa de anúncio de lead**: acertou quando o CPL do conjunto em
  que o anúncio vivia ficou igual ou menor depois da pausa; errou quando o CPL
  do conjunto piorou e nenhum outro anúncio do conjunto absorveu o gasto com
  CPL melhor; inconclusivo quando o conjunto não gastou o piso mínimo depois.
  (Ver P2.)
- Avaliar uma **pausa de conjunto**: mesma lógica da pausa de anúncio, no nível
  da campanha.
- Avaliar uma **redução de orçamento**: acertou quando o CPL (ou custo por
  visita) do alvo nos dias depois ficou igual ou melhor que a referência; errou
  quando piorou além da referência; inconclusivo sem gasto suficiente.
- Avaliar um **aumento de orçamento**: acertou quando o alvo continuou com CPL
  igual ou melhor que a referência e gastou o novo orçamento; errou quando o
  CPL passou da referência; inconclusivo quando o alvo não chegou a gastar o
  aumento.
- Avaliar uma **realocação**: acertou quando o destino ficou com CPL igual ou
  melhor que a referência e a origem não piorou; errou quando o destino ficou
  pior que a origem estava antes; inconclusivo quando um dos dois não gastou o
  suficiente.
- Avaliar uma **reativação**: acertou quando o anúncio reativado ficou dentro
  do CPL médio do funil; errou quando ficou acima; inconclusivo sem gasto
  suficiente.
- **Não avaliar** desfazeres: um desfazer é a correção de outra ação; ele marca
  a ação original como *desfeita*, e a ação original sai da fila sem veredito
  (o motivo gravado é "desfeita antes da janela").
- **Não avaliar** ações não aplicadas ou com desfecho desconhecido; elas ficam
  fora da fila com o motivo gravado.
- Quando o alvo foi **alterado de novo dentro da janela** (por qualquer um), o
  veredito é inconclusivo com o motivo "alvo mudou de novo em DD/MM antes de
  completar a janela".
- Quando o Argo não consegue ler os números de depois (falha de leitura), a
  ação **continua na fila** e é tentada na próxima rodada, até um limite de
  dias após a janela; passado o limite, recebe inconclusivo com o motivo
  "sem leitura".
- Gravar a intenção de avaliar **antes** de gravar o veredito, no mesmo padrão
  do write-ahead das ações: se o processo cair no meio, a próxima rodada
  retoma sem duplicar.
- Cada ação recebe **um único veredito**. Rodar a avaliação duas vezes no mesmo
  dia não cria dois.
- Uma ação avaliada como *errou* **não gera** ação nova automaticamente.

### 2. Detecção e avaliação de mudanças manuais

**Descrição:** hoje o bloco "antes e depois" já enxerga mudanças pela data de
atualização do Meta, sem distinguir quem fez. Este módulo transforma isso em
registro: toda mudança detectada que não bate com uma ação do Argo vira uma
**mudança manual** gravada, avaliada com a mesma régua das ações. A gestora
pediu que o Argo avalie o resultado "de quem quer que tenha feito".

**Componentes:**
- Registro de mudança manual: alvo, tipo inferido (pausa, orçamento para
  cima, orçamento para baixo, reativação, outro), data da mudança no Meta,
  estado observado antes e depois quando disponível.
- Ligação com ações do Argo: uma mudança cuja data e alvo coincidem com uma
  ação do Argo **não** é manual e não é registrada de novo.
- Veredito da mudança manual, gravado do mesmo jeito que o de uma ação.

**Comportamentos:**
- Detectar uma mudança manual em campanha de tráfego, conjunto ou anúncio de
  lead nos alvos que o Argo já acompanha.
- Registrar a mudança uma única vez; a mesma data no mesmo alvo não cria dois
  registros.
- Inferir o tipo pela diferença de estado (status, orçamento). Quando não dá
  para inferir, gravar "outro".
- Avaliar a mudança manual com a mesma janela e a mesma régua das ações do
  Argo.
- Marcar o veredito como "manual" para o placar poder separar (ver P3).
- O bloco "Mudanças recentes — antes e depois" do relatório **passa a ler
  destes registros**, em vez de recalcular tudo a cada rodada. O texto que a
  gestora já conhece continua igual; muda a fonte.

### 3. Registro da aba Argo (veredito visível)

**Descrição:** a vista Registro já lista as ações com desfecho ("pausada com
sucesso", "orçamento alterado" etc.). Passa a mostrar também o veredito, e a
listar as mudanças manuais.

**Componentes:**
- Selo de veredito em cada ação: *Acertou* (verde), *Errou* (coral),
  *Inconclusivo* (âmbar), *Aguardando* (neutro, com "avalia em DD/MM"), e
  *Sem avaliação* para desfeitas e não aplicadas, com o motivo curto.
- Detalhe do veredito ao abrir a ação: a frase do motivo, tabela antes ×
  depois com a métrica-guia, gasto, leads/visitas, MQL quando houver, e a
  referência usada.
- Linha de mudança manual no Registro, marcada como "manual" e com quem
  (quando o Meta informa) ou "não identificado".
- Filtro do Registro: todas, só acertos, só erros, só inconclusivas, só
  aguardando, só manuais.

**Comportamentos:**
- Ver o selo de veredito de cada ação na lista, sem abrir.
- Abrir uma ação e ver a tabela antes × depois e o motivo.
- Ver "Aguardando — avalia em DD/MM" numa ação dentro da janela.
- Ver "Sem avaliação — desfeita" ou "— não aplicada" nas que saíram da fila.
- Filtrar o Registro por veredito.
- Filtrar o Registro para só mudanças manuais.
- Ver uma mudança manual e seu veredito, com o tipo inferido.
- Quando a leitura do veredito falhar, a ação aparece normal e o selo mostra
  "veredito indisponível" (a aba nunca inventa rótulo por falta de dado).

### 4. Placar (taxa de acerto)

**Descrição:** um resumo numérico no topo da vista Registro. Serve para a
gestora julgar a régua por resultado, não por sensação.

**Componentes:**
- Cartões por tipo de ação: total avaliado, acertos, erros, inconclusivas e a
  taxa de acerto (acertos ÷ avaliadas com veredito conclusivo). Sem avaliadas,
  o cartão mostra "—", nunca 0%.
- Cartão geral do Argo (todos os tipos) e cartão das mudanças manuais,
  separados, lado a lado.
- Período do placar: os mesmos presets do dash (30, 60, 90 dias, personalizado),
  contando pela data da **ação**, não da avaliação.
- Nota de dinheiro por cartão: gasto total dos alvos nas ações *errou* no
  período, para dar peso ao número.
- Marcação de versão da régua: quando a régua mudou dentro do período, o
  placar mostra um aviso "régua alterada em DD/MM" para a gestora não misturar
  duas réguas na mesma conta.

**Comportamentos:**
- Ver a taxa de acerto geral do Argo no período.
- Ver a taxa de acerto por tipo de ação.
- Ver a taxa de acerto das mudanças manuais separada da do Argo.
- Trocar o período do placar.
- Clicar num cartão e o Registro abaixo filtra por aquele tipo.
- Ver o aviso de régua alterada quando houver.
- Ver "—" quando não há ação avaliada no período.

### 5. Relatório da rodada (Slack)

**Descrição:** o relatório que já chega no Slack ganha um bloco fixo de
vereditos, em toda rodada, como a gestora pediu ("resumo em toda rodada").

**Componentes:**
- Bloco "Vereditos de hoje": uma linha por ação avaliada nesta rodada, com
  alvo, tipo, veredito e a métrica antes → depois.
- Linha de placar: "Últimos 30 dias: X acertos, Y erros, Z inconclusivas
  (taxa N%)". Sem avaliadas, a linha diz "ainda sem ação avaliada".
- Aviso de fila: quantas ações estão aguardando e a data da próxima avaliação.
- Aviso de erro: quantas ações ficaram sem leitura e há quantos dias.

**Comportamentos:**
- Ler o veredito de cada ação avaliada hoje no relatório.
- Ler o placar de 30 dias em uma linha.
- Ler quantas ações ainda aguardam avaliação.
- Quando nenhuma ação foi avaliada hoje, o bloco diz isso em uma linha e não
  some (para a gestora saber que o módulo rodou).
- O bloco "Mudanças recentes — antes e depois" continua existindo e passa a
  vir do registro de mudanças manuais.

### 6. Régua de avaliação (configuração)

**Descrição:** os números que decidem o veredito ficam na régua editável da
aba Argo, junto dos outros, nunca no código.

**Componentes:**
- Janela de avaliação (dias completos depois da ação). Padrão proposto: 7.
- Piso de gasto para veredito conclusivo (abaixo dele é inconclusivo), por
  bloco: visita e lead.
- Tolerância de "manteve": quanto a métrica pode ficar acima da referência e
  ainda contar como acertou (percentual). Padrão proposto: o mesmo da régua de
  tráfego.
- Limite de dias após a janela para tentar reler antes de dar "sem leitura".
- Chave liga/desliga da avaliação de mudanças manuais.

**Comportamentos:**
- Editar a janela de avaliação.
- Editar os pisos de gasto por bloco.
- Editar a tolerância.
- Ligar ou desligar a avaliação de mudanças manuais.
- Toda alteração fica registrada com data e quem alterou, como já acontece
  com a régua atual.
- Uma alteração vale só para ações **ainda não avaliadas**; vereditos já
  dados não são refeitos.
- Campo em branco ou inválido não salva e mostra o motivo, como já acontece
  nos outros campos da régua.

## Fora de escopo declarado

- Ajuste automático da régua a partir do placar.
- Reativar, desfazer ou compensar ações a partir do veredito.
- Avaliação de campanhas dos funis não julgáveis (LIVE, WO PAGO), até haver
  métrica de resultado confiável para eles.
- Notificação individual por veredito (só o resumo no relatório da rodada).

## Decisões tomadas (27/09/2026)

As seis perguntas abertas no rascunho foram respondidas pela gestora com a
proposta de cada uma. Valem como regra desta entrega:

- **D1. Janela de avaliação: 7 dias completos** depois da ação. Mesmo tamanho
  da janela de decisão, o que deixa antes e depois comparáveis.
- **D2. "Acertou" para uma PAUSA mede onde o dinheiro ficou.** Anúncio: o
  CPL do conjunto dele. Conjunto: o CPL da campanha. Campanha de tráfego: a
  média do custo por visita das campanhas de tráfego que continuaram ativas.
- **D3. Mudanças manuais entram no placar, separadas** ("Argo" × "manual").
- **D4. O veredito só informa.** Nenhum número da régua muda sozinho. Ajuste
  automático, se um dia for desejado, é entrega própria com trava de
  aprovação.
- **D5. Piso de gasto para veredito conclusivo = os mesmos pisos de julgar**
  por bloco (R$ 30 em visita; 3× o CPL médio do funil em lead), editáveis na
  régua como os demais.
- **D6. Alvo alterado de novo dentro da janela → inconclusivo**, com o motivo
  "alvo mudou de novo em DD/MM antes de completar a janela".
