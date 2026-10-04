# 400: Protótipo do contexto do negócio

**Tipo:** Protótipo
**Página:** Aba Argo › Contexto do negócio (spec `spec-relatorio-semanal-argo.md`, módulo 1)

## Descrição

Desenhar no dash, no estilo "Etiqueta", a lista de itens de contexto com tipo (prioridade, oferta, evento, restrição, observação), funil, dias desde a revisão e situação (em dia, revisar); o formulário de item (com datas só para evento e prazo de validade); os botões editar, marcar como revisado e arquivar; o filtro de arquivados; o estado de contexto vazio; e o quadro "o que o relatório já sabe sozinho" (acrescentado à spec em 04/10, a pedido dela, para saber o que precisa escrever).

## Pronto quando

Na prévia, ela cria, edita, revisa e arquiva itens de exemplo, vê um item vencido aparecer como "revisar" e um evento terminado sair do contexto atual, consulta o quadro do que o relatório já sabe, no computador e no celular, e aprova o desenho. Nada é salvo (selo "Protótipo").

## Cenários

### Happy Path
1. Na aba Argo, uma quarta pílula **Contexto** abre `#argo?v=contexto` (recarregar mantém).
2. Faixa "Protótipo" com o seletor **Ver estado**: Com itens, Vazio.
3. No topo, uma linha de resumo: "5 itens valendo · 1 para revisar · 1 evento terminado", e o botão **Novo item**.
4. O quadro **O que o relatório já sabe sozinho** fica ao lado da lista no computador (embaixo, recolhido, no celular), com as fontes automáticas e a regra prática "vai aqui o que explica um número e não está em nenhum sistema", com exemplos por tipo.
5. A lista mostra cada item: tipo (carimbo), título, texto, funil, datas (eventos), "revisado há N dias" e a situação (`em dia` ou `revisar`). Os itens `revisar` vêm primeiro.
6. **Novo item** abre a gaveta com: tipo (os cinco, com uma frase de exemplo de cada), título, texto, funil (opcional, lista dos funis), datas de início e fim (só aparecem para `evento`) e prazo de validade (padrão 30 dias). Salvar põe o item na lista como `em dia` e mostra o aviso "Protótipo: nada foi salvo".
7. **Editar** abre a mesma gaveta preenchida; salvar renova a data de revisão para hoje.
8. **Marcar como revisado** renova a data sem abrir a gaveta; o item sai de `revisar`.
9. **Arquivar** pede confirmação na própria linha e tira o item da lista atual.
10. O filtro **Valendo / Arquivados / Eventos terminados** mostra os arquivados (com a data em que saíram) e os eventos cuja data de fim já passou (que saíram sozinhos).

### Edge Cases
- **Item vencido:** "Oferta: workshop pago a R$ 47", revisado há 41 dias com prazo de 30, aparece como `revisar`, com o aviso "o relatório usa, mas avisa que está velho".
- **Evento terminado:** "Workshop Black ao vivo em 23/09" aparece só no filtro "Eventos terminados", com a nota "a semana de 21/09 continua marcada como atípica".
- **Contexto vazio:** a lista vira um estado vazio que explica para que serve o contexto e o que o relatório faz sem ele ("gera mesmo assim e avisa"), com o botão Novo item.
- **Evento sem data de fim, ou fim antes do início:** a gaveta não deixa salvar e diz o motivo no campo.
- **Título vazio:** a gaveta não deixa salvar.
- **Celular (390 px):** lista em cartões, sem rolagem lateral; a gaveta ocupa a tela; o quadro do que o relatório já sabe fica recolhido em "Ver o que o relatório já sabe".

### Cenário de Erro
É protótipo, sem servidor. Nenhum botão grava: cada ação muda só a tela e mostra "Protótipo: nada foi salvo".

## Banco de Dados

Não se aplica (protótipo só de front).

## Arquivos

- **Criar:** `public/dash/argo-contexto.js`: o protótipo inteiro, isolado como o `argo-relatorio.js`. Contém os itens de exemplo, o quadro do que o relatório já sabe, a lista com filtro, a gaveta do formulário, revisar, arquivar e o estado vazio. Expõe só `window.ArgoContexto = { abrir(raiz) }`.
- **Modificar:** `public/dash/index.html`:
  - pílula **Contexto** em `.argo-vistas` e `<div id="argo-vista-contexto" hidden>`;
  - `ARGO_VISTAS` ganha `contexto`, e `mostrarVistaArgo` esconde ou mostra a vista nova e chama `ArgoContexto.abrir` quando ela aparece;
  - `<script src="/dash/argo-contexto.js">`;
  - CSS com prefixo `ac-` (livre hoje).
- **Modificar:** `spec-relatorio-semanal-argo.md`: o quadro "o que o relatório já sabe sozinho" no módulo 1 (já feito no plano).

**Reaproveitar:**
- A faixa do protótipo (`.em-proto*`), o aviso curto (`.ag-toast`), a gaveta (`.ag-gaveta*`, `.ag-campo`) e o padrão de toast e gaveta do `argo-relatorio.js`.
- `.carimbo` para tipo e situação, e `.tipo-pill` para o filtro.
- A confirmação na própria linha do dash: `pedirConfirmacao` mora dentro do script do `index.html` e não é acessível de fora, então o protótipo faz a confirmação na linha com o mesmo desenho (`.confirma`, botões `.btn.perigo` e `.btn.sec`).

## Dependências Externas

Nenhuma.

## Checklist

- [x] Pílula "Contexto" com `#argo?v=contexto` funcionando ao trocar e ao recarregar
- [x] Faixa "Protótipo" com os estados Com itens e Vazio
- [x] Resumo do topo e botão Novo item
- [x] Quadro "o que o relatório já sabe sozinho" (ao lado no computador, recolhido no celular)
- [x] Lista com tipo, título, texto, funil, datas, dias desde a revisão e situação; os itens a revisar primeiro
- [x] Gaveta de novo item e de edição, com datas só para evento, prazo de validade e validações (título, datas)
- [x] Marcar como revisado
- [x] Arquivar com confirmação na linha
- [x] Filtro Valendo / Arquivados / Eventos terminados
- [x] Estado vazio
- [x] Conferir em 1440 px e 390 px: sem rolagem lateral, nenhuma chamada de gravação
- [x] Copy sem travessão

## Implementação (04/10/2026)

Protótipo só de front, com itens de exemplo no navegador: nada chama a API, nada é salvo (selo "Protótipo"). Código novo em `public/dash/argo-contexto.js`; em `public/dash/index.html` a pílula "Contexto", a vista `#argo-vista-contexto` (`#argo?v=contexto`), o `<script>` e o CSS prefixado `ac-`. O quadro "o que o relatório já sabe sozinho" entrou na spec (módulo 1).

Conferido no navegador (1440 e 390 px): resumo do topo, item vencido primeiro como "revisar", marcar como revisado, novo item com validação de título e de datas do evento, editar, arquivar com confirmação na linha, filtros Valendo, Arquivados e Eventos terminados, estado vazio, quadro ao lado no computador e recolhido no celular. Sem rolagem lateral e nenhuma chamada à API.
