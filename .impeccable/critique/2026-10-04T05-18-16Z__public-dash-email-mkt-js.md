---
target: telas do e-mail próprio no dash
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\marce\\OneDrive\\tracking-avancado\\public\\dash\\email-mkt.js"
target_fingerprint: "sha256:6f2178bfb710fad63e2a9aab795a0cc22d9958bbe8b24b45422726b4271f449c"
target_path: "C:\\Users\\marce\\OneDrive\\tracking-avancado\\public\\dash\\email-mkt.js"
timestamp: 2026-10-04T05-18-16Z
slug: public-dash-email-mkt-js
---
Method: dual-agent (A: revisão de design · B: detector + navegador)

## Nota de saúde do design (Nielsen)

| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Visibilidade do estado | 3 | Cartão selecionado no quadro perde o destaque quando tem problema (`.fx-problema` sobrescreve `.fx-sel`, index.html:964/967) |
| 2 | Linguagem do mundo real | 3 | Slugs de funil ("sessao-estrategica", "lives-semanais-v1") misturados com rótulos; "Transacional (envio.)"; sintaxe `[[Texto \| link]]` exposta |
| 3 | Controle e liberdade | 3 | Quadro tem desfazer; "Descadastrar" é definitivo e a pergunta não avisa |
| 4 | Consistência | 2 | Três formas de aba (pílula, chip, chip com contador); gavetas de larguras diferentes; "renova no dia 1º" × "renova em 01/11"; Visão geral do canal escondida dentro de Campanhas |
| 5 | Prevenção de erros | 3 | Resumo de disparo excelente; fluxo arquivado abre como "Rascunho" com "Publicar" ativo |
| 6 | Reconhecer em vez de lembrar | 3 | Lista de problemas do fluxo não diz qual dos dois cartões "E-mail" é qual |
| 7 | Flexibilidade e eficiência | 3 | Atalhos no quadro (Ctrl+Z/C/V, Shift+clique), mas cartões fora do teclado; sem busca em Campanhas e Modelos |
| 8 | Estética e minimalismo | 3 | 7 filtros zerados em Campanhas vazia; "Ativos 480" e "Total 480" lado a lado; texto de ajuda repetido no vazio |
| 9 | Recuperação de erros | 3 | Mensagens do servidor claras; Configuração diz "Tudo certo" com resposta e rodapé vazios |
| 10 | Ajuda e documentação | 3 | Notas da Agenda › E-mails exemplares; dica do quadro abaixo da dobra |
| **Total** | | **29/40** | **Bom** |

## Veredito de especificidade

**Avaliação de design:** feito para este produto. A linguagem "Etiqueta" (etiquetas com ilhós, carimbos tracejados, fio forte acima dos blocos) é a mesma do resto do dash, e os textos explicam consequência em português claro ("A lista é recalculada na hora do envio: quem entrar até lá também recebe"). Os trechos genéricos são a fileira de 7 filtros, os cartões com "—" e a Configuração como pilha de formulários.

**Detector:** 89 achados no `index.html` (o detector não lê HTML montado dentro dos `.js`, então as telas do e-mail foram checadas no navegador). O que pesa de verdade: **50 casos de contraste baixo** da cor `--apagado` (#8b857c) sobre o papel, 3,0 a 3,2:1 (o mínimo é 4,5:1), em 17 regras `em-`/`fx-`/`ag-` do e-mail; e **textos de 9 a 10,6 px** (`.fx-nums span` 9,3px, `.fx-ou`, `.fx-cabeca`, `.em-numeros span`, cabeçalhos de tabela). As duas avaliações chegaram ao mesmo problema de contraste por caminhos independentes. Falsos positivos: paleta creme e réguas listradas (escolhas da direção Etiqueta), Arial na prévia do e-mail (imita fonte de cliente de e-mail), alertas de escala de fonte e raio (consultivos).

**Overlay no navegador:** não disponível. O script do detector não carregou na página no ar (o navegador não deixa um site https acessar localhost); no lugar, foram feitas checagens objetivas por tela: 0 erros de console, nenhum botão sem nome, imagens com alt, e os pontos abaixo.

## Impressão geral

A base é boa: o momento mais arriscado (disparar campanha) é tratado com cuidado, e os textos ensinam enquanto a pessoa usa. O maior problema é de **leitura**: o texto auxiliar, que é justamente onde moram os avisos importantes, está apagado demais e pequeno demais. A maior oportunidade é **o quadro dos fluxos**, que hoje abre com cartões sobrepostos e passa a impressão de coisa quebrada logo na primeira olhada.

## O que funciona

1. **O resumo antes de disparar**: número grande, quem fica de fora e por quê, aviso de contatos sem nome, limite do mês, botão com o número ("Disparar para N pessoas") e confirmação com foco em "Não".
2. **O editor de modelo**: prévia realista com remetente e linha de pré-visualização, dados de exemplo ("Oi, Ana!"), computador e celular, campos que entram com um clique.
3. **O montador de segmento**: contagem ao vivo, amostra real e o lembrete "combinadas com e" no cabeçalho.

## Problemas prioritários

**[P1] Texto auxiliar ilegível (contraste e tamanho)**
- **Por que importa:** os avisos que evitam erro ("as respostas dos leads se perdem", "a lista é recalculada", "Não dá para desfazer") estão em `.mini` #8b857c a 11,5px, 3,2:1. Os números dos cartões do fluxo ficam em 9,3px. Para mostrar ao cliente num projetor ou numa tela compartilhada, some.
- **Correção:** texto que traz consequência passa para `--tinta-2` (#4f4b45); `--apagado` fica só para metadado (data, contagem). Piso de 11px para rótulos (`.fx-nums span`, `.fx-ou`, `.fx-cabeca`, `th`).
- **Comando:** /impeccable audit (ou colorize + typeset)

**[P1] Quadro dos fluxos: cartões sobrepostos e seleção invisível**
- **Por que importa:** o primeiro e-mail nasce em cima do cartão de Início (medido: 4px de diferença), escondendo o gatilho. E o cartão com problema perde o destaque de selecionado, então o painel lateral abre sem mostrar qual cartão está sendo editado.
- **Correção:** nunca criar cartão sobre outro (e organizar sozinho ao abrir quando houver sobreposição); seleção com outro sinal (contorno duplo por fora do vermelho); cartões com `tabindex=0`, `role="button"` e nome acessível com tipo e problema.
- **Comando:** /impeccable layout, depois harden

**[P2] Estados que dizem a coisa errada**
- **Fluxo arquivado** abre como "Rascunho" com "Publicar" ativo. Correção: carimbo "Arquivado" e "Tirar do arquivo" no lugar de "Publicar".
- **Configuração** diz "Tudo certo" com o endereço de resposta e o rodapé vazios. Correção: "Funcionando, com 2 pendências" e as pendências em lista.
- **Nova campanha** abre com o seletor de modelo vazio (só existem modelos transacionais) e "Revisar e disparar" clicável. Correção: estado vazio "Ainda não há modelo de marketing. Criar modelo".
- **Descadastrar** não avisa que é definitivo. Correção: "Descadastrar? Só a própria pessoa volta, preenchendo um formulário."
- **Comando:** /impeccable clarify

**[P2] Consistência e arquitetura**
- Três formas de aba e larguras de gaveta diferentes; "Visão geral do canal" escondida dentro de Campanhas (o título muda para "Resultados do e-mail" mas a barra lateral segue marcando Campanhas); funis aparecem como slug; "Ativos 480" e "Total 480" repetem o número; 7 filtros zerados em Campanhas vazia.
- **Correção:** um padrão de aba só; gavetas em duas larguras (simples e larga); rótulo humano do funil em todo lugar; esconder filtros com zero quando a lista está vazia; Visão geral como item próprio.
- **Comando:** /impeccable polish (ou distill para os filtros)

**[P2] Celular**
- As subseções de E-mail viram uma faixa horizontal cortada ("Instagra…"), a tabela de Contatos corta E-mail e Situação, e os três cartões ocupam ~500px antes da lista.
- **Correção:** subseções em lista ou seletor no celular; tabela vira lista de cartões; números em linha compacta.
- **Comando:** /impeccable adapt

## Sinais de alerta por persona

**Alex (usuário avançado):** sem busca nem ordenação em Campanhas e Modelos; cartões do quadro fora do teclado; três botões "Salvar" separados na Configuração; os 7 filtros não se recolhem.

**Sam (acessibilidade):** contraste do texto auxiliar reprova em todas as telas (3,0 a 3,24:1); colunas ordenáveis (`th.ordenavel`) recebem foco mas não anunciam que ordenam nem a ordem atual (sem `role`/`aria-sort`); a única marcação de título nas telas é o h1; links de e-mail nas linhas de Contatos e Modelos com 20px de altura; a seleção do cartão no quadro depende só da borda, e essa borda some.

**Marcelle (opera sozinha e mostra ao Felipe):** "Teste Mah" e "Teste da equipe" aparecem como tipo e reunião reais; e-mails de leads em lista aberta numa tela compartilhada (LGPD); o quadro com cartões sobrepostos parece quebrado; o relatório com "—" em tudo, antes da primeira campanha, não impressiona.

## Observações menores

- Link direto `#mkt-email?v=...`: uma vez, depois de fechar a gaveta, ir para Modelos voltou para Campanhas. Vale investigar.
- Lista de Fluxos: colunas numéricas vazias em vez de "0"; cabeçalho "Clique" colado em "Editado".
- "mais 0 fora do marketing": com zero, omitir a frase.
- Remetente aparece como texto bruto truncado num campo só de leitura que parece editável.
- "Conectar resultados" aparece mesmo com os dois canais já conectados.
- Agenda › E-mails: "Mandar teste" desalinhado nas linhas que têm o "×".
- Detalhe do agendamento: "Nenhum e-mail programado" sem dizer por quê (reunião marcada antes da função existir).
- O vazio de Segmentos promete "campanha que abriram", mas essa condição só aparece depois da primeira campanha enviada.

## Perguntas para pensar

1. Se o disparo é o momento mais arriscado da semana, ele não merece uma tela própria com a prévia do e-mail e os nomes dos segmentos, em vez de um anexo no pé de um formulário?
2. O quadro dos fluxos precisa funcionar no celular, ou o celular deveria só mostrar números e situação, deixando a edição para o notebook?
3. O que o Felipe deve sentir ao ver esta tela: controle da operação ou resultado? Hoje o resultado do canal está escondido dentro de Campanhas.
