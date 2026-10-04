# Spec: Editor de e-mail por blocos, com imagens e cabeçalho editável

## Visão Geral

O e-mail próprio (spec-email-proprio.md) está funcionando: agenda, campanhas,
fluxos e testes saem pelo nosso domínio. O editor de modelo, porém, ficou simples
demais para marketing. Hoje o corpo é um texto único com uma marcação curta
(negrito, link e botão) e todo e-mail sai com o mesmo layout: a logo do Atacado
Exponencial fixa no topo, o corpo e o rodapé comum. Não dá para colocar imagem e
não dá para mudar nem tirar a logo.

Este projeto troca o corpo de texto por um **editor por blocos**: o e-mail é uma
pilha de blocos (título, texto, imagem, botão, divisória, espaço, imagem com
texto ao lado) que a equipe adiciona, edita, reordena e apaga, vendo o resultado
ao lado. Junto vêm:

- **Cabeçalho editável:** uma faixa no topo montada com os mesmos blocos do
  corpo e com cor de fundo. Um cabeçalho padrão na Configuração, que cada modelo
  usa, personaliza ou tira.
- **Biblioteca de imagens:** a equipe sobe uma imagem uma vez e reaproveita em
  vários modelos; a imagem fica num endereço público e permanente, porque o
  e-mail é aberto dias depois do envio.
- **Conversão dos modelos que já existem:** os 5 modelos da agenda (e qualquer
  outro modelo salvo) viram blocos sozinhos, com o mesmo resultado de hoje.
  Depois disso existe um formato só.
- **Campanha sem modelo:** dá para escrever o e-mail direto na campanha, com o
  mesmo editor, sem criar um modelo antes.

**Para quem:** a equipe de marketing, que monta os modelos no dash. Quem recebe
os e-mails (leads e clientes) vê e-mails com imagem e com a cara de cada
campanha.

**O que não muda:** quem usa os modelos (e-mails da agenda, campanhas, fluxos,
teste) continua usando do mesmo jeito. O rodapé comum da Configuração e o link de
descadastro do marketing continuam entrando sozinhos no fim de todo e-mail. Os
campos personalizados ({{primeiro_nome}}, {{data_reuniao}} etc.) continuam
funcionando dentro dos blocos.

## Páginas / Módulos

### 1. Editor do modelo (Marketing › E-mail › Modelos)

**Descrição:** a tela onde a equipe monta o e-mail. Substitui a caixa de texto
única do corpo. Assunto, texto de pré-visualização, canal e nome continuam como
hoje.

**Componentes:**
- Campos do topo: nome do modelo, canal (só na criação), assunto e texto de
  pré-visualização, como hoje.
- Faixa do cabeçalho: mostra qual cabeçalho este modelo usa (padrão, outra imagem
  ou nenhum), com o botão para trocar.
- Pilha de blocos: cada bloco aparece como um cartão com o tipo, um resumo do
  conteúdo e as ações (subir, descer, duplicar, apagar). O bloco selecionado
  mostra os campos de edição dele.
- Botão "Adicionar bloco" entre os blocos e no fim da pilha, que abre a lista de
  tipos de bloco.
- Prévia ao lado, igual ao e-mail que sai: cabeçalho, blocos, rodapé comum e,
  no marketing, o link de descadastro. Com os campos preenchidos por dados de
  exemplo.
- Alternador da prévia entre computador e celular.
- Lista de campos personalizados do canal, para inserir no bloco de texto,
  título ou botão que está sendo editado.
- Avisos do modelo: campo desconhecido, link vazio ou inválido, imagem sem texto
  alternativo, bloco vazio, modelo sem nenhum bloco.
- Indicador de "mudanças não salvas" e o botão "Salvar".

**Comportamentos:**
- Adicionar um bloco no fim do e-mail, escolhendo o tipo.
- Adicionar um bloco entre dois blocos, escolhendo o tipo.
- Selecionar um bloco para editar o conteúdo dele.
- Subir um bloco uma posição.
- Descer um bloco uma posição.
- Arrastar um bloco para outra posição da pilha.
- Duplicar um bloco (a cópia entra logo abaixo).
- Apagar um bloco.
- Desfazer a última mudança no editor.
- Refazer a mudança desfeita.
- Ver a prévia atualizar enquanto edita, sem precisar salvar.
- Clicar num bloco na prévia e ele ficar selecionado no editor.
- Alternar a prévia entre computador e celular.
- Inserir um campo personalizado no ponto onde o cursor está, no bloco
  selecionado.
- Ver o aviso de campo desconhecido no bloco onde ele está, antes de salvar.
- Ver o aviso de link inválido no bloco onde ele está, antes de salvar.
- Ver o aviso de imagem sem texto alternativo (não impede salvar).
- Salvar o modelo.
- Ser avisada ao sair do editor com mudanças não salvas, podendo ficar ou
  descartar.
- Mandar teste do modelo para um endereço da equipe (como hoje), com o que está
  na tela, mesmo sem salvar.
- Duplicar o modelo inteiro, com blocos e cabeçalho (como hoje).
- Arquivar o modelo, com a mesma trava de hoje para modelo em uso.
- Ser impedida de salvar modelo sem nenhum bloco, com o motivo.
- Salvar modelo usado pela agenda ou por fluxo publicado vale para os próximos
  envios, como hoje, e o editor avisa onde o modelo está em uso antes de salvar.

---

### 2. Tipos de bloco

**Descrição:** os blocos que montam o corpo do e-mail. Todos seguem a mesma
largura do e-mail, ficam bons no celular (empilham quando são lado a lado) e
saem iguais nos principais leitores de e-mail (Gmail, Outlook, Apple Mail,
celular).

**Componentes:**
- **Título:** texto curto em destaque, em dois tamanhos (grande e médio), com
  cor escolhida.
- **Texto:** parágrafos com negrito, itálico, link e lista com marcadores, com
  cor do texto e dos links escolhidas.
- **Imagem:** uma imagem da biblioteca, com texto alternativo, largura e link
  opcional.
- **Botão:** texto e link, com estilo cheio ou contorno e cores escolhidas
  (fundo e texto).
- **Divisória:** uma linha fina separando partes do e-mail, com cor escolhida.
- **Espaço:** um respiro vertical em três alturas (pequeno, médio, grande).
- **Imagem com texto:** imagem de um lado e texto do outro; no celular, a imagem
  fica em cima e o texto embaixo.

- **Escolha de cor (em todos os lugares com cor):** qualquer cor, por paleta
  livre ou pelo código da cor, com atalhos para as cores da marca (carvão, bege
  assinatura, branco) e para as últimas cores usadas.
- **Cor de fundo do e-mail:** escolhida por modelo (o fundo em volta e o fundo
  da área do conteúdo).

**Comportamentos:**
- Escolher uma cor pela paleta livre.
- Escolher uma cor digitando o código dela.
- Escolher uma cor pelos atalhos da marca.
- Reaproveitar uma das últimas cores usadas.
- Escolher a cor de fundo em volta do e-mail, no modelo.
- Escolher a cor de fundo da área do conteúdo, no modelo.
- Título: escrever o texto.
- Título: escolher o tamanho (grande ou médio).
- Título: escolher o alinhamento (esquerda ou centro).
- Título: escolher a cor.
- Texto: escrever os parágrafos.
- Texto: marcar um trecho como negrito.
- Texto: marcar um trecho como itálico.
- Texto: transformar um trecho em link, informando o endereço.
- Texto: tirar o link de um trecho.
- Texto: criar uma lista com marcadores.
- Texto: escolher o alinhamento (esquerda ou centro).
- Texto: escolher a cor do texto.
- Texto: escolher a cor dos links.
- Imagem: escolher uma imagem da biblioteca.
- Imagem: subir uma imagem nova direto do bloco (ela entra na biblioteca).
- Imagem: trocar a imagem escolhida.
- Imagem: escrever o texto alternativo (o que aparece quando a imagem não
  carrega e o que o leitor de tela lê).
- Imagem: escolher a largura (largura toda, metade ou tamanho original, sem
  passar da largura do e-mail).
- Imagem: escolher o alinhamento quando não ocupa a largura toda.
- Imagem: pôr um link na imagem (clicar nela abre o endereço).
- Imagem: tirar o link da imagem.
- Botão: escrever o texto do botão.
- Botão: informar o link do botão (aceita campo, ex.: {{link_reuniao}}).
- Botão: escolher o estilo (cheio ou contorno).
- Botão: escolher o alinhamento (esquerda, centro ou largura toda).
- Botão: escolher a cor de fundo.
- Botão: escolher a cor do texto.
- Botão: ser avisada quando a cor do texto e a do fundo têm pouco contraste
  (difícil de ler); não impede salvar.
- Divisória: escolher a cor.
- Espaço: escolher a altura (pequeno, médio ou grande).
- Imagem com texto: escolher a imagem, escrever o texto (com as mesmas opções do
  bloco de texto) e escolher de que lado fica a imagem (esquerda ou direita).
- Usar campo personalizado em título, texto, botão (texto e link) e texto
  alternativo de imagem.
- Ver, na prévia, o campo personalizado preenchido com o dado de exemplo.

---

### 3. Cabeçalho

**Descrição:** a faixa do topo do e-mail, montada com os **mesmos blocos do
corpo** (imagem, texto, título, botão, divisória, espaço, imagem com texto) e com
cor de fundo própria. Existe um cabeçalho padrão, definido na Configuração, e
cada modelo escolhe usar o padrão, ter um cabeçalho personalizado ou sair sem
cabeçalho. (Mudado em 04/10, a pedido dela: o cabeçalho não é só imagem.)

**Componentes:**
- Na Configuração de e-mail, bloco "Cabeçalho padrão": os blocos da faixa (hoje,
  a logo do Atacado Exponencial à esquerda, 150 px), a cor de fundo da faixa
  (qualquer cor, ou sem fundo) e a prévia.
- No editor do modelo, o cabeçalho é o primeiro cartão da lista ("Cabeçalho e
  blocos"), com o resumo do que está em uso, a lixeira para tirar e "Pôr de
  volta" quando foi tirado.
- Dentro do cartão, três opções: "Padrão da Configuração", "Personalizado" e
  "Sem cabeçalho". No padrão, o botão "Personalizar a partir do padrão".
- Quando "Personalizado": a cor de fundo da faixa e os blocos do cabeçalho logo
  abaixo do cartão, com "Adicionar ao cabeçalho".
- Na prévia, a faixa do cabeçalho com o fundo escolhido; sem cabeçalho, uma
  faixa tracejada só no editor.
- Bloco de imagem com a largura "Personalizada", em px (para logo pequena).

**Comportamentos:**
- Editar os blocos do cabeçalho padrão na Configuração (adicionar, editar,
  reordenar, apagar), com os mesmos blocos e opções do corpo.
- Mudar a cor de fundo do cabeçalho padrão.
- Salvar o cabeçalho padrão, que passa a valer para todos os modelos que usam o
  padrão, nos próximos envios.
- Ver quantos modelos usam o cabeçalho padrão antes de salvar a mudança.
- No modelo, escolher "Padrão da Configuração".
- No modelo, escolher "Personalizado" (começa como uma cópia do padrão).
- No modelo, personalizar a partir do padrão com um clique.
- Adicionar um bloco ao cabeçalho personalizado.
- Editar, reordenar, duplicar e apagar blocos do cabeçalho personalizado.
- Arrastar um bloco do corpo para o cabeçalho, e do cabeçalho para o corpo (na
  lista e na prévia).
- Soltar um bloco da paleta ou uma imagem do computador dentro da faixa do
  cabeçalho, na prévia.
- Mudar a cor de fundo da faixa do cabeçalho personalizado.
- Tirar o cabeçalho pela lixeira do cartão (o e-mail começa direto no corpo).
- Pôr o cabeçalho de volta, como estava antes.
- Clicar no cabeçalho dentro da prévia para abrir as opções dele.
- Ser avisada quando a cor de um texto ou título tem pouco contraste com o fundo
  da faixa ou do e-mail (não impede salvar).
- Escolher a largura de uma imagem em px ("Personalizada").

---

### 4. Biblioteca de imagens

**Descrição:** o lugar onde ficam as imagens dos e-mails. Uma imagem sobe uma
vez e pode ser usada em vários modelos e no cabeçalho. Cada imagem tem um
endereço público e permanente, para continuar aparecendo em e-mails já enviados.

**Componentes:**
- Grade de imagens com miniatura, nome, tamanho em pixels, peso do arquivo e
  data de envio.
- Indicação de onde cada imagem é usada (quais modelos, cabeçalho padrão).
- Botão "Subir imagem" e área para soltar arquivos.
- Busca por nome.
- A mesma biblioteca abre como escolha dentro do bloco de imagem e do cabeçalho.

**Comportamentos:**
- Subir uma imagem pelo botão, escolhendo o arquivo.
- Subir uma imagem soltando o arquivo na área.
- Subir várias imagens de uma vez.
- Ser avisada quando o arquivo não é imagem aceita (JPG, PNG, GIF ou WebP), e a
  imagem não sobe.
- Ser avisada quando a imagem passa do peso máximo (1 MB, o mesmo limite do
  Mailchimp; a Klaviyo também recomenda 1 MB ou menos), e a imagem não sobe,
  com a dica de exportar menor.
- Ser avisada quando a imagem é muito larga (acima de 1200 px), com a sugestão
  de reduzir (a imagem sobe mesmo assim e aparece reduzida no e-mail). A largura
  recomendada, 600 a 1200 px, aparece junto do botão de subir.
- Subir GIF animado como imagem comum (anima no Gmail, Apple Mail e celular; no
  Outlook do computador aparece o primeiro quadro).
- Ver a imagem nova aparecer na grade assim que termina de subir.
- Renomear uma imagem (o nome é só para achar na biblioteca).
- Buscar uma imagem pelo nome.
- Ver em quais modelos e se no cabeçalho padrão uma imagem é usada.
- Escolher uma imagem da biblioteca para um bloco de imagem.
- Escolher uma imagem da biblioteca para o cabeçalho.
- Apagar uma imagem que não está em uso em nenhum modelo nem no cabeçalho.
- Ser impedida de apagar imagem em uso, vendo onde ela é usada.
- Saber que apagar não tira a imagem de e-mails já enviados (aviso na
  confirmação: o endereço continua funcionando para quem já recebeu).

---

### 5. Prévia e teste

**Descrição:** a prévia e o e-mail de teste mostram exatamente o que o lead
recebe, já com blocos, cabeçalho, rodapé e descadastro.

**Componentes:**
- Prévia ao lado do editor, em computador e celular.
- Linha do remetente, assunto e texto de pré-visualização, como numa caixa de
  entrada (como hoje).
- Versão só texto do e-mail, gerada sozinha a partir dos blocos.

**Comportamentos:**
- Ver na prévia o cabeçalho, todos os blocos na ordem, o rodapé comum e, no
  marketing, o descadastro.
- Ver na prévia de celular as colunas empilhadas.
- Ver na prévia a imagem com o texto alternativo quando ela ainda está subindo
  ou falhou.
- Mandar o e-mail de teste e recebê-lo igual à prévia.
- O e-mail sair também em versão só texto (para leitores que não mostram imagem
  nem formatação), com títulos, textos, endereço dos botões e texto alternativo
  das imagens.

---

### 6. Conversão dos modelos que já existem

**Descrição:** todo modelo salvo no formato antigo (os 5 da agenda e qualquer
outro) vira blocos sozinho, uma vez, com o mesmo resultado de hoje. Depois da
conversão só existe o formato novo.

**Componentes:**
- Nenhuma tela nova. O modelo convertido abre no editor de blocos.

**Comportamentos:**
- Cada parágrafo de texto antigo virar um bloco de texto, com negrito e links
  preservados.
- Cada botão antigo ([[Texto | link]]) virar um bloco de botão com o mesmo texto
  e link.
- O modelo convertido usar o cabeçalho padrão (que começa igual à logo de hoje).
- O e-mail que sai de um modelo convertido ficar igual ao de antes (mesmo texto,
  mesmos links, mesmos campos).
- E-mails da agenda, campanhas agendadas e fluxos publicados que usam o modelo
  continuarem saindo sem interrupção durante e depois da conversão.

---

### 7. Uso pelos envios

**Descrição:** agenda, campanhas, fluxos e testes passam a mandar o e-mail
montado a partir dos blocos, sem mudar nada no jeito de usar.

**Componentes:**
- Nenhuma tela nova.

**Comportamentos:**
- E-mail da agenda sair com o cabeçalho e os blocos do modelo escolhido.
- Campanha sair com o cabeçalho e os blocos do modelo, com os campos de cada
  pessoa preenchidos.
- E-mail de fluxo sair com o cabeçalho e os blocos do modelo.
- Clique em imagem com link e em botão contar como clique no relatório, como os
  links de hoje.
- Resumo antes do disparo continuar mostrando assunto, remetente, quem recebe e
  o aviso de "sem nome" quando o modelo usa o nome em qualquer bloco.

---

### 8. Campanha com e-mail escrito na hora (sem modelo)

**Descrição:** hoje toda campanha precisa de um modelo de marketing. Passa a dar
para disparar uma campanha escrevendo o e-mail direto nela, com o mesmo editor
de blocos, sem criar um modelo antes. O modelo continua existindo para o que se
repete (agenda, fluxos, campanhas que voltam sempre).

**Componentes:**
- Na gaveta da campanha, a escolha "Usar um modelo" ou "Escrever o e-mail aqui".
- Com "Escrever o e-mail aqui": assunto, texto de pré-visualização, cabeçalho e
  o editor de blocos com a prévia, dentro da própria campanha.
- Botão "Salvar como modelo", para guardar o e-mail escrito na campanha como um
  modelo de marketing novo.
- Passos do que falta (já existentes) contando "e-mail escrito" no lugar de
  "modelo escolhido" quando a campanha não usa modelo.

**Comportamentos:**
- Escolher "Escrever o e-mail aqui" numa campanha nova.
- Escrever assunto e texto de pré-visualização da campanha.
- Montar o corpo da campanha com blocos, com tudo o que o editor do modelo
  oferece (blocos, cabeçalho, campos, prévia, avisos).
- Mandar teste da campanha com o e-mail escrito nela.
- Salvar a campanha como rascunho com o e-mail escrito nela e continuar depois.
- Revisar e disparar a campanha com o e-mail escrito nela, com o mesmo resumo de
  hoje (quem recebe, quem fica de fora, sem nome, último teste, limite do mês).
- Agendar a campanha com o e-mail escrito nela, podendo editar até o horário.
- Salvar o e-mail escrito na campanha como modelo de marketing novo (a campanha
  continua com o próprio e-mail; o modelo é uma cópia).
- Trocar de "Usar um modelo" para "Escrever o e-mail aqui" partindo do modelo
  escolhido (o conteúdo do modelo é copiado para a campanha, e o modelo não muda).
- Ser avisada, ao trocar de "Escrever o e-mail aqui" para "Usar um modelo", de
  que o e-mail escrito na campanha será descartado.
- Duplicar uma campanha com e-mail escrito nela (a cópia leva o e-mail junto).
- Ver no relatório da campanha o e-mail que saiu, mesmo sem modelo.
- Ter o e-mail de uma campanha já enviada guardado como saiu, sem poder editar.

---

## Fora do escopo desta versão

- Editar o HTML do e-mail na mão.
- Galeria de modelos prontos (começar de um layout pronto).
- Escolher fontes: o e-mail usa uma fonte segura para leitores de e-mail. Cores
  são livres (decidido em 04/10).
- Editar imagem dentro do dash (cortar, girar, filtros).
- Vídeo, GIF animado como vídeo, contador regressivo, redes sociais em ícones.
- Rodapé por modelo (o rodapé continua comum, na Configuração).
- Teste A/B de modelos.
- Blocos salvos para reaproveitar entre modelos.

## Decisões tomadas (04/10)

- Corpo por **blocos** (não texto livre com inserir).
- Cabeçalho: **padrão na Configuração + troca por modelo** (padrão, personalizado
  ou sem cabeçalho). Em 04/10 ela pediu que o cabeçalho não fosse só imagem: ele
  é **montado com os mesmos blocos do corpo**, com fundo próprio.
- Imagens numa **biblioteca** reaproveitável, com trava de apagar imagem em uso.
- Modelos existentes **convertem sozinhos**; um formato só depois disso.
- **Campanha sem modelo:** dá para escrever o e-mail direto na campanha (pedido
  dela em 04/10). Fluxos e agenda continuam usando modelos.

- **Peso máximo:** 1 MB por imagem, o padrão de mercado (Mailchimp aceita até
  1 MB; Klaviyo recomenda 1 MB ou menos). Largura recomendada de 600 a 1200 px.
- **Cores 100% personalizáveis:** título, texto, links, botão, divisória,
  cabeçalho e fundos, com atalhos da marca. Fonte continua fixa.
- **GIF animado:** aceito como imagem comum.
- **Onde as imagens moram:** a escolha técnica fica para o /plan. Sugestão
  registrada: um armazenamento público próprio para imagens de e-mail, com
  endereço no nosso domínio, sem custo de saída de tráfego; se for preciso
  ligar algum recurso na Cloudflare, o /plan traz o passo a passo.

## Perguntas em aberto

Nenhuma. Spec aprovada por ela em 04/10.
