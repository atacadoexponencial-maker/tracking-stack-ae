# Spec: LP /trafego-atacado — Gestão de Tráfego Pago para Marcas Atacado

## Visão Geral

Nova landing page em `/trafego-atacado` no site atacadoexponencial.com para vender o serviço **done-for-you de gestão de tráfego pago** para marcas atacado, na voz do Felipe. O time do Atacado Exponencial executa as campanhas (criativos, segmentação, otimização) e o comercial do cliente fecha os pedidos.

A página **espelha a estrutura visual da LP existente `/se-v1`** (`src/pages/se-v1.astro`): mesma sequência de seções — Hero, Problema (Pain), Metodologia (Pillars), Quem confia (LogoWall), Como funciona (HowItWorks), Resultados (Testimonials), Quem é (AboutFelipe), FAQ (Faq) e CTA final (FinalCta) — sem o menu padrão do site (a navegação é a barra própria do hero, com logo + CTA). Atenção: as seções da se-v1 têm o copy do funil de sessão estratégica fixo dentro delas (só o Hero aceita headline/subheadline por propriedade); esta LP usa **o mesmo molde visual com copy próprio** (o copy completo está na seção "Copy por seção" abaixo e é a fonte de verdade do conteúdo).

**Conversão da página:** agendamento de uma **reunião comercial direta** com o time (venda do serviço). O mecanismo do CTA (formulário, Calendly, WhatsApp…) **ainda não foi decidido** — ver Pendências; nesta spec o CTA é modelado como comportamento com destino configurável.

**Regra de copy (inviolável):** esta LP **nunca menciona "consultoria gratuita", "diagnóstico gratuito", "sessão gratuita" ou qualquer variação de oferta gratuita** — a reunião aqui é comercial e assumida como tal. Objetivo: não canibalizar o funil SE (sessão estratégica), que é onde a oferta gratuita vive.

**Tracking:** mesma esteira das demais LPs do site (visita registrada com atribuição de campanha; conversão registrada como Lead com deduplicação navegador/servidor). Valor de funil desta página: **`trafego-atacado`**.

## Páginas / Módulos

### Página /trafego-atacado (LP do serviço de gestão de tráfego)

**Descrição:** Landing page completa de venda do serviço de gestão de tráfego, com as mesmas 9 seções e o mesmo visual da `/se-v1` (tema alternando blocos escuros e claros, tipografia Satoshi, mesmos estilos de botões, cards, marquee de logos, acordeão de FAQ), porém com copy próprio de serviço/reunião comercial. Sem o cabeçalho padrão do site; o hero traz a barra própria com logotipo e um CTA compacto.

**Componentes:**
- **Barra do hero:** logotipo do Atacado Exponencial + botão compacto de CTA (visível em telas maiores, como na se-v1) que aciona o mecanismo de conversão.
- **Hero:** eyebrow/badge de qualificação, headline, subheadline, botão principal de CTA, linha de trust badges e faixa de 4 stats em cards (mesmo molde do hero da se-v1).
- **Seção O Problema:** eyebrow, título, texto de introdução e lista de 4 bullets com marcador "✕" em cards (mesmo molde da seção Pain da se-v1).
- **Seção O Serviço (Metodologia):** eyebrow, título, texto de introdução e 2 cards numerados (01/02) com título e descrição (mesmo molde da seção Pillars da se-v1).
- **Seção Quem Confia:** eyebrow, título, texto de apoio e o **mesmo bloco visual de marquee de logos de clientes da se-v1** (mesmas logos, rolagem contínua, pausa ao passar o mouse, respeito a preferência de movimento reduzido).
- **Seção Como Funciona:** eyebrow, título e 4 cards numerados (01–04) com título e descrição das etapas do serviço (mesmo molde da seção HowItWorks da se-v1; os cards desta LP não exibem duração em minutos, pois as etapas não são momentos de uma call).
- **Seção Resultados:** eyebrow, título e 3 cards de depoimento com estrelas, citação, avatar de iniciais, nome e contexto da marca (mesmo molde da seção Testimonials da se-v1), com os 3 depoimentos do copy abaixo.
- **Seção Quem é — Felipe Santos:** **reutiliza sem alteração o conteúdo da seção AboutFelipe da se-v1** — mesmos 3 stats (+100 marcas atendidas / 2013 desde quando está no digital / 1º método próprio para atacado), mesma foto e mesma bio em 5 parágrafos.
- **Seção FAQ:** eyebrow, título, frase de apoio e acordeão com as 6 perguntas/respostas do copy abaixo (mesmo molde da seção Faq da se-v1).
- **Seção CTA Final:** eyebrow, título, texto de apoio, botão de CTA e microcopy de notas (mesmo molde da seção FinalCta da se-v1).
- **Mecanismo de conversão:** ver módulo próprio abaixo (destino pendente).

**Comportamentos:**
- Visitante acessa `/trafego-atacado` e vê o hero completo (badge, headline, subheadline, CTA, trust badges e stats) sem o menu padrão do site.
- A visita à página é registrada pelo rastreamento padrão do site, idêntico ao das demais LPs: registro de visualização de página no navegador e espelho enviado ao servidor com um identificador único de evento (deduplicado), como o layout-base já faz — nenhum mecanismo novo de rastreamento é criado.
- Ao chegar com parâmetros de campanha (UTMs, cliques de anúncio) na URL, a atribuição é capturada e associada à visita automaticamente (comportamento já existente no site — a página não interfere nele).
- Clicar em **qualquer** CTA da página (botão compacto da barra do hero, botão principal do hero, botão do CTA final) aciona o mesmo mecanismo de conversão (módulo abaixo).
- Na seção Quem Confia, as logos rolam continuamente em loop; a rolagem pausa quando o cursor está sobre a faixa; visitantes com preferência de movimento reduzido veem as logos estáticas.
- Na seção Resultados, em telas de celular os depoimentos deslizam horizontalmente com encaixe por card; em telas maiores aparecem lado a lado em grade.
- Na seção FAQ, cada pergunta abre e fecha individualmente ao toque/clique, exibindo a resposta (acordeão).
- A página inteira é utilizável em telas de celular: seções em coluna única, stats em grade 2x2, botões de fácil toque (mesmo comportamento responsivo da se-v1).
- Em nenhum lugar da página (títulos, textos, botões, FAQ, metadados de título/descrição da aba) aparecem as expressões "consultoria gratuita", "diagnóstico gratuito", "sessão gratuita" ou equivalentes de oferta gratuita.
- A página passa a aparecer no relatório de conversão por LP do dashboard (visitantes x leads x taxa), como as demais páginas reais do site — o relatório usa uma lista fechada de páginas conhecidas, então `/trafego-atacado` precisa constar nela.
- No painel, os leads desta página são filtráveis pelo funil `trafego-atacado` (seletor de funil já existente).

### Mecanismo de conversão (CTA) — destino configurável, PENDENTE

**Descrição:** Comportamento único acionado por todos os CTAs da página, cujo destino final ainda não foi decidido pela usuária (ver Pendência 5). As opções em avaliação: (a) formulário multi-etapas seguido de agendamento no Calendly, (b) link direto para o Calendly, (c) conversa de WhatsApp, (d) apenas formulário. O site já possui precedentes prontos para os formatos (chat conversacional de captação, formulário multi-etapas da LP de aplicação, redirecionamento decidido pelo backend) — a escolha define qual precedente reutilizar.

**Componentes:**
- **Ponto de conversão:** o elemento/fluxo que o CTA abre ou para onde direciona (a definir).

**Comportamentos (invariantes, valem para qualquer destino escolhido):**
- Clicar em qualquer CTA aciona o mecanismo de conversão imediatamente (sem passos intermediários além dos do próprio mecanismo).
- Quando a conversão acontecer (envio de formulário e/ou clique de saída para agendamento — conforme o mecanismo escolhido), ela é registrada como evento **Lead** na esteira de captação existente do site, com o funil **`trafego-atacado`** identificando esta página, junto com a atribuição de campanha da visita.
- O registro do Lead segue o padrão de deduplicação já usado nas outras LPs: cópia do navegador e espelho no servidor com o mesmo identificador único de evento.
- Se o mecanismo envolver coleta de dados, qualquer regra de destino/roteamento pós-envio é decidida pelo backend, nunca pela página — a página apenas coleta, envia e segue o redirecionamento recebido (mesmo padrão thin-client das captações existentes).
- Nenhum texto do mecanismo (mensagens, botões, confirmações) menciona oferta gratuita; o enquadramento é sempre de reunião comercial.

## Copy por seção (fonte de verdade)

O texto abaixo, fornecido pela usuária, é a fonte de verdade do conteúdo. Marcações de pendência estão na seção Pendências.

### 1. Hero
- **Eyebrow:** "PARA MARCAS ATACADO COM FATURAMENTO ACIMA DE R$ 20 MIL/MÊS" *(Pendência 1 — nota: a se-v1 usa hoje exatamente a mesma régua de R$ 20 mil/mês no badge)*
- **Headline:** "Escale seu atacado para R$ 100 mil, R$ 200 mil, R$ 400 mil ou mais por mês com tráfego pago feito exclusivamente para atacado"
- **Subheadline:** "Gestão completa de tráfego pago (campanhas, criativos e otimização) feita pelo time do Atacado Exponencial, o 1º método próprio para o mercado atacado. A gente gera a entrada de novas revendedoras e seu comercial fecha os pedidos."
- **Botão:** "QUERO TRÁFEGO PARA MEU ATACADO →"
- **Trust badges:** Reunião individual · Direto com nosso time · Sem enrolação
- **Faixa de stats:** +100 MARCAS ATACADO ATENDIDAS · 2013 DESDE QUANDO ESTÁ NO DIGITAL · 1º MÉTODO PRÓPRIO PARA ATACADO · 100% FOCO EM ATACADO *(quarta stat é sugestão — Pendência 4)*

### 2. O Problema
- **Título:** "Sua verba de anúncio está rodando no jogo errado."
- **Intro:** "A internet ensinou o atacado a anunciar como varejo. E o resultado aparece na sua operação:"
- **4 bullets (✕):**
  - "Você investe em anúncio e o WhatsApp enche de gente querendo comprar UMA peça: consumidora final, não lojista"
  - "Sua agência fala de alcance, seguidor e engajamento, mas não sabe dizer quantas revendedoras novas entraram no mês"
  - "Você depende de indicação para trazer novos revendedores, e crescimento sob demanda não existe"
  - "As campanhas são adaptação de estratégia de varejo e e-commerce, que simplesmente não funciona para atacado"

### 3. O Serviço (Metodologia)
- **Título:** "Tráfego para Marcas Atacado: o marketing fazendo o papel certo"
- **Intro:** "No atacado, o papel do marketing é um só: **gerar novos revendedores.** É exatamente isso que a gestão de tráfego do Atacado Exponencial entrega: campanhas que já nascem para o jogo do atacado, não adaptadas do varejo."
- **Card 01 · Anúncio que vende negócio, não peça:** "O atacado de verdade não vende produto, vende oportunidade: revenda, margem, parceria de crescimento. É isso que os criativos comunicam, para atrair quem revende."
- **Card 02 · Funil que termina no seu comercial:** "Segmentação e campanhas desenhadas para lojistas e revendedoras. A revendedora qualificada chega pronta no seu WhatsApp: a gente gera a entrada e seu time fecha o pedido."

### 4. Quem Confia
- **Título:** "Marcas de atacado reais já constroem seus resultados com a gente"
- **Texto:** "Mais de 100 marcas, de moda festa a infantil, já passaram pelo método."
- Faixa de logos: mesmo bloco visual (e mesmas logos) da se-v1.

### 5. Como Funciona
- **Título:** "Do primeiro contato à campanha no ar"
- **01 · Reunião comercial:** "Uma conversa individual e direta: entendemos sua operação, mostramos como a gestão funciona e apresentamos o investimento. Você decide se faz sentido."
- **02 · Diagnóstico da operação:** "Fechou? A gente mapeia seu ICP, catálogo, condição de primeiro pedido e como seu comercial atende hoje."
- **03 · Estruturação das campanhas:** "Criativos, segmentação e funil montados para atrair revendedora qualificada, do jeito que o atacado exige."
- **04 · Gestão e otimização contínua:** "Nosso time roda as campanhas no dia a dia: testa, corta o que não performa e escala o que gera revendedora. Com relatórios focados no que importa: custo por revendedora qualificada e novos pedidos." *(Pendência 3 — frequência de relatórios/reuniões)*

### 6. Resultados
- **Título:** "Tráfego certo para atacado, na prática"
- **3 depoimentos** *(Pendência 2 — vêm do contexto da mentoria, validar uso)*:
  - **Keren, moda infantil (6 dígitos/mês):** "Quase 100 novos seguidores por dia, público bem qualificado. 40% das vendas do último mês vieram do tráfego e muitos clientes fechando de primeira."
  - **Viviane, Anifil:** "Queríamos pegar estratégia de varejo e aplicar na nossa marca 100% atacada. Com R$ 321 de investimento, fechamos 4 novos clientes no primeiro pedido, ticket médio de R$ 2.000."
  - **Viviane, moda fitness:** "Antes eu dependia literalmente dos mesmos clientes. Hoje, 45% do meu faturamento vem de novos clientes."

### 7. Quem é — Felipe Santos
Mesma bio da se-v1, sem alteração (conteúdo já existente na seção AboutFelipe: stats +100 / 2013 / 1º método + bio em 5 parágrafos + foto).

### 8. FAQ
- **Título:** "Perguntas frequentes" + apoio: "Tem outra dúvida? Agende a reunião e converse direto com nosso time."
- **6 perguntas:**
  1. "Isso é a mentoria Atacado Exponencial?" → "Não. Na mentoria você aprende e implementa o método no seu negócio. Aqui a gente executa o tráfego por você: é um serviço de gestão, feito pelo nosso time."
  2. "A verba dos anúncios está inclusa?" → "Não. O investimento em mídia é seu e roda na sua conta de anúncios. A gestão é cobrada à parte e os valores são apresentados na reunião."
  3. "Vocês criam os anúncios ou eu preciso enviar prontos?" → "A criação e a estrutura das campanhas fazem parte da entrega. O escopo completo é apresentado na reunião."
  4. "Minha marca vende atacado e varejo. Serve para mim?" → "O serviço é desenhado para o canal atacado: gerar revendedoras. Se o atacado é uma parte relevante do seu negócio, faz sentido conversar."
  5. "Em quanto tempo vejo resultado?" → "Depende do seu ponto de partida: oferta, catálogo, histórico de anúncios e capacidade de atendimento. Na reunião a gente analisa sua operação e fala o que dá para esperar, sem promessa mágica."
  6. "Vou receber uma proposta de venda?" → "Sim, e é justamente esse o combinado. A reunião é comercial: a gente mostra como o serviço funciona, apresenta o investimento e você decide. Sem aula disfarçada."

### 9. CTA Final
- **Título:** "Você já tem a marca. Agora precisa da entrada previsível."
- **Texto:** "Uma reunião individual com nosso time comercial: a gente analisa sua operação, mostra como a gestão de tráfego funciona para marcas atacado e apresenta o investimento. Você sai com clareza para decidir."
- **Botão:** "AGENDAR REUNIÃO COM O TIME →"
- **Microcopy:** Reunião individual · Vagas limitadas por semana

## Pendências (não resolver nesta spec — decidir antes/durante a implementação)

1. **Régua de faturamento do eyebrow:** validar se "acima de R$ 20 mil/mês" é a régua certa para este serviço. Observação de código: é exatamente a mesma régua exibida hoje no badge do hero da se-v1.
2. **Depoimentos:** os 3 depoimentos (Keren e as duas Vivianes) vêm do contexto da **mentoria**, não do serviço de gestão — validar se podem ser usados nesta LP ou substituir.
3. **Frequência de relatórios/reuniões** no passo "04 · Gestão e otimização contínua" (o copy cita relatórios, mas não a cadência).
4. **Quarta stat do hero:** "100% FOCO EM ATACADO" é sugestão, pendente de validação (as três primeiras já existem na seção AboutFelipe).
5. **Mecanismo do CTA (decisão principal):** formulário multi-etapas + Calendly, link direto Calendly, WhatsApp, ou só formulário. A spec modela o CTA como comportamento com destino configurável; os invariantes (Lead com funil `trafego-atacado`, dedup navegador/servidor, roteamento no backend, zero menção a oferta gratuita) valem para qualquer escolha.
