# Spec: Base de Conhecimento do Atacado Exponencial

## Visão Geral

**O que faz.** Junta num lugar só tudo o que a empresa sabe sobre o método — documentos do Atacado Sequencial, falas e visões do Felipe, comercial, tráfego, marcas atacadas e clientes — e, com o tempo, as gravações de lives, workshops e reuniões. Esse conteúdo vira uma **base consultável** que todos os profiles do Hermes (assistente-geral, comercial, gestor-ia, marketing, tracking) usam para responder com precisão e **sempre dizendo de onde tirou a resposta**.

**Para quem.** Equipe interna. Nenhum profile do Hermes conversa com pessoas de fora da empresa, então todos os profiles enxergam a base inteira, inclusive os dados de clientes.

**Qual problema resolve.** A própria equipe declara que hoje "não temos uma boa gestão" da base de conhecimento do método. O material está espalhado pelo Google Drive e em arquivos soltos, e o Hermes não tem como consultar nada disso. Ele não tem busca própria em documentos, e cada profile só sabe o que está escrito no seu prompt. Resultado: a IA não conhece o método nem os clientes, e quem sabe as coisas são as pessoas.

**Como se mede se funciona.** A base nasce junto com um **gabarito de perguntas** e uma rotina de teste. A equipe consegue ver, em números, se a busca acha o trecho certo e se melhorou ou piorou depois de cada mudança. O objetivo é tanto ter uma busca confiável quanto **aprender** com a estrutura: o que funciona, o que não funciona e por quê.

**Princípios que valem para a feature inteira:**

- **Toda resposta tem fonte.** Cada trecho devolvido pela busca traz o documento de origem, o link para abrir o original e, quando é gravação, o minuto e quem estava falando. Sem fonte, não entra na base.
- **Sem trecho, sem resposta.** Se a busca não achar nada relevante, ela diz que não achou. O Hermes responde "não encontrei isso na base" em vez de completar com o que imagina.
- **O original nunca é alterado.** A base guarda o arquivo como veio. Tudo o que é derivado dele (texto extraído, transcrição, trechos, fichas) pode ser apagado e refeito a partir do original.
- **O Hermes só lê.** Nenhum profile consegue escrever, editar ou apagar conteúdo da base. Quem muda a base é a equipe, pela pasta e pelo dash.
- **A versão mais recente vence.** Quando um arquivo é atualizado, os trechos da versão anterior saem da busca. Nunca coexistem duas versões do mesmo documento.
- **Nada some em silêncio.** Um arquivo que não pôde ser processado (formato não suportado, corrompido, grande demais, falha de transcrição) aparece como **erro, com o motivo**. Nunca fica fora da base sem ninguém saber.
- **Toda mudança passa pelo gabarito.** Qualquer alteração na forma de preparar ou buscar o conteúdo só é considerada melhoria se a taxa de acerto do gabarito não cair.

---

## Páginas / Módulos

### 1. Pasta vigiada no Google Drive (entrada de material)

**Descrição:** É uma pasta do Google Drive onde a equipe solta o material. Tudo o que é colocado lá entra na base sozinho, e isso vale também para os arquivos que hoje estão soltos: basta subi-los para a pasta. As subpastas dizem **a área** do conteúdo, e a área acompanha cada trecho para permitir filtrar a busca.

**Componentes:**
- **Pasta raiz "Base de Conhecimento AE"**, com uma subpasta por área:
  - `Método`: documentos do Atacado Sequencial, pilares, etapas, conceitos.
  - `Felipe`: falas, visões, "jeito de ver" e princípios do Felipe.
  - `Comercial`: roteiros, qualificação, objeções, processo de venda.
  - `Tráfego`: estrutura de campanhas, criativos, métricas, aprendizados.
  - `Marcas e Clientes`: **uma subpasta por cliente**, com o nome do cliente, contendo tudo sobre aquela marca.
  - `Lives`, `Workshops`, `Reuniões`: gravações em vídeo ou áudio e, quando existirem, as transcrições prontas.
- **Arquivo "LEIA-ME" na raiz:** explica em linguagem simples onde colocar cada tipo de material, quais formatos são aceitos e quanto tempo leva para aparecer na base.

**Comportamentos:**
- **Adicionar documento:** a equipe coloca um documento de texto na subpasta da área (documento do Google, PDF, Word, planilha, apresentação, texto simples). Em até 30 minutos ele aparece na base como "pronto".
- **Adicionar gravação:** a equipe coloca um vídeo ou áudio numa das subpastas de gravação. A gravação é transcrita, com a identificação de quem fala e o minuto de cada fala, e entra na base.
- **Adicionar gravação com transcrição pronta:** se houver uma transcrição com o mesmo nome da gravação na mesma pasta (a do Meet, por exemplo), ela é usada no lugar de uma nova transcrição.
- **Adicionar material de cliente:** um arquivo colocado na subpasta de um cliente fica marcado com o nome daquele cliente, além da área "Marcas e Clientes".
- **Criar cliente novo:** criar uma nova subpasta dentro de `Marcas e Clientes` cadastra o cliente na base com o nome da subpasta.
- **Atualizar arquivo:** quando um arquivo que já está na base é modificado no Drive, ele é processado de novo e a versão anterior sai da busca.
- **Renomear ou mover arquivo:** o nome e a área registrados na base passam a ser os novos, sem duplicar o conteúdo.
- **Apagar arquivo:** quando o arquivo sai da pasta (ou vai para a lixeira do Drive), o conteúdo dele sai da busca.
- **Arquivo repetido:** se o mesmo conteúdo for colocado duas vezes (cópia idêntica em outro lugar), a base guarda uma cópia só e registra os dois lugares.
- **Formato não suportado:** o arquivo aparece na aba da base com o status "erro" e o motivo "formato não suportado".
- **Arquivo sem texto aproveitável:** um PDF que é só imagem ou uma gravação sem fala aparece com status "erro" e o motivo "nenhum texto encontrado".
- **Arquivo acima do limite de tamanho:** aparece com status "erro" e o motivo "arquivo grande demais", informando o limite.
- **Arquivo fora das subpastas de área:** um arquivo colocado direto na pasta raiz entra na área "Sem área", e a aba avisa que ele precisa ser movido.

---

### 2. Preparação do conteúdo (o que a base faz com cada arquivo)

**Descrição:** Transforma cada arquivo em **trechos pesquisáveis**. Cada trecho é um pedaço do tamanho de uma ideia, com um resumo curto de onde ele está e do que se trata. Não tem tela própria: o andamento aparece na aba da base (módulo 4).

**Componentes:**
- **Trecho:** pedaço de conteúdo com texto, documento de origem, área, cliente (quando houver), data do documento, link para o original e, em gravações, o minuto de início e de fim e quem fala.
- **Contexto do trecho:** uma frase curta que situa o trecho dentro do documento (por exemplo: "Parte da aula 3 do Método sobre precificação no atacado, onde o Felipe explica margem por canal"). Ela é gravada junto com o trecho e ajuda a busca a entender trechos que, sozinhos, ficariam ambíguos.
- **Status do arquivo:** `na fila`, `processando`, `pronto` ou `erro` (com o motivo).

**Comportamentos:**
- **Dividir respeitando a estrutura:** o documento é cortado seguindo títulos, seções e parágrafos. Um trecho não começa nem termina no meio de uma frase.
- **Dividir gravação por assunto:** a transcrição é cortada por mudança de assunto ou de quem fala, sem cortes em tamanho fixo que partam uma explicação ao meio.
- **Manter quem falou:** nas gravações, cada trecho registra quem está falando. As falas do Felipe ficam identificáveis como falas dele, em qualquer pasta.
- **Gerar contexto do trecho:** cada trecho ganha a sua frase de contexto antes de entrar na busca.
- **Reprocessar:** refazer a preparação de um arquivo apaga os trechos antigos dele e cria os novos, sem duplicar.
- **Falha no meio:** se a preparação falhar no meio de um arquivo, nenhum trecho parcial fica na busca e o arquivo vai para `erro` com o motivo.

---

### 3. Busca (o que os profiles do Hermes consultam)

**Descrição:** É a consulta que os profiles do Hermes usam para achar conteúdo na base. Ela combina **busca por significado**, que acha o trecho certo mesmo com outras palavras ("como cobrar mais caro" encontra "precificação premium"), com **busca por termo exato**, que acha nomes de clientes, siglas e jargões como "SE", "MQL" ou "WO PAGO". Depois, reordena os candidatos e devolve só os mais relevantes.

**Componentes:**
- **Pergunta:** o texto que o Hermes quer consultar.
- **Filtros opcionais:** área, cliente, tipo de material (documento, live, workshop, reunião), quem falou (ex.: só falas do Felipe) e período.
- **Resultado:** lista ordenada de trechos. Cada um traz o texto, o contexto, a fonte, o link, a área, o cliente, a data, o minuto e quem falou (quando é gravação) e uma nota de relevância.

**Comportamentos:**
- **Buscar:** o Hermes manda uma pergunta e recebe os trechos mais relevantes, os melhores primeiro, até 8 por padrão.
- **Buscar filtrando por área:** o Hermes restringe a busca a uma ou mais áreas.
- **Buscar filtrando por cliente:** o Hermes restringe a busca ao material de um cliente.
- **Buscar só falas do Felipe:** o Hermes restringe a busca a trechos em que o Felipe é quem fala ou é o autor.
- **Buscar filtrando por período:** o Hermes restringe a busca a material de um intervalo de datas.
- **Buscar filtrando por tipo de material:** o Hermes restringe a busca a documentos, lives, workshops ou reuniões.
- **Nada relevante:** quando nenhum trecho atinge a relevância mínima, a busca devolve uma lista vazia com o aviso "nada relevante encontrado", nunca os "menos piores".
- **Listar clientes:** o Hermes pede a lista de clientes cadastrados na base, para usar o nome certo no filtro.
- **Abrir documento inteiro:** a partir de um trecho, o Hermes pede os trechos vizinhos (antes e depois) para ler mais contexto.
- **Nome aproximado de cliente:** um filtro de cliente com grafia aproximada ("oticas brasil" para "Óticas Brasil") encontra o cliente certo. Se houver mais de um candidato, a busca devolve os candidatos em vez de escolher sozinha.

---

### 4. Aba "Base de Conhecimento" no dash (acompanhar e testar a busca)

**Descrição:** É uma aba nova no menu lateral do dash, no mesmo padrão visual das outras abas (fundo escuro, seguindo o DESIGN.md). Nela a equipe vê o que está na base, acompanha o processamento e **testa a busca na mão**. O acesso é o mesmo do resto do dash, e toda a lógica fica no servidor.

**Componentes:**
- **Resumo no topo:** total de arquivos prontos, na fila e com erro; total de trechos; horas de gravação transcritas no mês e o teto mensal; data da última entrada.
- **Contagem por área:** quantos arquivos e trechos cada área tem.
- **Lista de arquivos:** nome, área, cliente, tipo, status, data da última atualização, número de trechos e link para o original no Drive. Filtrável por área, cliente, status e tipo, com busca pelo nome.
- **Detalhe do arquivo:** mostra os trechos gerados, cada um com o seu contexto, e o motivo quando está em erro.
- **Testador de busca:** um campo de pergunta com os mesmos filtros do módulo 3 e o resultado exatamente como o Hermes recebe, incluindo a nota de relevância de cada trecho.

**Comportamentos:**
- **Ver o resumo da base:** a equipe abre a aba e vê os totais e a contagem por área.
- **Filtrar a lista de arquivos:** por área, cliente, status ou tipo.
- **Procurar arquivo pelo nome:** digitar parte do nome filtra a lista.
- **Ver os trechos de um arquivo:** clicar no arquivo mostra os trechos e o contexto de cada um.
- **Ver o motivo de um erro:** um arquivo em erro mostra o motivo em linguagem simples.
- **Reprocessar um arquivo:** um botão manda o arquivo de novo para a preparação.
- **Marcar quem fala:** numa gravação, a equipe vê as vozes separadas pela transcrição, com um exemplo de fala de cada uma, e diz qual é o Felipe (ou dá outro nome). Os trechos daquela voz passam a registrar o nome escolhido.
- **Ver gravações sem voz identificada:** um filtro na lista mostra as gravações que ainda não tiveram as vozes marcadas.
- **Ver e ajustar o teto de transcrição:** a aba mostra quantas horas foram transcritas no mês, qual é o teto e quantas gravações esperam por causa dele. A equipe pode alterar o teto.
- **Abrir o original:** um link abre o arquivo no Google Drive.
- **Testar uma pergunta:** a equipe digita uma pergunta, escolhe filtros e vê os trechos que a busca devolve.
- **Transformar um teste em gabarito:** a partir de um teste feito no testador, um botão cria uma pergunta-gabarito já preenchida com a pergunta e com os trechos que a pessoa marcar como corretos (módulo 5).

---

### 5. Gabarito e rodadas de teste (medir se a busca funciona)

**Descrição:** É uma seção da aba "Base de Conhecimento". A equipe cadastra perguntas cuja resposta certa já conhece e indica **em que documento, ou trecho, a resposta está**. Uma rodada de teste faz todas essas perguntas à busca e mede quantas vezes ela trouxe o lugar certo e em que posição. É o termômetro da base.

**Componentes:**
- **Lista de perguntas-gabarito:** pergunta, área, fonte esperada (documento e, quando fizer sentido, trecho), quem cadastrou, situação (ativa ou arquivada) e resultado na última rodada (acertou ou errou, e a posição).
- **Formulário de pergunta-gabarito:** pergunta (obrigatória), área, fonte ou fontes esperadas (uma ou mais, escolhidas na lista de arquivos da base), filtros a usar (opcional) e observação.
- **Painel da última rodada:**
  - taxa de acerto nas 5 primeiras posições (a busca trouxe a fonte certa entre os 5 primeiros trechos);
  - taxa de acerto na primeira posição;
  - posição média da fonte certa;
  - taxa de acerto por área.
- **Histórico de rodadas:** data, o que mudou naquela rodada (texto livre), total de perguntas e as taxas, com a variação em relação à rodada anterior.
- **Lista de erros da rodada:** as perguntas que a busca errou, com o que ela trouxe no lugar da fonte certa.

**Comportamentos:**
- **Cadastrar pergunta-gabarito:** a equipe cria uma pergunta e aponta a fonte esperada.
- **Editar pergunta-gabarito:** altera a pergunta, a fonte esperada ou os filtros.
- **Arquivar pergunta-gabarito:** tira a pergunta das próximas rodadas sem apagar o histórico dela.
- **Reativar pergunta-gabarito:** a pergunta volta a entrar nas rodadas.
- **Fonte esperada apagada:** quando o arquivo esperado por uma pergunta sai da base, a pergunta recebe o aviso "fonte esperada não existe mais" e fica fora da rodada até ser corrigida.
- **Rodar teste agora:** um botão roda todas as perguntas ativas e mostra o resultado quando termina.
- **Descrever a rodada:** ao rodar, a pessoa escreve o que mudou desde a última rodada (ex.: "entraram 12 lives de agosto").
- **Rodada automática:** o teste roda sozinho uma vez por semana e sempre que entrar um lote grande de arquivos novos, registrado no histórico como "automática".
- **Comparar rodadas:** o histórico mostra a variação de cada taxa em relação à rodada anterior, com destaque visual quando cai.
- **Ver o que errou:** clicar numa pergunta errada mostra a fonte esperada ao lado do que a busca trouxe.
- **Ver acerto por área:** o painel separa a taxa de acerto por área, para mostrar onde a base está fraca.

---

### 6. Acesso pelos profiles do Hermes

**Descrição:** Liga a busca (módulo 3) aos cinco profiles do Hermes e define **como** eles usam a base. Todos os profiles recebem o mesmo acesso de leitura.

**Componentes:**
- **Ferramenta de busca na base:** disponível nos cinco profiles, com os mesmos filtros do módulo 3.
- **Instrução de uso da base:** texto que cada profile recebe explicando quando consultar a base, como citar a fonte e o que fazer quando não achar.

**Comportamentos:**
- **Consultar antes de responder sobre o método:** diante de uma pergunta sobre método, comercial, tráfego, clientes ou falas do Felipe, o profile consulta a base antes de responder.
- **Citar a fonte:** toda resposta baseada na base termina com as fontes usadas: nome do documento e link, e, em gravação, o minuto.
- **Dizer que não achou:** quando a busca volta vazia, o profile diz "não encontrei isso na base de conhecimento" e não inventa.
- **Separar base de opinião:** se o profile complementar com raciocínio próprio, ele deixa claro o que veio da base e o que é sugestão dele.
- **Buscar de novo com outras palavras:** se a primeira busca vier fraca, o profile pode reformular a pergunta e buscar de novo antes de desistir.
- **Registrar pergunta sem resposta:** toda busca que volta vazia fica registrada, com a pergunta e o profile, para a equipe ver na aba o que está faltando na base.

---

### 7. Fichas de síntese (a base aprendendo)

**Descrição:** A partir do material bruto, a IA escreve **fichas organizadas**: uma por cliente e uma por tema do método (ex.: "Precificação", "Objeção de preço", "Estrutura de campanha de SE"). Cada ficha junta o que está espalhado em vários documentos, lives e reuniões. Uma pessoa aprova a ficha antes de ela entrar na base, e a ficha aprovada vira mais uma fonte pesquisável, sempre com a lista das fontes de onde saiu.

**Componentes:**
- **Lista de fichas:** título, tipo (cliente ou tema), situação (`rascunho`, `aprovada`, `desatualizada`), data e quantas fontes usou.
- **Ficha:** texto organizado em seções e, no fim, a lista das fontes, com link e minuto.
- **Fila de revisão:** as fichas em rascunho esperando aprovação.

**Comportamentos:**
- **Pedir ficha de um cliente:** a equipe escolhe um cliente e pede a ficha. A IA monta um rascunho com tudo o que a base sabe sobre ele.
- **Pedir ficha de um tema:** a equipe escreve o tema e pede a ficha. A IA monta um rascunho a partir dos trechos relevantes.
- **Aprovar ficha:** a pessoa aprova o rascunho, e a ficha entra na base como fonte pesquisável.
- **Editar ficha antes de aprovar:** a pessoa corrige o texto do rascunho.
- **Recusar ficha:** o rascunho é descartado e o motivo fica registrado.
- **Ficha ficou desatualizada:** quando entra material novo sobre o cliente ou o tema de uma ficha aprovada, ela é marcada como `desatualizada`, com a lista do que entrou de novo.
- **Atualizar ficha:** a partir de uma ficha desatualizada, a IA gera um novo rascunho incorporando o material novo, e esse rascunho também passa por aprovação.

---

## Fora do escopo desta spec

- Profiles que conversam com pessoas de fora da empresa, e com isso os níveis de acesso por profile. Se um dia existir, é uma mudança nova.
- Tirar material automaticamente de outras ferramentas (ClickUp, CRM, ManyChat, YouTube). Por enquanto, o único caminho de entrada é a pasta do Drive.
- Uso da base fora do Hermes (por exemplo, um chat no próprio dash).

## Decisões tomadas (24/09)

1. **Identificação do Felipe nas gravações:** alguém marca na aba qual voz é a do Felipe (comportamento "Marcar quem fala" no módulo 4). Sem marcação, a voz fica como "não identificado". A base nunca adivinha.
2. **Falas literais do Felipe:** os trechos de gravação guardam o texto literal da transcrição. A busca "só falas do Felipe" já devolve as frases exatas, e as fichas de síntese citam de onde vieram. Não há um cadastro separado de citações.
3. **Teto de custo de transcrição:** existe um teto mensal de horas transcritas, ajustável na aba e começando em 30 horas. Com o teto atingido, novas gravações ficam `na fila` com o motivo "teto do mês atingido" e entram automaticamente no mês seguinte ou quando o teto for aumentado.
4. **Reuniões com clientes:** entram inteiras na base, porque o acesso é só da equipe interna.
