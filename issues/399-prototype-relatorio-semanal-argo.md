# 399: Protótipo do relatório semanal na aba Argo

**Tipo:** Protótipo
**Página:** Aba Argo › Relatório da semana (spec `spec-relatorio-semanal-argo.md`, módulos 4, 5, 6 e a parte visível do 7)

## Descrição

Desenhar no dash, no estilo "Etiqueta", a página do relatório com dados de exemplo: cabeçalho com a situação da análise (verificada, parcial, não passou na checagem) e os avisos (contexto velho, fontes com problema, semana atípica); resumo; painel por funil com semana anterior, média de 4 semanas e meta; o que foi feito na conta; leitura das ações; testes; até 3 testes propostos com a ficha completa e os botões aceitar e descartar; pontos de atenção; etiquetas de citação que mostram o fato ao tocar; diferença visual entre fato e leitura; reações útil, óbvio e errado com comentário em cada trecho; painel de qualidade; registro de checagem com as violações; pacote de fatos aberto; histórico de semanas e comparação de duas semanas.

## Pronto quando

Na prévia, ela navega por um relatório de exemplo em cada uma das três situações (verificada, parcial, não passou), toca nas etiquetas, abre o pacote, reage a trechos, compara duas semanas, no computador e no celular, e aprova o desenho. Nada é salvo nem gerado (selo "Protótipo").

## Cenários

### Happy Path
1. Ela abre a aba Argo e vê uma terceira pílula, **Relatório**, ao lado de Controle e Propostas. O endereço passa a `#argo?v=relatorio` e recarregar mantém a vista.
2. No topo aparece a faixa "Protótipo · Dados de exemplo. Nada aqui é salvo nem gerado." com o seletor **Ver estado**: Verificada, Parcial, Não passou na checagem, Primeira semana (sem histórico) e Fontes com problema.
3. Em **Verificada** ela vê, de cima para baixo:
   - cabeçalho (semana 28/09 a 04/10, gerado segunda 07h, situação "verificada", avisos de contexto velho e de semana atípica);
   - resumo da semana;
   - painel por funil (SE, workshop pago, workshop gratuito, aplicação): gasto, leads, MQLs, CPL e custo por MQL, cada um com semana anterior, média de 4 semanas e meta, e o sinal de melhor, pior ou estável;
   - o que foi feito na conta, agrupado por tipo, com o veredito e o link "ver proposta";
   - leitura das ações;
   - testes (rodando, pronto para ler, concluído na semana);
   - até 3 testes propostos com a ficha completa e os botões **Virar teste** e **Descartar**;
   - pontos de atenção;
   - painel de qualidade das últimas semanas.
4. O texto escrito pela IA tem aparência própria (fio lateral e rótulo "Leitura do Argo"). Os números calculados ficam na tipografia tabular dos cartões do dash. Os dois nunca se confundem.
5. Cada citação aparece como etiqueta pequena (`F12`). Passar o mouse ou tocar abre um balão com o fato: nome, valor, período e fonte. No celular o balão vira uma folha embaixo da tela.
6. **Ver pacote de fatos** abre um painel lateral (folha inteira no celular) com todos os fatos agrupados (resultados, ações, testes, contexto, marcas da semana, fontes) e uma busca por etiqueta ou nome.
7. Em cada bloco da leitura ela marca **Útil**, **Óbvio** ou **Errado**. "Errado" abre o campo de comentário obrigatório. Há também um comentário livre e **Virar item de contexto**. A marcação muda na tela e um aviso confirma que é só exemplo.
8. **Descartar** numa sugestão pede o motivo. **Virar teste** mostra o aviso "no sistema de verdade isto cria um teste planejado no registro".
9. **Histórico** lista 6 semanas de exemplo com a situação de cada uma; uma delas aparece como "substituída" e outra como "falhou". Abrir uma semana mostra aquele relatório.
10. **Comparar semanas** deixa escolher duas semanas e mostra os painéis por funil lado a lado, com a diferença.
11. **Registro de checagem** mostra as tentativas e as violações (regra, trecho, motivo).

### Edge Cases
- **Parcial:** um bloco removido (uma sugestão de teste com número inventado) aparece como faixa "Removido pela checagem: ..." no lugar do bloco. O registro de checagem mostra a violação.
- **Não passou na checagem:** nenhum texto da IA aparece. O cabeçalho explica, o resto do relatório (painel, ações, testes com números) continua, e o registro mostra as duas tentativas reprovadas.
- **Primeira semana:** sem histórico, as colunas "média de 4 semanas" mostram "sem histórico ainda" e o painel de qualidade fica vazio com uma explicação.
- **Fontes com problema:** o funil afetado mostra "indisponível" em vez do número, e o aviso no topo diz qual fonte falhou e o que ficou sem análise.
- **Funil sem meta:** a coluna meta mostra "sem meta cadastrada".
- **Amostra insuficiente:** o número aparece com a marca "amostra pequena" e o balão do fato explica.
- **Sem testes propostos:** o bloco diz "Sem base para sugerir teste nesta semana" em vez de sumir.
- **Celular (390 px):** o painel por funil vira um cartão por funil, sem rolagem lateral na página. As comparações ficam empilhadas.
- **Comparar a mesma semana com ela mesma:** o botão de comparar fica desabilitado até as duas escolhas serem diferentes.

### Cenário de Erro
É protótipo, não há chamada ao servidor. O estado "Fontes com problema" mostra como o relatório se comporta quando uma fonte falha. Nenhum botão tenta gravar: cada ação mostra só o aviso "Protótipo: nada foi salvo".

## Banco de Dados

Não se aplica (protótipo só de front, com dados de exemplo no navegador).

## Arquivos

- **Criar:** `public/dash/argo-relatorio.js`: o protótipo inteiro, em módulo isolado como os do e-mail. Contém os dados de exemplo determinísticos (4 funis, 6 semanas, ações, vereditos, testes, sugestões, fatos com etiqueta, registro de checagem), o seletor de estado, o desenho de cada bloco, o balão de citação, o painel do pacote de fatos, o histórico, a comparação de semanas e as reações. Expõe só `window.ArgoRelatorio = { abrir(raiz) }`.
- **Modificar:** `public/dash/index.html`:
  - pílula **Relatório** em `.argo-vistas` e um `<div id="argo-vista-relatorio" hidden>`;
  - `mostrarVistaArgo`, `trocarVistaArgo`, `escreverUrl` e a leitura do hash passam a aceitar `relatorio` (hoje só conhecem `controle` e `propostas`);
  - ao abrir a vista, chama `ArgoRelatorio.abrir($('#argo-vista-relatorio'))`;
  - `<script src="/dash/argo-relatorio.js">` junto dos outros;
  - CSS novo com prefixo `ar-` (livre hoje), usando os tokens do `:root` (`--papel`, `--etiqueta`, `--tinta`, `--apagado`, `--fio`, `--alta`, `--queda`, `--alerta`) e as regras de 390 px.

**Reaproveitar:**
- `esc`, `$` e `avisar`: os globais do `index.html`, já usados pelos módulos do e-mail.
- A faixa do protótipo, copiando o padrão `seloProto` + `ligarCenario` de `public/dash/email-mkt.js` (linhas 50 a 75) e as classes `.em-proto`, `.em-proto__selo` e `.em-proto__cen`, já no CSS. As classes são reaproveitadas, sem duplicar o CSS.
- O gerador determinístico `aleatorio(semente)` do mesmo arquivo, como padrão para os números de exemplo.
- As pílulas `.tipo-pill` e o padrão de vista no hash (`#argo?v=...`) que a aba já usa.
- Os visuais `.argo-grupo-titulo`, `.argo-acao` e o carimbo de veredito da vista Controle, para a lista "o que foi feito na conta" ter a mesma cara do registro.

## Dependências Externas

Nenhuma.

## Checklist

- [x] Pílula "Relatório" na aba Argo, com `#argo?v=relatorio` funcionando ao trocar e ao recarregar
- [x] Faixa "Protótipo" com o seletor dos 5 estados
- [x] Dados de exemplo determinísticos: 4 funis, 6 semanas, ações com vereditos, 3 testes, 3 sugestões, fatos com etiqueta, registro de checagem
- [x] Cabeçalho com situação e avisos
- [x] Resumo, leitura das ações, testes, pontos de atenção com etiquetas de citação
- [x] Painel por funil com semana anterior, média de 4 semanas, meta e sinal
- [x] "O que foi feito na conta", agrupado, com veredito e "ver proposta"
- [x] Testes propostos com a ficha completa, "Virar teste" e "Descartar" com motivo
- [x] Balão de citação (mouse e toque) e painel do pacote de fatos com busca
- [x] Diferença visual clara entre fato calculado e leitura da IA
- [x] Reações útil, óbvio e errado (errado exige comentário), comentário livre, "Virar item de contexto"
- [x] Painel de qualidade
- [x] Registro de checagem com tentativas e violações
- [x] Estados parcial, não passou, primeira semana e fontes com problema
- [x] Histórico de semanas (com substituída e falhou) e comparação de duas semanas
- [x] Conferir no navegador em 1440 px e 390 px: sem rolagem lateral, sem nenhuma chamada de gravação
- [x] Copy sem travessão

## Implementação (04/10/2026)

Protótipo só de front, com dados de exemplo no navegador: nada chama a API, nada é salvo nem gerado (selo "Protótipo"). Código novo em `public/dash/argo-relatorio.js`; em `public/dash/index.html` a pílula "Relatório", a vista `#argo-vista-relatorio`, a vista `relatorio` no endereço (`#argo?v=relatorio`), o `<script>` e o CSS prefixado `ar-`.

Conferido no navegador (1440 e 390 px), servindo `public/` localmente: os 5 estados, balão de citação (folha embaixo no celular), pacote de fatos com busca, registro de checagem, reações (errado exige comentário), descarte com motivo, histórico (com substituída e falhou), abrir semana antiga e comparar semanas. Sem rolagem lateral no celular e nenhuma chamada à API.

Fora do escopo, anotado para as próximas: a lista "o que o relatório já sabe sozinho" na tela de contexto (ideia levantada em 04/10, ainda não está na spec nem na 400).
