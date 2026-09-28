# Spec: Metas por funil no dash

> Escrita em 28/09/2026 e revista no mesmo dia com as respostas da gestora
> (seção "Decisões tomadas"). **Esperando aprovação explícita** para seguir
> para `/break`. Nada implementado.

## Visão Geral

O dash mostra quanto cada funil gastou, quantos leads trouxe e quanto custou
cada um. Falta o outro lado: **quanto deveria ter sido**. Hoje a gestora
compara de cabeça, com números que ela guarda fora do dash.

Esta entrega cria **metas mensais por funil**, cadastradas no próprio dash, e
mostra o mês corrente contra a meta na **Visão geral** e na aba **Leads**.
Todas as metas são sobre **leads novos**. Cada funil tem quatro:

1. **CPL máximo:** quanto pode custar, no máximo, cada lead novo.
2. **Leads novos:** quantidade no mês.
3. **MQLs:** quantidade no mês.
4. **Custo por MQL máximo.**

As metas são **manuais**. O cálculo automático a partir do CPL médio do ano
ficou de fora por decisão da gestora: o tracking só tem leads desde o fim de
junho e investimento desde julho de 2026, então a média do ano hoje seria só
julho.

**Para quem:** a gestora de tráfego e o marketing da AE.

**Problemas que resolve:**
1. Não há referência no dash para dizer se um CPL de R$ 90 é bom ou ruim.
2. Não dá para saber, no meio do mês, se o funil vai bater o volume.
3. As metas vivem na cabeça ou em planilha, sem histórico.

**Vocabulário:**
- **Lead novo:** pessoa que entrou no CRM pela primeira vez no período, com a
  mesma regra que o relatório de marketing já usa. Quem volta não conta.
- **MQL:** lead novo com faturamento declarado acima de R$ 20 mil por mês, a
  mesma régua do relatório de marketing.
- **Realizado:** o número do mês corrente até ontem. O dia de hoje fica de
  fora porque o investimento chega atrasado e distorce o CPL.
- **Projeção:** o realizado estendido até o fim do mês, pelo ritmo dos dias
  já fechados.

**Fora de escopo:**
- Cálculo automático da meta a partir do histórico.
- Alerta no Slack ou no WhatsApp quando uma meta é estourada.
- Metas para Live, workshop pago e Aquisição (só Sessão Estratégica por
  enquanto; o cadastro já nasce preparado para outros funis de lead).
- Metas de receita ou de compra.
- Ver meses passados contra a meta nos cartões (os cartões mostram sempre o
  mês corrente; o histórico das metas fica no cadastro).
- Login por pessoa: quem tem a chave do dash pode editar as metas.

## Decisões tomadas (28/09)

- **D1.** Metas manuais, sem cálculo automático nem janela de média.
- **D2.** Quatro metas por funil: CPL máximo, leads novos, MQLs e custo por
  MQL máximo.
- **D3.** Só a Sessão Estratégica recebe meta por enquanto.
- **D4.** Meta mensal, com projeção de fim de mês pelo ritmo dos dias fechados.
- **D5.** A meta vale para os meses seguintes até ser mudada; cada mês guarda
  o valor que valeu nele.
- **D6.** Sem aba própria: o acompanhamento aparece na Visão geral e na aba
  Leads; a edição fica na aba Funis do relatório.
- **D7.** Os cartões mostram sempre o mês corrente até ontem, qualquer que
  seja o filtro de datas.
- **D8.** Verde dentro da meta, âmbar até 10% fora, coral além disso. Sem
  alerta no Slack.

## Páginas / Módulos

### 1. Cartão de metas na Visão geral

**Descrição:** um cartão compacto, logo abaixo dos indicadores do topo, com o
mês corrente contra a meta de cada funil com meta.

**Componentes:**
- **Título:** "Metas de <mês>", com "dados até DD/MM (ontem) · faltam N dias".
- **Uma linha por funil**, com quatro indicadores lado a lado: CPL, leads
  novos, MQLs e custo por MQL. Cada um com o realizado, a meta em letra
  menor e a cor da situação.
- **Nota fixa** quando o filtro de datas não é o mês corrente: "as metas
  mostram sempre o mês corrente".

**Comportamentos:**
- Abrir a Visão geral e ver o cartão com o mês corrente.
- Trocar o filtro de datas e ver o cartão continuar no mês corrente, com a
  nota.
- Ver "—" no CPL e no custo por MQL quando não houve lead ou MQL no mês,
  nunca "R$ 0,00".
- Ver o cartão sumir quando nenhum funil tem meta cadastrada, com a frase
  "nenhuma meta cadastrada — cadastre em Funis do relatório" e o atalho.
- Clicar no cartão e ir para o detalhe na aba Leads.

### 2. Cartão de metas na aba Leads

**Descrição:** a versão detalhada, no topo da aba Leads, com barras de
progresso e projeção.

**Componentes:**
- **Título e faixa** iguais aos da Visão geral.
- **Por funil, quatro blocos:**
  - **CPL:** realizado, meta e diferença em reais e em porcentagem.
  - **Leads novos:** realizado, meta, porcentagem atingida, barra de
    progresso, projeção de fim de mês e "precisa de N por dia para bater".
  - **MQLs:** a mesma leitura dos leads novos.
  - **Custo por MQL:** realizado, meta e diferença.
- **Rodapé:** investido no mês e a data e o autor da última alteração da meta.

**Comportamentos:**
- Abrir a aba Leads e ver o cartão com o mês corrente.
- Ver a cor de cada bloco: nos custos, verde se ≤ meta, âmbar até 10% acima,
  coral acima disso; nos volumes, verde se a projeção ≥ meta, âmbar entre 90%
  e 100%, coral abaixo de 90%.
- Ver "—" na projeção no dia 1º, quando ainda não há dia fechado.
- Ver "meta atingida" no lugar de "precisa de N por dia" quando o volume já
  passou da meta.
- Ver o aviso "a meta deste mês foi alterada em DD/MM" quando alguém mudou a
  meta depois do início do mês.
- Ver "sem meta" num indicador deixado em branco no cadastro, com o realizado
  ao lado.
- Quando o CRM não responde, ver "não foi possível ler os leads agora" no
  lugar de leads e MQLs, e os custos como "—". O investimento continua
  aparecendo.
- Quando o investimento de algum dia do mês ainda não chegou, ver o aviso
  "investimento de DD/MM ainda não sincronizado".
- Ir para a edição das metas pelo atalho "editar metas".

### 3. Edição das metas (aba Funis do relatório)

**Descrição:** no cadastro de funis que já existe, cada funil de lead ganha
os quatro campos de meta. Por enquanto só a Sessão Estratégica aceita meta.

**Componentes:**
- **Bloco "Metas" na linha do funil:** CPL máximo (R$), leads novos
  (quantidade), MQLs (quantidade) e custo por MQL máximo (R$).
- **Indicação do mês:** "vale a partir de <mês> até ser mudada".
- **Última alteração:** data e autor.
- **Histórico:** lista das alterações, com mês, valor antigo e valor novo.
- **Botão Salvar**, apagado enquanto nada mudou.

**Comportamentos:**
- Digitar o CPL máximo.
- Digitar a meta de leads novos.
- Digitar a meta de MQLs.
- Digitar o custo por MQL máximo.
- Deixar um campo em branco para não ter meta naquele indicador.
- Salvar as metas, que passam a valer no mês corrente e nos seguintes.
- Ver o histórico de alterações do funil.
- Ter o salvamento recusado, com o motivo ao lado do campo, quando o valor não
  é número, é negativo, ou o valor em reais tem mais de duas casas decimais.
- Ter o salvamento recusado quando outra pessoa salvou no intervalo, com "as
  metas mudaram desde que você abriu a aba, recarregue".
- Ver os campos de meta desabilitados nos outros funis, com "metas só para a
  Sessão Estratégica por enquanto".

### 4. Cálculo do realizado

**Descrição:** as telas só desenham. Realizado, projeção, cor e textos chegam
prontos do servidor, com as mesmas regras do relatório de marketing.

**Comportamentos:**
- Mesma contagem de leads novos e de MQLs do relatório de marketing, para os
  dois nunca divergirem.
- O mês corrente conta até ontem.
- Projeção de volume = realizado ÷ dias fechados × dias do mês.
- CPL = investido ÷ leads novos; custo por MQL = investido ÷ MQLs; divisão
  sem denominador vale "—".
- Funil sem investimento no mês mostra R$ 0,00 investido e custos "—".
- A meta usada num mês é a que estava valendo nele; mudar a meta hoje não
  reescreve meses passados.
- Meta alterada no meio do mês vale para o mês inteiro; o histórico guarda a
  anterior.
