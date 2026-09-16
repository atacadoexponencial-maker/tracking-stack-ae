# Spec: Aviso de cookies nas páginas públicas (LGPD, somente informativo)

## Visão Geral

**O que faz.** Mostra, nas páginas públicas do site, um aviso curto e discreto explicando em linguagem simples que o site usa cookies e ferramentas para medir visitas e o resultado dos anúncios do Meta e do Google, com link para a Política de Privacidade e um botão **"Entendi"** que fecha o aviso e não o mostra de novo naquele navegador por um período. Junto com o aviso, a Política de Privacidade ganha uma seção de cookies que lista exatamente o que o site grava, para quê e por quanto tempo, e o tracking passa a registrar, em cada evento, se aquele visitante viu ou fechou o aviso.

**Para quem.** Para o visitante das LPs e páginas de conteúdo, que passa a ser informado sobre a coleta; para a Atacado Exponencial, que deixa de operar sem nenhuma transparência sobre cookies; e para quem analisa o tracking, que passa a ter um registro legível da situação do aviso em vez de `unknown`.

**Qual problema resolve.** Levantamento de 16/09/2026:

- Não existe nenhum aviso de cookies no site.
- Toda visita recebe, sem qualquer informação prévia: cookies próprios de medição (`_krob_sid` e `_krob_eid`, 400 dias), cookies de anúncio do Meta (`_fbp`, 400 dias; `_fbc`, 90 dias a partir do clique no anúncio), o Pixel do Meta, o Google Analytics 4 e o **Microsoft Clarity** (mapa de calor e gravação de sessão — carregado em todas as páginas do layout comum e já citado na política).
- Algumas páginas incorporam vídeos de terceiros que também gravam cookies (YouTube em `/obrigada` e outras; Panda Video).
- A situação de consentimento que o tracking já recebe em cada evento chega sempre como `unknown`, porque nenhuma página a envia.
- A Política de Privacidade (`/privacy-policy`, atualizada em 31/07/2026) foi escrita para o aplicativo integrado ao Meta. A seção 10 cita Clarity, GA4 e Pixel do Meta de forma genérica, mas **não lista nenhum cookie pelo nome, não informa duração e omite os cookies próprios de medição, os de vídeo incorporado e o registro do próprio aviso**.
- O guia orientativo de cookies da ANPD pede, para cookies não necessários, consentimento livre, informado, inequívoco e granular, com registro; medição pode se apoiar em interesse legítimo; publicidade pede consentimento. A fiscalização está ativa desde 2024–25.

**Decisão da usuária (definitiva).** O aviso é **somente informativo**: nenhum script, cookie ou envio (Meta, GA4, Clarity, tracking próprio, vídeos) deixa de acontecer por causa dele, antes ou depois do "Entendi". O risco disso está registrado em "Risco assumido".

**Princípios que valem para a feature inteira:**

- **Informar sem atrapalhar a conversão.** O aviso nunca é modal, nunca bloqueia rolagem, nunca cobre o botão principal, o formulário ou a barra fixa de CTA no celular.
- **Nada muda no que é coletado nem no que é enviado.** Meta, GA4 e Clarity recebem exatamente o que recebem hoje; o aviso não liga nem desliga nada.
- **Transparência verificável.** A lista de cookies da política corresponde ao que o navegador realmente grava nas páginas do site.
- **Registro legível.** A situação do aviso fica registrada no tracking com valores que qualquer pessoa entende lendo a tabela.
- **Mesma identidade visual do site.** Fundo escuro, Satoshi, bege de assinatura — inclusive quando o aviso aparece sobre uma seção clara.

---

## Páginas / Módulos

### 1. Aviso de cookies (páginas públicas)

**Descrição:** Faixa compacta e fixa no rodapé da janela, exibida nas páginas públicas que usam o layout comum do site. Informa o que é coletado e para quê, oferece o link para a Política de Privacidade e a ação "Entendi". Aparece por cima do conteúdo sem escurecer a página e sem impedir interação com o restante.

**Componentes:**

- **Faixa do aviso:** superfície grafite com contorno de 1px cinza quente e cantos de 0.75rem, texto branco/cinza texto em Satoshi, sem sombra de profundidade (segue "Tom Antes De Sombra" do DESIGN.md).
- **Texto do aviso** (proposta, até ~2 linhas no desktop): "Usamos cookies para medir as visitas ao site e o resultado dos nossos anúncios no Meta (Facebook e Instagram) e no Google. Saiba mais na nossa [Política de Privacidade]."
- **Link "Política de Privacidade":** sublinhado, na cor bege de assinatura, levando a `/privacy-policy#cookies` (seção de cookies do módulo 3).
- **Botão "Entendi":** botão primário do DESIGN.md (fundo branco, texto carvão, peso 700, cantos de 0.5rem), com área de toque mínima de 44×44px.
- **Região acessível:** o aviso é identificado para tecnologias assistivas como uma região nomeada "Aviso de cookies".
- **Memória do aviso fechado:** registro no navegador de que o aviso foi fechado e em que data, usado para não exibi-lo de novo durante o período definido.

**Comportamentos:**

*Onde aparece*

- **Página pública com o layout comum** (home, LPs de captação, LPs de live e workshop, VSL, página de vendas do workshop pago, calculadora e suas etapas, páginas de materiais, páginas de aplicação, páginas de obrigado que exibem conteúdo, Política de Privacidade e página 404): o aviso é exibido se o navegador ainda não o fechou dentro do período.
- **Página nova criada no futuro com o layout comum:** exibe o aviso automaticamente, sem configuração por página.
- **Dashboard interno (`/dash` e subcaminhos):** o aviso nunca é exibido.
- **Painel de clientes da agência:** o aviso nunca é exibido.
- **Endereços que só redirecionam** (`/links`, `/grupo-da-live`, `/grupo-workshop`, redirecionamentos legados como `/obrigado` e `/obrigado-workshop`): não exibem aviso, porque não renderizam página; a página de destino, se for do site, segue a regra normal.
- **Checkout externo (Greenn) e demais páginas fora do domínio:** fora do alcance; nada é exibido pelo site.
- **Arquivos públicos que não são páginas do site** (ex.: imagens de disparos): não exibem aviso.

*Quando aparece*

- **Primeira visita do navegador:** o aviso aparece assim que a página fica visível, sem atraso artificial e sem animação que desloque o conteúdo.
- **Navegação para outra página antes de clicar "Entendi":** o aviso continua aparecendo em cada página até ser fechado.
- **Retorno depois de ter clicado "Entendi", dentro do período:** o aviso não aparece em nenhuma página pública naquele navegador.
- **Retorno depois de vencido o período:** o aviso volta a aparecer uma vez, até novo "Entendi".
- **Navegador que não permite guardar a memória do aviso** (modo privado restrito, armazenamento bloqueado): o aviso aparece normalmente, "Entendi" fecha nesta página, e ele pode reaparecer na página seguinte; a página nunca quebra nem mostra erro por isso.
- **Navegador sem suporte a scripts:** nenhum aviso é exibido e a página funciona como hoje.
- **Visitante identificado como bot:** nenhuma regra especial; o aviso não interfere na detecção de bots existente.

*Ações*

- **Clicar ou tocar em "Entendi":** o aviso some imediatamente, a memória de fechamento é gravada com a data e a situação passa a "aviso fechado" (módulo 2).
- **Clicar no link da Política de Privacidade:** abre a política na mesma aba, na seção de cookies; o aviso **não** é considerado fechado por isso.
- **Rolar, clicar em CTA, preencher formulário ou navegar sem tocar no aviso:** nada disso fecha o aviso nem é interpretado como "Entendi".
- **Tecla Esc com o foco dentro do aviso:** não fecha o aviso (fechar exige a ação explícita "Entendi"), para não haver fechamento acidental.
- **Não há botão "X" nem "Recusar"** nesta versão, porque não há o que recusar (ver "Risco assumido").

*Não atrapalhar a conversão*

- **Não é modal:** a página inteira continua clicável, rolável e legível com o aviso aberto; não há véu escurecendo o conteúdo.
- **Não bloqueia rolagem:** a rolagem da página funciona igual com e sem aviso.
- **Não empurra o layout:** o aviso sobrepõe o rodapé da janela sem alterar a posição do conteúdo nem causar salto de layout ao aparecer ou sumir.
- **Celular (até 767px de largura):** o aviso ocupa a largura da tela com margem lateral de 16px, texto em no máximo 3 linhas e botão "Entendi" ao lado do texto ou logo abaixo, com altura total que não passa de ~25% da altura da tela.
- **Celular com barra fixa de CTA no rodapé** (páginas com botão fixo de inscrição): o aviso fica **acima** da barra, sem cobri-la, e a barra continua tocável.
- **Celular com notificação de prova social** (balão "fulano acabou de entrar no grupo"): o balão e o aviso não se sobrepõem; o balão não intercepta toques no "Entendi" e vice-versa.
- **Página de vendas com barra fixa no topo:** o aviso fica no rodapé e não interfere na barra do topo.
- **Formulário na tela ou campo em foco no celular:** o aviso não cobre o campo em foco, o botão de enviar nem as etapas do formulário; se o teclado virtual estiver aberto, o aviso não sobe junto cobrindo o campo.
- **Modal de formulário ou chat de captura aberto** (cobrem a tela inteira): o modal fica por cima do aviso; o aviso não aparece sobre o formulário nem rouba o foco.
- **Final da página:** o conteúdo do fim da página (rodapé, links, último CTA) continua alcançável, sem ficar escondido atrás do aviso.
- **Desktop:** o aviso é um cartão compacto no canto inferior, com largura máxima que não cobre o botão principal da dobra.
- **Carregamento da página:** exibir o aviso não atrasa o aparecimento do conteúdo principal nem piora a métrica de maior elemento visível.
- **Contagem de cliques no CTA:** tocar em "Entendi" não conta como clique de CTA no funil de micro-conversões.

*Acessibilidade*

- **Leitor de tela:** o aviso é anunciado como região "Aviso de cookies" sem interromper a leitura em andamento; texto, link e botão são lidos com rótulos claros.
- **Ordem de foco pelo teclado:** o aviso é alcançável pela tecla Tab (link e depois "Entendi") sem prender o foco; é possível sair dele e continuar navegando a página.
- **Foco não é roubado:** ao aparecer, o aviso não move o foco do teclado.
- **Foco visível:** link e botão mostram um anel de foco próprio, bem visível sobre o fundo escuro.
- **Ativar pelo teclado:** Enter e Espaço acionam "Entendi"; Enter aciona o link.
- **Após "Entendi" pelo teclado:** o foco volta para um ponto lógico da página (o início do conteúdo principal ou o elemento que tinha foco antes), nunca some no vazio.
- **Contraste:** texto e link atingem no mínimo 4,5:1 sobre o fundo do aviso; o botão atinge no mínimo 4,5:1 entre texto e fundo.
- **Zoom de 200% e texto ampliado:** o aviso continua legível, sem cortar texto e sem cobrir mais que a metade inferior da tela.
- **Menos movimento:** para quem pede menos movimento, o aviso aparece e some sem animação.
- **Idioma:** o texto é lido em português (herda o idioma da página).

*Identidade visual*

- **Sobre seção escura:** o aviso usa grafite com contorno cinza quente, destacando-se do fundo carvão pelo tom.
- **Sobre seção clara (bege):** o aviso mantém o mesmo fundo escuro e contorno, legível e com separação clara da seção bege; nunca inverte para versão clara.
- **Tipografia:** Satoshi 400 para o texto (tamanho de corpo do site, mínimo 14px no celular) e 700 no botão.
- **Cor com motivo:** nenhuma cor semântica (verde, coral, azul, âmbar) no aviso; o bege aparece só no link.

---

### 2. Registro da situação do aviso no tracking (sistema)

**Descrição:** Cada evento que as páginas já enviam ao tracking passa a levar a situação do aviso naquele navegador no momento do evento, preenchendo o campo de situação de consentimento que hoje chega sempre `unknown`. É registro interno: não muda o que vai para Meta, GA4 ou CRM, nem decide envio de nada.

**Componentes:**

- **Situação do aviso** (valores legíveis):
  - **"aviso exibido"** — o aviso está sendo exibido (ou será exibido) nesta página e ainda não foi fechado neste navegador dentro do período;
  - **"aviso fechado"** — o navegador clicou "Entendi" dentro do período;
  - **"sem aviso"** — o evento veio de uma página do site em que o aviso não é exibido por regra (se houver);
  - **`unknown`** — mantido para eventos históricos e para eventos que não nascem numa página (sincronização de leads do formulário do Meta, webhooks, vendas).
- **Evento de fechamento do aviso:** registro interno de que a pessoa clicou "Entendi", com data e hora, página e sessão.

**Comportamentos:**

- **PageView de página com aviso, em navegador que ainda não fechou o aviso:** chega ao tracking com "aviso exibido".
- **PageView de página com aviso, em navegador que já fechou dentro do período:** chega com "aviso fechado".
- **Evento de conversão (ex.: Lead) e eventos internos do funil enviados depois do "Entendi" na mesma página ou em página seguinte:** chegam com "aviso fechado".
- **Evento de conversão enviado sem que a pessoa tenha clicado "Entendi":** chega com "aviso exibido".
- **Clique em "Entendi":** gera um evento interno de fechamento do aviso, gravado só no tracking próprio, que **não** vai a Meta, GA4 nem CRM e **não** conta como clique de CTA nem como etapa de funil.
- **Evento de fechamento de bot:** segue a mesma regra de bot dos demais eventos internos (marcado como bot, fora das contagens).
- **Navegador sem memória do aviso disponível:** os eventos chegam com "aviso exibido", exceto os enviados na mesma página depois do "Entendi", que chegam com "aviso fechado".
- **Evento que não nasce numa página** (sincronização de leads do Meta, webhooks de venda e de CRM): continua gravado com `unknown`, como hoje.
- **Valor de situação desconhecido ou ausente recebido pelo tracking:** gravado como `unknown`, como hoje; o tracking nunca rejeita um evento por causa desse campo.
- **Eventos antigos:** não são reescritos; o histórico continua `unknown`.
- **Envio a Meta, GA4 e CRM:** idêntico ao de hoje, independentemente da situação do aviso; nenhum parâmetro novo é enviado a eles.
- **Deduplicação e identificadores:** a situação do aviso não altera identificador de evento, sessão nem cookies existentes.

---

### 3. Seção de cookies na Política de Privacidade

**Descrição:** A Política de Privacidade (`/privacy-policy`) ganha uma seção própria de cookies e tecnologias de medição do site, com âncora `#cookies` usada pelo link do aviso, listando cada cookie que o site realmente grava, quem grava, a finalidade em linguagem simples e a duração. A seção 10 atual ("Ferramentas de análise no site") é absorvida ou remetida a essa seção, sem contradição entre as duas. As demais seções da política não mudam nesta feature, exceto a data de "Última atualização".

**Componentes:**

- **Introdução da seção:** o que são cookies, que o site os usa para medir visitas e resultado de anúncios, e que eles são gravados em toda visita (redação honesta, sem sugerir que o aviso bloqueia algo).
- **Tabela de cookies** com as colunas Nome, Quem grava, Finalidade e Duração. Conteúdo mínimo, a ser confirmado no navegador antes de publicar (critério de aceite 14):

| Nome | Quem grava | Finalidade | Duração |
|---|---|---|---|
| `_krob_sid` | Atacado Exponencial | Identificar a visita para medir de onde o visitante veio e quais páginas acessou | 400 dias |
| `_krob_eid` | Atacado Exponencial | Identificador anônimo do navegador usado para medir conversões dos anúncios | 400 dias |
| `_fbp` | Atacado Exponencial, em nome do Meta | Reconhecer o navegador para medir o resultado dos anúncios no Facebook e Instagram | 400 dias |
| `_fbc` | Atacado Exponencial, em nome do Meta | Guardar o clique no anúncio do Meta para atribuir a conversão ao anúncio | 90 dias a partir do clique |
| `_ga` | Google Analytics 4 | Distinguir visitantes para métricas agregadas de visitas e origem de tráfego | até 2 anos |
| `_ga_<código>` | Google Analytics 4 | Manter o estado da sessão para as métricas do GA4 | até 2 anos |
| `_clck` | Microsoft Clarity | Reconhecer o navegador entre visitas para mapas de calor e gravação de sessão | 1 ano |
| `_clsk` | Microsoft Clarity | Juntar as páginas de uma mesma visita na gravação de sessão | 1 dia |
| Cookies do domínio do Clarity/Microsoft (ex.: `CLID`, `MUID`) | Microsoft | Identificar o navegador para o serviço de análise do Clarity | até 1 ano |
| Cookies do YouTube (ex.: `YSC`, `VISITOR_INFO1_LIVE`) | Google/YouTube, só nas páginas com vídeo do YouTube | Reproduzir o vídeo e medir sua exibição | da sessão a ~6 meses |
| Cookies do Panda Video (se houver) | Panda Video, só nas páginas com esse player | Reproduzir o vídeo | conforme o fornecedor |
| Registro do aviso de cookies | Atacado Exponencial | Lembrar que o aviso foi fechado, para não exibi-lo de novo | 12 meses |

- **Outras tecnologias sem cookie:** menção ao envio de eventos de conversão pelo servidor ao Meta e ao Google (mesma finalidade de medição de anúncios) e ao armazenamento local usado pela calculadora e pela página de vendas para continuar o fluxo.
- **Como controlar:** orientação de que cookies podem ser apagados ou bloqueados nas configurações do navegador ou por extensões de privacidade, e que o bloqueio não impede o uso do site; links para as políticas de privacidade do Meta, Google e Microsoft.
- **Data de "Última atualização"** revisada.

**Comportamentos:**

- **Link do aviso:** abre a política posicionada na seção de cookies.
- **Visitante lê a seção de cookies:** encontra todos os cookies gravados no site com nome, quem grava, finalidade e duração, em linguagem simples.
- **Cookie encontrado no navegador e ausente da tabela:** é incluído antes da publicação (a tabela reflete o comportamento real, não uma lista teórica).
- **Cookie da tabela que o site não grava mais:** é removido antes da publicação.
- **Redação sobre controle:** não afirma que o visitante pode recusar os cookies pelo aviso (não pode, nesta versão); indica apenas o navegador e extensões.
- **Seção 10 atual:** não fica contraditória com a nova seção (mesmas ferramentas, mesmas finalidades).
- **Política de Privacidade exibida com o aviso:** o aviso aparece normalmente também nesta página, sem cobrir a tabela de forma a impedir a leitura.
- **Tabela no celular:** legível sem rolagem horizontal da página (a tabela pode rolar dentro do próprio contêiner ou virar lista).

---

## Risco assumido

**O aviso atende apenas parcialmente ao guia orientativo de cookies da ANPD.** Por decisão definitiva da usuária, esta feature é somente informativa:

- **Publicidade sem consentimento prévio.** Os cookies e envios de publicidade/mensuração de anúncios (`_fbp`, `_fbc`, Pixel do Meta, envio de conversões ao Meta e ao Google) continuam acontecendo desde o primeiro carregamento, antes de qualquer interação com o aviso. O guia da ANPD indica consentimento para essa finalidade; o "Entendi" **não** é consentimento, é ciência.
- **Gravação de sessão (Clarity) sem opção de recusa.** Mapa de calor e gravação de sessão também seguem ativos para todos.
- **Sem granularidade.** Não há separação por finalidade nem escolha do visitante.
- **Registro limitado.** O que fica registrado é que o aviso foi exibido ou fechado, não um consentimento válido.
- **Parte atendida.** Transparência (aviso claro, política com lista exata de cookies, finalidade e duração) e registro legível da ciência — e a medição própria pode se apoiar em interesse legítimo.

A usuária está ciente de que isso deixa exposição regulatória (a fiscalização da ANPD sobre cookies está ativa desde 2024–25) e reclamações de titulares. **A evolução para consentimento real** (bloqueio prévio de publicidade e gravação de sessão até o aceite, escolha por finalidade, recusa tão fácil quanto aceitar, revogação e registro de consentimento, e o reflexo disso nos envios a Meta e Google) **é outra spec**, e deve considerar o impacto na atribuição de campanhas antes de ser adotada.

---

## Decisões tomadas

Respondidas pela usuária em 16/09/2026:

1. **Período do aviso fechado: 12 meses.**
2. **O aviso NÃO reaparece quando a seção de cookies da política mudar**; só volta ao vencer os 12 meses.

---

## Fora do escopo

- **Consentimento com bloqueio:** segurar Pixel do Meta, GA4, Clarity, cookies de anúncio ou envios pelo servidor até um aceite; qualquer mudança no que é coletado ou enviado. Fica para outra spec (ver "Risco assumido").
- **Preferências granulares:** central de preferências, escolha por finalidade, botão "Recusar", revogação pelo site.
- **Dashboard interno (`/dash`) e painel de clientes da agência:** não recebem aviso nem mudanças.
- **Envio da situação do aviso a Meta, GA4 ou CRM:** nada muda nos parâmetros enviados.
- **Mostrar a situação do aviso em alguma aba do dashboard:** o dado fica gravado e consultável, mas nenhuma visualização é criada nesta feature.
- **Reescrever o restante da Política de Privacidade** (seções sobre o aplicativo do Meta, direitos, retenção): só a seção de cookies e a data mudam.
- **Checkout da Greenn, Calendly, grupos de WhatsApp e demais páginas fora do domínio.**
- **Trocar incorporações de vídeo por versões sem cookie:** a política apenas descreve o que existe hoje.
- **Reprocessar eventos históricos** para preencher a situação do aviso.

---

## Critérios de aceite verificáveis

1. Num navegador sem histórico, ao abrir a home, uma LP de captação (ex.: `/se-v2`), uma LP de live (`/lives-semanais-v2`), a página de vendas do workshop, uma página de materiais, a calculadora, `/obrigada`, `/privacy-policy` e uma URL inexistente (404), o aviso aparece em todas.
2. `/dash` e o painel de clientes nunca exibem o aviso, com ou sem histórico no navegador.
3. `/links`, `/grupo-da-live`, `/grupo-workshop` e os redirecionamentos legados continuam respondendo com redirecionamento direto, sem página intermediária e sem aviso.
4. Com o aviso aberto, os scripts do Meta, GA4 e Clarity carregam e os cookies `_krob_sid`, `_krob_eid`, `_fbp` (e `_fbc` quando há `fbclid`) são gravados exatamente como antes da feature; depois do "Entendi", nada novo é ligado nem desligado.
5. As requisições enviadas a Meta e GA4 numa visita com o aviso aberto e numa visita com o aviso fechado têm os mesmos parâmetros das enviadas antes da feature.
6. Clicar "Entendi" fecha o aviso na hora; navegar para outra página e recarregar não o mostra de novo; alterando a data gravada para além do período, ele volta a aparecer.
7. Clicar no link "Política de Privacidade" abre `/privacy-policy` na seção de cookies e o aviso continua aparecendo até o "Entendi".
8. Rolar, clicar em CTA e enviar formulário sem tocar no aviso não o fecham.
9. Num celular de 360×640 e num de 390×844, em `/lives-semanais-v2`, `/se-v1` e `/workshop-gratuito-atacado`: a barra fixa de CTA fica visível e tocável com o aviso aberto, o botão principal da primeira dobra não é coberto, a página rola normalmente e o aviso ocupa no máximo ~25% da altura da tela.
10. Em `/aplicacao-mentoria` e `/aplicacao-trafego-atacado` no celular, com o teclado aberto num campo, o campo em foco e o botão de avançar/enviar não ficam cobertos pelo aviso.
11. Com o modal de formulário ou o chat de captura aberto, o modal fica por cima do aviso e o foco permanece no modal.
12. Usando só o teclado: Tab alcança o link e o "Entendi", o anel de foco é visível, Enter/Espaço fecham o aviso, o foco vai para um ponto lógico da página e Tab continua navegando a página sem ficar preso.
13. Com leitor de tela (NVDA no desktop e TalkBack ou VoiceOver no celular), o aviso é anunciado como "Aviso de cookies" e o texto, o link e o botão são lidos corretamente; uma ferramenta de contraste confirma no mínimo 4,5:1 no texto, no link e no botão.
14. Numa visita limpa, a lista de cookies gravados pelo navegador em `/`, `/obrigada` e numa página com vídeo Panda confere, item a item, com a tabela da seção de cookies da política (nome, quem grava e duração); nenhum cookie gravado fica fora da tabela.
15. A seção de cookies da política tem a âncora usada pelo aviso, a data de "Última atualização" foi revisada, a seção 10 não a contradiz e o texto não afirma que o visitante pode recusar cookies pelo aviso.
16. Sobre uma seção clara (bege) e sobre uma seção escura, o aviso mantém fundo escuro, Satoshi, botão primário branco e link bege, legível nos dois casos.
17. No tracking, numa visita nova: o PageView chega com "aviso exibido"; depois do "Entendi", o evento interno de fechamento é gravado e os eventos seguintes (incluindo um Lead de teste) chegam com "aviso fechado"; numa visita seguinte do mesmo navegador, o PageView já chega com "aviso fechado".
18. O evento interno de fechamento do aviso não aparece como enviado a Meta, GA4 ou CRM e não soma no degrau "clicou" do funil de micro-conversões.
19. Leads sincronizados do formulário do Meta e vendas vindas de webhook continuam gravados com `unknown`; eventos anteriores à feature continuam `unknown`.
20. Com o armazenamento do navegador bloqueado, o aviso aparece, "Entendi" o fecha na página atual e nenhuma página apresenta erro ou deixa de funcionar.
21. A métrica de maior elemento visível e o salto de layout medidos na home e em `/se-v2` no celular não pioram de forma perceptível com o aviso em relação à versão sem aviso.
22. A seção "Risco assumido" desta spec está registrada e a usuária confirmou ciência antes da publicação.
