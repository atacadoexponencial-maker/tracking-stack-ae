# Spec: Migração do site Atacado Exponencial para o stack de tracking

## Visão Geral

Migrar o site **atacadoexponencial.com** — hoje hospedado na Lovable (app React/Vite) — para ser servido pela mesma infraestrutura Cloudflare que já roda o stack de tracking server-side (`tracking-ae`). O objetivo é que cada visita ao site passe nativamente pelo tracking: cookies first-party que sobrevivem ao Safari/iOS, captura de atribuição (UTMs, `fbclid`, `gclid`) no edge, e disparo de conversões server-side para o Meta (CAPI) — sem depender de pixel no navegador, ad-blocker ou Google Tag Manager.

O site é reconstruído a partir do visual e conteúdo da versão atual (referência: repositório `atacado-exponencial-lp`), com **liberdade para adaptar**. As prioridades, nesta ordem, são: **(1) performance** (Core Web Vitals no topo, para conversão e Quality Score de tráfego pago) e **(2) tracking funcionando perfeitamente**. Fidelidade pixel-a-pixel ao código original NÃO é requisito.

Público: a própria operação de tráfego pago do Atacado Exponencial, que roda campanhas para captação de leads (donos de marcas de atacado).

## Arquitetura e Decisões Técnicas

Estas decisões foram tomadas no brainstorming e orientam toda a implementação:

- **Mesmo domínio/projeto:** o site e os endpoints de tracking convivem no mesmo projeto Cloudflare Pages. É condição obrigatória para os cookies first-party funcionarem (mesmo-domínio). `atacadoexponencial.com` deixa de apontar para a Lovable e passa a ser servido por esta infraestrutura.

- **Estrutura de repositório — decisão: expandir o `tracking-stack-ae`.** O site reconstruído passa a ser a "frente" do projeto que já está no ar e com deploy automático (git-connected). As funções de tracking (`functions/`) continuam servindo as rotas de tracking/webhook/API. Um único repositório = uma fonte de verdade e um deploy só. As páginas de exemplo (`examples/`) saem; o dashboard (`/dash`) é preservado e continua acessível.

- **Estratégia de cutover — decisão: testar antes de migrar o domínio.** Todo o site é validado primeiro numa URL de teste (subdomínio ou URL `.pages.dev`): visual, performance, captura de leads e tracking ponta-a-ponta. Só depois de validado, o domínio `atacadoexponencial.com` é apontado para o novo projeto e a hospedagem da Lovable é desativada. Sem janela de site quebrado em produção.

- **Tecnologia do site:** site estático com partes interativas isoladas ("islands") apenas onde necessário (calculadora, FAQ, carrossel, modal de formulário). O restante é HTML estático puro, sem framework no cliente.

- **Fluxo de leads desacoplado (thin client, fat server):** os formulários NÃO falam direto com o n8n. Eles enviam o lead ao **backend do stack**, que faz três coisas: (1) registra o lead no banco com a atribuição da sessão; (2) dispara a conversão server-side para o Meta; (3) encaminha o lead para o CRM. Hoje o encaminhamento aponta para o n8n (`webhook.seteaceleradora.com.br`, que leva ao ClickUp); o destino é configurável e trocável sem alterar o site (permite remover o n8n no futuro e falar direto com o ClickUp).

- **Rastreamento:** o Google Tag Manager (`GTM-N999Q2GC`) e todo o tracking client-side atual são removidos. O rastreamento passa a ser 100% server-side via o stack (Meta CAPI + GA4).

## Páginas / Módulos

### Home (`/`)

**Descrição:** Página principal de captação de leads. Apresenta a oferta (diagnóstico/método para marcas de atacado) e conduz o visitante ao formulário de cadastro.

**Componentes:**
- Hero: navegação com logo, selo/badge, título principal, subtítulo, botão de chamada para ação (CTA) e selos de confiança, com grid de estatísticas.
- Seção de Dores: lista de problemas/dores que o público enfrenta.
- Seção de Pilares: pilares do método/proposta de valor.
- Seção "Como Funciona": passos do processo.
- Carrossel de Depoimentos: provas sociais (prints/depoimentos) navegáveis.
- Seção "Sobre o Felipe": apresentação do especialista, com foto.
- FAQ: perguntas frequentes em formato sanfona (expandir/recolher).
- CTA Final: bloco de chamada para ação ao fim da página.
- Rodapé: links institucionais e informações de contato.
- Modal de Formulário de Lead: captura nome, telefone e e-mail.

**Comportamentos:**
- Visitante visualiza a página e rola por todas as seções.
- Visitante clica no CTA do Hero e o modal de formulário abre.
- Visitante clica no CTA Final e o modal de formulário abre.
- Visitante fecha o modal de formulário sem enviar.
- Visitante preenche o campo nome.
- Visitante preenche o campo telefone.
- Visitante preenche o campo e-mail.
- Visitante tenta enviar com campos vazios ou inválidos e vê mensagens de validação.
- Visitante envia o formulário válido e o lead é capturado (registrado com atribuição, enviado ao Meta e encaminhado ao CRM).
- Após o envio, o visitante é redirecionado para a página de Obrigada.
- Visitante expande uma pergunta do FAQ.
- Visitante recolhe uma pergunta do FAQ.
- Visitante avança/retrocede no carrossel de depoimentos.
- Visitante clica em links do rodapé.

### Obrigada (`/obrigada`)

**Descrição:** Página de confirmação exibida após o visitante enviar um formulário de lead. Reforça o próximo passo e mantém o engajamento com prova social.

**Componentes:**
- Hero de Confirmação: mensagem de agradecimento e instrução do próximo passo.
- Vídeo de Depoimento: depoimento em vídeo de cliente.
- Seção de Metodologia: explicação do método.
- Seção "Sobre o Felipe": apresentação do especialista.
- Rodapé.

**Comportamentos:**
- Visitante visualiza a confirmação de cadastro.
- Visitante dá play no vídeo de depoimento.
- Visitante lê a metodologia.
- Visitante rola até o rodapé e clica em links.

### Workshop Gratuito (`/workshop-gratuito-atacado`)

**Descrição:** Página de captação para um workshop gratuito. Apresenta o conteúdo do workshop e capta inscrições.

**Componentes:**
- Hero do Workshop: título, descrição e CTA de inscrição.
- Seção "A Verdade": argumento/quebra de objeção.
- Seção "O Que Vai Aprender": tópicos do workshop.
- Seção "Para Quem": público-alvo.
- Seção "Por Que é Gratuita": justificativa da gratuidade.
- Seção "Sobre o Felipe".
- CTA Final do Workshop.
- Modal de Formulário de Lead: nome, telefone e e-mail.

**Comportamentos:**
- Visitante visualiza a página e rola pelas seções.
- Visitante clica no CTA do Hero e o modal de formulário abre.
- Visitante clica no CTA Final e o modal de formulário abre.
- Visitante preenche e envia o formulário e o lead é capturado.
- Após o envio, o visitante é redirecionado para a página de Obrigada.
- Visitante fecha o modal sem enviar.

### Vídeo Workshop (`/video-workshop-instagram`)

**Descrição:** Página focada em um vídeo de workshop (origem Instagram), com chamadas para ação ao longo e ao fim.

**Componentes:**
- Hero com logo, rótulo e player de vídeo incorporado.
- Seção de CTA pós-vídeo.
- Seção de CTA final.
- Rodapé.

**Comportamentos:**
- Visitante dá play no vídeo.
- Visitante clica no CTA pós-vídeo.
- Visitante clica no CTA final.
- Visitante rola até o rodapé.

### VSL (`/vsl`)

**Descrição:** Página de vídeo de vendas (VSL). Lidera com um vídeo e segue com as seções de oferta da home.

**Componentes:**
- Hero de VSL: player de vídeo de vendas com chamada para ação.
- Seção de Dores.
- Seção de Pilares.
- Seção "Como Funciona".
- Carrossel de Depoimentos.
- Seção "Sobre o Felipe".
- FAQ.
- CTA Final.
- Rodapé.

**Comportamentos:**
- Visitante dá play no vídeo de vendas.
- Visitante clica no CTA do Hero de VSL e o modal de formulário abre.
- Visitante clica no CTA Final e o modal de formulário abre.
- Visitante preenche e envia o formulário e o lead é capturado.
- Após o envio, o visitante é redirecionado para a página de Obrigada.
- Visitante expande/recolhe perguntas do FAQ.
- Visitante navega pelo carrossel de depoimentos.

### Calculadora — Captura (`/calculadora-atacado`)

**Descrição:** Primeira etapa de uma ferramenta interativa que estima o potencial de receita do visitante. Capta os dados de contato antes de iniciar o questionário.

**Componentes:**
- Formulário de captura: nome, telefone e e-mail.
- Texto de apresentação da calculadora.

**Comportamentos:**
- Visitante visualiza a apresentação da calculadora.
- Visitante preenche nome, telefone e e-mail.
- Visitante tenta avançar com campos inválidos e vê validação.
- Visitante envia os dados e o lead é capturado (registrado com atribuição, enviado ao Meta e encaminhado ao CRM).
- Após o envio, o visitante avança para a etapa de perguntas.

### Calculadora — Perguntas (`/calculadora-atacado/perguntas`)

**Descrição:** Etapa de questionário da calculadora. Coleta as respostas que alimentam o cálculo do potencial.

**Componentes:**
- Formulário multi-etapa com campos de seleção (ex.: percentuais, taxa de recompra, ticket médio, faturamento).
- Indicador de progresso.

**Comportamentos:**
- Visitante que chega sem ter preenchido a captura é redirecionado de volta para a etapa de captura.
- Visitante seleciona as opções de cada pergunta.
- Visitante preenche os valores numéricos solicitados.
- Visitante avança para a próxima pergunta.
- Visitante retorna para a pergunta anterior.
- Visitante conclui o questionário e suas respostas são salvas.
- Após concluir, o visitante avança para a página de resultado.

### Calculadora — Resultado (`/calculadora-atacado/resultado`)

**Descrição:** Etapa final da calculadora. Exibe o potencial de receita estimado e o "gap" não realizado, com chamada para agendamento.

**Componentes:**
- Bloco de resultado: receita potencial estimada e potencial não realizado (gap).
- Mensagem interpretativa do resultado.
- CTA de agendamento.

**Comportamentos:**
- Visitante que chega sem ter respondido o questionário é redirecionado de volta.
- Visitante visualiza o resultado calculado a partir das suas respostas.
- Visitante lê a mensagem interpretativa.
- Visitante clica no CTA de agendamento. (Destino **a definir** — esta LP ainda não foi finalizada pela operação; manter o botão presente porém sem destino real até que seja informado. Não inventar um destino.)

### Política de Privacidade (`/privacy-policy`)

**Descrição:** Página institucional com a política de privacidade do site.

**Componentes:**
- Conteúdo textual da política.

**Comportamentos:**
- Visitante lê a política de privacidade.
- Visitante clica em links internos/externos da política.

### Módulo: Captura e Tracking de Lead (transversal)

**Descrição:** Comportamento compartilhado por todos os formulários do site (modais da Home/Workshop/VSL e formulário da Calculadora). Define o que acontece quando um lead é enviado, independentemente da página de origem.

**Componentes:**
- Endpoint de captura no backend do stack.
- Registro do lead no banco com a atribuição da sessão (UTMs, `fbp`/`fbc`, origem).
- Disparo de conversão server-side para o Meta.
- Encaminhamento do lead para o CRM (n8n → ClickUp hoje; destino trocável).

**Comportamentos:**
- Ao enviar qualquer formulário, o lead é registrado com a origem (campanha/anúncio) de onde a visita veio.
- Ao enviar qualquer formulário, uma conversão é disparada ao Meta de forma server-side.
- Ao enviar qualquer formulário, o lead é encaminhado ao CRM configurado.
- Cada visita recebe e mantém os cookies first-party de atribuição já na entrada do site.
- Nenhuma tag de Google Tag Manager ou pixel client-side é carregada.

### Módulo: Identidade Visual e Assets (transversal)

**Descrição:** Elementos visuais compartilhados por todo o site.

**Componentes:**
- Fonte Satoshi (pesos Regular e Bold).
- Logotipos e ícones da marca.
- Imagens de prova social (depoimentos) e foto do especialista.

**Comportamentos:**
- Todas as páginas exibem a tipografia, cores e logotipos consistentes da marca.
- As imagens carregam de forma otimizada, sem prejudicar a performance.
