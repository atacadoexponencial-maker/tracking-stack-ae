# Spec: Central de Marketing — Instagram do @felipesantosae

> **Aprovada pela usuária em 29/09/2026**, depois de ver a prévia com dados reais.
> A prévia validou o layout (sub-abas, cartões, gráficos, ranking, stories,
> público) e serve de referência visual no /plan.

## Visão Geral

**O que faz.** Abre dentro do dash uma área nova, **Marketing**, cuja primeira tela
é **Instagram**: mostra como o perfil **@felipesantosae** está evoluindo (alcance,
visualizações, seguidores, interações), quais posts, reels e stories funcionaram
melhor e quem é o público. Tudo com o mesmo filtro de datas que o dash já usa.

**Para quem.** A equipe interna do Atacado Exponencial, que hoje só vê esses
números abrindo o app do Instagram, um post por vez, sem histórico nem comparação.

**Problema que resolve.** O Instagram não guarda histórico acessível para
comparação, e os **stories somem em 24h** junto com as métricas deles. A central
registra tudo continuamente, então dá para comparar períodos, ranquear conteúdo e
ver stories antigos.

**Decisões já tomadas pela usuária (29/09)** — registradas aqui porque definem o
escopo, não o jeito de implementar:
- Fica **dentro do dash atual**, com o mesmo login. Não é app nem domínio separado.
- Os dados ficam num **banco separado do banco do tracking** (Neon, área própria
  `marketing`, com acesso restrito só a ela). Nada é gravado no banco do tracking.
- A coleta usa o acesso à Meta que **já existe** (usuário do sistema "gestoria",
  app "Agentes de IA"). Nenhuma credencial nova.
- **Só o @felipesantosae** nesta entrega. O @atacadoexponencial fica para depois
  (depende de liberar a conta ao usuário do sistema no Gerenciador de Negócios).

**Fora do escopo desta entrega:**
- Publicar, agendar ou responder conteúdo pelo dash.
- Comparar com concorrentes ou perfis de clientes da agência.
- Alertas (Slack, WhatsApp) sobre queda de desempenho.
- Cruzar Instagram com leads/vendas do tracking.
- Métricas que a Meta desativou (impressões, plays) — não aparecem em lugar nenhum.

---

## Módulos

### 1. Coleta automática (sem tela)

**Descrição:** Busca os números do @felipesantosae na Meta de tempos em tempos e
guarda no banco da central, para que a tela nunca dependa da Meta na hora em que
alguém abre o dash.

**Componentes:**
- Coleta do perfil: números do dia do perfil inteiro.
- Coleta de posts: números de cada post do feed e reel.
- Coleta de stories: números de cada story enquanto ele ainda está no ar.
- Coleta de público: distribuição de seguidores e de engajados por idade, gênero,
  cidade e país, e os horários em que os seguidores estão online.
- Registro de execuções: quando cada coleta rodou, se deu certo e, se falhou, por quê.

**Comportamentos:**
- Registrar os números diários do perfil: alcance, visualizações, visitas ao
  perfil, contas com engajamento, interações totais, curtidas, comentários,
  compartilhamentos, salvamentos, respostas, reposts, toques no link e seguidores
  ganhos no dia.
- Registrar alcance, visualizações e interações do perfil separados por tipo de
  conteúdo (post, carrossel, reel, story, anúncio), para permitir separar
  orgânico de anúncios.
- Registrar o total de seguidores, de contas seguidas e de posts, uma vez por dia.
- Descobrir posts e reels novos publicados desde a última coleta.
- Atualizar os números de cada post e reel publicado nos **últimos 30 dias**,
  porque eles continuam crescendo depois de publicados.
- Registrar, para reels: alcance, visualizações, curtidas, comentários,
  compartilhamentos, salvamentos, interações totais, tempo médio assistido e
  tempo total assistido.
- Registrar, para carrossel e foto: alcance, visualizações, curtidas, comentários,
  compartilhamentos, salvamentos, interações totais, visitas ao perfil geradas e
  seguidores gerados.
- Guardar de cada post: tipo, data de publicação, legenda, link para o post e
  miniatura.
- Identificar quais posts do perfil foram usados em anúncio na conta
  CA_AtacadoExponencial e registrar, por post, alcance pago, impressões,
  visualizações pagas e investimento, somando todos os anúncios que usam o post.
- Capturar cada story ativo **várias vezes ao dia**, de modo que o último registro
  antes de expirar fique a no máximo poucas horas do fim das 24h.
- Registrar, para stories: alcance, visualizações, respostas, compartilhamentos,
  interações totais, navegação (avançar, voltar, sair), visitas ao perfil e
  seguidores gerados.
- Manter o último número capturado de um story depois que ele expira (o story
  deixa de ser atualizado, mas não some).
- Registrar a demografia do público uma vez por dia (a foto mais recente substitui
  a anterior na tela, mas o histórico fica guardado).
- Preencher o histórico na primeira execução com o que a Meta ainda permitir
  buscar para trás (posts antigos e números diários do perfil). Stories anteriores
  ao início da coleta **não podem** ser recuperados.
- Não duplicar registros quando a mesma coleta roda duas vezes no mesmo período.
- Registrar a falha e seguir para o próximo item quando um post específico der
  erro na Meta, sem derrubar a coleta inteira.
- Registrar a falha da execução quando o acesso à Meta for recusado (token
  revogado, permissão retirada).

---

### 2. Área Marketing no menu do dash

**Descrição:** Um grupo novo na barra lateral do dash, separado de Resultados,
Operação e Diagnóstico, que vai reunir as telas da central. Nesta entrega tem um
item só.

**Componentes:**
- Rótulo de grupo **Marketing** na barra lateral.
- Item **Instagram** dentro do grupo.

**Comportamentos:**
- Clicar em **Instagram** abre a tela do Instagram com o título "Instagram".
- Abrir o dash por um link direto para a tela do Instagram leva a ela depois do login.
- O item fica marcado como ativo enquanto a tela do Instagram está aberta.
- A tela só aparece para quem passou pela chave de acesso do dash, como as demais.

---

### 3. Tela Instagram — cabeçalho e frescor dos dados

**Organização da tela (decidida em 29/09).** A tela mostra **todas** as
informações que a Meta disponibiliza, divididas em quatro sub-abas (pílulas, no
padrão de abas do dash), no mesmo desenho que as ferramentas de mercado usam
(Instagram Insights, Metricool, Iconosquare, Reportei, mLabs):

| Sub-aba | Blocos |
|---|---|
| **Crescimento** | indicadores (4), seguidores (4b), evolução diária (5) |
| **Conteúdo** | desempenho por tipo (6a), ranking de posts e reels (6) |
| **Stories** | stories (7) |
| **Público** | público e melhores horários (8) |

O cabeçalho (3) fica fixo acima das sub-abas. Estados de carregamento e erro (9)
valem para todas.

**Descrição:** Topo da tela, que diz de qual perfil são os números e se eles estão
em dia.

**Componentes:**
- Identificação do perfil: @felipesantosae, total de seguidores atual, total de posts.
- Indicador de atualização: "Atualizado há X" com a hora da última coleta que deu certo.
- Aviso de coleta atrasada: aparece quando a última coleta bem-sucedida tem mais
  de um limite de horas (a definir no /plan).
- Filtro de datas: o mesmo seletor de período que o dash já usa (Hoje, Ontem,
  7/14/30 dias, Este mês, Mês passado, Personalizado). O filtro de funil não se
  aplica e fica escondido ou desativado nesta tela.

**Comportamentos:**
- Trocar de sub-aba (Crescimento, Conteúdo, Stories, Público) sem recarregar a página.
- Abrir o dash por um link direto para uma sub-aba leva a ela.
- A sub-aba padrão ao abrir a tela é **Crescimento**.
- Mudar o período recarrega todos os blocos da tela para o novo período.
- Ver o horário exato da última coleta ao passar o mouse sobre "Atualizado há X".
- Ver o aviso de coleta atrasada, com a hora e o motivo da última falha, quando
  a coleta estiver parada.

---

### 4. Tela Instagram — indicadores do período

**Descrição:** Linha de cartões com os totais do período escolhido, comparados com
o período anterior de mesmo tamanho.

**Orgânico × anúncios (medido em 29/09, últimos 28 dias).** Os números do perfil
que a Meta entrega **misturam anúncios**: todos os anúncios da conta
CA_AtacadoExponencial rodam com a identidade @felipesantosae, e **97% do alcance**
(150.109 de 154.964) e **94% das visualizações** veio de anúncio. Sem separar, a
tela mediria a verba de mídia, não o perfil. Regra:
- Alcance, Visualizações e Interações mostram **Orgânico** como número principal
  e **Anúncios** como número secundário no mesmo cartão (a Meta permite separar
  por tipo de conteúdo, onde "anúncio" é um tipo).
- Métrica que a Meta **não** permite separar (contas com engajamento, visitas ao
  perfil, toques no link, seguidores ganhos) leva o selo **"inclui anúncios"**.
- Os anúncios são de dois jeitos: (a) **posts do perfil impulsionados** (campanhas
  "Post do Instagram", 14 encontrados em 29/09) e (b) **posts feitos só para
  anúncio**, que não aparecem no perfil. Os do tipo (b) ficam fora do ranking.
- Os números de cada post que a Meta entrega pelo perfil são **só orgânicos**,
  mesmo quando o post foi impulsionado (medido: reel de 01/07 com 380 de alcance
  orgânico e 63.929 de alcance pago, R$ 743,96). O pago vem da conta de anúncios,
  ligado ao post pelo anúncio que o usa.

**Componentes:**
- Cartão **Alcance** (contas únicas alcançadas).
- Cartão **Visualizações**.
- Cartão **Seguidores**: saldo do período (ganhos − perdidos) e total atual.
- Cartão **Visitas ao perfil**.
- Cartão **Interações** (curtidas + comentários + compartilhamentos + salvamentos + respostas + reposts).
- Cartão **Toques no link**.
- Em cada cartão: variação em % contra o período anterior, com seta e cor para cima/baixo.

**Comportamentos:**
- Ver cada total do período escolhido.
- Ver a variação de cada total contra o período anterior de mesmo tamanho.
- Ver "sem comparação" em vez de uma % quando o período anterior não tem dados coletados.
- Ver a quebra das interações (curtidas, comentários, compartilhamentos,
  salvamentos, respostas, reposts) ao passar o mouse no cartão Interações.

---

### 4b. Tela Instagram — seguidores

**Descrição:** Bloco próprio para o crescimento do perfil: quantos entraram,
quantos saíram e como o total evoluiu.

**Limite da Meta (medido em 29/09):** seguidores por dia só podem ser buscados
para os **últimos 30 dias**. Tudo antes do início da coleta menos 30 dias não
existe e não pode ser recuperado. A primeira coleta traz de 31/08/2026 em diante.

**Componentes:**
- Três números do período: **Ganhos**, **Perdidos** e **Saldo**.
- Gráfico diário com duas séries: ganhos (série principal) e perdidos (segunda
  série), para ver dias de ganho e de perda lado a lado.
- Linha do **total de seguidores** dia a dia.
- Aviso fixo: "Histórico de seguidores começa em DD/MM/AAAA."

**Comportamentos:**
- Ver ganhos, perdidos e saldo do período escolhido.
- Ver os ganhos e os perdidos de um dia ao passar o mouse sobre ele.
- Ver o total de seguidores de um dia ao passar o mouse na linha do total.
- Ver lacuna, e não zero, nos dias anteriores ao início do histórico.
- Ver "perdidos indisponível" em vez de zero nos dias em que a Meta não informou
  as saídas (confirmado em 29/09: a Meta informa saídas por dia).

**Na coleta (módulo 1), isso exige:**
- Registrar por dia os seguidores **ganhos** e os **perdidos**, separados.
- Registrar o **total de seguidores** uma vez por dia a partir do início da coleta.
- Na primeira execução, reconstruir o total dos 30 dias anteriores a partir do
  total atual descontando ganhos e perdidos, e marcar esses dias como reconstruídos.

---

### 5. Tela Instagram — evolução diária

**Descrição:** Gráfico de linha com a evolução dia a dia dentro do período.

**Componentes:**
- Gráfico diário com uma métrica por vez.
- Seletor da métrica exibida: Alcance, Visualizações, Seguidores ganhos, Visitas
  ao perfil, Interações.
- Marcação dos dias em que houve publicação (post, reel), para ligar picos a conteúdo.

**Comportamentos:**
- Trocar a métrica exibida no gráfico.
- Ver o valor exato de um dia ao passar o mouse sobre ele.
- Ver quais conteúdos foram publicados num dia marcado ao passar o mouse na marcação.
- Ver os dias sem coleta como lacuna no gráfico, e não como zero.

---

### 6a. Tela Instagram — desempenho por tipo de conteúdo

**Descrição:** Comparação lado a lado entre **Reels, Carrosséis, Fotos e Stories**
publicados no período, para responder "qual formato funciona melhor".

**Componentes:**
- Um cartão por tipo, com: quantidade publicada, alcance médio, visualizações
  médias, interações médias, taxa de engajamento média (interações ÷ alcance) e
  seguidores gerados (onde a Meta informa).
- Destaque discreto no tipo com maior alcance médio e no de maior engajamento.
- Em cada cartão, o **melhor conteúdo daquele tipo** no período (miniatura e alcance).

**Comportamentos:**
- Ver as médias de cada tipo no período escolhido.
- Ver "nenhum publicado" no cartão de um tipo sem publicações no período.
- Clicar no cartão de um tipo filtra o ranking (6) para aquele tipo (Stories leva
  à sub-aba Stories).
- Abrir o melhor conteúdo do tipo no Instagram, numa aba nova.

---

### 6. Tela Instagram — ranking de posts e reels

**Descrição:** Tabela com os posts do feed e reels **publicados no período**,
ordenável, para responder "o que funcionou".

**Componentes:**
- Tabela com uma linha por conteúdo: miniatura, tipo (Reel, Carrossel, Foto),
  data de publicação, começo da legenda, alcance, visualizações, curtidas,
  comentários, compartilhamentos, salvamentos, interações e taxa de engajamento
  (interações ÷ alcance).
- Selo **Impulsionado** nos posts que foram usados em anúncio, com colunas de
  **alcance pago**, **visualizações pagas** e **investimento**; nos demais, essas
  colunas mostram "—".
- As colunas de alcance e visualizações mostram o **orgânico**; o pago nunca é
  somado a elas em silêncio.
- Colunas que só existem para alguns tipos: tempo médio assistido (reels),
  visitas ao perfil e seguidores gerados (carrossel e foto). Onde não se aplica,
  a célula mostra "—", nunca zero.
- Filtro por tipo de conteúdo.
- Estado vazio: "Nenhum post publicado neste período."

**Comportamentos:**
- Ordenar a tabela por qualquer coluna numérica, crescente ou decrescente.
- A ordem padrão é por alcance, do maior para o menor.
- Filtrar a tabela para mostrar só Reels, só Carrossel, só Foto ou todos.
- Filtrar a tabela para mostrar só os impulsionados, só os não impulsionados ou todos.
- Ver, ao passar o mouse no selo Impulsionado, o nome da campanha e o período em
  que o anúncio rodou.
- Abrir o post no Instagram, numa aba nova, clicando na linha ou na miniatura.
- Ver a legenda completa ao passar o mouse sobre o trecho.
- Ver a data e hora da última atualização dos números daquele post.

---

### 7. Tela Instagram — stories

**Descrição:** Lista dos stories **publicados no período**, com os números
capturados enquanto estavam no ar.

**Componentes:**
- Lista de stories: miniatura, data e hora da publicação, alcance, visualizações,
  respostas, compartilhamentos, navegação, visitas ao perfil, seguidores gerados.
- Selo **No ar** para stories que ainda não expiraram (números ainda mudando).
- Selo **Captura parcial** quando a última captura foi muito antes do story
  expirar (os números finais podem ter sido maiores).
- Totais e médias dos stories do período (alcance médio por story, total de respostas).
- Aviso fixo informando desde quando os stories começaram a ser registrados.
- Estado vazio: "Nenhum story registrado neste período."

**Comportamentos:**
- Ordenar a lista por data, alcance ou visualizações.
- Ver a quebra da navegação (avançar, voltar, sair, próximo story) ao passar o mouse.
- Ver a hora da última captura de cada story.
- Ver o aviso de "desde quando" ao escolher um período anterior ao início da coleta.

---

### 8. Tela Instagram — público

**Descrição:** Quem são os seguidores e quem interage, pela foto mais recente
coletada. **Não segue o filtro de datas** (a Meta só dá o retrato atual).

**Componentes:**
- Distribuição por **idade** (barras).
- Distribuição por **gênero** (barras ou proporção).
- **Top 10 cidades** e **top 5 países**.
- Alternância entre **Seguidores** e **Quem interagiu**.
- **Melhores horários**: gráfico de barras por hora (0h a 23h, horário de
  Brasília) com os seguidores online no último dia informado pela Meta, com a
  hora de pico destacada. A Meta só entrega um dia por vez e no fuso do Pacífico;
  a conversão para Brasília é feita antes de exibir. (Aprovado em 29/09 no lugar
  da grade dia × hora.)
- Nota: "Retrato de DD/MM — não varia com o filtro de datas."

**Comportamentos:**
- Alternar entre o público de seguidores e o público de quem interagiu.
- Ver o número absoluto e a % de cada faixa ao passar o mouse.
- Ver no gráfico de horários a hora com mais seguidores online destacada.
- Ver quantos seguidores estavam online numa hora ao passar o mouse sobre a barra.
- Ver o aviso "a Meta não devolveu o perfil de quem interagiu" quando esse
  público vier vazio, em vez de gráficos zerados.
- Ver a data da foto do público exibida.

---

### 9. Tela Instagram — estados de carregamento e erro

**Descrição:** Como a tela se comporta quando os dados ainda não existem ou não
podem ser lidos.

**Componentes:**
- Indicador de carregamento por bloco.
- Mensagem de erro por bloco, sem derrubar os outros blocos.
- Estado "coleta ainda não rodou": tela explica que os números aparecem após a
  primeira coleta.

**Comportamentos:**
- Ver cada bloco carregando de forma independente.
- Ver uma mensagem de erro num bloco quando o banco da central não responder,
  enquanto os demais blocos continuam visíveis.
- Tentar de novo um bloco com erro sem recarregar a página.
- Ver o estado "coleta ainda não rodou" antes da primeira coleta.
