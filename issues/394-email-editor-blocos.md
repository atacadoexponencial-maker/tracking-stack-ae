# 394: Editor de blocos no modelo

**Tipo:** Implementação
**Página:** Marketing › E-mail › Modelos, editor (spec `spec-editor-email.md`, módulos 1, 2 para título, texto, botão, divisória e espaço, e 5)

## Descrição

Trocar a caixa de texto do corpo pelo editor de blocos: adicionar no fim e entre blocos, selecionar, subir, descer, arrastar, duplicar, apagar, desfazer e refazer; editar título, texto (negrito, itálico, link, tirar link, lista, alinhamento), botão (texto, link com campo, estilo, alinhamento), divisória e espaço; inserir campo no cursor; prévia ao vivo em computador e celular com clique na prévia selecionando o bloco; avisos no bloco; salvar com aviso de onde o modelo está em uso; aviso ao sair sem salvar; teste com o que está na tela.

## Pronto quando

Ela abre um modelo, monta e reordena blocos, vê a prévia mudar na hora, salva, manda teste e recebe igual à prévia; os avisos aparecem no bloco certo e modelo sem bloco não salva.

## Cenários

### Happy Path
1. Em Modelos, abrir um modelo abre o editor por blocos (o mesmo desenho aprovado no protótipo 389), com o documento do modelo.
2. Cada mudança redesenha a prévia, que é o e-mail **montado pelo servidor** (`acao: 'previa'` com `editor: true`): o mesmo HTML que sai, com cada bloco marcado para clicar, arrastar e soltar na prévia.
3. Salvar manda o documento; o servidor limpa e valida (393). Se o modelo é usado pela agenda, por fluxo ou por campanha agendada, o editor avisa onde antes de salvar.
4. "Mandar teste" manda o que está na tela, mesmo sem salvar (`enviar_teste` com o rascunho).
5. Imagens vêm da biblioteca de verdade (392): escolher, subir do bloco e soltar arquivo na prévia.

### Edge Cases
- Modelo novo (sem corpo): abre com um bloco de texto vazio.
- Modelo ainda em texto antigo: o servidor converte na leitura; a conversão única roda junto desta entrega.
- Resposta de prévia atrasada não sobrescreve uma mais nova.
- Sair com mudanças não salvas pede confirmação.

### Cenário de Erro
- Erro de validação ao salvar: mensagem do servidor no topo e no aviso; nada é perdido na tela.
- Prévia falhou (rede): aviso no lugar da prévia; o editor segue.

## Arquivos

- **Modificar:** `functions/api/_email-blocos.js` — opção `editor` marca as linhas (`data-b`, `data-cabeca`, vazios) e mostra blocos vazios como lugar marcado.
- **Modificar:** `functions/api/_email-render.js` — repassa `editor`.
- **Modificar:** `functions/api/email/modelos.js` — prévia com `editor` devolvendo também o texto puro; `enviar_teste` com rascunho; lista com onde cada modelo é usado.
- **Modificar:** `public/dash/email-blocos.js` — modo real do editor: dados do modelo, campos do canal, prévia do servidor, imagens da biblioteca e salvar/testar/duplicar pela API.
- **Modificar:** `public/dash/email-mkt.js` — Modelos abre o editor novo; `pedirTeste` aceita rascunho; sai o editor de texto antigo e o botão do protótipo.
- **Modificar:** `tests/email-modelos.test.js` — teste com rascunho, prévia marcada e usos na lista.

## Checklist

- [x] Prévia do servidor marcada para o editor
- [x] Teste com rascunho e usos na lista
- [x] Editor real ligado em Modelos
- [x] Conversão única rodada no remoto e conferida
- [x] Testes passando e conferido no navegador

## Execução (04/10/2026)

- Modelos abre o editor por blocos (`EmailBlocos.editor`); o editor de texto antigo e o botão do protótipo saíram.
- Prévia do servidor com `editor: true` (linhas marcadas, blocos vazios como lugar marcado); seleção marcada na prévia sem novo pedido.
- Conversão única rodada no remoto: 6 modelos (5 da agenda e "Modelo de Teste Mkt"); a segunda rodada não converteu nada. Conferido: texto puro e links de cada e-mail iguais antes e depois. Cópia dos corpos antigos guardada no scratchpad da sessão.
- Conferido na prévia com gravações bloqueadas: abrir, editar (prévia atualiza), clicar na logo da prévia abre o cabeçalho, imagem da biblioteca num bloco.
