# Spec: Feedback de Marketing a partir do Tracking

## Visão Geral

**O que faz.** Cria uma consulta só de leitura, `GET /api/feedback-marketing`, que entrega pronto o conteúdo dos relatórios de marketing (diário, semanal e mensal): investimento geral, e um bloco por funil com investimento, volume (leads, MQLs ou vendas) e custo por resultado. A mesma consulta aceita intervalos de 1 a 92 dias e serve ao feedback diário, ao comparativo semanal de segunda-feira e ao feedback mensal; o comparativo é feito chamando-a duas vezes (período atual e período anterior). Junto com ela nasce o **Cadastro de funis**, uma aba nova do dashboard onde a equipe define quais blocos o relatório tem, em que ordem, e como cada funil é reconhecido — sem depender de programador.

**Para quem.** O consumidor da consulta é o agente do job "AE feedback marketing diário" (roda às 8h30 nos dias úteis), que passa a apenas **formatar** a mensagem do Slack. O consumidor do cadastro é a equipe de marketing, pelo dashboard.

**Qual problema resolve.** Hoje o agente monta o relatório juntando fontes por conta própria e aplicando regras de negócio que ele não conhece. A conferência do relatório de 14/09/2026 achou três erros de natureza diferente:

1. **Comprador contado como lead de outro funil.** O card criado automaticamente para um comprador do workshop (funil WO PAGO no CRM, sem UTM) entrou como lead de AQUISIÇÃO.
2. **Compra subcontada e mal atribuída.** O relatório disse "1 compra" — a atribuição do Meta —, quando a Greenn registrou **3 vendas pagas**, 2 delas vindas de disparo de WhatsApp. E o Meta ainda atribuiu aquela 1 compra à campanha de SE, não à do workshop.
3. **Custo inventado.** Sem nenhum lead no dia, o relatório escreveu "CPL R$ 0,00", que se lê como "lead de graça".

Os três somem quando a regra sai do agente e passa a morar no servidor, num lugar só, com os mesmos critérios que o dashboard já usa.

**Formato da mensagem que a consulta precisa alimentar (ordem atual):**

- Investido geral
- SE — Investido, Novos leads, MQLs, CPL
- LIVE — Investido, Novos leads, CPL
- WO PAGO — Investido, Compras Realizadas, CPA
- AQUISIÇÃO — Investido, Novos leads, MQLs, CPL

**Princípios que valem para a feature inteira:**

- **Nada some.** Todo real investido e todo lead do período aparece em algum bloco. O que não casa com nenhum funil cadastrado vai para o bloco **"sem funil"**, com o valor à mostra — nunca é descartado e nunca é empurrado para um funil "mais parecido".
- **Sem denominador não existe custo.** CPL ou CPA sem leads ou vendas vem **vazio**, e o relatório escreve "—". Zero só aparece quando é zero de verdade.
- **Zero não é o mesmo que "não sei".** Se uma fonte não respondeu ou está desatualizada, a métrica vem vazia com um aviso explicando — nunca como zero.
- **Comprador do workshop nunca é lead de outro funil.**
- **As mesmas regras do dashboard.** Campanha→funil, dia de Brasília, exclusão de teste interno, contagem de venda pela última atualização, corte de bots: tudo reaproveitado das regras que já existem, para o relatório e o dashboard nunca discordarem por critério.
- **Só leitura.** Nada é escrito no CRM, no Meta ou na Greenn.

---

## Páginas / Módulos

### 1. Cadastro de funis (aba nova do dashboard)

**Descrição:** Aba "Funis do relatório" no menu lateral do dashboard, no mesmo padrão visual e de comportamento das abas de cadastro já existentes (Links, Bloqueios): lista no topo, formulário de criação/edição abaixo, validação feita pelo servidor e mensagem de erro exibida no próprio formulário. Cada linha do cadastro vira um bloco do relatório de marketing, na ordem da lista. O acesso é o mesmo do restante do dashboard; toda validação e toda regra de permissão ficam no servidor.

**Componentes:**

- **Lista de funis cadastrados:** tabela na ordem do relatório, com as colunas: posição, nome no relatório, tipo de medição, funil do tracking, opção(ões) do campo "🔻 Funil" do CRM, origem do lead (quando houver), trecho do nome da campanha (quando houver), situação (ativo/arquivado) e data da última alteração.
- **Controles de ordem:** em cada linha ativa, botões "subir" e "descer".
- **Ações por linha:** "Editar", "Arquivar" (linha ativa) e "Reativar" (linha arquivada).
- **Filtro de situação:** alterna entre "ativos" (padrão) e "todos", para ver os arquivados.
- **Formulário de funil** (título "Novo funil" ou "Editando: <nome>"):
  - **Nome no relatório** (texto, obrigatório): como o bloco aparece na mensagem. Ex.: `SE`, `LIVE`, `WO PAGO`, `AQUISIÇÃO`.
  - **Tipo de medição** (escolha única, obrigatório):
    - *Lead do formulário + MQL*
    - *Manual* (o resultado é contado pela equipe fora do tracking; o relatório só mostra o investimento)
    - *Venda na Greenn*
  - **Funil do tracking** (escolha; só aparece e só é obrigatório nos tipos *Lead do formulário + MQL* e *Manual*): lista com os funis que o tracking já reconhece (os mesmos oferecidos hoje na classificação manual de campanhas da aba Meta Ads), incluindo `aquisicao` (impulsionamento de post). Ex.: `sessao-estrategica`. No tipo *Venda na Greenn* **não se aplica** e fica vazio: o produto não tem funil no tracking, e as campanhas dele são reconhecidas só pelo trecho do nome da campanha (decisão 10).
  - **Opção do campo "🔻 Funil" no CRM** (escolha de uma ou mais opções, obrigatório): lista com as opções que existem hoje no campo do CRM, lida do próprio CRM. Ex.: `SESSÃO ESTRATÉGICA`.
  - **Origem do lead** (escolha única; só aparece e só é obrigatória no tipo *Lead do formulário + MQL*): define quais cards daquela opção do CRM contam no funil, pela origem registrada no card (campo utm_source do card no CRM):
    - *Tráfego pago*: utm_source reconhecido como anúncio pela mesma regra de canal usada no CPL por canal (ex.: `facebookads`);
    - *Qualquer origem exceto tráfego pago*: bio, ManyChat, outras UTMs e card **sem** utm_source;
    - *Qualquer origem*: todos os cards da opção.
  - **Trecho do nome da campanha** (texto, opcional): pedaço de texto que, se aparecer no nome da campanha, faz o investimento dela contar para este funil. Ex.: `workshop-pago`. Serve para campanhas cujo nome não segue a nomenclatura em que o funil é o último segmento.
  - **Botões:** "Salvar", "Cancelar edição" (só em edição).
  - **Área de erro:** mensagem do servidor quando a gravação é recusada.
- **Aviso de conflito de campanhas:** caixa acima da lista que aparece quando, no período dos últimos 30 dias, alguma campanha com investimento casa com mais de um funil ativo ou com nenhum, listando campanha e valor.
- **Estado vazio:** quando não há nenhum funil ativo, a mensagem "Nenhum funil cadastrado — todo o investimento do relatório vai aparecer em 'sem funil'."

**Comportamentos:**

- **Abrir a aba:** o sistema carrega a lista de funis ativos na ordem do relatório.
- **Abrir a aba sem acesso ao dashboard:** o sistema recusa, como nas demais abas.
- **Alternar para "todos":** a lista passa a incluir os arquivados, marcados como tal, abaixo dos ativos.
- **Carregar opções do campo de funil do tracking:** o sistema lista os funis reconhecidos pelo tracking mais `aquisicao`.
- **Carregar opções do CRM:** o sistema lê as opções atuais do campo "🔻 Funil" da lista do CRM.
- **Falha ao carregar opções do CRM:** o formulário mostra "Não foi possível ler as opções do CRM agora" e desabilita "Salvar"; os funis já cadastrados continuam visíveis.
- **Opção do CRM cadastrada que deixou de existir no CRM:** a linha da lista mostra a opção marcada como "não existe mais no CRM"; o relatório segue funcionando e inclui um aviso (ver módulo 2).
- **Escolher o tipo "Lead do formulário + MQL":** o formulário mostra o campo "Origem do lead".
- **Escolher o tipo "Manual":** o campo "Origem do lead" some e o valor dele é descartado ao salvar.
- **Escolher o tipo "Venda na Greenn":** os campos "Origem do lead" e "Funil do tracking" somem e os valores deles são descartados ao salvar.
- **Salvar funil do tipo "Lead do formulário + MQL" sem origem do lead:** recusado com "Escolha a origem do lead."
- **Escolher o tipo "Manual":** o formulário mostra a nota "O relatório vai trazer só o investimento deste funil; leads e custo aparecem como contagem manual."
- **Criar funil válido:** o servidor grava o funil como ativo, na **última posição** da ordem, e a lista recarrega mostrando-o.
- **Salvar sem nome:** recusado com "Informe o nome no relatório."
- **Salvar com nome só de espaços:** tratado como vazio; recusado com a mesma mensagem.
- **Nome com espaços nas pontas:** gravado sem os espaços.
- **Nome acima de 40 caracteres:** recusado com "Nome no relatório deve ter até 40 caracteres."
- **Nome igual ao de outro funil ativo (sem diferenciar maiúsculas, minúsculas e acentos):** recusado com "Já existe um funil com esse nome."
- **Nome igual ao de um funil arquivado:** recusado com "Existe um funil arquivado com esse nome — reative-o em vez de criar outro."
- **Nome "sem funil" (qualquer grafia):** recusado com "Esse nome é reservado para o bloco do que não foi classificado."
- **Salvar sem tipo de medição:** recusado com "Escolha o tipo de medição."
- **Salvar funil do tipo "Lead do formulário + MQL" ou "Manual" sem funil do tracking:** recusado com "Escolha o funil do tracking."
- **Funil do tracking que não está na lista de reconhecidos:** recusado com "Funil do tracking desconhecido."
- **Funil do tracking já usado por outro funil ativo** (a comparação só vale entre funis que têm funil do tracking; o de venda na Greenn, vazio, não conflita): recusado com "Esse funil do tracking já pertence ao bloco <nome>." (um mesmo investimento não pode contar em dois blocos).
- **Salvar sem opção do CRM:** recusado com "Escolha ao menos uma opção do campo Funil do CRM."
- **Opção do CRM que não existe no CRM no momento de salvar:** recusado com "Essa opção não existe no CRM."
- **Mesma opção do CRM em mais de um funil ativo com origens que não se sobrepõem** ("Tráfego pago" em um e "Qualquer origem exceto tráfego pago" no outro): aceito — cada card cai em exatamente um dos dois.
- **Mesma opção do CRM em mais de um funil ativo com origens que se sobrepõem** (a mesma origem nos dois, ou "Qualquer origem" junto de qualquer outra): recusado com "A opção <opção> com essa origem já pertence ao bloco <nome>." (um mesmo card não pode contar em dois blocos).
- **Mesma opção do CRM num funil do tipo "Manual" ou "Venda na Greenn" e em qualquer outro funil ativo:** recusado com "A opção <opção> com essa origem já pertence ao bloco <nome>." (esses tipos não têm origem e ocupam a opção inteira).
- **Trecho do nome da campanha com menos de 4 caracteres (após remover espaços):** recusado com "O trecho precisa ter ao menos 4 caracteres." (evita que um trecho curto capture campanhas de outros funis).
- **Trecho do nome da campanha igual ou contido no trecho de outro funil ativo (ou vice-versa):** recusado com "Esse trecho se sobrepõe ao do bloco <nome>."
- **Trecho vazio:** aceito; o funil passa a reconhecer campanhas só pela regra automática e pela classificação manual.
- **Segundo funil ativo do tipo "Venda na Greenn":** recusado com "Já existe um funil de venda na Greenn (<nome>). Hoje as vendas da Greenn não são separadas por produto." (evita que a mesma venda conte em dois blocos).
- **Tipo "Venda na Greenn" sem trecho do nome da campanha:** aceito, com o aviso no formulário "Sem trecho, as campanhas deste produto podem cair em 'sem funil'."
- **Salvar enquanto outra pessoa alterou o mesmo funil:** recusado com "Este funil foi alterado por outra pessoa. Recarregue antes de salvar." — nada é sobrescrito.
- **Clicar em "Editar":** o formulário é preenchido com os valores da linha e o título muda para "Editando: <nome>".
- **Clicar em "Cancelar edição":** o formulário volta a "Novo funil" e fica vazio, sem gravar nada.
- **Salvar edição válida:** o servidor grava, mantém a posição do funil na ordem e atualiza a data da última alteração.
- **Editar funil do tracking, opção do CRM, trecho ou tipo de um funil que já apareceu em relatórios:** antes de gravar, o dashboard pede confirmação com o texto "Esta mudança também altera os números de relatórios passados, se forem consultados de novo." — cancelar não grava.
- **Editar só o nome:** grava sem pedir confirmação.
- **Clicar em "subir" na primeira linha / "descer" na última:** botão desabilitado; nada acontece.
- **Clicar em "subir" ou "descer":** o servidor troca a posição com a linha vizinha e a lista recarrega na nova ordem.
- **Mudança de ordem:** vale a partir da próxima consulta do relatório.
- **Clicar em "Arquivar":** o dashboard pede confirmação com "O bloco <nome> sai do relatório. O investimento e os leads dele passam a aparecer em 'sem funil', inclusive se um dia passado for consultado de novo."
- **Confirmar o arquivamento:** o servidor marca o funil como arquivado, tira-o da ordem e as posições seguintes sobem.
- **Excluir definitivamente:** não existe. Funil nunca é apagado — só arquivado —, para que o histórico do cadastro continue legível.
- **Clicar em "Reativar":** o servidor valida de novo as regras de unicidade (nome, funil do tracking, opção do CRM combinada com a origem do lead — mesma regra de sobreposição da criação —, trecho, venda na Greenn única) contra os ativos; se passar, o funil volta ativo na **última posição**.
- **Reativar funil que conflita com um ativo:** recusado com a mesma mensagem de conflito da criação.
- **Arquivar o único funil ativo:** permitido; a aba passa a mostrar o estado vazio.
- **Mostrar o aviso de conflito de campanhas:** ao abrir a aba, o servidor calcula as campanhas com investimento nos últimos 30 dias que casam com dois funis ou com nenhum, e a caixa lista cada uma com o valor.
- **Nenhum conflito:** a caixa não aparece.
- **Primeiro acesso após a entrada da feature:** a lista já vem com os quatro blocos do relatório atual, na ordem atual (ver módulo 3), para que nada mude no dia da troca.

---

### 2. Endpoint de feedback de marketing (`GET /api/feedback-marketing`)

**Descrição:** Consulta só de leitura, protegida por chave própria, que devolve tudo o que o relatório de marketing (diário, semanal ou mensal) precisa já calculado: período, investimento geral, um bloco por funil ativo do cadastro (na ordem do cadastro), o bloco "sem funil", totais, frescor das fontes e avisos. O agente só formata. Não escreve em lugar nenhum.

**Componentes (conteúdo da resposta):**

- **Período:**
  - data inicial e data final (dias de Brasília, inclusive);
  - quantidade de dias;
  - rótulo pronto para leitura (ex.: "14/09" ou "12/09 a 14/09");
  - indicador se o período foi escolhido pelo sistema (padrão) ou informado por quem consultou;
  - indicador de período **parcial**, quando inclui o dia de hoje.
- **Gerado em:** data e hora da consulta, em Brasília.
- **Investido geral:** soma de todo investimento do período, de todas as campanhas, **incluindo** o que está em "sem funil".
- **Blocos por funil** (um por funil ativo do cadastro, na ordem do cadastro), cada um com:
  - nome no relatório, tipo de medição e posição;
  - **investido** no período;
  - campanhas que compõem o investimento (nome, valor e como foram reconhecidas: classificação manual, trecho do cadastro, regra automática ou impulsionamento);
  - métricas do tipo de medição (abaixo);
  - custo por resultado (vazio quando não há denominador);
  - avisos do bloco.
- **Métricas por tipo de medição:**
  - *Lead do formulário + MQL:* novos leads, MQLs e CPL (investido ÷ novos leads).
  - *Manual:* só o investido; novos leads e custo vêm marcados como **não calculados**, com o motivo "contagem manual" — ausentes, nunca zero.
  - *Venda na Greenn:* compras realizadas = **todas** as vendas pagas no período, de qualquer origem; CPA = investido do funil ÷ compras realizadas; e, como informação complementar, a quebra das compras por origem — **tráfego pago**, **disparo**, **outra origem** e **sem rastreio**. A compra atribuída pelo Meta não é usada.
- **Bloco "sem funil"** (sempre presente, sempre depois dos blocos cadastrados):
  - investido sem classificação, com a lista de campanhas e valores;
  - novos leads cuja opção do CRM não pertence a nenhum funil ativo (incluindo cards sem a opção preenchida), com a contagem por opção encontrada;
  - MQLs desses leads;
  - **sem** CPL: o investimento e os leads deste bloco não têm ligação entre si, então custo por lead aqui seria número inventado;
  - indicador de vazio (nenhum investimento e nenhum lead).
- **Totais:**
  - investido geral;
  - novos leads (todos os blocos do tipo lead + "sem funil");
  - MQLs (idem);
  - compras realizadas (do bloco de venda na Greenn, se houver).
  - Os totais não incluem nenhum número de funis do tipo "Manual", além do investimento.
- **Frescor das fontes:**
  - data e hora da última atualização do investimento;
  - se a leitura do CRM funcionou;
  - data e hora do último evento recebido da Greenn.
- **Avisos gerais:** lista de frases prontas em português que o agente pode repassar como estão (ex.: "R$ 42,10 de investimento sem funil — classifique as campanhas no dashboard.").

**Comportamentos:**

*Autenticação*

- **Consultar com a chave própria correta:** o sistema responde com o relatório.
- **Consultar sem chave:** recusado como acesso negado, sem nenhum dado no corpo.
- **Consultar com chave errada:** recusado como acesso negado, com a mesma resposta de "sem chave" (não revela se a chave existe ou está quase certa).
- **Consultar com a chave do dashboard:** recusado como acesso negado — a chave do dashboard não abre esta consulta.
- **Usar a chave própria em qualquer outra rota do dashboard ou da API:** recusado — a chave só abre esta consulta.
- **Chave própria não configurada no servidor:** toda consulta é recusada (a rota nunca fica aberta por falta de configuração).
- **Chave enviada no endereço da consulta:** recusado com "Envie a chave como credencial da requisição, não no endereço." — para a chave não ficar gravada em históricos e registros de acesso.
- **Consulta com método diferente de leitura:** recusada como método não permitido; nada é alterado.

*Período*

- **Consultar sem informar período:** o sistema usa o período padrão do relatório: **ontem**; se hoje for **segunda-feira**, de **sexta a domingo**. A resposta marca o período como padrão.
- **Informar só uma data:** o período é aquele único dia.
- **Informar data inicial e final:** o período é o intervalo, inclusive nas duas pontas.
- **Data em formato inválido:** recusado com "Data inválida: use AAAA-MM-DD."
- **Data que não existe (ex.: 31/09):** recusado com a mesma mensagem.
- **Data final anterior à inicial:** recusado com "A data final é anterior à inicial."
- **Intervalo de 1 a 92 dias (inclusive):** aceito — cobre o feedback diário, sexta a domingo, a semana e o mês.
- **Intervalo acima de 92 dias:** recusado com "O período pode ter no máximo 92 dias — divida em mais de uma consulta."
- **Uso pelo comparativo semanal:** quem consulta chama duas vezes — uma com o período atual e outra com o período anterior — e compara as respostas; a consulta não calcula variação nem conhece a noção de "período anterior".
- **Mesmo cadastro nas duas chamadas do comparativo:** as duas respostas usam o cadastro vigente no momento da consulta, então os blocos das duas chamadas são sempre os mesmos e na mesma ordem.
- **Data no futuro:** recusado com "O período não pode terminar no futuro."
- **Período que inclui hoje:** aceito; a resposta marca o período como **parcial** e inclui o aviso "Dia de hoje ainda em andamento — números parciais."
- **Recorte dos dias:** todos os dados (investimento, cards, vendas, entradas) são recortados pelo dia de Brasília, do início do primeiro dia ao fim do último.
- **Feriado:** não há tratamento especial; o período padrão segue só a regra ontem/segunda-feira, e quem consulta pode informar o intervalo manualmente.

*Investimento e reconhecimento de campanhas*

- **Somar investimento do período:** o sistema soma o investimento de cada campanha nos dias do período.
- **Reconhecer o funil de uma campanha:** a ordem de decisão é (1) classificação manual feita na aba Meta Ads; (2) trecho do nome da campanha de um funil ativo do cadastro; (3) regra automática pelo último segmento do nome, incluindo impulsionamento de post como `aquisicao`; (4) nenhum → "sem funil".
- **Ligar a campanha ao bloco:** o funil do tracking reconhecido é comparado com o funil do tracking de cada funil ativo do cadastro; casou, o investimento vai para aquele bloco.
- **Campanha reconhecida para um funil do tracking que não está em nenhum funil ativo:** o investimento vai para "sem funil", com a campanha listada e o motivo "funil <x> não cadastrado no relatório".
- **Campanha cujo nome contém o trecho de dois funis ativos:** o investimento vai para "sem funil", com o motivo "casou com mais de um funil", e entra um aviso geral. Nunca é dividida nem atribuída ao primeiro que casou.
- **Campanha com classificação manual para um funil arquivado ou não cadastrado:** vai para "sem funil" com o motivo correspondente.
- **Período sem nenhum investimento:** investido geral é 0, cada bloco tem investido 0 e nenhuma campanha listada.
- **Investimento desatualizado** (última atualização anterior ao fim do período): os números vêm normalmente e entra o aviso "O investimento foi atualizado pela última vez em <data e hora> — pode estar incompleto."
- **Soma dos investimentos dos blocos + "sem funil" diferente do investido geral:** a resposta inclui o aviso "Investimento dos blocos não fecha com o investido geral." (conferência interna; não deveria acontecer).

*Tipo "Lead do formulário + MQL"*

- **Contar novos leads:** cards da lista do CRM **criados** no período (data de criação em Brasília) cuja opção do campo "🔻 Funil" pertence ao funil **e** cuja origem (utm_source do card) se encaixa na origem do lead cadastrada no funil.
- **Card `SESSÃO ESTRATÉGICA` com utm_source de anúncio (ex.: `facebookads`):** conta no funil com essa opção e origem "Tráfego pago" (no cadastro inicial, SE).
- **Card `SESSÃO ESTRATÉGICA` vindo da bio, do ManyChat ou de outra UTM:** conta no funil com essa opção e origem "Qualquer origem exceto tráfego pago" (no cadastro inicial, AQUISIÇÃO).
- **Card `SESSÃO ESTRATÉGICA` sem utm_source:** conta no funil com origem "Qualquer origem exceto tráfego pago" (no cadastro inicial, AQUISIÇÃO).
- **Card cuja opção do CRM está cadastrada, mas cuja origem não se encaixa em nenhum funil ativo daquela opção** (ex.: só existe o funil "Tráfego pago" e o card veio da bio): conta em "sem funil", identificado como "opção <x> com origem não cadastrada".
- **Card de lead que voltou** (card antigo que só recebeu comentário no período): não conta como novo lead.
- **Contar MQL:** novo lead com faturamento mensal **acima de R$ 20 mil** e status atual **diferente de Desqualificado**.
- **Card sem faturamento preenchido:** conta como novo lead e não conta como MQL.
- **MQL avaliado pelo status no momento da consulta:** o status usado é o atual do card, não o que ele tinha no fim do período. Um lead desqualificado depois deixa de ser MQL se o período for consultado de novo.
- **MQL em períodos longos ou antigos:** num período fechado há mais tempo (ex.: um mês de três meses atrás), a equipe já teve mais tempo para desqualificar leads, então a proporção de MQL tende a ser **menor** do que a de um período recente; comparar períodos de idades diferentes precisa levar isso em conta.
- **Informar o critério do MQL:** a resposta sempre traz a nota de que o MQL reflete o status do momento da consulta.
- **Calcular CPL:** investido do bloco ÷ novos leads, em reais com duas casas.
- **Bloco sem novos leads:** novos leads 0, MQLs 0 e **CPL vazio** (o relatório escreve "—").
- **Bloco com leads e sem investimento:** CPL 0 — é custo zero de verdade (lead orgânico), e a resposta marca "sem investimento no período".
- **Card de teste ou de bot já marcado como tal no tracking:** não conta, pelo mesmo critério da aba de leads.
- **Card com opção do CRM de um funil do tipo "Venda na Greenn" (comprador):** **nunca** conta como lead — nem no próprio bloco de venda, nem em outro bloco, nem em "sem funil".
- **Card com opção do CRM que não pertence a nenhum funil ativo (ex.: `TRAFEGO PAGO`, `ISCAS`):** conta em "sem funil", identificado pela opção. **Diferença intencional em relação ao relatório antigo**, que jogava esses cards em AQUISIÇÃO: nada cai em funil por padrão.
- **Card sem opção do campo "🔻 Funil":** conta em "sem funil", identificado como "sem opção de funil no CRM".
- **CRM indisponível na hora da consulta:** novos leads, MQLs e CPL de todos os blocos do tipo lead (e os leads de "sem funil") vêm **vazios**, nunca zero, com o aviso "Não foi possível ler o CRM — leads e MQLs não informados."; investimento e vendas seguem normalmente.
- **Opção do CRM cadastrada que não existe mais no CRM:** o bloco é calculado com as opções que ainda existem e entra o aviso "A opção <x> do bloco <nome> não existe mais no CRM."

*Tipo "Manual"*

- **Montar o bloco:** traz o investido do período das campanhas reconhecidas para o funil, com a lista de campanhas.
- **Novos leads e custo:** vêm marcados como **não calculados**, com o motivo "contagem manual"; nunca 0 e nunca um número estimado.
- **Bloco manual sem investimento no período:** investido 0; leads e custo continuam "não calculados".
- **Cards do CRM com a opção de um funil deste tipo:** não contam como lead em nenhum bloco nem em "sem funil" (o número do funil é o da equipe), e não entram nos totais.
- **Número da contagem manual:** a consulta não recebe nem devolve; quem monta a mensagem obtém da equipe.

*Tipo "Venda na Greenn"*

- **Contar compras realizadas:** **todas** as vendas da Greenn cuja atualização **mais recente** tem status pago e que foram pagas dentro do período (dia de Brasília), qualquer que seja a origem.
- **Mesma venda notificada várias vezes:** conta uma vez só.
- **Venda paga e depois estornada/reembolsada:** não conta.
- **Venda aguardando pagamento, recusada ou cancelada:** não conta.
- **Venda de teste interno** (e-mail da lista de teste interno já usada na aba Greenn): não conta em nada.
- **Notificação ilegível:** não conta e soma no aviso "N registros da Greenn não puderam ser lidos."
- **Classificar a origem da venda:** pela UTM da sessão de checkout ligada à venda:
  - **tráfego pago:** origem reconhecida como anúncio pela mesma regra de canal usada no CPL por canal;
  - **disparo:** origem de disparo de WhatsApp (ex.: `disparo-api`);
  - **outra origem:** UTM presente que não é anúncio nem disparo (ex.: bio, e-mail);
  - **sem rastreio:** venda sem ligação com sessão de checkout, com ligação órfã ou com sessão sem UTM.
- **Quebra por origem:** informação complementar; não altera as compras realizadas nem o CPA.
- **Soma das origens:** sempre igual ao total de compras realizadas.
- **Calcular CPA:** investido do funil ÷ total de compras realizadas (todas as origens), em reais com duas casas.
- **Compra atribuída pelo Meta:** não é usada em nenhum número da resposta — nem neste bloco, nem no bloco da campanha à qual o Meta atribuiu a compra (ex.: SE).
- **Investido do bloco:** investimento do período das campanhas reconhecidas para este funil pelo trecho do nome da campanha no cadastro. Como este tipo não tem funil do tracking, a classificação manual e a regra automática não trazem campanha para ele; uma classificação manual para outro funil vence o trecho (decisão 10).
- **Período com investimento e sem venda:** compras 0 e CPA vazio.
- **Venda sem investimento no período** (ex.: só disparo): compras contadas normalmente e CPA 0, marcado "sem investimento no período".
- **Nenhuma notificação da Greenn desde antes do início do período:** compras vêm normalmente (podem ser 0) com o aviso "Nenhum evento da Greenn desde <data>."
- **Nenhum funil do tipo "Venda na Greenn" cadastrado:** vendas da Greenn não aparecem em bloco nenhum; entra o aviso "Há N vendas pagas na Greenn no período e nenhum funil de venda cadastrado."

*Bloco "sem funil", ordem e resposta*

- **Ordenar os blocos:** na ordem do cadastro; "sem funil" sempre por último.
- **Funil arquivado:** não gera bloco; o que era dele cai em "sem funil".
- **Nenhum funil ativo cadastrado:** a resposta tem só o investido geral, o bloco "sem funil" com tudo e o aviso "Nenhum funil cadastrado."
- **"Sem funil" com investimento:** entra o aviso geral "R$ <valor> de investimento sem funil — classifique as campanhas no dashboard."
- **"Sem funil" vazio:** o bloco vem presente, marcado como vazio, para o agente decidir omiti-lo na mensagem.
- **Dia sem dado nenhum** (sem investimento, sem card, sem venda): resposta completa com todos os blocos, volumes 0, custos vazios e nenhum erro.
- **Valores monetários:** números em reais com duas casas; a formatação ("R$ 1.234,56" ou "—") é do agente.
- **Mudança recente no cadastro:** vale na consulta seguinte.
- **Consultar o mesmo período duas vezes sem mudança nos dados:** mesma resposta.
- **Falha inesperada no servidor:** resposta de erro com a mensagem "Não foi possível montar o feedback agora." e sem números parciais disfarçados de completos.

---

### 3. Migração do reconhecimento do workshop pago para o cadastro

**Descrição:** Hoje a aba Greenn reconhece as campanhas do workshop pago por um padrão fixo no código (`workshop-pago` no nome da campanha). Esse reconhecimento passa a vir do **trecho do nome da campanha** do funil ativo do tipo "Venda na Greenn" no cadastro. O padrão fixo deixa de existir. A entrada da feature não pode mudar nenhum número que o dashboard mostra hoje.

**Componentes:**

- **Cadastro inicial:** os quatro blocos do relatório atual, criados na entrada da feature, na ordem atual:
  1. `SE` — Lead do formulário + MQL — funil do tracking `sessao-estrategica` — opção do CRM `SESSÃO ESTRATÉGICA` — origem "Tráfego pago" — sem trecho.
  2. `LIVE` — Manual — funil do tracking `lives-semanais-v1` — opção do CRM `LIVES SEMANAIS` — sem trecho.
  3. `WO PAGO` — Venda na Greenn — sem funil do tracking (não se aplica) — opção do CRM `WO PAGO` — trecho `workshop-pago`.
  4. `AQUISIÇÃO` — Lead do formulário + MQL — funil do tracking `aquisicao` — opção do CRM `SESSÃO ESTRATÉGICA` — origem "Qualquer origem exceto tráfego pago" — sem trecho.
- **Por que SE e AQUISIÇÃO dividem a mesma opção do CRM:** reproduz o relatório atual, que conta SE só com utm_source `facebookads` e manda o resto dos cards de `SESSÃO ESTRATÉGICA` para AQUISIÇÃO.
- **Aviso na aba Greenn:** faixa que aparece quando não há funil ativo do tipo "Venda na Greenn" ou quando ele não tem trecho do nome da campanha.

**Comportamentos:**

- **Criar o cadastro inicial:** acontece uma única vez, na entrada da feature; se já houver funis cadastrados, nada é criado nem sobrescrito.
- **Reconhecer campanha do produto na aba Greenn:** usa o trecho do nome da campanha do funil ativo do tipo "Venda na Greenn", sem diferenciar maiúsculas e minúsculas — mesmo comportamento do padrão fixo de hoje.
- **Conferência de equivalência:** com o cadastro inicial, a aba Greenn mostra exatamente os mesmos números (investimento, receita, vendas, ROAS e custo por venda, por campanha e no resumo) que mostrava antes da troca, para qualquer período.
- **Alterar o trecho no cadastro:** a aba Greenn passa a reconhecer as campanhas pelo trecho novo na próxima abertura.
- **Arquivar o funil de venda na Greenn:** a aba Greenn continua listando as vendas e as campanhas **que venderam**, mas deixa de listar campanhas que só gastaram, e mostra o aviso "Nenhum funil de venda cadastrado — as campanhas do produto que não venderam não aparecem. Cadastre em Funis do relatório."
- **Funil de venda sem trecho:** mesmo comportamento e mesmo aviso, com o texto "O funil <nome> não tem trecho do nome da campanha."
- **Filtro de datas da aba Greenn:** continua como hoje (ciclo inteiro da campanha, sem seguir o filtro de datas); só a origem do reconhecimento muda.
- **Exclusão de teste interno e contagem por última atualização da venda:** continuam como hoje e são as mesmas usadas pelo endpoint de feedback de marketing.
- **Classificação manual de campanhas na aba Meta Ads:** continua funcionando como hoje e continua vencendo o trecho do cadastro no endpoint de feedback de marketing.

---

## Fora do escopo

- Alterar o prompt ou a configuração do job "AE feedback marketing diário" no Hermes para passar a usar o endpoint — fica para depois, com aprovação da usuária.
- Qualquer escrita no CRM (ClickUp), no Meta ou na Greenn: criar, editar, taguear ou mover cards; mudar campanhas; alterar vendas.
- Envio da mensagem ao Slack — continua sendo do agente.
- Alterar o prompt do job do comparativo semanal de segunda-feira no Hermes para usar o endpoint (a consulta já fica pronta para ele; a troca no job é depois, com aprovação).
- Tela para a equipe digitar a contagem manual (ex.: entradas no grupo da LIVE) — por enquanto, o número manual não passa pelo tracking.
- Tipo de medição com contagem automática de entradas no grupo de WhatsApp.
- Calcular variação entre períodos dentro da consulta.
- Uso da compra atribuída pelo Meta.
- Separar vendas da Greenn por produto (hoje só um funil de venda pode existir).
- Tratamento de feriados no período padrão.
- Rotacionar a chave do dashboard (pendência já conhecida, independente desta feature).
- Mudar a regra automática de campanha→funil pelo último segmento do nome ou a nomenclatura das campanhas.
- Métricas que não estão na mensagem atual (receita, ROAS, custo por MQL no relatório).

---

## Decisões

Respostas da usuária às perguntas levantadas na primeira versão desta spec (15/09/2026):

**1. Denominador da LIVE — contagem manual.** Por enquanto, as entradas no grupo da LIVE são contadas pela equipe. Existe o tipo de medição **"Manual"** no cadastro de funis. Para funil desse tipo, o endpoint devolve o investimento e marca leads e custo como **não calculados** ("contagem manual"), sem inventar número. Não há tela de digitação da contagem manual (fora do escopo por enquanto).

**2. CPA do WO PAGO — todas as vendas pagas da Greenn.** O WO PAGO considera **todas** as vendas pagas da Greenn no período, de qualquer origem (tráfego pago, disparo, sem rastreio). CPA = investimento do funil ÷ total de vendas pagas. A compra atribuída pelo Meta **não** é usada. A quebra das vendas por origem fica como informação complementar.

**3. Comparativo semanal de segunda — também usa o endpoint.** O endpoint aceita qualquer intervalo de datas (não só um dia ou sexta a domingo). O comparativo é obtido chamando o endpoint duas vezes (período atual e período anterior); o endpoint não calcula variação. Alterar o prompt dos jobs no Hermes continua fora do escopo.

**4. Um endpoint para diário, semanal e mensal, com teto de 92 dias.** O mesmo endpoint, `GET /api/feedback-marketing`, serve o feedback diário, o semanal e o mensal. Cada chamada aceita de 1 a 92 dias (inclusive); acima disso é recusada e a consulta deve ser dividida.

**5. AQUISIÇÃO é separada de SE pela origem do card.** Os leads de AQUISIÇÃO vêm do link da bio ou do ManyChat, mas entram no CRM com a opção `SESSÃO ESTRATÉGICA` no campo "🔻 Funil" — e o CRM fica como está. Quem separa os dois é a origem do card (utm_source). Por isso cada funil do tipo "Lead do formulário + MQL" tem o campo **Origem do lead**, e a mesma opção do CRM pode estar em mais de um funil ativo desde que as origens não se sobreponham. Cadastro inicial: SE = `SESSÃO ESTRATÉGICA` + "Tráfego pago"; AQUISIÇÃO = `SESSÃO ESTRATÉGICA` + "Qualquer origem exceto tráfego pago" (card sem utm_source vai para AQUISIÇÃO).

**6. Card com opção do CRM fora do cadastro vai para "sem funil".** Cards com opções que não pertencem a nenhum funil ativo (ex.: `TRAFEGO PAGO`, `ISCAS`) passam a aparecer em "sem funil". É uma diferença **intencional** em relação ao relatório antigo, que os jogava em AQUISIÇÃO: nada cai em funil por padrão. O comprador do workshop (opção `WO PAGO`) continua nunca contando como lead.

**7. Só um funil ativo do tipo "Venda na Greenn".** Confirmado: como as vendas da Greenn não são separadas por produto, o cadastro recusa um segundo funil ativo desse tipo.

**8. LIVE usa o funil do tracking `lives-semanais-v1`** (15/09/2026, com base no D1 remoto). A campanha da live é `ae_leads_publico-frio_evento-lead_lives-semanais`; a regra automática casa o último segmento `lives-semanais` por prefixo com `lives-semanais-v1`, o único funil do tracking dessa família com lead válido (funis com lead válido: `aplicacao-mentoria`, `diagnostico`, `lives-semanais-v1`, `sessao-estrategica`, `trafego-atacado`, `workshop`). Nenhuma regra nova.

**9. Venda na Greenn não tem funil do tracking** (15/09/2026). Não existe funil do tracking do workshop pago: o funil `workshop` é o do workshop GRATUITO e não deve ser usado, e as campanhas do produto (`ae_vendas-workshop-pago-09-09_publico-frio`, `ae_vendas-workshop-pago-23-09_publico-frio`, `ae_vendas-workshop-pago-23-09_publico-quente`) terminam no público, não no funil. Por isso, no tipo "Venda na Greenn" o funil do tracking não se aplica e fica vazio (como a origem do lead); o reconhecimento das campanhas é só pelo trecho do nome (decisão 10). "Funil do tracking obrigatório" vale só para os tipos "Lead do formulário + MQL" e "Manual". O cadastro inicial do WO PAGO fica sem funil do tracking e com o trecho `workshop-pago`.

**10. Venda na Greenn só recebe campanha pelo trecho** (15/09/2026). Como o bloco do tipo "Venda na Greenn" não tem funil do tracking (decisão 9), a classificação manual e a regra automática — que sempre resolvem para um funil do tracking — nunca o alcançam: ele só recebe campanha pelo trecho do nome. Se a campanha tiver classificação manual para outro funil, a classificação vence o trecho e a campanha vai para o funil classificado (ou para "sem funil", com o motivo, se esse funil não tiver bloco ativo). Resolve a contradição apontada na issue 236 com o texto do módulo 2.

**11. Faixa de faturamento conta como MQL pelo teto** (15/09/2026). O campo "🤑 Faturamento Mensal" do CRM é texto livre com faixas ("De 20 a 30 Mil", "De 150 a 200 Mil"). Uma faixa é MQL quando o **teto** passa de R$ 20 mil — "De 20 a 30 Mil" e "De 20 a 50 Mil" contam; "Menos de 20 Mil" e "De 10 a 20 mil" não. É a régua do comparativo semanal; o relatório diário deixava essas duas faixas de fora, então o MQL do diário sobe (~10 por mês) a partir da troca.
