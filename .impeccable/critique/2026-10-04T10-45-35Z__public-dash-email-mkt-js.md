---
target: telas do e-mail próprio no dash (3ª rodada)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\marce\\OneDrive\\tracking-avancado\\public\\dash\\email-mkt.js"
target_fingerprint: "sha256:a6de197eaf943cd79e41410532945896f732742c4b7b17aafba9fdf8bcf0a70f"
target_path: "C:\\Users\\marce\\OneDrive\\tracking-avancado\\public\\dash\\email-mkt.js"
timestamp: 2026-10-04T10-45-35Z
slug: public-dash-email-mkt-js
---
Method: dual-agent (A: revisão de design · B: detector + navegador, contextos isolados e gravações bloqueadas)

## Nota de saúde do design (Nielsen)

| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Visibilidade do estado | 3 | Fluxo arquivado aparece "Rascunho" na lista e "Arquivado" no quadro |
| 2 | Linguagem do mundo real | 3 | Slug cru: "Virou lead (aplicacao-mentoria)" na lista de fluxos, "Comercial · sessao-estrategica" em Tipos |
| 3 | Controle e liberdade | 3 | "Novo fluxo" grava "Fluxo sem nome" no clique; "Revisar e disparar" salva rascunho calado |
| 4 | Consistência | 2 | Links azuis do navegador, rádios nativos e fieldset com caixa na gaveta de campanha; título "Agenda" em Tipos; ícone do Instagram no item Marketing |
| 5 | Prevenção de erros | 3 | "Revisar e disparar" ativo sem modelo/segmento; teste antes do disparo só como conselho |
| 6 | Reconhecer em vez de lembrar | 2 | Corpo do modelo em monoespaçado com sintaxe para decorar; "Mandar teste" não diz para quem |
| 7 | Flexibilidade e eficiência | 2 | Contatos de 50 em 50, sem lote/exportar; atalhos do quadro escondidos num rodapé |
| 8 | Estética e minimalismo | 3 | "sem nome" em todas as linhas; Ativos 481 = Total 481 |
| 9 | Recuperação de erros | 3 | Pendências e "falta resolver" exemplares; faixa da Configuração ilegível no celular |
| 10 | Ajuda e documentação | 3 | Ajuda no lugar certo, às vezes demais (5 regras sempre abertas na Agenda › E-mails) |
| **Total** | | **27/40** | **Aceitável (no limite de Bom)** |

## Veredito de especificidade

Feito para este produto: vocabulário da operação dela, Etiqueta aplicada, disparo e diagnóstico que nenhum SaaS genérico teria. O que destoa são vazamentos do navegador (link azul, rádio nativo, fieldset) e estados que se contradizem entre lista e detalhe.

Detector: CLI com 38 achados, nenhum em regras fx-/ag-; em em- só tamanhos fora da escala e Arial proposital. Overlay injetado pela primeira vez (script buscado pelo Node e injetado como conteúdo): contraste 4,2:1 no quadro ("Sem modelo" e "Nenhum modelo escolhido." em --queda; --queda-texto resolve), h2 da Configuração sem respiro acima, linhas longas (96–197 caracteres) em notas, sombra larga com borda fina em menus. Medidas: 0 erros de console, 0 gravações ao abrir qualquer vista ou o fluxo arquivado, sem rolagem lateral no celular, selos a 5,5:1, menor fonte 11px, aria-sort só nos ordenáveis (correto). Novos: #agenda sem h2; no celular os 4 ícones do seletor de apps ficam sem nome acessível; gaveta do cartão Início no arquivado ainda faz 2 POST "estimar" (leitura). Falsos positivos: creme, réguas, Arial, Consolas, recorte do canvas.

## Impressão geral

Os dois pacotes resolveram o que pesava (gravação ao abrir, contraste, legibilidade, celular dos Contatos). O que sobra é acabamento de sistema (elementos nativos do navegador, um bloco quebrado no celular, nomes diferentes para a mesma coisa) e dois fluxos que ainda deixam avançar sem pré-requisito.

## O que funciona

1. Disparo seguro: resumo com quem fica de fora, aviso de sem nome, limite, confirmação na linha.
2. Diagnóstico acionável: pendências da Configuração e "Para publicar, falta resolver" com link.
3. Textos que antecipam a dúvida real do domínio.

## Problemas prioritários

**[P1] Faixa de situação da Configuração quebra no celular** — texto vira coluna de ~70px. Correção: abaixo de 900px, faixa em coluna, min-width 0 no texto. (/impeccable adapt)

**[P1] Vazamentos do navegador** — links rgb(0,0,238) ("Resultados", "Criar modelo de marketing", "configuração de e-mail"), rádios azuis em "Quando enviar", fieldset com borda em "Segmentos". Correção: link na tinta com sublinhado em fio; accent-color tinta ou pílulas; fieldset sem borda e legend como rótulo. (/impeccable polish)

**[P2] Mesmo objeto, nomes diferentes** — arquivado "Rascunho" na lista; slug do funil na lista de fluxos e em Tipos; vista Tipos com título "Agenda". Correção: carimbo Arquivado com prioridade; nomeFunil também nesses lugares; título acompanha a barra. (/impeccable clarify)

**[P2] Nova campanha deixa avançar sem pré-requisito** — botão ativo sem modelo/segmento; teste não cobrado. Correção: passos com estado e botão desabilitado com motivo; linha "Último teste" ou alerta âmbar no resumo. (/impeccable harden)

**[P2] Quadro: vermelho demais e abaixo do contraste** — "Sem modelo" em --queda 4,2:1; rascunho incompleto lido como falha. Correção: --queda-texto no texto, ou âmbar para "incompleto". Rótulo "Enter abre para editar" no modo leitura vira "Enter abre para ver". (/impeccable colorize)

**[P3] Editor de modelo e Agenda › E-mails** — monoespaçado com sintaxe; "Mandar teste" e "Ligado" repetidos sem nome da linha. Correção: corpo em Satoshi com botões que inserem marcação; aria-label com o nome da linha e "vai para <e-mail>". (/impeccable typeset, clarify)

## Sinais por persona

**Alex:** sem lote/exportar em Contatos; atalhos do quadro escondidos; "Novo fluxo" cria lixo no banco.
**Sam:** "Mandar teste" ×5 e "Ligado" ×5 sem contexto; ligar cartões só arrastando; ícones do seletor de apps sem nome no celular; #agenda sem h2.
**Marcelle:** e-mails reais em lista cheia ao mostrar ao Felipe; "Teste Mah" sem marca de teste; régua com "renova no dia 1º" × "renova em 01/11".

## Observações menores

- Gaveta do contato: título repete o e-mail quando não há nome; "Fechar" como primário divide opiniões (A preferia sem primário).
- Faixa escura do topo no celular muda de altura entre vistas (227px em Campanhas).
- Tipos de reunião: DURAÇÃO e LINK colados.
- Ligação solta do canto do quadro até o Início depois de um clique (reproduzir).
- Botão "N" de negrito no editor sem sentido para quem não conhece.
- .aviso.alerta usa #8a5a12 fixo em vez de --alerta-texto.

## Perguntas para pensar

1. "O e-mail está de pé e o que saiu ontem?" deveria ser uma linha na Visão geral?
2. Teste antes do disparo é regra ou conselho? Se regra, o servidor cobra.
3. Contatos precisa mostrar 481 endereços completos por padrão numa tela projetada ao cliente?
