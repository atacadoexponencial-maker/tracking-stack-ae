# Spec: Planner da Black Atacado

## Visão Geral

Ferramenta web preenchível, protegida por senha, entregue aos participantes do
Workshop Black Exponencial de **23/09/2026, às 19h**.

**Para quem é:** donas e donos de marcas de atacado que compraram o workshop
pago. Preenchem durante a aula, com o Felipe falando ao mesmo tempo.

**Qual problema resolve:** um workshop de duas horas termina com a pessoa cheia
de ideia e sem nada escrito. O planner transforma a aula em um artefato: quatro
blocos que, no fim, são a Black da marca montada em uma folha para colar na
parede da expedição.

**A restrição que manda em tudo:** precisa ser preenchível em 2 horas, sem
pausar o vídeo. Onde deu para virar opção para escolher em vez de campo em
branco, virou opção. Onde deu para virar data já calculada, virou data
editável. Ninguém escreve narrativa do zero nem conta calendário no susto
enquanto assiste aula.

**O que este projeto NÃO faz** (fronteira explícita, para não crescer sozinho):

- Não envia o preenchimento para lugar nenhum. Não há banco, não há coleta, não
  há lista de quem preencheu. O que a pessoa escreve fica no navegador dela.
- Não identifica quem está preenchendo. A senha é uma só, compartilhada com a
  turma. O planner não sabe nem quer saber quem é a marca do outro lado.
- Não rastreia. Sem pixel, sem sessão, sem evento, sem cookie de atribuição.
- Não pergunta curva de produtos. Ficou fora do workshop por decisão do Felipe,
  então está fora do planner.
- Não projeta resultado. A única conta de metas é soma pura. Nenhum percentual
  estimando faturamento futuro.

### Decisões já tomadas (não reabrir sem dizer que está reabrindo)

| Decisão | Escolha |
|---|---|
| Endereço | `/planner-workshop-black` |
| Acesso | Senha única, compartilhada com a turma, conferida no servidor |
| Entrega do conteúdo | O planner só é entregue **depois** que o servidor valida a senha |
| Onde o preenchimento mora | Só no navegador de quem preencheu, enquanto ela preenche |
| O que ela leva embora | Um PDF baixado no aparelho dela |
| Navegação | Um bloco por vez, com barra fixa dos quatro |
| Visual | Escuro por padrão, com opção de trocar para claro |
| Saídas | Baixar PDF e imprimir em papel — mesma folha, destinos diferentes |
| Impressão | Sempre clara, sem fundo, um bloco por folha — e **desenhada**, não só despida |
| Tracking | Nenhum |
| Moldura do site | Sem cabeçalho e sem rodapé do site |

### Datas de 2026 (conferidas contra o calendário)

| Data | Dia da semana | Papel |
|---|---|---|
| 28/09 | segunda | Abre o aquecimento |
| 12/10 | segunda | Dia das Crianças; abre o pico 1 |
| 13/10 a 28/10 | — | Janela de 45 a 30 dias antes da Black |
| 11/11 | quarta | Data clássica da Black VIP |
| 27/11 | sexta | Black Friday |
| 30/11 | segunda | Cyber Monday |

---

## Páginas / Módulos

### 1. Portão de acesso

**Descrição:** primeira e única coisa que um visitante sem senha enxerga em
`/planner-workshop-black`. Nada do planner existe do lado de fora dele — nem no
código-fonte da página, nem em endereço alternativo. O objetivo não é segurança
de cofre: é que o material pago não circule por link solto.

**Componentes:**

- **Marca:** logo do Atacado Exponencial.
- **Título do portão:** identifica que é o Planner da Black Atacado e que o
  acesso é de quem está no workshop.
- **Campo de senha:** um único campo, do tipo que esconde o que se digita.
- **Botão de entrada:** confirma a senha.
- **Área de recado:** onde aparece o erro de senha incorreta. Vazia por padrão.

**Comportamentos:**

- Visitante abre o endereço sem ter entrado antes: recebe o portão, e só o
  portão.
- Visitante digita a senha correta e confirma: o servidor valida, guarda o
  acesso no navegador dele e entrega o planner.
- Visitante digita senha incorreta e confirma: recebe o recado de senha
  incorreta, continua no portão, e o campo fica pronto para nova tentativa.
- Visitante confirma com o campo vazio: recebe o aviso de campo obrigatório,
  sem que nada seja enviado ao servidor.
- Visitante aperta Enter dentro do campo: equivale a apertar o botão.
- Visitante que já entrou recarrega a página ou volta depois: entra direto no
  planner, sem repetir a senha.
- Visitante que já entrou fecha o navegador e volta dias depois, dentro do
  prazo de validade do acesso: entra direto.
- Visitante cujo acesso expirou: volta a ver o portão, e o preenchimento que
  ele já tinha feito continua intacto quando ele entrar de novo.
- Servidor sem a senha configurada: recusa todo mundo. Ambiente incompleto
  nunca vira porta aberta.
- Alguém tenta adivinhar a senha repetidamente: o portão desacelera as
  tentativas a partir de certo volume, para não virar alvo de força bruta.

---

### 2. Moldura do planner

**Descrição:** o que envolve os quatro blocos e permanece na tela o tempo todo.

**Componentes:**

- **Cabeçalho:** título "Planner da Black Atacado" e a linha "Preencha durante
  o workshop. No fim, imprima ou salve."
- **Campo Nome da sua marca:** texto livre. É o nome que alimenta as narrativas
  dos blocos seguintes.
- **Campo Data de hoje:** já vem preenchido com a data do dia, e é editável.
- **Aviso de onde o preenchimento mora:** "Seu preenchimento fica salvo neste
  navegador enquanto você preenche. Se trocar de aparelho ou limpar o histórico,
  perde. Baixe o PDF antes de fechar."
- **Indicador de salvamento:** mostra "Salvo agora há pouco" depois de cada
  gravação automática. Refere-se ao rascunho no navegador, não ao PDF.
- **Botão de tema:** alterna entre escuro e claro.
- **Barra de blocos:** fixa abaixo do cabeçalho, com os quatro blocos
  numerados e nomeados. Mostra em qual deles a pessoa está.
- **Indicação de bloco:** cada bloco se anuncia como "Bloco X de 4", para o
  Felipe poder dizer "agora bloco 2" e todo mundo estar na mesma tela.
- **Botão de avançar:** no fim de cada bloco, leva ao seguinte pelo nome
  ("Próximo: Ofertas"). No último bloco, dá lugar ao fecho e às duas saídas.

**Um bloco por vez.** O planner mostra um bloco de cada vez, e não os quatro
empilhados numa rolagem só. A razão é o momento de uso: a pessoa preenche
durante a aula, com o Felipe falando. Quando ele diz "agora bloco 2", ela
precisa chegar lá num toque, não caçando no meio de cinquenta campos. Empilhado,
o planner também esconde o próprio tamanho — a pessoa não sabe onde está nem
quanto falta, e rolagem longa em celular durante uma aula é onde o
preenchimento morre.

**Comportamentos:**

- Participante escreve o nome da marca: o nome passa a aparecer dentro das
  narrativas sugeridas do bloco 2, mesmo que ela ainda não tenha aberto aquele
  bloco.
- Participante troca a data de hoje: o valor novo vale, inclusive na impressão.
- Participante alterna o tema: a tela troca na hora e a preferência é lembrada
  na próxima visita.
- Participante abre o planner: cai no bloco 1, com a barra marcando o bloco 1.
- Participante clica num bloco da barra: aquele bloco aparece, os outros somem,
  e a barra passa a marcar o novo. A página volta para o topo do bloco.
- Participante clica no botão de avançar: vai para o bloco seguinte, igual a
  ter clicado nele na barra.
- Participante está no bloco 4: não há botão de avançar; o que aparece é o
  fecho e as duas saídas.
- Participante troca de bloco com campos preenchidos: nada se perde. Sair de um
  bloco é esconder, nunca apagar — o que ela escreveu continua lá quando voltar,
  e continua saindo na impressão e no PDF.
- Participante volta a um bloco já preenchido: encontra tudo como deixou.
- Participante imprime ou baixa o PDF estando em qualquer bloco: saem os
  quatro, inteiros. O que está escondido na tela não está ausente do documento.
- Participante abre com JavaScript desligado: os quatro blocos aparecem
  empilhados, todos preenchíveis. Sem navegação, mas sem nada inacessível.
- Participante abre no celular: tudo continua preenchível, sem rolagem lateral,
  e a barra de blocos continua alcançável sem rolar até o topo.

---

### 3. Bloco 1 de 4 — Onde você está e onde quer chegar

**Descrição:** abre com os três números que a régua de disparos mandou a pessoa
trazer de casa, e fecha com a primeira conta do planner. Esses números não são
decoração: o pedido mínimo reaparece no bloco 2, e a base de ativos alimenta a
conta do fim deste bloco — que é a promessa da página de vendas virando número
na tela.

**Componentes:**

- **Subtítulo "Onde você está hoje"** com a explicação: "Três números que você
  trouxe. Eles são a régua do resto do planner, e são o que você vai comparar em
  dezembro."
- **Campo Pedido mínimo de primeira compra hoje:** número, em peças.
- **Campo Revendedores ativos na base hoje:** número. Apoio: "Ativo é quem
  comprou nos últimos 90 dias."
- **Campo Faturamento da última Black:** valor em reais. Apoio: "Se você nunca
  rodou uma, escreva 0. Serve igual."
- **Subtítulo "Suas metas"** com a explicação: "Sem número aqui, oferta e
  calendário viram palpite."
- **Campo Revendedores novos nesta Black:** número. Apoio: "Conte só quem nunca
  comprou de você."
- **Campo Clientes inativos a reativar:** número. Apoio: "Quem já comprou e
  parou. Puxe da sua lista de quem não compra há mais de 90 dias."
- **Campo Revendedores que compram duas vezes:** número. Apoio: "Comprou no pico
  de outubro, vendeu, e volta em novembro para repor. É esse número que separa
  uma Black de uma base maior."
- **Campo Faturamento desejado no período:** valor em reais. Apoio: "Outubro e
  novembro somados."
- **Painel Sua base no fim da Black:** área calculada, visualmente separada dos
  campos. Mostra a soma e a frase "Você quer terminar a Black com [total]
  revendedores ativos, contra [ativos hoje] que tem hoje. Anote esse número. É
  ele que você vai conferir na virada do ano."

**Comportamentos:**

- Participante digita qualquer um dos três números de hoje: o valor é aceito e
  guardado.
- Participante digita o pedido mínimo: o mesmo valor aparece sozinho no bloco 2,
  no campo "Seu mínimo de primeira compra hoje".
- Participante digita os ativos, os novos e os reativados: o painel da base
  recalcula na hora, somando os três — soma pura, sem percentual e sem projeção.
- Participante deixa um dos três campos da soma vazio: o painel trata o vazio
  como zero e continua mostrando a conta, sem quebrar.
- Participante escreve letra num campo que espera número: o campo não aceita.
- Participante escreve valor em reais: o campo mostra o valor formatado como
  dinheiro brasileiro.
- Participante tenta imprimir com campo de meta vazio: recebe o aviso "Coloque
  um número, mesmo que seja chute. Meta redonda é melhor que meta nenhuma."
- Participante zera um número já preenchido: o painel da base reflete a mudança
  imediatamente.

---

### 4. Bloco 2 de 4 — Suas ofertas

**Descrição:** monta duas ofertas, uma para quem ainda não compra da marca e
outra para quem já compra. É o bloco mais longo e o único com um aviso que
pode contradizer o que a pessoa escreveu.

**Componentes — abertura do bloco:**

- **Texto de abertura:** "Você vai montar duas: uma para quem ainda não compra
  de você, outra para quem já compra."
- **Campo Margem bruta hoje:** percentual. Apoio: "Quanto sobra em cima do custo
  do produto, antes das despesas. Desconto maior que essa margem não é promoção,
  é prejuízo com movimento."

**Componentes — Pico 1 · Outubro · Conquistar revendedor novo:**

- **Campo Quando começa:** data, sugerida como 12/10/2026. Apoio explicando a
  janela de 45 a 30 dias antes da Black e o papel do Dia das Crianças.
- **Escolha de narrativa:** três opções para marcar, uma de cada ângulo —
  *Antecipação*, *Porta de entrada* e *Estoque limitado* — cada uma com o nome
  da marca inserido no texto.
- **Campo de narrativa própria:** texto livre, alternativa às três opções.
- **Valor Seu mínimo de primeira compra hoje:** só de leitura, puxado do bloco 1.
- **Campo Mínimo reduzido da campanha:** número, em peças. Apoio: "Reduza um
  pouco, não muito. E defina prazo, senão vira vício e você perde a mão do seu
  mínimo."
- **Campo Até quando o mínimo reduzido vale:** data, sugerida como 25/10/2026.
- **Tabela de desconto progressivo:** três faixas. A coluna "Se comprar" é
  calculada (o mínimo reduzido, o dobro e o triplo) e a coluna "Desconto" vem
  preenchida com 5%, 10% e 15%, editável.
- **Aviso de margem:** recado que aparece quando o maior desconto encosta ou
  passa a margem declarada.
- **Lista de itens adicionais da oferta:** quatro opções para marcar — percentual
  no de/por, categoria específica com desconto, compre X e ganhe Y, compre e
  ganhe um mimo.
- **Campo Descreva a condição escolhida:** texto livre.

**Componentes — Pico 2 · Novembro · Fazer a base repor:**

- **Campo Quando começa:** data, sugerida como 09/11/2026. Apoio: "Durante o
  movimento do varejo. Quem comprou em outubro já vendeu e está sem produto."
- **Escolha de narrativa:** três opções — *Reposição*, *Última hora* e *Base
  primeiro* — com o nome da marca inserido.
- **Campo de narrativa própria:** texto livre.
- **Lista de itens da oferta:** quatro opções para marcar — desconto progressivo
  por volume, percentual no de/por, categoria específica, compre X e ganhe Y.
- **Campo Descreva a condição escolhida:** texto livre.
- **Escolha Você vai fazer Black VIP:** sim ou não. Apoio explicando que a Black
  VIP é um dia só, exclusivo para o grupo de ativos, antes da Black Friday.
- **Campo Dia da Black VIP:** data, sugerida como 11/11/2026.
- **Campo Onde ela acontece:** texto livre. Apoio: "Grupo de WhatsApp,
  comunidade, lista fechada."

**Comportamentos:**

- Participante escreve a margem bruta: o valor passa a ser a régua do aviso de
  desconto.
- Participante escolhe uma das três narrativas do pico 1: a narrativa fica
  marcada e é a que sai na impressão.
- Participante escolhe uma narrativa e depois escreve a sua: a narrativa própria
  prevalece, e a escolha anterior é desmarcada.
- Participante lê a narrativa sugerida antes de escrever o nome da marca: vê um
  marcador de lacuna no lugar do nome.
- Participante escreve o nome da marca no cabeçalho: as seis narrativas passam a
  mostrar o nome no lugar da lacuna.
- Participante digita o mínimo reduzido: as três faixas da tabela recalculam na
  hora para esse valor, o dobro e o triplo.
- Participante deixa o mínimo reduzido vazio: as faixas mostram lacuna em vez de
  número, e a tabela continua legível.
- Participante edita um dos percentuais de desconto: o valor novo vale e a
  verificação de margem roda de novo.
- Participante define um desconto maior que a margem declarada: recebe o aviso
  "Seu desconto de [x]% passa da margem de [y]% que você escreveu. Confere antes
  de seguir." O aviso não bloqueia nada — ela pode seguir assim se quiser.
- Participante corrige o desconto ou a margem e o conflito some: o aviso
  desaparece.
- Participante não preencheu a margem: nenhum aviso aparece, porque não há régua
  para comparar.
- Participante marca e desmarca itens da oferta: a marcação é livre, sem limite
  e sem exclusão mútua.
- Participante responde "não" para a Black VIP: os campos de data e de local da
  VIP somem da tela e não saem na impressão.
- Participante responde "sim" para a Black VIP: os dois campos aparecem, com a
  data sugerida já posta.
- Participante clica numa data sugerida: consegue trocar. O apoio "Data sugerida
  para 2026. Clique para trocar." explica isso em todo campo de data do planner.

---

### 5. Bloco 3 de 4 — Seu calendário

**Descrição:** o esqueleto da Black já de pé. Uma Black parada vende menos que
uma Black com movimento toda semana, então as dez semanas de 28/09 a 06/12 já
vêm posicionadas com a função de cada uma escrita. A pessoa preenche o que
acontece, não descobre quando acontece.

**Componentes:**

- **Texto de abertura** explicando que as datas de 2026 já vêm posicionadas e
  que o esqueleto pode ser ajustado.
- **Trilha de outubro · trazer gente nova:** cinco semanas, de 28/09 a 01/11.
  Cada linha traz a semana, um campo de texto livre "o que acontece" e a função
  daquela semana como apoio (aquecimento; última semana de expectativa; abertura
  do pico 1; prazo acabando; fechamento do pico 1).
- **Trilha de novembro · fazer a base repor:** cinco semanas, de 02/11 a 06/12,
  no mesmo formato (convite do VIP; Black VIP; pré-Black; Black Week com a
  Friday em 27/11 e a Cyber Monday em 30/11; Black November e virada de
  dezembro).
- **Campo Seu diferencial da Black Week:** texto livre. Apoio: "Crie um
  diferencial para a Week, mas guarde o destaque para a Friday."
- **Campo O que você faz no dia 27/11:** texto livre. Apoio: "Aqui é urgência e
  escassez, sem economia."
- **Fase Aquecimento:** data de início, sugerida como 28/09/2026, mais um campo
  de texto "Como você vai preparar a base" e o apoio que termina em "Repare na
  data: é semana que vem."
- **Fase Vendas:** data de início e data de fim, sugeridas como 12/10 e 30/11.
  Apoio: "É aqui que sai a maior parte do seu investimento."
- **Fase Pós-venda:** data de início, sugerida como 01/12/2026, mais um campo de
  texto "O que você mede depois" e o apoio que manda voltar ao bloco 1 e comparar
  a base.

**Comportamentos:**

- Participante escreve o que acontece em qualquer uma das dez semanas: o texto é
  aceito e cresce conforme ela escreve, sem barra de rolagem dentro do campo.
- Participante deixa semanas em branco: o planner aceita. Semana vazia sai
  vazia na impressão, sem placeholder.
- Participante troca qualquer uma das datas das três fases: o valor novo vale.
- Participante escreve o que faz no dia 27/11: o texto é guardado como qualquer
  outro.
- Participante abre o bloco pelo celular: as duas trilhas viram lista vertical
  em vez de tabela, sem perder a semana nem a função.

---

### 6. Bloco 4 de 4 — Seus canais

**Descrição:** quem faz o quê. O bloco mais curto e o que produz a informação
mais desconfortável da página.

**Componentes:**

- **Texto de abertura:** "Marque os canais que você vai usar e quem responde por
  cada um."
- **Tabela de oito canais**, cada um com uma marcação de usar ou não e um campo
  de responsável: Live Boom, Tráfego pago, Redes sociais, WhatsApp, E-mail
  marketing, Influenciadores, Live commerce, Ações offline.
- **Recado abaixo da tabela:** "Se é você quem faz tudo, escreva seu nome em
  todas. Ver o próprio nome oito vezes é a informação mais útil desta tabela."
- **Campo Nome da campanha:** texto livre. Apoio: "Sua Black precisa de nome
  próprio. Black Atacado da [marca], Black Antecipada, Reposição Black."
- **Campo Prazo para a arte ficar pronta:** data, sugerida como 25/09/2026.
  Apoio: "Conte para trás a partir do aquecimento, não a partir da venda. Se o
  aquecimento começa em 28/09, a arte fica pronta nesta semana."

**Comportamentos:**

- Participante marca um canal: o campo de responsável daquela linha fica pronto
  para receber nome.
- Participante escreve o responsável sem marcar o canal: aceito. O planner não
  força ordem.
- Participante desmarca um canal já preenchido: o nome do responsável continua
  guardado, mas a linha sai da impressão.
- Participante escreve o nome da campanha: aceito como texto livre.
- Participante troca o prazo da arte: o valor novo vale.

---

### 7. Saída — baixar o PDF e imprimir

**Descrição:** o fecho da página. "Sua Black está montada. Imprima, cole na
parede da expedição e vá executar."

São duas saídas, e elas produzem **a mesma folha**: o PDF baixado e o papel
impresso têm layout idêntico. A diferença é só o destino.

**A folha impressa é o produto final, e precisa ser bonita.** Ela vai para a
parede da expedição e vai ser vista todo dia até dezembro — por quem preencheu
e por quem trabalha com ela. Não basta tirar os botões e o fundo escuro: a
folha é peça de design própria, com capa que nomeia a marca, hierarquia clara
entre bloco, seção e resposta, e as respostas em destaque sobre os rótulos. O
que a pessoa escreveu é o conteúdo; o rótulo é só a legenda. Uma folha que
pareça um formulário web impresso reprova, mesmo que esteja legível.

**Componentes:**

- **Frase de fecho** e a instrução de colar na parede.
- **Botão Salvar meu planner em PDF:** baixa o arquivo no computador ou celular
  de quem preencheu.
- **Botão Imprimir meu planner:** abre a impressão em papel.
- **Aviso permanente:** "Seu preenchimento fica só neste navegador. O PDF é o
  que você leva embora."

**Comportamentos:**

- Participante clica em Salvar meu planner em PDF: o arquivo é gerado e baixado
  direto, sem ela precisar passar pelo menu de impressão do navegador.
- O arquivo baixado tem nome reconhecível, com o nome da marca e a data — para
  não virar "documento(3).pdf" na pasta de downloads.
- Participante sem nome de marca preenchido baixa o PDF: o arquivo recebe um
  nome genérico do planner, e o download acontece do mesmo jeito.
- Participante clica em Imprimir meu planner: abre o diálogo de impressão do
  navegador com a folha já formatada.
- Participante clica em qualquer uma das duas saídas com campos faltando:
  recebe o aviso "Faltam campos no bloco [nome]. Continuar assim mesmo?" com a
  opção de seguir ou voltar e preencher.
- Participante escolhe seguir assim mesmo: a folha sai com os vazios.
- Participante tenta fechar a aba com o planner preenchido e sem ter baixado
  nem impresso: o navegador pergunta "Você preencheu o planner e ainda não
  baixou nem imprimiu. Sair mesmo?"
- Participante tenta fechar a aba com o planner vazio: sai sem pergunta.
- Participante baixa o PDF ou imprime: sai um bloco por folha, sem menu, sem
  botão, sem cor de fundo e em tema claro, independentemente do tema que estiver
  na tela.
- Participante baixa o PDF pelo celular: o arquivo vai para os downloads do
  aparelho e pode ser compartilhado dali, com o mesmo layout da versão de
  computador.
- Participante baixa o PDF duas vezes: recebe dois arquivos, com o conteúdo do
  momento de cada clique. O planner não guarda histórico de versões.

---

### 8. Salvamento e recuperação

**Descrição:** a promessa do cabeçalho, cumprida. Nada sai do navegador de quem
preencheu — e é justamente por isso que o aviso precisa ser honesto.

**Comportamentos:**

- Participante preenche qualquer campo: o planner grava sozinho pouco depois,
  sem que ela precise clicar em nada.
- Participante recarrega a página: tudo o que ela preencheu volta como estava,
  inclusive marcações, narrativas escolhidas, contas derivadas e tema.
- Participante fecha o navegador e volta no dia seguinte, no mesmo aparelho e
  mesmo navegador: encontra o preenchimento inteiro.
- Participante abre em outro aparelho ou outro navegador: encontra o planner
  vazio. O aviso do cabeçalho já tinha dito isso.
- Participante limpa o histórico do navegador: perde o preenchimento. O aviso
  do cabeçalho já tinha dito isso também.
- Navegador em modo privado ou com gravação bloqueada: o planner continua
  preenchível, e o PDF e a impressão continuam funcionando na sessão. A página
  avisa que não vai conseguir guardar o rascunho e que o PDF é a única saída.
- Participante entra de novo depois do acesso expirar e digitar a senha outra
  vez: o preenchimento dela continua lá, intacto.
