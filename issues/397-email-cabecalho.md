# 397: Cabeçalho padrão e cabeçalho por modelo

**Tipo:** Implementação
**Página:** Configuração de e-mail e editor do modelo (spec `spec-editor-email.md`, módulo 3)

## Descrição

Criar o cabeçalho montado com blocos: o padrão na Configuração (blocos da faixa, cor de fundo, prévia e quantos modelos usam antes de salvar) e, no modelo, o cartão do cabeçalho com padrão, personalizado (blocos próprios, começando como cópia do padrão, com arrastar entre cabeçalho e corpo) ou sem cabeçalho, mais tirar e pôr de volta e o aviso de contraste do texto com o fundo da faixa.

## Pronto quando

Ela muda o cabeçalho padrão e todos os modelos que usam o padrão passam a sair com ele; um modelo com cabeçalho personalizado (logo e texto em fundo escuro) e outro sem cabeçalho saem assim no teste.

## Cenários

### Happy Path
1. Configuração › **Cabeçalho padrão** mostra quantos modelos usam o padrão e o botão "Editar cabeçalho padrão".
2. O editor abre só com a faixa (blocos, paleta, arrastar, fundo da faixa, avisos), com a prévia montada pelo servidor e o lugar do corpo marcado.
3. Salvar pede confirmação com o número de modelos afetados e grava `cabecalho_padrao` na configuração (documento `{ fundo, blocos }`); os próximos envios de todos os modelos com cabeçalho padrão saem com ele.
4. No editor de um modelo, "Personalizar a partir do padrão" copia o padrão **atual** da configuração.

### Edge Cases
- Sem cabeçalho padrão salvo: vale a logo de hoje (150 px, à esquerda).
- Padrão vazio: não salva ("adicione um bloco, ou use Sem cabeçalho em cada modelo").
- Link sem https:// num bloco do cabeçalho: recusado com o rótulo do bloco.
- Imagem do cabeçalho padrão aparece como "Cabeçalho padrão" em "Onde é usada" da biblioteca e não pode ser apagada.

### Cenário de Erro
- Erro ao salvar: mensagem do servidor no topo do editor; nada é perdido na tela.

## Arquivos

- **Modificar:** `functions/api/_email-config.js` — chave `cabecalho_padrao` (vazia = logo de hoje), validada como documento de blocos do cabeçalho.
- **Modificar:** `functions/api/email/config.js` — GET devolve os modelos que usam o cabeçalho padrão.
- **Modificar:** `public/dash/email-blocos.js` — `editorCabecalho` (modo cabeçalho de verdade); personalizar copia o padrão atual.
- **Modificar:** `public/dash/email-mkt.js` — seção "Cabeçalho padrão" na Configuração (sai o botão do protótipo); passa o padrão ao editor do modelo.
- **Criar/Modificar:** testes em `tests/email-config.test.js` e `tests/email-blocos.test.js`.

## Checklist

- [ ] `cabecalho_padrao` validado e guardado
- [ ] Modelos que usam o padrão no GET da configuração
- [ ] Editor do cabeçalho padrão ligado
- [ ] Personalizar copia o padrão atual
- [ ] Testes e conferência na prévia (sem salvar o padrão)
