# Spec: Relatório semanal do Argo

## Visão Geral

**O que faz.** Toda semana, o Argo entrega um relatório sobre a conta de anúncios do Atacado Exponencial: o que foi feito na conta (ações do Argo, aprovações e recusas da gestora, pausas manuais, vereditos), o que aconteceu com os resultados por funil, como isso se compara com o histórico e com as metas, como estão os testes em andamento e quais testes valeria a pena fazer em seguida.

**Para quem.** A gestora (Marcelle). O relatório fica na aba Argo do dash e um aviso curto chega no Slack.

**Qual problema resolve.** Hoje as peças existem separadas: a aba Argo mostra propostas e vereditos um a um, o dash mostra métricas por funil, as metas ficam em outra tela, e ninguém junta isso numa leitura da semana. A análise semanal genérica de clientes não conhece o Argo, os funis nem os testes. O resultado é que a gestora monta essa leitura de cabeça, e o aprendizado de um teste não fica registrado em lugar nenhum.

**Onde entra a IA, e onde não entra.** Uma IA escreve a análise e propõe testes. Ela **só escreve**: não pausa, não mexe em orçamento, não cria nada na conta. Agir na conta continua sendo das réguas do Argo, com aprovação da gestora e as travas que já existem. Os números do relatório são sempre calculados por código. A IA interpreta números prontos, nunca faz conta.

**Princípios que valem para a feature inteira:**

- **Número vem de cálculo, não da IA.** Todo número que aparece no relatório foi calculado a partir das fontes. A IA só pode citar números que recebeu.
- **Toda afirmação tem fonte.** Cada frase da análise aponta os fatos em que se apoia, e a gestora consegue ver de onde veio cada número.
- **Dado faltando é dito, não preenchido.** Se uma fonte falhou, o relatório diz qual e o que ficou sem análise. Nunca aparece zero no lugar de "indisponível".
- **Texto não verificado não é publicado.** A análise escrita passa por uma checagem automática antes de aparecer. Se não passar, o relatório sai só com a parte calculada e o aviso.
- **Fato separado de leitura.** O relatório deixa visível o que é dado e o que é interpretação ou sugestão da IA.
- **Contexto velho é avisado.** Quando o contexto do negócio está sem revisão há tempo demais, o relatório avisa que está trabalhando com ele.
- **Sugestão não é ação.** Teste proposto é texto. Nada do que o relatório sugere vira ação na conta sem passar pelo caminho que já existe.

---

## Páginas / Módulos

### 1. Contexto do negócio (o que só a gestora sabe)

**Descrição:** Uma seção da aba Argo onde a gestora mantém, em itens curtos, o momento do negócio: o que é prioridade agora, a oferta vigente, eventos que afetam a conta, o que não deve ser mexido. É a parte do contexto que nenhum sistema sabe sozinho. Cada item tem data de revisão, para o relatório saber se pode confiar nele.

**Componentes:**
- **Lista de itens de contexto:** cada item tem título, texto curto, tipo, funil relacionado (opcional), data da última revisão e situação (`em dia` ou `revisar`).
- **Tipos de item:** `prioridade` (ex.: "SE é o funil principal em outubro"), `oferta` (ex.: "workshop pago a R$ 47"), `evento` (ex.: "workshop ao vivo em 07/10", com data de início e fim), `restrição` (ex.: "não mexer na campanha de remarketing até o fim do mês"), `observação` (texto livre).
- **Indicador de validade:** cada item mostra há quantos dias foi revisado. Passado o prazo de validade, aparece como `revisar`.
- **Formulário de item:** título, texto, tipo, funil (opcional), datas (só para `evento`) e prazo de validade (padrão de 30 dias).
- **Quadro "o que o relatório já sabe sozinho":** lista das fontes que o relatório lê sem ninguém escrever (resultados por funil e anúncio, metas, funis e páginas ativos, testes A/B de página, propostas, aprovações e recusas, vereditos, pausas manuais, relatórios e reações anteriores), com a regra prática: vai no contexto o que explica um número e não está em nenhum sistema.

**Comportamentos:**
- **Criar item de contexto:** a gestora preenche o formulário e o item entra na lista como `em dia`.
- **Editar item:** a gestora altera o texto ou o tipo, e a data de revisão passa a ser hoje.
- **Marcar como revisado sem mudar:** um botão confirma que o item continua valendo e renova a data de revisão.
- **Arquivar item:** o item sai do contexto usado pelo relatório, mas continua no histórico, com a data em que foi arquivado.
- **Ver itens arquivados:** um filtro mostra os itens que já saíram do contexto.
- **Item vencido:** um item que passou do prazo de validade aparece como `revisar`, e o próximo relatório lista esse item no aviso de contexto velho.
- **Evento terminado:** um item do tipo `evento` cuja data de fim já passou sai sozinho do contexto atual. A semana em que ele aconteceu continua marcada como atípica no histórico.
- **Contexto vazio:** sem nenhum item ativo, o relatório é gerado mesmo assim e avisa que está sem contexto do negócio.
- **Ver o que o relatório já sabe:** ao preencher o contexto, a gestora consulta o quadro para não repetir o que os sistemas já informam.

---

### 2. Registro de testes (a memória do que já foi testado)

**Descrição:** Uma seção da aba Argo com todos os testes da conta e do funil, dos quatro tipos: criativo, público ou conjunto, página e oferta ou funil. Cada teste guarda a hipótese, o que mudou, como se mede e o que se aprendeu. É o que permite ao relatório dizer "isso já foi testado e perdeu" ou "esse teste já pode ser lido".

**Componentes:**
- **Lista de testes:** nome, tipo, funil, situação (`planejado`, `rodando`, `pronto para ler`, `concluído`, `abandonado`), data de início, dias rodando e resultado (quando concluído).
- **Ficha do teste:** hipótese ("acreditamos que X porque Y"), o que mudou (variante contra controle), onde está na conta ou no site (anúncios, conjuntos ou páginas envolvidos), métrica principal, critério de sucesso, duração mínima, amostra mínima, resultado, aprendizado em texto e origem (`gestora` ou `sugerido pelo relatório`).
- **Indicador de leitura:** para testes `rodando`, mostra se o teste já tem duração e amostra mínimas para ser lido, e quanto falta.
- **Filtros:** por tipo, funil, situação e período.

**Comportamentos:**
- **Registrar teste:** a gestora cria um teste preenchendo a ficha, e ele entra como `planejado` ou `rodando`.
- **Ligar teste a anúncios, conjuntos ou páginas:** a gestora escolhe da lista o que pertence a cada lado do teste, para o relatório saber de onde tirar os números.
- **Ligar teste de página ao A/B que já existe:** um teste do tipo página pode apontar para um teste A/B já cadastrado no dash e usar os números dele.
- **Iniciar teste:** um teste `planejado` passa a `rodando` e a data de início é registrada.
- **Teste fica pronto para ler:** quando atinge duração e amostra mínimas, o teste passa sozinho a `pronto para ler` e entra em destaque no próximo relatório.
- **Concluir teste:** a gestora registra o resultado (`variante ganhou`, `controle ganhou`, `empate`, `inconclusivo`) e o aprendizado em texto.
- **Abandonar teste:** a gestora encerra o teste sem resultado, com o motivo.
- **Editar teste:** a gestora corrige a ficha. Mudar a hipótese, a métrica ou o critério depois do início fica registrado no histórico do teste, com a data.
- **Procurar no registro:** a gestora digita um termo e acha testes pelo nome, hipótese ou aprendizado.
- **Transformar sugestão em teste:** a partir de um teste proposto no relatório (módulo 5), um botão cria um teste `planejado` com a ficha já preenchida, e a origem fica `sugerido pelo relatório`.
- **Anúncio novo sem teste:** quando aparece um anúncio novo na conta que não está ligado a nenhum teste, o relatório pergunta se ele faz parte de um teste, em vez de supor.

---

### 3. Pacote de fatos da semana (o que o relatório sabe)

**Descrição:** Toda semana, antes de qualquer análise escrita, o sistema junta e calcula tudo o que o relatório pode usar. Cada fato recebe uma etiqueta para ser citado. Esse pacote é a única coisa que a IA enxerga. Não tem tela própria: aparece no relatório (módulo 4) e pode ser aberto por inteiro.

**Componentes:**
- **Semana do relatório:** os 7 dias anteriores ao dia da geração, sem contar o dia atual (segunda a domingo da semana que passou).
- **Resultados por funil:** gasto, leads, MQLs, CPL, custo por MQL e vendas, quando houver, de cada funil ativo.
- **Comparações:** cada resultado ao lado da semana anterior, da média das 4 semanas anteriores e da meta do funil no período, quando houver meta.
- **Resultados por anúncio e conjunto:** os mesmos números por anúncio e conjunto, com a taxa de junção entre anúncio e lead daquela semana.
- **O que foi feito na conta:** propostas do Argo na semana (aprovadas, recusadas, pendentes, com o motivo da recusa quando houver), ações executadas, ações desfeitas, pausas manuais e vereditos que saíram na semana (acertou, errou, inconclusivo).
- **Testes:** situação de cada teste ativo, números de cada lado e o indicador de leitura.
- **Contexto do negócio:** os itens ativos do módulo 1, com os vencidos marcados.
- **Marcas da semana:** eventos que tornam a semana atípica (workshop, feriado, mudança grande de verba) e o aviso de comparação com semana atípica.
- **Leituras prontas do código:** para cada variação importante, o código já informa se ela veio de mudança de preço ou de mudança de mix entre funis, e se a amostra é suficiente para concluir.
- **Comentários da gestora no relatório anterior** (módulo 6).
- **Fontes com problema:** lista das fontes que falharam ou vieram incompletas, e o que ficou de fora por causa delas.
- **Etiqueta de fato:** cada número e cada informação do pacote tem uma etiqueta única que a análise usa para citar.

**Comportamentos:**
- **Montar o pacote:** toda segunda às 07h o pacote da semana anterior é montado automaticamente.
- **Fonte indisponível:** se uma fonte não responde, os fatos dela entram como `indisponível` com o motivo, e o resto do pacote é montado normalmente.
- **Funil sem meta:** a comparação com meta aparece como `sem meta cadastrada`, nunca como zero.
- **Funil sem gasto na semana:** o funil aparece com a indicação `sem gasto na semana` e não entra nas comparações de custo.
- **Amostra pequena:** uma variação calculada abaixo das réguas de piso que o Argo já usa (leads e impressões) é marcada como `amostra insuficiente`, e a análise não pode tirar conclusão dela.
- **Semana atípica:** uma semana com evento do contexto, ou com gasto total 30% ou mais acima ou abaixo da média das 4 semanas anteriores, é marcada como atípica, e as comparações com ela levam o aviso.
- **Separar preço de mix:** quando o CPL geral muda, o pacote informa quanto da mudança veio de cada funil ter ficado mais caro ou mais barato e quanto veio da verba ter mudado de funil.
- **Abrir o pacote inteiro:** no relatório, a gestora pode abrir a lista completa de fatos com as etiquetas.

---

### 4. Relatório da semana (a leitura na aba Argo)

**Descrição:** A página do relatório na aba Argo do dash. Junta a parte calculada (sempre presente) e a análise escrita (presente quando passa na checagem). A gestora lê, confere a origem dos números e comenta.

**Componentes:**
- **Cabeçalho:** semana do relatório, data de geração, situação da análise (`verificada`, `parcial` ou `não passou na checagem`) e avisos (contexto velho, fontes com problema, semana atípica).
- **Resumo da semana:** três a cinco frases com o que mais importa, escritas pela IA e com citação.
- **Painel por funil:** os números de cada funil com as comparações do módulo 3 e um sinal de melhor, pior ou estável frente à meta e ao histórico.
- **O que foi feito na conta:** lista das ações da semana, agrupadas por tipo, com o veredito quando já houver, e o total de propostas aprovadas e recusadas.
- **Leitura das ações:** análise escrita sobre o efeito das ações da semana, citando os vereditos.
- **Testes:** os testes em andamento, os que ficaram prontos para ler e os concluídos na semana, cada um com a leitura da IA.
- **Testes propostos:** até 3 sugestões de teste (módulo 5).
- **Pontos de atenção:** o que a IA viu e as réguas não pegam (ex.: custo subindo em todos os conjuntos ao mesmo tempo), sempre com citação.
- **Citações:** cada afirmação da análise traz as etiquetas dos fatos em que se apoia. Passar o mouse ou tocar numa etiqueta mostra o fato.
- **Marca de fato e leitura:** os números calculados e o texto interpretativo têm aparência diferente, para nunca serem confundidos.
- **Histórico de relatórios:** lista das semanas anteriores, com a situação da análise de cada uma.

**Comportamentos:**
- **Abrir o relatório da semana:** a gestora entra na aba Argo e vê o relatório mais recente.
- **Ver de onde veio um número:** tocar numa etiqueta mostra o fato com a fonte.
- **Abrir o pacote de fatos:** um link abre o pacote inteiro da semana (módulo 3).
- **Abrir um relatório antigo:** a gestora escolhe uma semana no histórico e vê o relatório como foi publicado.
- **Comparar duas semanas:** a gestora escolhe duas semanas do histórico e vê os painéis por funil lado a lado.
- **Ir para uma ação:** cada ação da lista leva à proposta correspondente na aba Argo.
- **Ir para um teste:** cada teste leva à ficha dele no registro (módulo 2).
- **Relatório sem análise escrita:** quando a análise não passou na checagem, o relatório mostra só a parte calculada e o aviso, sem nenhum texto da IA.
- **Gerar de novo:** um botão refaz o relatório da semana (pacote, análise e checagem). A versão anterior fica guardada e marcada como substituída.
- **Aviso no Slack:** quando o relatório fica pronto, chega no canal dos monitores uma mensagem curta com a situação da análise, até 3 destaques e o link para a aba.
- **Semana sem relatório:** se a geração falhar por completo, o aviso no Slack diz que falhou e por quê, e a aba mostra a semana como `falhou`.

---

### 5. Testes propostos (sugestão da IA)

**Descrição:** Dentro do relatório, a IA sugere até 3 testes para as próximas semanas, apoiados no que aconteceu, no contexto do negócio e no registro de testes. Cada sugestão vem num formato fixo e completo. É só texto: nada é criado na conta.

**Componentes:**
- **Ficha da sugestão:** tipo (criativo, público ou conjunto, página, oferta ou funil), funil, hipótese, o que mudar, métrica principal, critério de sucesso, duração e amostra mínimas estimadas, por que agora (com citação) e testes parecidos já feitos (com link para o registro).

**Comportamentos:**
- **Receber sugestões:** cada relatório verificado traz de zero a 3 testes propostos.
- **Não repetir teste já feito:** uma sugestão parecida com um teste já concluído só aparece se disser o que muda em relação a ele e por que o resultado poderia ser diferente agora.
- **Respeitar o contexto:** uma sugestão nunca contraria uma `restrição` ativa do contexto do negócio.
- **Sem sugestão:** quando não há base para sugerir, o relatório diz isso em vez de inventar um teste.
- **Aceitar sugestão:** a gestora transforma a sugestão em teste `planejado` no registro (módulo 2).
- **Descartar sugestão:** a gestora descarta com um motivo curto, e o motivo entra no pacote da semana seguinte para a IA não insistir.

---

### 6. Comentários da gestora (a análise aprendendo)

**Descrição:** A gestora pode reagir a cada parte da análise escrita. Essas reações entram no relatório da semana seguinte e viram a medida de qualidade do relatório ao longo do tempo.

**Componentes:**
- **Reação por trecho:** em cada bloco da análise (resumo, leitura das ações, cada teste, cada ponto de atenção, cada sugestão), as opções `útil`, `óbvio` e `errado`, e um campo de comentário.
- **Painel de qualidade:** por semana, quantos trechos foram marcados como útil, óbvio e errado, e a tendência das últimas semanas.

**Comportamentos:**
- **Marcar trecho como útil:** registra que aquele tipo de leitura vale a pena.
- **Marcar trecho como óbvio:** registra que aquilo não acrescentou nada.
- **Marcar trecho como errado:** exige um comentário curto dizendo o que está errado.
- **Comentar sem marcar:** a gestora escreve um comentário livre num trecho.
- **Comentário vira contexto:** os comentários e marcações da semana entram no pacote da semana seguinte. A análise seguinte não repete uma leitura marcada como errada sem tratar do comentário.
- **Ver a qualidade ao longo do tempo:** o painel mostra se a proporção de trechos errados e óbvios está caindo ou subindo.
- **Transformar comentário em item de contexto:** a partir de um comentário, um botão cria um item no contexto do negócio (módulo 1) já preenchido com o texto.

---

### 7. Checagem da análise (os guardrails)

**Descrição:** A barreira entre o que a IA escreveu e o que a gestora vê. Toda análise escrita é conferida automaticamente contra o pacote de fatos antes de ser publicada. A checagem não depende de a IA obedecer às instruções: ela confere o resultado.

**Componentes:**
- **Regras da checagem:**
  - **Números:** todo número no texto existe no pacote de fatos, dentro da tolerância de arredondamento.
  - **Citações:** toda etiqueta citada existe no pacote, e toda afirmação sobre resultado tem pelo menos uma citação.
  - **Formato:** a análise tem as seções esperadas, e cada teste proposto tem todos os campos da ficha.
  - **Amostra:** nenhuma conclusão (ex.: "venceu", "é melhor", "piorou por causa de") se apoia em fato marcado `amostra insuficiente`.
  - **Leitura antecipada:** nenhum teste é declarado vencedor antes de estar `pronto para ler`.
  - **Causa sem veredito:** a análise não atribui uma melhora ou piora a uma ação do Argo sem citar o veredito dessa ação.
  - **Semana atípica:** comparações com semana atípica mencionam o aviso.
  - **Fonte indisponível:** a análise não afirma nada sobre um dado `indisponível`.
  - **Restrição:** nenhuma sugestão contraria uma `restrição` ativa.
- **Resultado da checagem:** `passou` ou `reprovou`, com a lista de violações (regra, trecho e motivo).
- **Registro de checagens:** para cada relatório, quantas tentativas houve, as violações de cada uma e o resultado final.

**Comportamentos:**
- **Checar antes de publicar:** toda análise escrita passa pela checagem antes de aparecer no relatório.
- **Corrigir uma vez:** se a checagem reprovar, a IA recebe a lista de violações e escreve de novo. A nova versão passa pela checagem inteira.
- **Reprovar de novo:** se a segunda tentativa também reprovar, o relatório é publicado só com a parte calculada, com a situação `não passou na checagem`.
- **Publicar parcial:** quando as violações ficam em blocos isolados (ex.: só uma sugestão de teste), o relatório publica os blocos aprovados, remove os reprovados e mostra a situação `parcial`, dizendo o que foi removido.
- **Ver por que reprovou:** na aba, a gestora abre o registro de checagem do relatório e vê cada violação.
- **Testar mudança na análise:** antes de mudar as instruções da IA ou o modelo usado, a mudança é rodada nos pacotes das semanas anteriores, e o resultado mostra quantas análises passariam na checagem e quantos trechos que a gestora marcou como errado se repetiriam. A mudança só entra se não piorar.

---

## Fora do escopo desta spec

- **Base de conhecimento do método (RAG).** O relatório não depende dela. Decidido em 04/10: a base é mais útil para produção de conteúdo. Se um dia existir, entra como mais uma fonte do pacote de fatos.
- **Testes propostos virando ação na conta ou tarefa no ClickUp.** Por enquanto a sugestão é só texto e, se aceita, vira teste `planejado` no registro.
- **Relatório para outras contas ou clientes da agência.** Só a conta do Atacado Exponencial.
- **IA agindo na conta.** Pausas, orçamento e realocação continuam com as réguas do Argo, a aprovação da gestora e as travas atuais.
- **Envio por e-mail.**

## Decisões tomadas (04/10)

1. **Onde:** relatório na aba Argo do dash, com um aviso curto no Slack.
2. **Testes cobertos:** criativos, públicos e conjuntos, páginas (A/B do site) e oferta e funil.
3. **Testes propostos:** só texto, para a gestora decidir.
4. **Contexto em três camadas:** dados que os sistemas já têm (automáticos), contexto do negócio mantido pela gestora com prazo de validade, e o registro de testes com os comentários dela como memória.
5. **Base de conhecimento (RAG) fora:** o relatório não depende dela.
6. **Guardrails de veracidade:** números só do código, citação obrigatória, checagem automática depois da escrita, uma nova tentativa e, se falhar, publicar só a parte calculada.
7. **Dia e hora:** toda segunda às 07h, cobrindo os 7 dias anteriores sem contar o dia atual (segunda a domingo da semana que passou).
8. **Quem lê:** só a gestora.
9. **Amostra e duração mínimas dos testes:** partem das mesmas réguas que o Argo já usa (piso de lead e de impressões).
10. **Semana atípica por verba:** variação de 30% ou mais no gasto total frente à média das 4 semanas anteriores.
11. **Quem escreve a análise (05/10):** o próprio Argo (perfil gestor-ia do Hermes), sem chave de API separada. O tracking prepara o pacote e deixa um pedido; o job do Argo na VPS escreve e devolve; a checagem continua no tracking e vale para qualquer modelo.
