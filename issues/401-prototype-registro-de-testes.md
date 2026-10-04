# 401: Protótipo do registro de testes

**Tipo:** Protótipo
**Página:** Aba Argo › Testes (spec `spec-relatorio-semanal-argo.md`, módulo 2)

## Descrição

Desenhar no dash, no estilo "Etiqueta", a lista de testes com filtros (tipo, funil, situação, período) e busca; a ficha do teste (hipótese, o que mudou, anúncios, conjuntos ou páginas de cada lado, ligação com um A/B de página existente, métrica, critério, duração e amostra mínimas, resultado, aprendizado, origem); o indicador de leitura com quanto falta; as ações iniciar, concluir com resultado, abandonar com motivo e editar; e o histórico de mudanças da ficha depois do início.

## Pronto quando

Na prévia, ela registra um teste de cada tipo, liga anúncios e uma página, inicia, vê um teste "pronto para ler", conclui outro, abandona um terceiro e procura pelo aprendizado, no computador e no celular, e aprova o desenho. Nada é salvo (selo "Protótipo").

## Cenários

### Happy Path
1. Na aba Argo, uma quinta pílula **Testes** abre `#argo?v=testes` (recarregar mantém).
2. Faixa "Protótipo" com o seletor **Ver estado**: Com testes, Vazio.
3. Topo com resumo ("2 rodando · 1 pronto para ler · 1 planejado · 4 concluídos") e o botão **Registrar teste**.
4. Filtros: tipo, funil e período (selects), situação (pílulas: Todos, Planejado, Rodando, Pronto para ler, Concluído, Abandonado) e uma busca que procura no nome, na hipótese e no aprendizado.
5. Lista em cartões: nome, tipo, funil, situação (carimbo), início e dias rodando, origem ("sugerido pelo relatório" quando for o caso), resultado (concluídos) e, nos rodando, o **indicador de leitura**: duas réguas (dias e leads) com "faltam X dias e Y leads".
6. Clicar num teste abre a **ficha** na gaveta: hipótese, o que mudou, os dois lados (anúncios ou conjuntos de cada lado, ou o A/B de página ligado), métrica, critério de sucesso, mínimos, números de cada lado (nos rodando e concluídos), resultado e aprendizado, origem e o **histórico** da ficha.
7. Na ficha, as ações mudam conforme a situação:
   - `planejado`: **Iniciar**, **Editar**, **Abandonar**;
   - `rodando` ou `pronto para ler`: **Concluir**, **Editar**, **Abandonar**;
   - `concluído` e `abandonado`: só leitura.
8. **Registrar teste** abre o formulário: nome, tipo (criativo, público ou conjunto, página, oferta ou funil), funil, hipótese ("acreditamos que X porque Y"), o que muda, os dois lados (para página, escolher um A/B existente; para os outros, marcar anúncios ou conjuntos de uma lista de exemplo da conta), métrica principal, critério de sucesso, duração mínima (dias), amostra mínima (leads) e se já começa rodando ou fica planejado.
9. **Concluir** pede o resultado (variante ganhou, controle ganhou, empate, inconclusivo) e o aprendizado em texto, obrigatório.
10. **Abandonar** pede o motivo, obrigatório.
11. Toda ação muda a tela e mostra "Protótipo: nada foi salvo".

### Edge Cases
- **Mudar hipótese, métrica ou critério depois do início:** salvar registra no histórico da ficha "04/10: critério mudou de ... para ...", com destaque, porque muda a leitura do teste.
- **Teste de página:** em vez de anúncios, a ficha mostra o A/B ligado (A e B com as visitas e a conversão) e o link "abrir no A/B".
- **Pronto para ler:** o cartão ganha destaque e a nota "atingiu os mínimos: dá para ler".
- **Amostra atingida mas dias não, ou o contrário:** o indicador mostra cada régua separada e só vira "pronto" quando as duas completam.
- **Busca sem resultado:** "Nenhum teste com 'xyz'." com o botão de limpar filtros.
- **Registro vazio:** estado vazio explicando para que serve o registro e o que o relatório faz com ele, com o botão Registrar teste.
- **Formulário incompleto:** nome, hipótese, métrica e os dois lados são obrigatórios; o formulário diz o que falta no próprio campo.
- **Celular (390 px):** cartões empilhados, filtros quebram em linhas, gaveta em tela cheia, sem rolagem lateral.

### Cenário de Erro
É protótipo, sem servidor. Nenhum botão grava: cada ação muda só a tela e mostra o aviso de protótipo.

## Banco de Dados

Não se aplica (protótipo só de front).

## Arquivos

- **Criar:** `public/dash/argo-testes.js`: o protótipo inteiro, isolado como o `argo-contexto.js`. Contém os testes de exemplo (um de cada tipo e de cada situação), os anúncios, conjuntos e A/Bs de exemplo para escolher, os filtros e a busca, o indicador de leitura, a ficha, o formulário, iniciar, concluir, abandonar, editar com histórico e o estado vazio. Expõe só `window.ArgoTestes = { abrir(raiz) }`.
- **Modificar:** `public/dash/index.html`:
  - pílula **Testes** em `.argo-vistas` e `<div id="argo-vista-testes" hidden>`;
  - `ARGO_VISTAS` ganha `testes`, e `mostrarVistaArgo` mostra a vista e chama `ArgoTestes.abrir`;
  - `<script src="/dash/argo-testes.js">`;
  - CSS com prefixo `at-` (livre hoje).

**Reaproveitar:** a faixa do protótipo (`.em-proto*`), o aviso curto (`.ag-toast`), a gaveta (`.ag-gaveta*`, `.ag-campo`, `.em-gaveta--larga`), `.carimbo`, `.tipo-pill`, `.confirma` e o desenho dos tipos em cartão do formulário de contexto (`.ac-tipo`), além do padrão de módulo do `argo-contexto.js`.

## Dependências Externas

Nenhuma.

## Checklist

- [x] Pílula "Testes" com `#argo?v=testes` funcionando ao trocar e ao recarregar
- [x] Faixa "Protótipo" com os estados Com testes e Vazio
- [x] Resumo do topo e botão Registrar teste
- [x] Filtros por tipo, funil, período e situação, e busca no nome, hipótese e aprendizado
- [x] Cartões com situação, dias rodando, origem, resultado e indicador de leitura (dias e leads)
- [x] Ficha na gaveta com os dois lados (anúncios ou A/B), números, resultado, aprendizado e histórico
- [x] Formulário de registro com validação e escolha dos lados (lista da conta ou A/B existente)
- [x] Iniciar, concluir (resultado e aprendizado obrigatório), abandonar (motivo obrigatório)
- [x] Editar, com mudança de hipótese, métrica ou critério depois do início indo para o histórico
- [x] Estado vazio e busca sem resultado
- [x] Conferir em 1440 px e 390 px: sem rolagem lateral, nenhuma chamada de gravação
- [x] Copy sem travessão

## Implementação (04/10/2026)

Protótipo só de front, com testes de exemplo no navegador: nada chama a API, nada é salvo (selo "Protótipo"). Código novo em `public/dash/argo-testes.js`; em `public/dash/index.html` a pílula "Testes", a vista `#argo-vista-testes` (`#argo?v=testes`), o `<script>` e o CSS prefixado `at-`. A amostra mínima é em leads nos testes da conta e em visitas nos testes de página.

Conferido no navegador (1440 e 390 px): resumo, filtros e busca (inclusive no aprendizado), busca sem resultado com "limpar filtros", indicador de leitura com as duas réguas, ficha com os dois lados (anúncios ou A/B), editar critério depois do início indo para o histórico em destaque, concluir (aprendizado obrigatório), iniciar, abandonar (motivo obrigatório), registrar teste com validação e troca para A/B quando o tipo é página, estado vazio. Sem rolagem lateral e nenhuma chamada à API.
