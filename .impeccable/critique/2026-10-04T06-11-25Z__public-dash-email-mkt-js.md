---
target: telas do e-mail próprio no dash (2ª rodada)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\marce\\OneDrive\\tracking-avancado\\public\\dash\\email-mkt.js"
target_fingerprint: "sha256:adfcbc9df8892f0ae69af4a3fa49c34f8948c9e1f459dcb00971b854bedde99d"
target_path: "C:\\Users\\marce\\OneDrive\\tracking-avancado\\public\\dash\\email-mkt.js"
timestamp: 2026-10-04T06-11-25Z
slug: public-dash-email-mkt-js
---
Method: dual-agent (A: revisão de design · B: detector + navegador)

## Nota de saúde do design (Nielsen)

| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Visibilidade do estado | 3 | Uso do mês não bate: Resultados mostra "E-mails enviados 0" ao lado da régua "1 de 10.000"; "renova no dia 1º" × "renova em 01/11" |
| 2 | Linguagem do mundo real | 3 | Funis já com nome de leitura; mas `{{data_reuniao}}` cru na coluna Assunto de Modelos e a coluna Nome repete o e-mail nos 480 contatos |
| 3 | Controle e liberdade | 2 | Gravação imediata sem desfazer: chave "Marketing liberado", chaves e select de modelo da Agenda › E-mails, "Adicionar lembrete…" cria ao escolher |
| 4 | Consistência | 2 | Três jeitos de salvar (automático no quadro, imediato na Agenda › E-mails, 4 botões na Configuração); filtros ora pílula, ora botão |
| 5 | Prevenção de erros | 2 | REGRESSÃO: abrir um fluxo com cartões sobrepostos organiza e GRAVA; fluxo arquivado segue editável; "Conectar de novo" sem confirmação |
| 6 | Reconhecer em vez de lembrar | 3 | Pendências da Configuração em parágrafo, sem link para os campos que ficam abaixo da dobra |
| 7 | Flexibilidade e eficiência | 2 | Contatos de 50 em 50, sem lote; ligar cartões só arrastando (`.fx-porta` 13px, sem teclado) |
| 8 | Estética e minimalismo | 3 | Contatos abre com 480 / 480 / 0; coluna Situação toda "Ativo" verde |
| 9 | Recuperação de erros | 3 | Problemas do fluxo explicados e com link; "Rodapé vazio: preencha em Configuração" não é link |
| 10 | Ajuda e documentação | 3 | Ajuda no lugar é boa; dica do quadro abaixo da dobra em 1440x900 |
| **Total** | | **26/40** | **Aceitável (no limite de Bom)** |

## Veredito de especificidade

Avaliação de design: feito para este produto. Régua do limite com projeção, resumo do disparo com quem fica de fora, confirmação na linha e a frase "Funcionando, com 2 pendências" não existem num Mailchimp genérico. O trecho mais genérico é o quadro de fluxos (padrão ManyChat/n8n, que o próprio texto vazio cita).

Detector: 38 achados no index.html (eram 89). Nenhum em regras `fx-` e `ag-`; em `em-` só tamanhos fora da escala (`.em-andamento__num`, `.em-resumo__grande`, `.em-rel-cabeca h2`) e Arial da prévia do e-mail (proposital). O contraste do texto apagado passou: 5,34:1 (antes 3,2:1). Menor fonte medida: 11px. Novos achados objetivos: selo verde `.carimbo.alta` 3,15:1 e selo âmbar `.selo-estado` 3,49:1 a ~11px; na Configuração, a tabela "Últimos testes" (1048px, overflow visible) faz a página rolar de lado no celular; aria-sort só em parte das tabelas (Fluxos 2/8, Modelos 2/5, Agenda › E-mails 0/5); checkboxes de 38x22; várias telas sem h2/h3. Falsos positivos: paleta creme, réguas listradas, Arial e Consolas.

Overlay: não disponível. Script injetável na página, mas o carregamento de localhost a partir de https foi bloqueado em silêncio (proteção de rede local do Chrome).

## Impressão geral

Os problemas da primeira rodada foram quase todos resolvidos: contraste do texto auxiliar, piso de 11px, quadro sem sobreposição e com teclado, Resultados como item próprio, funil com nome, celular dos Contatos, testes escondidos. A nota cai de 29 para 26 porque esta rodada foi mais exigente com gravações e achou uma regressão introduzida pela própria correção: organizar o quadro ao abrir grava no banco. O tema que sobra é confiança: olhar não pode mudar nada, e o que muda produção precisa de confirmação ou desfazer.

## O que funciona

1. Disparo em três tempos: revisar, resumo com quem fica de fora, confirmação com o número exato; botão desabilitado quando há bloqueio.
2. Quadro acessível: cartões com role, tabindex e aria-label que inclui os problemas; faixa "Para publicar, falta resolver" leva ao cartão.
3. Textos que ensinam o comportamento do sistema, sem travessão.

## Problemas prioritários

**[P1] Abrir um fluxo grava sozinho; arquivado continua editável**
- Por que importa: abrindo para olhar, a avaliação gravou novas posições no fluxo arquivado de teste. Num fluxo no ar, criaria "Mudanças não publicadas" sem ninguém mexer.
- Correção: organizar só na tela, sem salvar, ou trocar por aviso "Cartões sobrepostos. [Organizar]"; arquivado em modo leitura (barra desabilitada, sem autosave).
- Comando: /impeccable harden

**[P1] Ações que mudam produção com um clique**
- "Conectar de novo" (aponta os retornos do Postmark para o endereço atual; na prévia tira da produção) e a chave "Marketing liberado" sem confirmação.
- Correção: confirmação com o efeito escrito e o endereço que vai receber.
- Comando: /impeccable harden

**[P2] Gravação imediata na Agenda › E-mails e salvar disperso na Configuração**
- Select de modelo e chave gravam na hora, sem desfazer; "Adicionar lembrete…" cria ao escolher; 4 botões de salvar na Configuração.
- Correção: aviso com "Desfazer" depois da troca; botão "+ Lembrete"; um "Salvar alterações" só ativo com mudança.
- Comando: /impeccable clarify

**[P2] Nome igual ao e-mail**
- 480 contatos com o e-mail na coluna Nome; `{{primeiro_nome}}` sairia "Oi, tatilima2512@hotmail.com!" e o aviso de "sem nome" do disparo não pega.
- Correção: no servidor, nome igual ao e-mail conta como sem nome; tela mostra "(sem nome)". (Nomes reais chegam do ClickUp depois do merge.)
- Comando: /impeccable harden

**[P2] Contraste dos selos e celular da Configuração**
- Verde #2f9a5d 3,15:1 e âmbar #b7791f 3,49:1 em texto de 11px; tabela "Últimos testes" estoura a página no celular; aria-sort incompleto; checkboxes 38x22.
- Correção: texto do selo em verde/âmbar escuros (borda pode manter); tabela com rolagem interna; aria-sort em todo cabeçalho ordenável.
- Comando: /impeccable audit

## Sinais de alerta por persona

**Alex:** Contatos de 50 em 50 sem lote; ligar cartões só arrastando; sem busca em Modelos; a barra da Agenda muda de lugar entre abas.
**Sam:** selos abaixo de 4,5:1; aria-sort faltando; "Ver fluxos em uso" com aria-pressed contraditório; `.fx-porta` sem teclado; no celular, chave e "Mandar teste" da Agenda › E-mails só aparecem rolando a tabela.
**Marcelle:** "Teste Mah" ainda aparece (precisa ser marcado como teste no cadastro); carimbo âmbar de pendências visível ao cliente; nomes que são e-mails; link "Resultados" roxo de visitado.

## Observações menores

- "E-mails enviados 0 (sem os testes)" ao lado de "1 de 10.000": dizer que o 1 é transacional/teste.
- Vazio de Segmentos promete "campanha que abriram", que só aparece depois da primeira campanha.
- "Descadastrar" é a única ação no rodapé da gaveta do contato.
- Gavetas ocultas de outras telas ficam no DOM.
- No celular, abas de tipo da Agenda › E-mails ocupam 5 linhas; quadro abre a 55% com alvos de 7–13px.
- Configuração abre com "Carregando…" em texto em vez de esqueleto.

## Perguntas para pensar

1. Se olhar um fluxo pode mudá-lo, a Marcelle vai confiar em "Mudanças não publicadas" num fluxo no ar?
2. "Marketing liberado" deveria ser chave na tela ou o servidor deveria saber pela Postmark se o canal está aprovado?
3. Agenda › E-mails: uma tabela com os tipos como linhas mostraria as diferenças de uma vez, em vez de seis botões?
