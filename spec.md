# Spec: Landing Page de Formulário de Aplicação (multi-etapas)

## Visão Geral

Criar uma nova landing page de captação de leads para o site atacadoexponencial.com cujo elemento central é um **formulário de aplicação dividido em etapas** (estilo da referência ecommercenext.com.br/form-organico): um cartão centralizado na tela com título curto, exibindo **uma etapa de campos por vez** e uma barra de rodapé no próprio cartão com a navegação — seta "→" para avançar e seta "←" para voltar (a partir da segunda etapa). O envio acontece somente na última etapa.

Hoje o site captura leads por um chat conversacional (pergunta a pergunta). Esta LP oferece um formato alternativo intermediário: mais direto que o chat, mas sem sobrecarregar o visitante com todos os campos de uma vez — os campos são agrupados em 3 etapas curtas. Serve para tráfego que responde melhor a formulário do que a chat (ex.: tráfego orgânico ou campanhas específicas), permitindo comparar a conversão dos formatos.

**Divisão das etapas** (análoga à referência):

- **Etapa 1 — identidade/contato:** Nome, WhatsApp, @instagram da marca
- **Etapa 2 — qualificação:** Email, Faturamento mensal, Cargo
- **Etapa 3 — perguntas abertas:** Principal desafio, Maior objetivo — e o botão de envio

**Perguntas do formulário** — mantém exatamente as perguntas do fluxo de captação atual e adiciona uma nova (Cargo):

1. **Nome** — texto livre
2. **WhatsApp** — telefone
3. **Email** — email
4. **@instagram da marca** — texto livre
5. **Faturamento MENSAL do negócio** — escolha única entre 10 faixas: `Menos de 20 Mil` / `De 20 a 30 Mil` / `De 30 a 40 Mil` / `De 40 a 75 Mil` / `De 75 a 100 Mil` / `De 100 a 150 Mil` / `De 150 a 200 Mil` / `De 200 a 300 Mil` / `De 300 a 500 Mil` / `Mais de 500 Mil`
6. **Cargo** (NOVO) — escolha única entre: `Dono(a) / Sócio(a)` / `Gestor(a)` / `Funcionário(a)` / `Outro`
7. **Principal desafio do negócio hoje** (justificativa) — texto livre curto
8. **Maior objetivo para os próximos meses** (objetivo) — texto livre curto

**Pós-envio** — o lead entra no mesmo fluxo de captação já existente no site (registro, atribuição, notificações e encaminhamentos internos), e o visitante é redirecionado conforme a faixa de faturamento informada: faixa mais baixa ("Menos de 20 Mil") vai para uma conversa de WhatsApp com os especialistas; todas as demais faixas vão para a página de agendamento da sessão. A regra de destino é decidida pelo fluxo de captação, nunca pela página — a página apenas executa o redirecionamento recebido.

**Atribuição** — os parâmetros de campanha (UTMs) presentes na URL de chegada são capturados automaticamente e ficam associados à visita, acompanhando o lead no envio, como já acontece nas demais páginas do site. Nenhum mecanismo novo de captura precisa ser criado — a spec registra o comportamento para garantir que a página não o quebre.

**Visual** — segue a identidade atual do site: tema escuro com detalhes em bege, tipografia Satoshi, mesmo estilo de botões e campos das páginas existentes. Página sem menu de navegação e sem seções extras de conteúdo — o formulário é o protagonista.

**URL definida:** `/aplicacao-mentoria`.

## Páginas / Módulos

### Página de Aplicação (LP de formulário multi-etapas)

**Descrição:** Página nova e enxuta contendo logotipo, headline curta, subtítulo de reforço e um cartão de formulário centralizado que exibe uma etapa de campos por vez (3 etapas), com barra de navegação no rodapé do cartão (avançar/voltar) e envio na última etapa. Não tem menu, rodapé de navegação nem outras seções de conteúdo. Reaproveita o visual e o layout-base das páginas atuais do site.

**Componentes:**
- **Logotipo:** marca do Atacado Exponencial no topo, centralizada.
- **Sem headline/subtítulo:** decisão da usuária — a página exibe apenas o logotipo e o cartão do formulário ("apenas o form"), como na referência.
- **Cartão do formulário:** cartão centralizado com título curto no topo (ex.: "FORMULÁRIO DE APLICAÇÃO"), que exibe uma etapa por vez e contém a barra de navegação no rodapé.
- **Formulário de aplicação:** os 8 campos distribuídos em 3 etapas — Etapa 1: Nome, WhatsApp, @instagram da marca; Etapa 2: Email, Faturamento mensal, Cargo; Etapa 3: Principal desafio, Maior objetivo. Rótulos dos campos obrigatórios marcados com `*` (todos os campos são obrigatórios). Os valores preenchidos são preservados ao navegar entre etapas.
- **Barra de navegação do cartão:** barra no rodapé do cartão com seta "→" para avançar (etapas 1 e 2), seta "←" para voltar (etapas 2 e 3) e o botão de envio na etapa 3.
- **Indicador de etapa (opcional):** indicação discreta da etapa atual (ex.: "1 de 3").
- **Campo Nome:** entrada de texto com rótulo/placeholder "Nome".
- **Campo WhatsApp:** entrada de telefone com rótulo/placeholder "WhatsApp".
- **Campo Email:** entrada de email com rótulo/placeholder "Email".
- **Campo Instagram:** entrada de texto com rótulo/placeholder indicando o formato "@suamarca".
- **Campo Faturamento mensal:** seleção de escolha única exibindo as 10 faixas na ordem crescente listada na Visão Geral.
- **Campo Cargo:** seleção de escolha única com as opções: Dono(a)/Sócio(a), Gestor(a), Funcionário(a), Outro.
- **Campo Principal desafio:** entrada de texto livre com pergunta "Qual o principal desafio do seu negócio hoje?" e placeholder "Conte em poucas palavras".
- **Campo Maior objetivo:** entrada de texto livre com pergunta "E qual o seu maior objetivo para os próximos meses?" e placeholder "Conte em poucas palavras".
- **Mensagens de erro por campo:** texto curto exibido junto ao campo inválido.
- **Botão de envio:** botão destacado na barra de navegação da etapa 3, com texto de ação (ex.: "ENVIAR APLICAÇÃO →").
- **Nota de privacidade/expectativa (opcional):** frase pequena abaixo do botão informando que o time entra em contato pelo WhatsApp/email informados.

**Comportamentos:**
- Visitante acessa a página e vê, sem rolagem excessiva, o logotipo e o cartão do formulário exibindo a Etapa 1 (Nome, WhatsApp, @instagram) com a barra de navegação no rodapé do cartão — sem headline nem subtítulo.
- Ao clicar em "→" com os campos da etapa atual válidos, o cartão avança para a próxima etapa; os valores preenchidos são preservados.
- Ao clicar em "→" com algum campo da etapa atual inválido, o avanço é bloqueado, as mensagens de erro dos campos inválidos daquela etapa aparecem e o foco vai para o primeiro campo inválido da etapa.
- Ao clicar em "←" (etapas 2 e 3), o cartão volta para a etapa anterior sem perder nenhum valor preenchido e sem disparar validação.
- Campos de etapas ainda não visitadas não exibem erro antecipadamente.
- Ao chegar na página com parâmetros de campanha (UTMs) na URL, esses parâmetros são capturados e ficam associados à visita, de modo que acompanhem o lead no envio (comportamento de atribuição já existente no site — a página não interfere nele).
- Todos os rótulos de campos exibem `*` indicando obrigatoriedade.
- Campo Nome: aceita texto livre; é inválido se vazio ou com menos de 2 caracteres; nesse caso exibe a mensagem "Digite seu nome." junto ao campo.
- Campo WhatsApp: enquanto o visitante digita, aplica máscara de telefone brasileiro (DDD + número); é inválido se tiver menos de 10 dígitos; nesse caso exibe "Digite um WhatsApp válido com DDD." junto ao campo.
- Campo Email: é inválido se vazio ou fora do formato de email (nome@dominio); nesse caso exibe "Digite um email válido." junto ao campo.
- Campo Instagram: aceita texto livre; é inválido se vazio; nesse caso exibe "Digite o @ da sua marca." junto ao campo.
- Campo Faturamento mensal: o visitante escolhe exatamente uma das 10 faixas; é inválido se nenhuma faixa foi escolhida; nesse caso exibe "Escolha a faixa de faturamento." junto ao campo.
- Campo Cargo: o visitante escolhe exatamente uma das opções; é inválido se nenhuma opção foi escolhida; nesse caso exibe "Escolha o seu cargo." junto ao campo.
- Campo Principal desafio: aceita texto livre; é inválido se tiver menos de 2 caracteres; nesse caso exibe "Conta um pouquinho pra gente." junto ao campo.
- Campo Maior objetivo: aceita texto livre; é inválido se tiver menos de 2 caracteres; nesse caso exibe "Conta um pouquinho pra gente." junto ao campo.
- Ao corrigir um campo que estava inválido, a mensagem de erro daquele campo desaparece.
- Ao clicar em enviar (etapa 3) com algum campo da etapa 3 inválido, o envio é bloqueado, as mensagens de erro aparecem, o foco vai para o primeiro campo inválido e nenhum valor já preenchido é perdido.
- Ao clicar em enviar com todos os campos válidos (as etapas anteriores já foram validadas ao avançar), o botão entra em estado de envio: fica desabilitado e muda o texto para "Enviando…", impedindo cliques repetidos e envio duplicado.
- No envio, o lead é entregue ao fluxo de captação existente do site com todas as respostas (nome, whatsapp, email, instagram, faturamento, cargo, principal desafio, maior objetivo) e a identificação de que veio desta página, junto com a atribuição de campanha da visita.
- Após o envio bem-sucedido, o visitante é redirecionado automaticamente para o destino retornado pelo fluxo de captação: quem informou faturamento "Menos de 20 Mil" vai para a conversa de WhatsApp com os especialistas; quem informou qualquer outra faixa vai para a página de agendamento da sessão.
- Se o envio falhar ou o destino não for retornado (ex.: falha de comunicação), o visitante é redirecionado para um destino padrão definido para a página (não fica preso numa tela travada), e a falha não gera nova tentativa automática que duplicaria o lead.
- Nenhuma regra de destino, validação de negócio ou segredo fica na página: a página apenas coleta respostas, valida formato dos campos e executa o redirecionamento que recebe.
- A página exibe a identidade visual atual do site (fundo escuro, detalhes em bege, tipografia Satoshi) e é totalmente utilizável em telas de celular: campos em coluna única, botão de envio de fácil toque.
- A visita à página é registrada pelo rastreamento padrão do site (mesmo comportamento das demais páginas), permitindo comparar a conversão desta LP com as demais no painel existente.
