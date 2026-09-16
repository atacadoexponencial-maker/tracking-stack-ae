# Spec: Reenvio garantido de conversões ao Meta e monitoramento da saúde do envio

## Visão Geral

**O que faz.** Garante que nenhuma conversão destinada ao Meta se perca por uma recusa ou por uma falha passageira, e torna a saúde desse envio **visível** e **vigiada**. São três partes que funcionam juntas:

1. **Reenvio automático:** toda conversão que o Meta não aceitou na primeira tentativa entra numa fila de reenvio, com limite de tentativas, dentro da janela em que o Meta ainda aceita o evento, sem nunca gerar conversão duplicada. O que não tiver mais salvação termina num destino final consultável, **"falhou de vez"**, com o motivo legível.
2. **Monitoramento:** uma área nova no dashboard, **"Saúde do Meta"**, que mostra por período a taxa de aceitação por tipo de evento, o que está esperando reenvio, as falhas definitivas, a última conversão aceita e a taxa de captura dos identificadores de clique nas visitas vindas de anúncio.
3. **Alerta:** quando a aceitação cair ou as conversões pararem de ser aceitas por um período, alguém é avisado por um canal que **não depende** do WhatsApp.

**Para quem.** Para a operação de marketing, que decide campanha com base no que o Meta enxerga, e para quem mantém o tracking, que precisa saber em horas — e não em semanas — que o envio quebrou.

**Qual problema resolve.** Hoje cada conversão do site (Lead e demais eventos) e cada venda (Purchase dos gateways e da ponte do CRM) é enviada ao Meta **uma única vez**, durante o próprio registro. A resposta fica guardada, mas ninguém tenta de novo: se o Meta recusar ou a rede falhar, a conversão se perde. O único aviso de falha sai pelo WhatsApp, que está mudo desde 10/08/2026 e em aposentadoria. O resultado real: **de 30/07 a 15/09/2026 o Meta recusou 100% das conversões** (credencial com um caractere invisível) e ninguém soube por **6 semanas** — e, como não havia fila, tudo o que foi recusado nesse período está perdido para sempre.

**Precedente interno.** A conversão de entrada em grupo (`EntrouGrupo`) já funciona com fila própria: situação pendente/enviada/falha, contagem de tentativas, expiração antes do limite do Meta e separação entre erro de credencial (não consome tentativa) e erro do evento. Esta feature estende **o mesmo conceito** às demais conversões, com as mesmas regras de decisão, para que o projeto tenha uma única forma de pensar reenvio.

**Princípios que valem para a feature inteira:**

- **Nada se perde em silêncio.** Toda conversão destinada ao Meta termina em exatamente uma de três situações: **aceita**, **aguardando reenvio** ou **falhou de vez** (com motivo). Não existe quarta situação.
- **Reenviar nunca duplica.** Todo reenvio usa o **mesmo identificador de evento** e o **mesmo horário original do evento** da primeira tentativa; o Meta descarta a repetição. O conteúdo reenviado é o mesmo que foi montado na primeira tentativa.
- **Erro de credencial não é culpa do evento.** Quando o Meta recusa por credencial inválida, expirada ou sem permissão (ou quando a credencial nem está configurada), a conversão **não consome tentativa** e continua aguardando — mas o problema é tratado como **incidente**, alertado imediatamente.
- **A janela do Meta manda.** Evento com mais de 7 dias o Meta recusa; por isso nenhuma conversão é reenviada depois de **6 dias** do horário original (margem de segurança, a mesma do `EntrouGrupo`). Passou disso, vai para "falhou de vez" com o motivo "expirou".
- **O que nunca deveria ir ao Meta continua fora.** Bots, leads bloqueados e eventos internos não entram na fila, nem contam no monitoramento.
- **Barato por construção.** O banco já estourou o limite de leitura duas vezes por varreduras. Toda rotina periódica e toda consulta do painel leem **só** o que está pendente ou o período pedido, nunca a história inteira; rodada sem trabalho quase não custa nada.
- **Lógica no servidor.** Taxas, classificação de erro, decisão de reenvio e decisão de alerta são calculadas no servidor. O dashboard só pede e exibe.

---

## Páginas / Módulos

### 1. Registro da conversão para reenvio (sistema)

**Descrição:** Ponto em que cada conversão destinada ao Meta, depois da primeira tentativa de envio, recebe uma situação. Vale para todas as origens de conversão ao Meta, exceto `EntrouGrupo` (que já tem fila própria): eventos de conversão do site (Lead e demais eventos de conversão que hoje já vão ao Meta — **PageView fica fora**, ver "Decisões tomadas", item 3) e Purchase (vendas de gateways e da ponte do CRM). A primeira tentativa continua acontecendo no mesmo momento de hoje; nada muda para o visitante nem para quem envia a venda.

**Componentes:**

- **Situação da conversão:** aceita, aguardando reenvio ou falhou de vez.
- **Tipo do evento:** Lead, Purchase e demais eventos de conversão, como enviado ao Meta.
- **Origem:** site ou venda (gateway / ponte do CRM).
- **Identificador do evento:** o mesmo usado na primeira tentativa.
- **Horário original do evento:** o mesmo usado na primeira tentativa.
- **Conteúdo enviado:** o mesmo montado na primeira tentativa, preservado para o reenvio.
- **Tentativas consumidas:** começa em 1 após a primeira tentativa, exceto quando a falha é de credencial.
- **Última resposta do Meta:** código e texto da resposta mais recente.
- **Categoria do erro:** credencial, evento recusado, falha passageira ou expirou.
- **Motivo legível:** frase em português explicando a categoria (ver módulo 2).
- **Horário da última tentativa** e **horário em que foi aceita** (quando aceita).

**Comportamentos:**

- **Primeira tentativa aceita pelo Meta:** a conversão é registrada como aceita, com o horário de aceitação; não entra na fila.
- **Primeira tentativa recusada por credencial:** a conversão é registrada como aguardando reenvio, com zero tentativas consumidas e categoria "credencial".
- **Credencial do Meta não configurada no momento do envio:** tratado igual a erro de credencial (aguardando reenvio, sem consumir tentativa).
- **Primeira tentativa com falha passageira** (sem resposta, tempo esgotado, erro de rede, erro temporário do lado do Meta, limite de volume atingido): registrada como aguardando reenvio, com uma tentativa consumida.
- **Primeira tentativa recusada por problema do próprio evento** (conteúdo inválido, parâmetro rejeitado, evento velho demais): registrada como falhou de vez, com o motivo; não entra na fila, porque reenviar o mesmo conteúdo daria o mesmo erro.
- **Evento de bot:** não é enviado, não recebe situação e fica fora da fila e do monitoramento, como hoje.
- **Lead bloqueado:** não é enviado, não recebe situação e fica fora da fila e do monitoramento, como hoje.
- **Evento interno (clique em CTA, início de formulário, etapa de formulário):** não é enviado, não recebe situação e fica fora da fila e do monitoramento, como hoje.
- **Evento que hoje não vai ao Meta por decisão de configuração (ex.: venda de teste interno):** continua fora, sem situação.
- **Conversões registradas antes da ativação da feature:** na ativação, as recusadas cujo horário original ainda está dentro de 6 dias entram na fila; as mais antigas ficam só como registro (ver "Decisões tomadas", item 5).
- **PageView:** continua sendo enviado ao Meta como hoje, sem situação, fora da fila e do monitoramento (ver "Decisões tomadas", item 3).
- **Falha ao registrar a situação:** a primeira tentativa e o registro principal do evento continuam valendo como hoje; a falha é registrada no log do servidor e o evento aparece no monitoramento como "sem situação" (ver módulo 3).

---

### 2. Reenvio automático (sistema)

**Descrição:** Rotina periódica que pega as conversões aguardando reenvio e tenta de novo, respeitando limite de tentativas, janela de 6 dias e distinção entre credencial e evento. Mesma lógica de decisão da fila do `EntrouGrupo`.

**Componentes:**

- **Limite de tentativas:** número máximo de tentativas que consomem contagem por conversão (5, ver "Decisões tomadas", item 4).
- **Intervalo entre rodadas:** periodicidade da rotina (proposta: 15 minutos).
- **Espera crescente:** uma conversão que falhou por motivo passageiro só é tentada de novo depois de um intervalo que aumenta a cada tentativa.
- **Tamanho máximo da rodada:** quantidade máxima de conversões tentadas por rodada.
- **Resumo da rodada:** aceitas, ainda pendentes, que viraram falha definitiva, expiradas e se a rodada abortou por credencial.

**Comportamentos:**

- **Iniciar rodada:** o sistema primeiro move para "falhou de vez", com motivo "expirou", toda conversão aguardando reenvio cujo horário original tem mais de 6 dias.
- **Selecionar conversões da rodada:** o sistema pega apenas as conversões aguardando reenvio cuja espera já terminou, das mais antigas para as mais novas, até o tamanho máximo da rodada.
- **Rodada sem nenhuma pendente:** termina sem enviar nada e sem gravar registro de rodada.
- **Reenviar uma conversão:** o sistema envia ao Meta o conteúdo preservado, com o mesmo identificador de evento e o mesmo horário original.
- **Reenvio aceito:** a conversão passa a aceita, com o horário de aceitação e a tentativa contada.
- **Reenvio recusado por credencial:** a conversão continua aguardando, sem consumir tentativa, e **a rodada é interrompida** (as demais não são tentadas, porque dariam o mesmo erro); o módulo de alerta é acionado.
- **Rodadas seguintes com credencial ainda quebrada:** cada rodada faz uma única tentativa para detectar se a credencial voltou; nada consome tentativa.
- **Credencial consertada:** na primeira rodada após o conserto, as pendentes voltam a ser enviadas normalmente, em ordem de antiguidade, até o tamanho máximo por rodada.
- **Reenvio com falha passageira:** a conversão consome uma tentativa e continua aguardando, com espera maior até a próxima.
- **Reenvio recusado por problema do evento:** a conversão vai direto para "falhou de vez", com o motivo.
- **Atingir o limite de tentativas:** a conversão vai para "falhou de vez", com motivo "esgotou as tentativas" mais a última resposta do Meta.
- **Meta responde aceito, mas informa que o evento já tinha sido recebido:** tratado como aceita.
- **Duas rodadas simultâneas:** uma mesma conversão nunca é enviada por duas rodadas ao mesmo tempo.
- **Rodada com trabalho:** grava o resumo da rodada, consultável no monitoramento.
- **Rodada que falha no meio:** o que já foi decidido fica gravado; o restante continua aguardando para a próxima rodada.
- **Traduzir resposta do Meta em motivo legível:** o sistema converte a resposta em uma das frases:
  - credencial: "Credencial do Meta inválida, expirada ou sem permissão — nenhuma conversão está sendo aceita.";
  - credencial não configurada: "Credencial do Meta não configurada.";
  - expirou: "Passou de 6 dias sem ser aceita — o Meta não aceita mais este evento.";
  - esgotou: "Esgotou as tentativas. Última resposta: <resumo>.";
  - evento recusado: "O Meta recusou o conteúdo do evento: <mensagem do Meta>.";
  - falha passageira: "Sem resposta do Meta (rede ou instabilidade).".

---

### 3. Área "Saúde do Meta" (dashboard)

**Descrição:** Aba nova no menu lateral do dashboard, no mesmo padrão visual e de acesso das demais abas, com o filtro de período padrão do dashboard (incluindo "Hoje" e "Ontem"). Mostra se o Meta está aceitando as conversões, o que está esperando e o que se perdeu. Todos os números vêm prontos do servidor. Dias contados no horário de Brasília.

**Componentes:**

- **Faixa de estado geral** (topo): "Saudável", "Atenção" ou "Incidente", com a frase do motivo (ex.: "Incidente — credencial do Meta recusada desde 14/09 10:32").
- **Última conversão aceita:** data e hora da última conversão aceita pelo Meta (qualquer tipo), com o tempo decorrido ("há 2 h"), e a última aceita por tipo (Lead, Purchase).
- **Tabela de aceitação por tipo de evento:** uma linha por tipo (Lead, Purchase, EntrouGrupo e demais tipos de conversão enviados no período), com: total destinado ao Meta, aceitas na primeira tentativa, aceitas por reenvio, aguardando reenvio, falhou de vez e taxa de aceitação (aceitas ÷ total). Linha de total no fim.
- **Evolução diária da aceitação:** gráfico por dia do período com a taxa de aceitação e o volume de conversões destinadas ao Meta.
- **Pendentes de reenvio:** contagem total, contagem por categoria de erro, a pendente mais antiga (com idade) e quantas expiram nas próximas 24 h.
- **Lista de falhas definitivas:** tabela com data/hora original, tipo do evento, origem (site/venda), página ou produto, tentativas, motivo legível e data em que virou falha. Paginada.
- **Detalhe da falha:** ao abrir uma linha, a última resposta completa do Meta e o identificador do evento.
- **Captura de identificadores de clique:** para visitas vindas de anúncio no período (reconhecidas pela origem da visita, com a mesma regra de canal já usada no dashboard), a porcentagem com identificador de clique do Meta nas visitas de anúncio do Meta e a porcentagem com identificador de clique do Google nas visitas de anúncio do Google, com os números absolutos (ex.: "812 de 903").
- **Últimas rodadas de reenvio:** lista curta com horário, aceitas, pendentes, falhas, expiradas e se abortou por credencial.
- **Aviso de conversões sem situação:** caixa que aparece só quando há conversões no período sem situação registrada (ver módulo 1), com a contagem.
- **Estado vazio:** "Nenhuma conversão destinada ao Meta neste período."
- **Aviso de dados anteriores:** quando o período começa antes da ativação da feature, a nota "Antes de <data de ativação> não havia reenvio: as recusas desse período aparecem só como resposta da primeira tentativa."

**Comportamentos:**

- **Abrir a aba:** o sistema carrega os dados do período padrão do dashboard.
- **Abrir a aba sem acesso ao dashboard:** recusado, como nas demais abas.
- **Mudar o período:** todos os blocos recarregam para o novo período, exceto "Pendentes de reenvio", "Última conversão aceita" e "Estado geral", que sempre mostram o momento atual.
- **Período maior que o máximo permitido:** recusado pelo servidor com "Escolha um período de até 92 dias."
- **Calcular a taxa de aceitação:** aceitas (primeira tentativa + reenvio) ÷ total destinado ao Meta no período, pelo horário original do evento.
- **Tipo sem nenhuma conversão no período:** a linha não aparece.
- **Total zero:** a taxa aparece como "—", nunca "0%" nem "100%".
- **Conversões ainda aguardando:** entram no total e não entram nas aceitas; a taxa de períodos recentes pode subir conforme o reenvio acontece.
- **Determinar o estado geral "Incidente":** quando a última resposta do Meta foi de credencial, ou quando o alerta de volume zerado está ativo.
- **Determinar o estado geral "Atenção":** quando a aceitação das últimas 24 h está abaixo do limite de alerta, ou há pendentes que expiram nas próximas 24 h, ou houve falha definitiva nas últimas 24 h.
- **Determinar o estado geral "Saudável":** nenhuma das condições acima.
- **Ver a lista de falhas:** a tabela mostra as falhas definitivas cujo horário original está no período, das mais recentes para as mais antigas.
- **Filtrar a lista de falhas por tipo de evento:** a tabela mostra só o tipo escolhido.
- **Filtrar a lista de falhas por motivo:** a tabela mostra só a categoria escolhida.
- **Mudar de página na lista:** carrega a página seguinte ou anterior.
- **Abrir o detalhe de uma falha:** mostra a última resposta completa e o identificador do evento.
- **Fechar o detalhe:** volta à lista sem recarregar.
- **Ver as pendentes:** mostra os números do momento atual, independentes do período.
- **Calcular a captura de identificadores de clique:** visitas de anúncio do Meta com identificador de clique do Meta ÷ visitas de anúncio do Meta; o mesmo para o Google. Visitas de bot ficam fora.
- **Nenhuma visita de anúncio no período:** a taxa aparece como "—".
- **Atualizar os dados:** botão "Atualizar" recarrega a aba sem mudar o período.
- **Falha ao carregar:** a aba mostra "Não foi possível carregar a saúde do Meta agora." e mantém o filtro.
- **Reenviar manualmente uma falha definitiva:** na linha de uma falha **ainda dentro da janela de 6 dias**, o botão "Tentar de novo" devolve a conversão para aguardando reenvio, com tentativas zeradas; ela é enviada na próxima rodada. Uso típico: depois de corrigir a causa de um "evento recusado".
- **Reenviar manualmente falha fora da janela:** botão desabilitado com a dica "O Meta não aceita mais este evento (mais de 6 dias)."
- **Reenviar manualmente todas as falhas de um motivo:** não existe nesta versão; o reenvio manual é uma a uma.

---

### 4. Alerta de saúde do envio (sistema)

**Descrição:** Verificação periódica, independente do tráfego do site, que avisa a equipe quando o envio ao Meta está doente. Substitui o aviso atual por WhatsApp para as conversões do Meta. O canal de entrega é um **canal do Slack** da equipe (ver "Decisões tomadas", item 1). Toda regra de disparo fica no servidor.

**Componentes:**

- **Condição "credencial recusada":** o Meta recusou por credencial (na primeira tentativa ou no reenvio).
- **Condição "aceitação baixa":** a taxa de aceitação das últimas N horas ficou abaixo do limite, com um volume mínimo de conversões para não disparar com amostra pequena (proposta: abaixo de 80% nas últimas 6 h, com pelo menos 10 conversões).
- **Condição "nenhuma conversão aceita":** nenhuma Lead aceita pelo Meta há mais de X horas em horário em que costuma haver leads (proposta: 24 h), ou nenhuma conversão de qualquer tipo aceita há mais de Y horas (proposta: 6 h).
- **Condição "pendentes prestes a expirar":** há conversões aguardando reenvio que expiram nas próximas 24 h.
- **Mensagem de alerta:** título com a condição, números que a justificam (taxa, volume, horário da última aceita, quantidade pendente), o motivo legível mais frequente e o caminho para a aba "Saúde do Meta".
- **Mensagem de recuperação:** aviso de que a condição deixou de valer, com a duração do incidente e quantas conversões foram recuperadas pelo reenvio.
- **Registro de alertas:** histórico de alertas enviados (condição, horário, entregue ou não), exibido na aba "Saúde do Meta".

**Comportamentos:**

- **Verificar a saúde:** a rotina avalia as condições em intervalo fixo (proposta: a cada 15 minutos, junto da rodada de reenvio), lendo só os dados recentes.
- **Condição começa a valer:** o sistema envia a mensagem de alerta para o canal do Slack.
- **Condição continua valendo:** o sistema não repete o alerta antes do intervalo de lembrete (proposta: 6 h), para não virar ruído.
- **Lembrete de condição persistente:** depois do intervalo, reenvia o alerta marcado como "ainda acontecendo", com a duração acumulada.
- **Condição deixa de valer:** o sistema envia a mensagem de recuperação uma única vez.
- **Várias condições ao mesmo tempo:** um único alerta lista todas.
- **Evento de bot, lead bloqueado ou evento interno:** nunca contam para nenhuma condição.
- **Falha ao entregar o alerta:** registrada no histórico como "não entregue", mostrada na aba "Saúde do Meta" e tentada de novo na verificação seguinte; a falha nunca é silenciosa.
- **Canal de alerta não configurado:** a aba "Saúde do Meta" mostra o aviso "Nenhum canal de alerta configurado — problemas não serão avisados." e a condição continua visível na faixa de estado geral.
- **Aviso antigo por WhatsApp para falha do Meta:** deixa de ser a forma de avisar falha de conversão do Meta (ver "Decisões tomadas", item 6).
- **Enviar alerta de teste:** quem mantém o tracking consegue disparar uma mensagem de teste pelo canal, para confirmar a entrega, sem alterar o estado de nenhuma condição.

---

## Decisões tomadas

Respondidas pela usuária em 16/09/2026 (itens 1, 2, 3 e 7); as demais adotam a proposta desta spec.

1. **Canal do alerta: Slack.** Mensagem num canal do Slack da equipe. Pendência de configuração: a usuária precisa indicar o canal e liberar o acesso de envio (o segredo fica só no servidor).
2. **`EntrouGrupo` entra no monitoramento e no alerta.** A aba "Saúde do Meta" mostra `EntrouGrupo` como mais uma linha da tabela de aceitação, das pendentes e das falhas, e o alerta considera essas conversões — lendo a fila existente, sem alterá-la.
3. **PageView fica fora** da fila, do painel e do alerta. Hoje o PageView nem é gravado no banco, de propósito, para poupar o banco; incluí-lo multiplicaria as gravações.
4. **Números do reenvio:** 5 tentativas, rodada a cada 15 minutos, espera crescente entre tentativas e tamanho máximo por rodada (propostas do módulo 2).
5. **Recuperar o passado recente:** na ativação, conversões recusadas cujo horário original ainda esteja dentro de 6 dias entram na fila. O período de 30/07 a 15/09/2026 já está fora da janela e não tem recuperação.
6. **Aviso por WhatsApp:** deixa de ser usado para falha de conversão do Meta assim que o alerta pelo Slack for comprovado com a mensagem de teste.
7. **Reenvio manual incluído:** botão "Tentar de novo", uma falha por vez, só dentro da janela de 6 dias.
8. **Limites do alerta:** as propostas do módulo 4 (aceitação abaixo de 80% nas últimas 6 h com pelo menos 10 conversões; nenhuma Lead aceita há 24 h; nenhuma conversão aceita há 6 h; lembrete a cada 6 h), sem exceção de madrugada ou fim de semana nesta versão.

## Fora do escopo

- **Consentimento / LGPD:** decidido que será apenas aviso; tratado em outra spec.
- **Google Ads / Data Manager API:** envio de conversões ao Google adiado. A taxa de captura do identificador de clique do Google entra só como medição.
- **Integração dos estágios do CRM com o Meta** (ex.: MQL, venda fechada como evento): outra spec.
- **Fila do `EntrouGrupo`:** já existe e não é alterada. O monitoramento e o alerta apenas **leem** essa fila ("Decisões tomadas", item 2).
- **Envio ao GA4 e demais destinos:** sem reenvio nem monitoramento nesta feature.
- **Recuperar conversões perdidas de 30/07 a 15/09/2026:** impossível (fora da janela do Meta).
- **Mudar o conteúdo dos eventos** (parâmetros, correspondência de identidade, novos eventos): nada muda no que é enviado.
- **Substituir o WhatsApp para os demais avisos do projeto** (alertas de lead, disparos): só o aviso de saúde do Meta é tratado aqui.
- **Métrica de qualidade de correspondência do próprio Meta:** não é lida nesta versão.

## Critérios de aceite

1. Uma conversão Lead aceita pelo Meta na primeira tentativa aparece como aceita e nunca é reenviada.
2. Simulando uma falha passageira, a conversão fica aguardando reenvio e é aceita numa rodada seguinte **com o mesmo identificador de evento e o mesmo horário original** da primeira tentativa.
3. No gerenciador de eventos do Meta, uma conversão que falhou e foi reenviada aparece **uma única vez**.
4. Simulando credencial inválida: as conversões ficam aguardando com zero tentativas consumidas, a rodada é interrompida após a primeira recusa, a faixa da aba mostra "Incidente" e um alerta chega pelo canal escolhido em até 30 minutos.
5. Depois de restaurar a credencial, as pendentes são aceitas nas rodadas seguintes e chega uma mensagem de recuperação com a quantidade recuperada.
6. Uma conversão com falha passageira repetida vai para "falhou de vez" com o motivo "Esgotou as tentativas…" ao atingir o limite.
7. Uma conversão aguardando reenvio com horário original acima de 6 dias vai para "falhou de vez" com o motivo de expiração e não é mais enviada.
8. Uma conversão recusada por problema do conteúdo vai direto para "falhou de vez", sem novas tentativas.
9. Purchase de gateway e de ponte do CRM seguem as mesmas regras dos critérios 1–8.
10. Evento de bot, lead bloqueado e eventos internos (clique em CTA, início e etapa de formulário) não entram na fila e não aparecem em nenhum número da aba "Saúde do Meta".
11. A aba "Saúde do Meta" mostra, para um período escolhido, a taxa de aceitação por tipo que confere com a contagem manual das conversões do mesmo período.
12. Período sem conversões mostra "—" na taxa, nunca 0% ou 100%.
13. A lista de falhas definitivas mostra motivo legível em português para cada linha e o detalhe mostra a resposta completa do Meta.
14. A taxa de captura de identificadores de clique confere com a contagem manual das visitas de anúncio do período, excluindo bots.
15. "Última conversão aceita" mostra o horário correto da última conversão aceita.
16. Uma rodada de reenvio sem pendentes não grava nada e lê apenas as conversões pendentes, nunca a história inteira; a abertura da aba lê apenas o período pedido.
17. Nenhum alerta sai pelo WhatsApp/Evolution; uma falha de entrega do alerta aparece na aba como "não entregue".
18. O alerta de uma condição persistente não se repete antes do intervalo de lembrete.
19. O botão "Enviar alerta de teste" entrega a mensagem pelo canal configurado.
20. "Tentar de novo" numa falha dentro da janela faz a conversão ser aceita na rodada seguinte, sem duplicar no Meta; fora da janela, o botão fica desabilitado.
21. Toda regra (taxas, categorias de erro, estado geral, decisão de alerta) é calculada no servidor; o dashboard não contém nenhuma dessas regras nem credencial.
