# Spec: Redesign do dash na direção "Etiqueta"

> Decisões da usuária em 30/09/2026: direção **A "Etiqueta"** escolhida entre três
> mockups (https://claude.ai/artifact/D53wRnsubqBz7quVzJDueM); alcance **só o dash**
> (painel de clientes e site ficam como estão); migração **tudo de uma vez, por
> entregas**: o dash só vai ao ar claro quando as 19 abas estiverem prontas, nada
> de aba clara convivendo com aba escura em produção.
>
> Contrato de direção (tese, mundo próprio, primeira dobra): `.impeccable/surfaces/public-dash-index-html.md`.
> Verdade do produto: `PRODUCT.md`. Entrou no ar em 30/09/2026 (issues 344–355); arquivada.

## Visão Geral

O dash de tracking (`public/dash/index.html`) é o painel interno que a Marcelle abre todo dia para decidir investimento, cobrar a equipe e conferir integrações. O visual atual (carvão, cards de grafite, bege nos gráficos) foi julgado fraco. Este projeto troca o mundo visual inteiro pela direção "Etiqueta": o painel lido como um **catálogo de atacado**. Papel claro levemente quente como fundo, tinta preta, fios finos entre linhas e um fio forte acima de cada bloco. Cada número vive numa **etiqueta pendurada** (cartão branco com furo e ilhós no topo, sombra curta). A tabela é uma **grade de tamanhos** (cabeçalho em caixa alta espaçada, linhas separadas por fio). O delta contra o período anterior é um **carimbo** (moldura fina, levemente inclinado, verde para alta, coral para queda, cinza tracejado para neutro). A **barra lateral fica carvão com texto bege**, a assinatura da marca dentro do papel; o item ativo inverte (bege com texto carvão).

O que **não muda**: nenhum dado, cálculo, chamada ao backend, filtro, texto ou fluxo. Todas as 19 abas continuam fazendo exatamente o que fazem. Muda só o que se vê. Fica de fora: painel de clientes (`painel/`), site e LPs, tela de acesso além do necessário para ficar coerente.

Regras transversais que valem em todos os módulos:
- Cor semântica só para estado: verde (alta, ok), coral (queda, falha), âmbar (aviso acionável), azul (informação). Nunca decoração.
- Alta e queda sempre levam sinal (▲ ▼) além da cor.
- Todo número comparável usa algarismos tabulares e alinha à direita em tabela.
- Sem cantos grandes, sem gradiente, sem vidro, sem sombra além da sombra curta da etiqueta.
- Foco de teclado visível em todo controle, no tom da tinta.
- Quem pede menos movimento não recebe animação nenhuma.
- Abaixo de 900px a barra lateral vira faixa horizontal rolável, colunas viram uma, tabelas rolam dentro do próprio contêiner e a página nunca rola de lado.

## Páginas / Módulos

### Módulo 0: Fundação visual (tokens e componentes)

**Descrição:** o sistema que todas as abas herdam. Nada aqui é visível sozinho; ele entra junto com a Visão geral na primeira entrega e sustenta as demais.

**Componentes:**
- Paleta: papel (fundo), etiqueta (branco quente), tinta, tinta secundária, apagado, fio, fio forte, carvão, bege, taupe, alta, queda, informação, alerta.
- Tipografia: Satoshi 400 e 700, escala fixa (título de aba 1.6rem, manchete 1.45rem, valor de etiqueta-herói 2.9rem, valor de etiqueta 2.2rem, corpo 14px, tabela 0.86rem, rótulo 0.66rem em caixa alta com espaçamento 0.14em).
- Barra lateral: carvão, logo branco, "TRACKING INTERNO" em taupe, quatro grupos (Resultados, Operação, Diagnóstico, Marketing) com rótulo em taupe caixa alta e fio translúcido entre grupos; item em bege translúcido, hover mais claro, ativo bege sólido com texto carvão em negrito.
- Topo da aba: título grande à esquerda com subtítulo apagado (período, comparação, "atualizado há X"), filtros à direita; fio forte de 2px embaixo separando do conteúdo.
- Campos de formulário (select, input de texto, data, senha, e-mail, textarea): fundo etiqueta, contorno na tinta, canto de 2px; select com seta própria desenhada, não a do navegador.
- Botões: primário tinta com texto papel; secundário etiqueta com contorno tinta; perigo com contorno coral e texto coral; desabilitado apagado. Mesma altura dos campos.
- Etiqueta (KPI): cartão branco com furo e ilhós centralizado no topo, rótulo "REF." em caixa alta apagada, valor grande, rodapé com fio tracejado contendo carimbo de delta à esquerda e nota à direita. Variante herói com valor maior. Hover sobe 2px e alonga a sombra. Valor sem dado mostra "—" com a nota do motivo.
- Carimbo: moldura de 1.5px na cor do estado, texto em negrito espaçado, inclinado 2 graus; neutro sem inclinação e tracejado.
- Bloco de conteúdo: título de 0.95rem com fio forte de 2px em cima e complemento apagado à direita; sem caixa, sem fundo.
- Tabela-grade: cabeçalho caixa alta apagada com fio forte embaixo, linhas com fio fino, hover em tinta a 3%, primeira coluna em negrito quando é o nome do item, colunas numéricas à direita; cabeçalho ordenável mostra a seta de ordenação.
- Barra horizontal de proporção dentro de célula (leads por funil, funil de micro-conversões): traço na tinta, altura 6px.
- Régua de metas: trilho com marcas a cada 10%, preenchido na tinta até o feito, traço coral marcando a projeção, legenda apagada embaixo.
- Chips de filtro aplicado: pílula tinta com texto papel; pílula de aba (tab-pill) contorno fio com texto apagado, ativa tinta com texto papel.
- Avisos: `explica` em papel mais escuro com texto secundário; `alerta` com fio âmbar à esquerda de 1px e texto âmbar escuro; `falha` com texto coral.
- Selos em linha (ex.: "form Meta", estado de integração): pílula com contorno fio e texto azul escuro; variantes `ar`, `pago`, `parcial`.
- Modal: véu de tinta a 40%, caixa em etiqueta com fio forte no topo, título, botão fechar, corpo rolável.
- Tooltip do gráfico: etiqueta pequena com sombra curta, texto tinta.
- Gráfico de linha: linha na tinta, área em degradê da tinta a 16% até zero, grade em fio, rótulos apagados de 11px, ponto com halo no último valor e o valor escrito acima, cursor tracejado; segunda série em coral sem área; barras (funil, evolução) na tinta com variante apagada e negativa em coral.
- Estados: carregando (esqueleto em fio piscando devagar), vazio (frase que ensina o que apareceria ali), erro (aviso falha com o motivo e botão de tentar de novo), aba que falhou inteira mantém o topo e mostra o erro no lugar do conteúdo.
- Tela de acesso: papel, etiqueta centralizada com logo, campo de chave, botão primário, erro em coral.
- Marca "Dados de exemplo": não existe em produção; era só dos mockups.

**Comportamentos:**
- A usuária vê o foco do teclado em qualquer controle ao navegar com Tab.
- A usuária passa o mouse numa etiqueta e ela sobe levemente.
- A usuária passa o mouse numa linha de tabela e a linha escurece de leve.
- A usuária com "reduzir movimento" ativo não vê nenhuma transição.
- A usuária abre o dash no celular e vê a barra lateral como faixa horizontal rolável com os grupos separados por fio vertical.
- A usuária redimensiona a janela e nada rola de lado; tabelas largas rolam dentro do bloco.
- A usuária abre uma aba enquanto carrega e vê esqueletos no lugar dos números, nunca os números do período anterior.
- A usuária vê "—" e o motivo quando um número não tem base para ser calculado.

### Módulo 1: Visão geral

**Descrição:** primeira aba, responde "como estamos" num olhar. É a entrega que valida a direção.

**Componentes:**
- Manchete: frase do período em 1.45rem, tinta secundária com os números em tinta.
- Três etiquetas-herói: Leads, Conversão geral, CPL (com nota "todos os canais"), com carimbo de delta.
- Régua de metas do mês corrente (uma por funil com meta), entre dois fios, com feito, percentual e projeção; segue a regra de hoje de não obedecer ao filtro de período.
- Quatro etiquetas: Novos visitantes, Investimento Meta (delta neutro), Receita, ROAS.
- Duas colunas (3/5 e 2/5): bloco "Leads por dia" com o gráfico de linha; bloco "Leads por funil" em tabela-grade com barra de proporção e carimbo.
- Bloco "Conversão por LP" em tabela-grade com as seis primeiras páginas.

**Comportamentos:**
- A usuária troca o funil no filtro e todos os blocos recarregam com esqueleto.
- A usuária troca o período e a manchete reescreve a frase com o novo "quando".
- A usuária escolhe "Personalizado…" e os dois campos de data aparecem ao lado do select.
- A usuária passa o mouse no gráfico e vê o cursor tracejado com o tooltip do dia.
- A usuária clica no cabeçalho de uma coluna da tabela e ordena por ela.
- A usuária clica numa linha de "Conversão por LP" e vai para a aba Leads com aquela LP aberta (comportamento atual preservado).
- A usuária vê "—" no ROAS quando não há venda atribuída, com a nota do motivo.

### Módulo 2: Leads

**Descrição:** detalhe dos leads do período: metas com projeção, CRM, origens, estágio, funis, materiais, conversão por LP com funil de micro-conversões e a lista dos leads recentes com detalhe em modal.

**Componentes:**
- Bloco de metas detalhado: uma régua por funil, indicador dentro/perto/fora em carimbo, histórico em `details` com marcador próprio.
- Bloco CRM: pílulas de aba (novos × retornando), chips de filtro, etiquetas de contagem; sub-blocos "Por origem" e "Estágio atual no CRM" em tabela-grade.
- Leads por funil e Materiais mais baixados: etiquetas em grade.
- Conversão por LP: tabela-grade; ao clicar numa linha abre abaixo o funil de micro-conversões por página (título com o caminho em mono, tabela com barra de proporção, maior queda destacada em coral, aviso e nota).
- Leads recentes: tabela-grade com selos ("form Meta"), status de envio Meta/GA4 (✓ apagado, ✕ coral), paginação em botões secundários.
- Modal de detalhe do lead: cabeçalho com nome e origem, corpo com os campos e a jornada do lead (linha do tempo).

**Comportamentos:**
- A usuária alterna entre novos e retornando nas pílulas do CRM.
- A usuária clica num chip para remover um filtro aplicado.
- A usuária clica numa linha de conversão e o funil daquela página abre embaixo; clica de novo e fecha.
- A usuária clica num lead e o modal abre com foco preso dentro; Esc ou o botão fecha.
- A usuária pagina a lista de leads recentes.
- A usuária abre o histórico de metas e vê as alterações anteriores.

### Módulo 3: Vendas

**Descrição:** receita por dia, produtos e compras registradas.

**Componentes:**
- Etiquetas de receita bruta, líquida e quantidade.
- Bloco "Receita por dia" com gráfico de linha.
- Blocos "Produtos" e "Compras registradas" em tabela-grade.
- Modal de detalhe da compra.

**Comportamentos:**
- A usuária clica numa compra e vê o detalhe no modal.
- A usuária ordena a tabela de produtos por qualquer coluna.

### Módulo 4: Greenn

**Descrição:** receita e ROAS do produto pago, com campanhas e vendas; não segue o filtro de datas (regra atual).

**Componentes:**
- Aviso `explica` sobre o período fixo; aviso `alerta` quando o sync falhou.
- Etiquetas de receita, vendas, investimento e ROAS.
- Blocos "Campanhas" e "Vendas" em tabela-grade, com selo `pago`/`parcial`.

**Comportamentos:**
- A usuária ordena campanhas por retorno.
- A usuária clica numa venda e vê o detalhe.

### Módulo 5: Atribuição

**Descrição:** quebra dos leads por UTM.

**Componentes:**
- Pílulas de dimensão (source, medium, campaign, content) e chips.
- Bloco "Quebra por UTM" em tabela-grade com barra de proporção.

**Comportamentos:**
- A usuária troca a dimensão nas pílulas e a tabela recarrega.
- A usuária clica num valor e ele vira chip de filtro.

### Módulo 6: Meta Ads

**Descrição:** CPL por funil, por canal, cruzamento e campanhas sincronizadas.

**Componentes:**
- Aviso `explica` (denominador inclui todos os canais).
- Etiquetas de investimento, leads pagos, CPL pago.
- Blocos "CPL por funil", "CPL por canal", "Funil × canal", "Campanhas" em tabela-grade; nota de sync no complemento do título.

**Comportamentos:**
- A usuária ordena qualquer tabela por coluna.
- A usuária vê o aviso de sync atrasado em âmbar quando a última sincronização passou do prazo.

### Módulo 7: Email

**Descrição:** campanhas de e-mail do GoHighLevel.

**Componentes:**
- Etiquetas de envios, entregas e taxa.
- Bloco "Campanhas de email" em tabela-grade, nota de sync no título.

**Comportamentos:**
- A usuária ordena as campanhas por envio ou entrega.

### Módulo 8: Workshops

**Descrição:** lista de workshops, detalhe com presença e presentes.

**Componentes:**
- Bloco "Workshops" em tabela-grade com taxa de presença em carimbo.
- Bloco "Detalhe" (aparece ao escolher um) com etiquetas de inscritos, presentes e taxa; sub-bloco "Presentes" em tabela.

**Comportamentos:**
- A usuária clica num workshop e o bloco de detalhe aparece abaixo com o título dele.
- A usuária fecha o detalhe pelo botão secundário.

### Módulo 9: Grupos

**Descrição:** conexão do WhatsApp, grupos monitorados, conversão no Meta e eventos de entrada/saída.

**Componentes:**
- Bloco "Conexão do WhatsApp" com etiqueta de estado (selo ok/falha) e nota.
- Bloco "Grupos monitorados": lista de grupos com chave liga/desliga (trilho no estilo da tinta), busca, aviso quando nenhum é monitorado.
- Bloco "Conversão no Meta" com etiquetas de enviados, aceitos e falhas.
- Bloco "Eventos recentes" em tabela-grade (entrou/saiu com sinal, não só cor).

**Comportamentos:**
- A usuária liga ou desliga o monitoramento de um grupo pela chave.
- A usuária busca um grupo pelo nome na lista.
- A usuária vê o estado da conexão como selo colorido com texto.

### Módulo 10: Disparos

**Descrição:** compor um disparo com mídia, ver a semana agendada e o que já foi.

**Componentes:**
- Bloco "Compor": campos (grupo, texto, horário), área de soltar arquivo com contorno tracejado que acende na tinta ao arrastar por cima, prévia em balão de WhatsApp (balão em etiqueta com hora), botões primário e secundário.
- Bloco "Semana": grade de sete dias, dia de hoje marcado com fio forte, itens agendados como etiquetas pequenas; item que falhou em coral.
- Bloco "Já foram": tabela-grade com estado.

**Comportamentos:**
- A usuária arrasta um arquivo para a área e vê a borda acender.
- A usuária vê a prévia do texto em balão antes de agendar.
- A usuária clica num dia da semana e vê os itens daquele dia.
- A usuária cancela um disparo agendado com confirmação na própria linha (sem diálogo do navegador).

### Módulo 11: Links

**Descrição:** redirecionador com destinos agendados.

**Componentes:**
- Bloco "No ar agora" com etiquetas por link (destino atual, desde quando).
- Bloco "Destinos" em tabela-grade com selo `ar` no vigente.
- Bloco "Novo destino"/"Editar destino": formulário em campos alinhados, botões primário, secundário e perigo.

**Comportamentos:**
- A usuária cria um destino e ele aparece na tabela sem recarregar.
- A usuária edita um destino e o título do bloco muda para "Editar destino".
- A usuária apaga um destino com confirmação na própria linha.

### Módulo 12: Bloqueios

**Descrição:** leads bloqueados como falsos e devolução ao CRM.

**Componentes:**
- Bloco "Leads bloqueados" em tabela-grade com motivo em selo e botão secundário "Devolver ao CRM".

**Comportamentos:**
- A usuária devolve um lead ao CRM e a linha some com aviso de sucesso.
- A usuária vê o estado vazio ensinando o que aparece ali.

### Módulo 13: Funis do relatório

**Descrição:** cadastro dos funis e das metas mensais.

**Componentes:**
- Bloco "Funis cadastrados" em tabela-grade com chave de ativo e ordem.
- Bloco "Novo funil"/"Editar funil" em formulário.
- Bloco "Metas mensais": um formulário por funil, campos com erro em coral abaixo, funil bloqueado apagado, avisos e histórico.

**Comportamentos:**
- A usuária cadastra um funil e ele entra na lista.
- A usuária salva a meta de um funil e vê a confirmação.
- A usuária tenta salvar meta inválida e vê o erro embaixo do campo.

### Módulo 14: Testes A/B

**Descrição:** testes de páginas em andamento e cadastro de novo teste.

**Componentes:**
- Bloco "Testes em andamento": um sub-bloco por teste com tabela de variantes (visitas, formulários, leads, conversão) e veredito em carimbo.
- Bloco "Novo teste" em formulário.

**Comportamentos:**
- A usuária cadastra um teste com as duas páginas.
- A usuária encerra um teste escolhendo a vencedora na própria linha (sem prompt do navegador).

### Módulo 15: Jornada

**Descrição:** busca da jornada de um lead.

**Componentes:**
- Bloco "Buscar jornada de um lead" com campo e botão primário.
- Resultado: etiqueta do lead e linha do tempo vertical (ponto na tinta, fio, hora apagada, evento).

**Comportamentos:**
- A usuária busca por e-mail ou telefone e vê a linha do tempo.
- A usuária vê o estado vazio quando nada foi encontrado.

### Módulo 16: Eventos

**Descrição:** saúde da captura e eventos recentes.

**Componentes:**
- Bloco "Saúde da captura" em etiquetas.
- Bloco "Eventos recentes" em tabela-grade com payload em mono num `details`.

**Comportamentos:**
- A usuária abre o payload de um evento.
- A usuária filtra por tipo de evento nas pílulas.

### Módulo 17: Saúde das integrações

**Descrição:** aceitação do Meta, reenvios, credenciais e alertas.

**Componentes:**
- Faixa de estado no topo (saudável, atenção, incidente) como etiqueta larga com selo de estado e frase.
- Blocos "Aceitação por tipo de evento", "Pendentes de reenvio", "Falhas definitivas", "Credenciais", "Horário das integrações", "Últimas rodadas de reenvio", "Alertas enviados" em tabela-grade.
- Bloco "Evolução diária" com gráfico de duas séries e legenda.
- Bloco "Captura de identificadores de clique" em etiquetas.
- Filtros e ações (reenviar agora) em botões.

**Comportamentos:**
- A usuária vê a faixa de estado mudar de cor e texto conforme a saúde.
- A usuária dispara um reenvio manual e vê a rodada entrar na tabela.
- A usuária passa o mouse na evolução e vê as duas séries no tooltip.

### Módulo 18: Argo

**Descrição:** o operador de conta: placar, propostas, regras, rodadas e histórico.

**Componentes:**
- Faixa de estado do Argo (ativo, observando, parado) com selo e chamada.
- Vistas em pílulas (propostas, regras, histórico) com contador.
- Placar: grupos de etiquetas por período com aviso.
- Propostas: cartões-etiqueta com alvo, ação, motivo (cortado com "ver tudo"), prazo, botões aprovar/rejeitar com confirmação em linha, campo "por quê" ao rejeitar.
- Regras: linhas com chave liga/desliga, entrada numérica com unidade, seletor segmentado (observar/executar), erro em coral.
- Rodadas: lista em `details` com ações, resultado em selo (ok, falha, info, desconhecido), tabela antes × depois, veredito em carimbo.
- Histórico em cartões.

**Comportamentos:**
- A usuária aprova ou rejeita uma proposta com confirmação na própria linha.
- A usuária liga ou desliga uma regra e vê o estado salvo.
- A usuária alterna entre observar e executar no seletor segmentado.
- A usuária abre uma rodada e vê antes × depois.
- A usuária filtra propostas por tipo nas pílulas.

### Módulo 19: Instagram

**Descrição:** métricas do perfil, posts, reels, stories e público.

**Componentes:**
- Cabeça com vistas em pílulas, filtros de período e nota da última coleta com selo ok.
- Etiquetas de seguidores com variação e trio de números.
- Bloco "Evolução diária" com gráfico.
- Bloco "Desempenho por formato": cartões-etiqueta por formato, líder marcado com fio forte.
- Bloco "Ranking de posts e reels" em tabela-grade com miniatura.
- Bloco "Stories do período": grade de miniaturas com dados embaixo.
- Bloco "Quando os seguidores estão online": mapa de calor em células na tinta com legenda.
- Demografia: barras horizontais (idade, gênero, cidades, países) na tinta.

**Comportamentos:**
- A usuária troca a vista (perfil, conteúdo, público) nas pílulas.
- A usuária passa o mouse numa célula do mapa de calor e vê o valor.
- A usuária clica numa miniatura e abre o post no Instagram em outra aba.

### Módulo 20: Documentação e encerramento

**Descrição:** o que fecha o projeto depois que a última aba está pronta.

**Componentes:**
- `DESIGN.md` reescrito a partir do que foi construído (tokens, componentes, regras nomeadas), com a regra "Noite Sempre" substituída pela regra do papel e a nota de que painel e site continuam no mundo escuro até nova decisão.
- Revisão de acabamento nas 19 abas, desktop e celular, antes de ir ao ar.
- Esta spec movida para `docs/specs-arquivadas/`.

**Comportamentos:**
- A usuária abre qualquer aba no ar e vê o mesmo vocabulário de componentes que viu na Visão geral.
- A usuária lê o `DESIGN.md` e encontra exatamente o que está no ar, sem regra antiga.
