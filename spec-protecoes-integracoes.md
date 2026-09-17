# Spec: Proteções nas integrações — credenciais, horário suspeito e telefone no padrão

## Visão Geral

**O que faz.** Adiciona três proteções dirigidas aos defeitos que realmente machucaram o tracking nos últimos meses:

1. **Checagem das credenciais:** uma vez por dia (e sob demanda) o sistema confere cada credencial e configuração de integração — se existe, se está limpa de caracteres invisíveis e sujeira nas pontas e, onde for barato, se o serviço de destino ainda a aceita. Mostra o resultado e avisa quando algo quebra.
2. **Horário suspeito nas integrações:** para cada evento recebido que traz horário próprio, compara esse horário com o momento em que ele chegou, e avisa quando uma fonte passa a mandar horários sistematicamente deslocados (o sintoma clássico de fuso errado).
3. **Telefone no padrão na entrada:** todo telefone de lead passa por **uma única regra** antes de ser gravado ou repassado a qualquer destino, para que o mesmo celular não apareça com e sem o nono dígito.

**Para quem.** Para quem mantém o tracking, que precisa saber em horas — e não em semanas — que uma integração quebrou; e para a operação comercial e de marketing, que depende de dados certos no CRM e no Meta.

**Por que agora — e por que não uma "validação genérica".** A conferência de 16/09/2026 mostrou que os dados que chegam **do site** estão limpos: em 60 dias, 478 leads, nenhum sem e-mail, com e-mail inválido, sem telefone, sem funil ou sem identificador de evento. Uma validação genérica de formato não teria pego nenhum dos problemas reais. Os problemas reais foram estes:

- **Incidente 1 — credencial com caractere invisível.** De 30/07 a 15/09/2026 o Meta recusou **100%** das conversões porque as credenciais do pixel novo foram gravadas com um caractere invisível (BOM) na frente. Ninguém soube por **6 semanas**. → Módulo 1.
- **Incidente 2 — horário de Brasília carimbado como UTC.** A integração dos grupos de WhatsApp informa o horário de Brasília marcado como se fosse UTC. Todos os eventos de grupo ficaram **3 horas atrasados por 7 semanas**, até a correção de 16/09/2026 (que confere o horário informado contra o horário de recebimento). → Módulo 2.
- **Incidente 3 — celular com e sem o nono dígito.** O WhatsApp entrega o celular sem o nono dígito; o lead digita com. Nos últimos 60 dias, **10 de 489** telefones registrados nos envios de lead estão fora do padrão (6 com 11 dígitos, 4 com 12; o padrão é 13: 55 + DDD + 9 dígitos). → Módulo 3.

**Reaproveitamento do que já está no ar.** A spec `spec-capi-reenvio-monitoramento.md` já entregou a aba **"Saúde do Meta"** e o alerta pelo **Slack** (com anti-repetição, lembrete, mensagem de recuperação, registro de alertas e aviso de "canal não configurado"). Esta spec **não cria outro canal nem outra área solta**: as proteções 1 e 2 são exibidas nessa mesma aba (ver Decisões tomadas, item 1) e alertam pelo mesmo canal do Slack, com as mesmas regras de repetição e recuperação. A proteção 3 não tem tela: é uma regra de entrada.

**Princípios que valem para a feature inteira:**

- **Segredo nunca aparece.** Nenhum valor de credencial é exibido em tela, gravado em log, guardado no banco ou enviado em alerta — nem parcial, nem mascarado. Só o **nome** da credencial e o **tipo** do problema.
- **Observar não é corrigir.** As proteções 1 e 2 só detectam, mostram e avisam. Nenhuma credencial é "limpa" automaticamente, nenhum evento é descartado e nenhum horário é reescrito por elas.
- **Barato por construção.** O banco já estourou o limite de leitura por varreduras. As checagens são periódicas, leem só o período recente e guardam resumos em vez de reprocessar a história; rodada sem novidade quase não custa nada.
- **Lógica no servidor.** Classificação de problema, estatística de desvio, regra do telefone e decisão de alerta ficam no servidor. O dashboard só pede e exibe.
- **Identidade estável.** Nenhuma mudança pode fazer um lead, uma entrada em grupo ou uma conversão já registrados serem tratados como novos.

---

## Páginas / Módulos

### 1. Checagem das credenciais (sistema)

**Descrição:** Rotina que confere, uma a uma, as credenciais e configurações das integrações em uso. Roda automaticamente 1 vez por dia e também sob demanda (módulo 3). Para cada item produz um resultado "ok" ou "problema", com motivo legível, sem nunca ler o valor para fora do servidor.

**Componentes:**

- **Catálogo de credenciais verificadas:** lista fixa, mantida no servidor, com nome, integração a que pertence, tipo (segredo ou configuração), se é obrigatória ou opcional e se tem teste de aceitação. Itens em uso hoje no código:
  - **Meta (conversões):** `META_PIXEL_ID_2`, `META_ACCESS_TOKEN_2` (com teste de aceitação); opcional `META_TEST_EVENT_CODE`.
  - **Meta (investimento/contas de anúncio):** `META_ADS_ACCESS_TOKEN`, `META_ACCESS_TOKEN` (legado), `META_ADS_ACCOUNT_ID`.
  - **Windsor (investimento):** `WINDSOR_API_KEY`, `WINDSOR_META_ACCOUNT`.
  - **GA4:** `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`.
  - **ClickUp:** `CLICKUP_API_TOKEN` (com teste de aceitação), `CLICKUP_LIST_ID`.
  - **CRM novo:** `LEAD_WEBHOOK_URL_CRM`, `LEAD_WEBHOOK_TOKEN_CRM`.
  - **Encaminhamento de lead para WhatsApp:** `LEAD_WEBHOOK_URL_WHATSAPP`, `LEAD_WEBHOOK_TOKEN_WHATSAPP`.
  - **GoHighLevel:** `TOKEN_GHL`, `LOCAL_ID`.
  - **ManyChat:** `MANYCHAT_API`.
  - **Encharge:** `ENCHARGE_API_KEY`.
  - **Google Ads:** `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.
  - **Recebimento de vendas e eventos:** `GREENN_WEBHOOK_TOKEN`, `KIWIFY_WEBHOOK_SLUG`, `HOTMART_WEBHOOK_SLUG`, `EDUZZ_WEBHOOK_SLUG`, `GRUPOS_WEBHOOK_SECRET`.
  - **Evolution (avisos por WhatsApp, em aposentadoria):** `EVOLUTION_API_URL`, `EVOLUTION_BASE_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_APIKEY_NOTIF`, `EVOLUTION_NUMERO_NOTIF`, `EVOLUTION_APIKEY_ALERTA`, `EVOLUTION_NUMERO_ALERTA`.
  - **Acesso interno:** `SYNC_SECRET`, `DASH_KEY`, `FEEDBACK_MARKETING_KEY`.
  - **Alerta:** `SLACK_WEBHOOK_META`, `DASH_URL_SAUDE_META`.
  - **Redirecionamentos e configurações de texto:** `LEAD_REDIRECT_LIVE`, `LEAD_REDIRECT_WHATSAPP`, `LEAD_REDIRECT_WHATSAPP_TRAFEGO`, `LEAD_REDIRECT_CALENDLY`, `LEAD_REDIRECT_CALENDLY_TRAFEGO`, `LEAD_REDIRECT_WORKSHOP`, `GRUPO_WORKSHOP_URL`, `DEFAULT_COUNTRY_CODE`, `TIMEZONE_OFFSET`.
- **Tipos de problema (motivos legíveis):**
  - ausente: "Não configurada.";
  - vazia: "Configurada, mas vazia.";
  - caractere invisível: "Contém caractere invisível (ex.: BOM ou espaço de largura zero) — regrave a credencial.";
  - espaço ou quebra de linha nas pontas: "Tem espaço ou quebra de linha no começo ou no fim.";
  - aspas: "Está entre aspas — as aspas foram gravadas junto com o valor.";
  - formato impossível (só onde o formato é conhecido, ex.: identificador numérico, endereço que precisa começar com https): "Formato inesperado para este tipo de credencial.";
  - recusada pelo serviço: "O serviço recusou a credencial (inválida, expirada ou sem permissão).";
  - serviço não respondeu: "Não foi possível confirmar agora — o serviço não respondeu." (não conta como problema de credencial).
- **Teste de aceitação:** consulta simples e sem efeito colateral ao serviço, só para as integrações em que isso é barato e não gera evento, cobrança, contato ou conversão (proposta mínima: Meta — pixel e token de conversões; ClickUp — token). Outras podem ser acrescentadas depois, com o mesmo critério.
- **Resultado por credencial:** nome, integração, situação (ok / problema / não confirmado / não se aplica), motivo legível, horário da checagem e desde quando está no estado atual.
- **Resumo da rodada:** horário, total verificado, quantidade de problemas, origem (automática ou manual).

**Comportamentos:**

- **Rodada automática:** o sistema executa a checagem completa 1 vez por dia.
- **Rodada manual:** executada quando pedida pelo botão da aba (módulo 3), com o mesmo resultado de uma automática.
- **Credencial obrigatória ausente:** resultado "problema" com motivo "Não configurada.".
- **Credencial opcional ausente:** resultado "não se aplica", sem alerta.
- **Credencial vazia:** resultado "problema" com motivo "Configurada, mas vazia.".
- **Caractere invisível em qualquer posição:** resultado "problema" com motivo de caractere invisível; detecta pelo menos BOM, espaço de largura zero, junção/não junção de largura zero e espaço não separável.
- **Espaço, tabulação ou quebra de linha no começo ou no fim:** resultado "problema" com o motivo correspondente.
- **Valor entre aspas (simples ou duplas) nas duas pontas:** resultado "problema" com motivo de aspas.
- **Formato impossível num item de formato conhecido:** resultado "problema" com motivo de formato.
- **Mais de um defeito na mesma credencial:** todos os motivos aparecem, na ordem da lista de tipos.
- **Credencial com defeito de conteúdo:** o teste de aceitação não é executado (o defeito já explica a falha).
- **Teste de aceitação aprovado:** resultado "ok".
- **Teste de aceitação recusado por credencial:** resultado "problema" com motivo "O serviço recusou a credencial…".
- **Serviço sem resposta, tempo esgotado ou erro temporário:** resultado "não confirmado"; não dispara alerta na primeira ocorrência; vira "problema" se repetir em 2 rodadas automáticas seguidas.
- **Credencial sem teste de aceitação e sem defeito de conteúdo:** resultado "ok" com a nota "conferida só a forma".
- **Guardar o resultado:** o sistema guarda só nome, situação, motivos e horários; nunca o valor, nem trecho, nem tamanho, nem resumo criptográfico.
- **Registrar em log:** o log do servidor registra só nome e tipo do problema.
- **Resposta do serviço no teste:** a mensagem devolvida pelo serviço é reduzida a código e categoria antes de ser guardada, para não arriscar ecoar a credencial.
- **Rodada com trabalho igual à anterior:** o resultado de cada item é atualizado, mas o "desde quando" só muda quando a situação muda.
- **Credencial muda de ok para problema:** aciona o alerta (módulo 4).
- **Credencial volta de problema para ok:** aciona a mensagem de recuperação (módulo 4).
- **Rodada manual em sequência:** o sistema recusa uma nova rodada manual antes de 1 minuto da anterior, com "Aguarde um minuto para checar de novo.", para não martelar os serviços.
- **Duas rodadas simultâneas:** nunca executam ao mesmo tempo; a segunda espera ou é descartada.
- **Falha no meio da rodada:** o que já foi conferido fica guardado; os itens restantes aparecem como "não confirmado" com o horário da última checagem válida.

---

### 2. Horário suspeito nas integrações (sistema)

**Descrição:** Para cada evento recebido de uma integração que informa horário próprio, o sistema compara esse horário com o horário em que o evento chegou e acompanha, por fonte, se os desvios são isolados (normal: reentrega, venda antiga, fila do lado da fonte) ou sistemáticos (sinal de fuso ou relógio errado). Nada é descartado, corrigido ou reordenado por esta proteção; a correção já existente para os grupos de WhatsApp continua como está.

**Componentes:**

- **Fontes acompanhadas:** grupos de WhatsApp (entradas e saídas), Greenn (vendas), ClickUp (mudança de estágio), sincronização de leads do formulário do Meta (planilha), Kiwify, Hotmart e Eduzz (vendas).
- **Horário informado pela fonte:** o horário que veio no próprio evento, **antes** de qualquer correção.
- **Horário de chegada:** o momento em que o servidor recebeu o evento (para a planilha do Meta, o momento da sincronização que o trouxe).
- **Desvio:** horário de chegada menos horário informado, em minutos, com sinal (positivo = evento informado no passado; negativo = evento "do futuro").
- **Tolerância por fonte:** desvio considerado normal para aquela fonte (proposta inicial):
  - grupos de WhatsApp e ClickUp: 10 min;
  - Greenn, Kiwify, Hotmart, Eduzz: 30 min (reentregas e aprovações tardias);
  - formulário do Meta: intervalo da sincronização + 30 min.
- **Evento suspeito:** evento cujo desvio passa da tolerância da fonte, ou cujo horário informado está mais de 5 min no futuro.
- **Resumo por fonte e hora:** contagem de eventos, contagem de suspeitos e a distribuição de desvios necessária para os critérios abaixo, guardados como resumo compacto (não um registro por evento normal).
- **Registro de suspeitos:** amostra dos eventos suspeitos com fonte, horário informado, horário de chegada, desvio e um identificador do evento (nunca dados pessoais), limitada por fonte (proposta: os últimos 50).
- **Critério de desvio sistemático** (avaliado sobre as últimas 24 h de cada fonte, com volume mínimo de 5 eventos):
  - a **mediana** do desvio, em valor absoluto, passa de **30 min**; **ou**
  - **80% ou mais** dos eventos têm desvio próximo de um número inteiro de horas diferente de zero (dentro de ±5 min de 1 h, 2 h, 3 h…), indicando fuso.
- **Diagnóstico legível:** frase com o provável motivo, ex.: "Os horários desta fonte estão, em regra, 3 h atrasados em relação à chegada — provável fuso errado." ou "Metade dos eventos chega com mais de 40 min de atraso."
- **Correção aplicada conhecida:** marcação, por fonte, de que já existe correção de horário em uso (hoje: grupos de WhatsApp), para que o painel mostre desvio **antes** e **depois** da correção.

**Comportamentos:**

- **Receber evento com horário informado:** o sistema calcula o desvio e soma ao resumo da fonte, sem atrasar nem alterar o processamento do evento.
- **Evento sem horário informado ou com horário ilegível:** conta no resumo como "sem horário", não entra na estatística de desvio e não é descartado.
- **Desvio dentro da tolerância:** só conta no resumo.
- **Desvio acima da tolerância:** conta como suspeito e entra no registro de suspeitos.
- **Horário informado no futuro além de 5 min:** conta como suspeito.
- **Reentrega do mesmo evento:** conta como suspeito isolado (é o esperado), sem tratamento especial; não dispara alerta sozinha.
- **Venda antiga reenviada pela fonte:** conta como suspeito isolado; não dispara alerta sozinha.
- **Fonte com correção de horário já aplicada:** a estatística usa o horário informado **antes** da correção para detectar o defeito da fonte, e também registra o desvio **depois** da correção, para confirmar que a correção funciona.
- **Fonte com correção aplicada e desvio sistemático só antes da correção:** aparece como "defeito conhecido, corrigido", sem alerta.
- **Desvio sistemático depois da correção (ou em fonte sem correção):** aparece como "suspeito" e aciona o alerta (módulo 4).
- **Volume abaixo do mínimo nas últimas 24 h:** a fonte aparece como "pouco volume para avaliar", sem alerta.
- **Avaliar o critério:** feito periodicamente sobre os resumos (proposta: a cada hora), nunca relendo os eventos originais.
- **Fonte deixa de ter desvio sistemático:** aciona a mensagem de recuperação (módulo 4).
- **Guardar resumo:** resumos com mais de 30 dias são apagados; o registro de suspeitos mantém só os últimos por fonte.
- **Falha ao registrar o desvio:** o evento é processado normalmente; a falha fica no log do servidor.
- **Nada é descartado:** nenhum evento deixa de ser gravado ou repassado por ser suspeito.
- **Nada é corrigido:** nenhum horário é reescrito por esta proteção.

---

### 3. Exibição das proteções no dashboard (dashboard)

**Descrição:** As proteções 1 e 2 aparecem na aba de saúde já existente ("Saúde do Meta"), no mesmo padrão visual, de acesso e de atualização. A forma exata (renomear a aba ou acrescentar blocos) está em Decisões tomadas, item 1. Todos os números e situações vêm prontos do servidor.

**Componentes:**

- **Faixa de estado geral:** passa a considerar também credenciais com problema e fontes com horário suspeito, com a frase do motivo mais grave (ex.: "Incidente — credencial META_ACCESS_TOKEN_2 com caractere invisível desde 14/09 06:00").
- **Bloco "Credenciais":**
  - tabela com uma linha por credencial: integração, nome, situação (ok / problema / não confirmado / não se aplica), motivo legível, desde quando e horário da última checagem;
  - problemas no topo, depois "não confirmado", depois "ok"; itens "não se aplica" recolhidos;
  - botão **"Checar agora"**;
  - horário e origem da última rodada.
- **Bloco "Horário das integrações":**
  - tabela com uma linha por fonte: volume nas últimas 24 h, eventos sem horário, desvio típico (mediana), percentual de suspeitos, situação (normal / suspeito / defeito conhecido, corrigido / pouco volume) e diagnóstico legível;
  - para a fonte com correção aplicada, desvio típico antes e depois da correção;
  - último evento suspeito por fonte (horário informado, horário de chegada, desvio);
  - detalhe da fonte com a amostra de suspeitos recentes.
- **Aviso de canal:** o mesmo aviso já existente de "canal de alerta não configurado" vale para as novas proteções.

**Comportamentos:**

- **Abrir a aba:** os blocos novos carregam junto com os existentes, sem ler além dos resumos guardados.
- **Abrir a aba sem acesso ao dashboard:** recusado, como nas demais abas.
- **Mudar o período da aba:** os blocos "Credenciais" e "Horário das integrações" não mudam — mostram sempre o momento atual (últimas 24 h para horário).
- **Clicar em "Checar agora":** dispara uma rodada manual (módulo 1), mostra "Checando…" e atualiza a tabela ao terminar.
- **"Checar agora" antes de 1 minuto da última:** mostra "Aguarde um minuto para checar de novo.".
- **Checagem manual falha:** mostra "Não foi possível checar as credenciais agora." e mantém o último resultado.
- **Exibir credencial:** nunca mostra o valor, nem parte, nem máscara; só nome, situação e motivo.
- **Abrir o detalhe de uma fonte:** mostra os suspeitos recentes, sem dados pessoais.
- **Fechar o detalhe:** volta à tabela sem recarregar.
- **Nenhuma rodada de credenciais ainda:** o bloco mostra "Ainda não houve checagem." com o botão "Checar agora".
- **Nenhum evento de uma fonte nas últimas 24 h:** a linha mostra volume 0 e situação "pouco volume para avaliar".
- **Falha ao carregar os blocos novos:** cada bloco mostra sua própria mensagem de erro sem derrubar os blocos do Meta.
- **Botão "Atualizar" existente:** recarrega também os blocos novos.

---

### 4. Alerta das proteções (sistema)

**Descrição:** As proteções 1 e 2 avisam pelo **mesmo canal do Slack** e com as **mesmas regras** do alerta de saúde do Meta já no ar: alerta quando começa, lembrete se persistir, recuperação quando para, registro de alertas visível na aba. Nenhum canal novo.

**Componentes:**

- **Condição "credencial com problema":** uma ou mais credenciais obrigatórias em situação "problema".
- **Condição "horário suspeito":** uma ou mais fontes com desvio sistemático (sem correção conhecida que o resolva).
- **Mensagem de alerta:** título da condição; para credenciais, a lista de nomes com o tipo do problema; para horário, a fonte, o desvio típico e o diagnóstico; caminho para a aba.
- **Mensagem de recuperação:** o que voltou ao normal e por quanto tempo ficou com problema.
- **Registro de alertas:** o mesmo histórico já exibido na aba, com as novas condições.

**Comportamentos:**

- **Condição começa a valer:** envia a mensagem de alerta pelo canal do Slack.
- **Condição continua valendo:** não repete antes do intervalo de lembrete já em uso (6 h).
- **Lembrete:** depois do intervalo, reenvia marcado como "ainda acontecendo", com a duração.
- **Nova credencial ou nova fonte entra numa condição já ativa:** envia um novo alerta só com o item novo.
- **Condição deixa de valer:** envia a recuperação uma única vez.
- **Credencial em "não confirmado":** não alerta até virar "problema".
- **Mensagem de alerta:** nunca contém valor de credencial, trecho, máscara nem dados pessoais de leads.
- **Falha ao entregar:** registrada como "não entregue", exibida na aba e tentada de novo na verificação seguinte.
- **Canal não configurado:** nada é enviado; a aba mostra o aviso já existente e as condições continuam visíveis na faixa de estado geral.
- **A própria credencial do canal com problema:** aparece na tabela de credenciais e na faixa de estado geral, mesmo sem conseguir alertar.

---

### 5. Telefone no padrão na entrada (sistema)

**Descrição:** Uma regra única de padronização de telefone, usada por todas as portas de entrada de lead — site, formulário do Meta, grupos de WhatsApp, vendas (Greenn, Kiwify, Hotmart, Eduzz) e mudança de estágio vinda do CRM — antes de o telefone ser gravado ou repassado a ClickUp, CRM novo, GoHighLevel, ManyChat, Meta e demais destinos. Hoje existem várias regras parecidas espalhadas; todas passam a usar a mesma.

**Componentes:**

- **Telefone como veio:** o valor original recebido, preservado.
- **Telefone padronizado:** só dígitos, com código do país.
- **Situação do telefone:** "brasileiro celular", "brasileiro fixo", "estrangeiro", "impossível" ou "ausente".
- **Padrão do celular brasileiro:** 55 + DDD de 2 dígitos + 9 dígitos começando com 9 (13 dígitos).
- **Padrão do fixo brasileiro:** 55 + DDD + 8 dígitos começando com 2 a 5 (12 dígitos).
- **Lista de DDDs brasileiros válidos.**
- **Sinalização de telefone impossível:** marca consultável no lead.

**Comportamentos:**

- **Remover formatação:** espaços, parênteses, hífens, pontos, sinal de mais e o prefixo de discagem internacional são descartados antes de aplicar a regra.
- **Telefone com zero de discagem nacional ou código de operadora na frente:** o prefixo é removido antes de aplicar a regra.
- **Celular brasileiro com 55 + DDD + 9 dígitos:** mantido.
- **Celular brasileiro sem o nono dígito (55 + DDD + 8 dígitos começando com 6 a 9):** o 9 é inserido depois do DDD.
- **Celular brasileiro sem 55 (DDD + 9 dígitos, ou DDD + 8 dígitos começando com 6 a 9):** recebe 55 e, se faltar, o nono dígito.
- **Fixo brasileiro (DDD + 8 dígitos começando com 2 a 5), com ou sem 55:** recebe 55 e **não** recebe nono dígito.
- **DDD inexistente num número com cara de brasileiro:** situação "impossível".
- **Número com código de outro país (não começa com 55 e tem tamanho de número internacional):** situação "estrangeiro", preservado com o código do país, sem nenhuma inserção.
- **Número que começa com 55 mas não fecha nenhum padrão brasileiro:** situação "impossível".
- **Número curto demais, longo demais ou com todos os dígitos iguais:** situação "impossível".
- **Telefone impossível:** mantido exatamente como veio (só sem formatação), sinalizado no lead, e o lead segue o fluxo normal — nunca é descartado.
- **Telefone ausente:** o lead segue o fluxo normal como hoje.
- **Guardar o original:** o telefone como veio continua registrado ao lado do padronizado.
- **Repassar a destinos:** todos os destinos recebem o telefone padronizado; cada destino continua podendo apresentar o número no formato visual que exige (ex.: com "+"), mas a partir do mesmo telefone padronizado.
- **Identidade para o Meta:** o telefone usado na correspondência de identidade com o Meta é o padronizado.
- **Deduplicação de lead (telefone ou e-mail):** compara telefone padronizado com telefone padronizado; um lead que já existe com o número sem o nono dígito é reconhecido como o mesmo quando chega com o nono dígito, e vice-versa — nunca gera lead duplicado.
- **Identificadores já emitidos:** identificadores de evento e chaves de fila que hoje incluem o telefone como veio (como a fila de conversão de entrada em grupo) **continuam sendo calculados do mesmo jeito**; a regra nova não altera nenhum identificador já emitido nem a forma de calcular os futuros, para que reentradas e reenvios não virem conversões novas.
- **Destino recebe o mesmo lead antes e depois da mudança:** o cartão/contato já existente é encontrado e atualizado, não duplicado.
- **Telefones antigos fora do padrão:** não são alterados automaticamente por este módulo (ver Decisões tomadas, item 3).
- **Contar telefones fora do padrão:** o bloco de horário/credenciais não exibe isso; a contagem fica consultável por quem mantém o tracking para acompanhar se o número de novos fora do padrão cai a zero.

---

## Decisões tomadas

Respondidas pela usuária em 16/09/2026:

1. **A aba passa a se chamar "Saúde das integrações"**, com o Meta como primeiro bloco.
2. **Teste de aceitação só no Meta e no ClickUp** nesta versão.
3. **Telefones antigos NÃO são corrigidos**: a regra vale só daqui para frente.
4. **Credenciais conferidas 1 vez por dia + botão "Checar agora".**
5. **Tolerâncias e critério de horário aceitos como propostos**, para rever depois de 2 semanas de dados.

## Fora do escopo

- **Validação genérica de formato dos dados do site** (e-mail, nome, funil): descartada — os dados do site estão limpos.
- **Limpar ou regravar credenciais automaticamente:** a proteção só avisa; regravar continua sendo ação da usuária.
- **Corrigir horário de outras fontes automaticamente:** só a correção dos grupos de WhatsApp, que já existe.
- **Novo canal de alerta** ou retorno do WhatsApp como canal de alerta.
- **Rotação de credenciais** (inclusive as que já vazaram) e cadastro do webhook do Slack: tarefas da usuária.
- **Credenciais que vivem só na VPS** (crons, relatórios, backup): esta spec cobre só as configurações do tracking no ar.
- **Alterar a fila de conversão de entrada em grupo** ou qualquer identificador de evento já emitido.
- **Validar se o número de telefone existe de verdade no WhatsApp.**
- **Painel de clientes da agência** (`painel/`): outro projeto.

## Critérios de aceite

1. Com uma credencial obrigatória gravada com BOM no começo, a checagem marca "problema" com o motivo de caractere invisível, e um alerta chega ao Slack em até 1 dia (ou imediatamente pelo "Checar agora"), mostrando só o nome e o tipo do problema.
2. Com uma credencial com espaço de largura zero no meio, com quebra de linha no fim ou entre aspas, cada caso é marcado com o motivo correspondente.
3. Credencial obrigatória ausente aparece como "Não configurada."; credencial opcional ausente aparece como "não se aplica" e não alerta.
4. Com um token do Meta ou do ClickUp limpo mas revogado, a checagem marca "O serviço recusou a credencial…"; com o serviço fora do ar, marca "não confirmado" e só alerta se repetir na rodada seguinte.
5. Nenhum valor, trecho, máscara, tamanho ou resumo de credencial aparece na tela, no banco, no log do servidor ou na mensagem do Slack (conferido buscando o valor real nos quatro lugares).
6. Ao corrigir a credencial e checar de novo, a situação volta a "ok" e chega uma única mensagem de recuperação.
7. Um problema que persiste não gera novo alerta antes de 6 h.
8. "Checar agora" duas vezes em menos de 1 minuto mostra "Aguarde um minuto para checar de novo." e não chama os serviços.
9. Simulando uma fonte que manda o horário de Brasília marcado como UTC por 24 h (≥ 5 eventos), a fonte aparece como "suspeito" com diagnóstico de cerca de 3 h, e um alerta é enviado.
10. Nos grupos de WhatsApp, com a correção de 16/09 ativa, a fonte aparece como "defeito conhecido, corrigido", com desvio antes ≈ 3 h e depois ≈ 0, sem alerta.
11. Uma única reentrega da Greenn com 2 dias de atraso aparece como suspeito isolado e não gera alerta.
12. Nenhum evento é descartado nem tem o horário alterado pela proteção de horário (a contagem de eventos gravados é a mesma com e sem a proteção).
13. Abrir a aba e avaliar os critérios de horário leem só os resumos, nunca os eventos originais; a checagem de credenciais não lê o banco além do próprio resultado.
14. Os telefones `(11) 98765-4321`, `11987654321`, `5511987654321`, `551187654321` e `+55 11 8765-4321` viram todos `5511987654321`; o fixo `(11) 3456-7890` vira `551134567890`.
15. `+1 415 555 0100` é preservado como `14155550100` com situação "estrangeiro"; `123` e `55001234567890` ficam como vieram, com situação "impossível", e o lead é gravado e repassado normalmente.
16. Um lead que já existe com `551187654321` e chega de novo como `5511987654321` é reconhecido como o mesmo lead e não cria card novo no ClickUp nem contato novo nos demais destinos.
17. O identificador de evento de uma entrada em grupo já registrada é o mesmo antes e depois da mudança, e uma reentrada da mesma pessoa não gera conversão nova no Meta.
18. Todas as portas de entrada (site, formulário do Meta, grupos, Greenn, Kiwify, Hotmart, Eduzz, CRM) usam a mesma regra de telefone: o mesmo número bruto produz o mesmo telefone padronizado em qualquer uma delas.
19. Nos 7 dias após a ativação, nenhum lead novo com telefone brasileiro válido é registrado fora do padrão de 12 ou 13 dígitos.
20. Toda regra (classificação de credencial, estatística de desvio, regra de telefone, decisão de alerta) é calculada no servidor; o dashboard não contém nenhuma delas nem credencial.
