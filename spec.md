# Spec: Página de vendas do Workshop Black Exponencial

## Visão Geral

Página de vendas única, no endereço `/workshop-black-exponencial-2026`, para
vender ingresso do **Workshop Black Exponencial** — evento ao vivo com Felipe
Santos em **09/09, às 19h, com 2 horas de duração**.

**Para quem:** dona ou dono de marca de atacado que já tem base de revendedores
e precisa montar a campanha de Black Friday da marca — com a tese do "duplo
pico" (outubro traz revendedor novo, novembro faz a base repor).

**Problema que resolve:** hoje não existe página onde essa oferta possa ser
apresentada e vendida. A marca chega em novembro anunciando junto com o varejo,
quando o lojista já decidiu de quem comprar em outubro. A página precisa
explicar essa inversão de calendário, provar autoridade e levar o visitante ao
checkout do workshop.

**Diferença em relação às páginas existentes do projeto:** as landing pages
atuais são de captura (formulário, chat ou entrada em grupo) e geram *lead*.
Esta é a primeira **página de vendas** com preço e destino de compra — não tem
formulário nenhum, e o objetivo do visitante é sair da página em direção ao
checkout.

**Duas particularidades que definem o comportamento da página:**

1. **O checkout ainda não existe.** Todos os botões apontam para um destino
   configurável, definido num único lugar da página, que será trocado pela URL
   real do checkout quando ela existir. Nada além desse único ponto muda quando
   a URL chegar.
2. **O preço não é fixo.** A página descobre sozinha, pela data corrente no
   fuso de Brasília, qual lote está vigente e mostra o valor daquele lote, o
   rótulo do lote e qual será o próximo valor.

---

## Páginas / Módulos

### Página de vendas `/workshop-black-exponencial-2026`

**Descrição:** página longa de venda direta, com ordem fixa de blocos, quatro
chamadas para ação no corpo mais o botão da barra fixa, e preço calculado pela
data. Não capta dados: o único caminho de saída é o destino de compra.

**Componentes:**

- **Barra fixa de topo:** texto "BLACK EXPONENCIAL · 09/09 · 19h · ao vivo" e um
  botão pequeno de compra. Fica visível o tempo todo, sobre o conteúdo.
- **Hero:** selo "Exclusivo para marcas atacado"; headline "Monte a Black Friday
  da sua marca atacado em 2 horas, com metas, oferta e calendário semana a
  semana definidos.", com o trecho "2 horas" em destaque visual; subtítulo com a
  data, o horário e a tese do duplo pico; botão "Garantir minha vaga"; logo
  abaixo do botão, uma linha com o valor vigente e o rótulo do lote vigente; um
  elemento visual (mockup do planner, ou foto do Felipe como alternativa).
  Sem vídeo.
- **Bloco de dor:** texto corrido centralizado, frases curtas em linhas
  separadas, sobre a Black passada que deu faturamento mas não deu revendedor
  novo. Sem ícone, sem lista, sem card. Fundo diferente do hero.
- **Bloco do problema real:** texto explicando que o lojista decide em outubro e
  que a Black do atacado precisa acontecer antes da do varejo; ao lado, uma
  linha do tempo simples com dois marcos — "OUT: decisão do lojista" e "NOV:
  você anuncia (tarde)". É o único gráfico da página.
- **Bloco antes e depois:** duas colunas. À esquerda, "Como a maioria faz", com
  quatro itens marcados com ✕ e tratamento visual apagado. À direita, "Como
  funciona o duplo pico", com quatro itens marcados com ✓ e tratamento visual de
  destaque. Abaixo, a frase de fecho "No dia 09/09 você monta os dois."
- **Bloco da solução:** nome do workshop, data, horário, duração, e o texto que
  posiciona a aula como sessão de execução — o visitante entra com o planner em
  branco e sai com ele preenchido.
- **Cronograma da aula:** sete linhas, cada uma com horário à esquerda (19h00,
  19h15, 19h30, 20h00, 20h15, 20h40, 20h50), título do módulo em negrito e
  descrição em texto secundário abaixo.
- **Bloco de entregáveis:** um card largo em destaque para o *Planner da Black
  Atacado* com imagem; abaixo, uma grade de três cards menores (Mapa mental do
  método completo; Calendário Black Atacado 2026; Pack de mensagens de
  WhatsApp); abaixo, um segundo card largo para *Os 3 checklists de execução*.
- **Bloco de autoridade:** foto do Felipe Santos à esquerda, nome, papel
  ("fundador do Atacado Exponencial") e a biografia de quatro frases à direita.
- **Bloco de prova social:** os mesmos depoimentos já usados na página das
  lives, exibidos entre Autoridade e Ancoragem.
- **Bloco de ancoragem:** texto "Quanto custa uma Black mal planejada?" seguido
  de uma conta de duas linhas — "desconto dado no ano passado" e "investimento
  em anúncio em novembro" — com os valores em branco, alinhados à direita, para
  o visitante preencher mentalmente; fecho com "O workshop custa menos que um
  pedido mínimo da sua marca."
- **Caixa de oferta:** caixa fechada com borda destacada e centralizada,
  contendo: título "WORKSHOP BLACK EXPONENCIAL — 09/09 · 19h · 2 horas ao vivo";
  lista de seis itens com check (2 horas ao vivo com Felipe Santos; Planner da
  Black Atacado; Mapa mental do método; Calendário Black Atacado 2026; Pack de
  mensagens de WhatsApp; Os 3 checklists); valor cheio de R$ 297 riscado, menor
  e apagado; valor do lote vigente em tamanho grande; rótulo do lote vigente;
  botão "Garantir minha vaga por R$ [valor do lote]"; linha de aviso do próximo
  valor.
- **Faixa de garantia:** faixa horizontal com selo à esquerda e o texto dos 7
  dias de reembolso à direita, sobre fundo levemente diferente do bloco
  anterior.
- **Bloco de urgência:** texto explicando por que existe prazo (o pico 1
  acontece na primeira quinzena de outubro, a campanha precisa estar montada em
  setembro) e que cada lote que passa aumenta o valor, sem mudar conteúdo nem
  materiais. Termina com botão "Quero garantir minha vaga".
- **FAQ:** sanfona com seis perguntas, todas fechadas por padrão (preciso já
  vender no atacado; e se eu não puder assistir ao vivo; serve para o meu nicho;
  já estou atrasada; quanto tempo dura; e se eu não gostar).
- **Fechamento:** frase "Duas opções para outubro: chegar com a campanha montada
  em setembro ou improvisar quando o lojista já tiver comprado." e botão "Quero
  minha vaga".
- **Rodapé padrão do site.**

**Comportamentos:**

*Estrutura e navegação*

- Exibir os blocos sempre nesta ordem: Hero → Dor → Problema real → Antes e
  depois → **CTA** → Solução → Cronograma → Entregáveis → **CTA** →
  Autoridade → Prova social → Ancoragem → Oferta → Garantia → Urgência →
  **CTA** → FAQ → Fechamento → **CTA**.
- Manter no celular exatamente a mesma ordem de blocos do desktop, sem
  reordenar, esconder ou trocar nada de lugar.
- Manter a barra fixa visível durante toda a rolagem da página, sobreposta ao
  conteúdo, sem cobrir o botão de compra de nenhum bloco.
- No celular, a barra fixa quebra em duas linhas ou omite o nome do evento,
  preservando sempre a data e o botão.
- Empilhar em uma coluna, no celular, todos os blocos de duas colunas (problema
  real, antes e depois, autoridade, entregáveis).
- No celular, no bloco de entregáveis, exibir a imagem de cada card acima do
  texto do card.
- Apresentar a página com a identidade visual do restante do site (mesma fonte,
  mesma paleta, mesmos formatos de seção, selo, título e botão já usados nas
  outras páginas).
- Carregar a página sem vídeo e sem elementos pesados; imagens entram
  comprimidas e as que estão abaixo da primeira dobra só carregam quando o
  visitante se aproxima delas.
- Descrever a página, para buscadores e compartilhamentos, como o workshop de
  Black Friday para marcas de atacado, com data e horário.

*Preço e lote (calculados pela data)*

- Determinar o lote vigente a partir da data e hora correntes no fuso de
  Brasília, segundo a tabela: **Lote 0 — R$ 47**, de 10/08 a 20/08; **Lote 1 —
  R$ 97**, de 20/08 a 30/08; **Lote 2 — R$ 147**, de 30/08 até 09/09 às 18h.
- Exibir o valor do lote vigente em todos os pontos da página que mostram preço
  (linha abaixo do botão do hero, caixa de oferta e texto do botão da caixa de
  oferta), sempre com o mesmo número.
- Exibir o rótulo do lote vigente ("Lote 0", "Lote 1", "Lote 2") junto ao valor
  no hero e na caixa de oferta.
- Exibir sempre o valor cheio de R$ 297 riscado como ancoragem, menor e mais
  apagado que o valor vigente.
- Exibir, abaixo da caixa de oferta, a linha "Depois do Lote [N], o valor sobe
  para R$ [próximo valor]" enquanto existir um lote seguinte.
- Substituir ou omitir essa linha quando o lote vigente for o último — nunca
  anunciar um próximo valor que não existe.
- Definir um comportamento explícito para as datas fora da tabela: antes de
  10/08 a página apresenta o primeiro lote; depois de 09/09 às 18h a página
  apresenta o encerramento das vendas, sem preço inventado.
- Tratar as fronteiras de data sem ambiguidade: em cada dia de virada (20/08 e
  30/08) apenas um lote pode estar vigente, e o valor exibido em todos os
  lugares da página é o mesmo.
- Escrever todos os valores no formato brasileiro, com "R$" e sem centavos.

*Destino de compra*

- Ler o destino de compra de um único ponto de configuração da página, usado por
  todos os botões — barra fixa, hero, os quatro CTAs do corpo e o botão da caixa
  de oferta.
- Enquanto a URL real do checkout não existir, apontar todos os botões para o
  destino placeholder configurado, sem quebrar a navegação nem exibir erro ao
  visitante.
- Trocar o destino real exige alterar apenas esse ponto de configuração, sem
  tocar em nenhum bloco da página.
- Usar exatamente o mesmo texto e a mesma cor em todos os botões do corpo da
  página.

*Rastreamento*

- Registrar a visita da página com os mesmos dados de origem já registrados nas
  demais páginas do site (origem, campanha, conteúdo e identificadores de
  clique), pelo mesmo mecanismo compartilhado — sem tratamento especial.
- Criar, na chegada do visitante, um identificador de compra para esta visita e
  registrá-lo junto com os dados de origem, de modo que uma venda confirmada
  depois pelo checkout possa ser atribuída a esta visita.
- Reaproveitar o mesmo identificador de compra enquanto o visitante estiver na
  mesma visita, mesmo que recarregue a página.
- Registrar o evento de "início de checkout" quando o visitante aciona qualquer
  botão de compra, de forma que o registro sobreviva à saída da página.
- Enviar esse identificador de compra junto com o visitante ao destino de
  compra, no formato exigido pela plataforma de checkout escolhida.
- Registrar o mesmo evento de início de checkout uma única vez por clique, sem
  contagem dupla entre o registro do navegador e o registro do servidor.
- Fazer a página aparecer, sem configuração extra, na visão de desempenho por
  landing page já existente no painel.
- Manter a página compatível com o mecanismo de teste A/B existente: se um dia
  uma variante desta página for criada, ela entra pelo mesmo caminho das demais,
  sem alteração nesta página.

*Prova social*

- Exibir o bloco de prova social usando o mesmo conjunto de depoimentos já
  publicado na página das lives.
- Omitir o bloco inteiro caso não haja material de depoimento disponível —
  nunca exibir um espaço vazio, um placeholder ou um aviso de "em breve".

*FAQ*

- Exibir todas as perguntas fechadas quando a página carrega.
- Abrir a resposta quando o visitante aciona uma pergunta e fechá-la quando
  aciona de novo.
- Permitir que mais de uma pergunta fique aberta ao mesmo tempo, sem que abrir
  uma feche a outra.
- Responder, na pergunta sobre não assistir ao vivo, que a gravação vitalícia é
  **adicional no checkout, por R$ 27** — e em nenhum outro lugar da página
  prometer a gravação como incluída no ingresso.

*Garantia*

- Informar prazo de 7 dias após o workshop, com a data limite explícita de 16 de
  setembro, e reembolso integral sem formulário e sem pergunta.

---

## Fora de escopo

- **Checkout real:** a criação, configuração ou integração da página de
  pagamento. A página aponta para um placeholder até a URL existir.
- **Formulário de captura:** esta página não coleta nome, e-mail, telefone nem
  qualquer outro dado do visitante; não há modal, chat nem campo de entrada.
- **Contador de vagas:** nenhuma exibição de vagas restantes, lotadas ou
  esgotando.
- **Contador regressivo de horas:** proibido explicitamente. A urgência da
  página vem do texto e da mudança de lote, nunca de um relógio.
- **Produção das artes e imagens:** o mockup do planner, a foto do Felipe e
  qualquer arte dos cards de entregáveis não são produzidos aqui.
- **Criação dos materiais entregáveis:** o planner, o mapa mental, o calendário,
  o pack de mensagens e os checklists são produtos do workshop — a página apenas
  os anuncia.
- **Configuração do webhook de venda** na plataforma de checkout e a validação
  ponta a ponta da compra.
- **Página de obrigado pós-compra** específica do workshop.
- **Upsell da gravação vitalícia:** vive no checkout, não nesta página.
- **Criação de uma variante de teste A/B** desta página.

---

## Pendências / Decisões em aberto

1. **URL real do checkout** — depende da usuária. Sem ela, os botões ficam no
   placeholder. Junto da URL é preciso saber **qual plataforma** de checkout
   será usada, porque o nome do parâmetro que carrega o identificador de compra
   muda de plataforma para plataforma.
2. **Imagem do mockup do planner** — elemento visual preferido do hero e imagem
   do card largo de entregáveis. Sem ela, o hero cai para a alternativa já
   decidida (foto do Felipe) e o card do planner fica sem imagem.
3. **Foto do Felipe** — confirmar se a foto já usada nas outras páginas serve
   para o bloco de autoridade desta página ou se haverá uma nova.
4. **Política de reembolso pós-evento** — confirmar a redação final (7 dias
   após o workshop, com data limite 16 de setembro) e por qual canal o pedido de
   reembolso é feito, já que o texto promete "manda uma mensagem".
5. **Comportamento após 09/09 às 18h** — confirmar o que a página deve mostrar
   quando as vendas encerram: aviso de encerramento, convite para uma lista de
   espera, ou redirecionamento.
6. **Comportamento antes de 10/08** — confirmar se a página fica no ar antes da
   abertura do Lote 0 e, se ficar, se já mostra o preço do Lote 0.
7. **Depoimentos** — confirmar que os depoimentos da página das lives podem ser
   reaproveitados nesta oferta paga, já que falam do método e não do workshop.
8. **Identificador de funil** — definir com qual nome esta página aparece nos
   relatórios do painel, para não se misturar aos funis de captura já
   existentes.
