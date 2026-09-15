# 246: Campos e notas do formulário conforme o tipo de medição

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Mostrar ou esconder campos e notas do formulário conforme o tipo de medição escolhido.

## Comportamentos cobertos

- Tipo "Lead do formulário + MQL": mostra "Origem do lead"
- Tipo "Manual" ou "Venda na Greenn": "Origem do lead" some
- Tipo "Manual": nota "O relatório vai trazer só o investimento deste funil; leads e custo aparecem como contagem manual."
- Tipo "Venda na Greenn" sem trecho: aviso "Sem trecho, as campanhas deste produto podem cair em 'sem funil'."

## Cenários

### Happy Path
1. A aba abre e `GET /api/funis-relatorio-opcoes` passa a devolver também `tipos`: para cada tipo de medição, quais campos existem (`funil_tracking`, `origem_lead`) e os textos de nota/aviso — tirados de `CAMPOS_POR_TIPO` (issue 240), a mesma tabela que a validação usa para descartar valores.
2. A usuária escolhe o tipo no formulário; a tela só aplica o que veio:
   - *Lead do formulário + MQL* → "Funil do tracking" e "Origem do lead" visíveis; sem nota.
   - *Manual* → "Origem do lead" some; aparece a nota "O relatório vai trazer só o investimento deste funil; leads e custo aparecem como contagem manual."
   - *Venda na Greenn* → "Origem do lead" e "Funil do tracking" somem; com o trecho vazio aparece "Sem trecho, as campanhas deste produto podem cair em 'sem funil'."
3. Ao digitar um trecho no tipo *Venda na Greenn*, o aviso some; ao apagar, volta.

### Edge Cases
- Nenhum tipo escolhido → campos visíveis e nenhuma nota (nada foi decidido ainda).
- Campo escondido mantém o valor na tela, mas o servidor descarta ao salvar (issue 240) — esconder é só conveniência de tela.
- "Cancelar"/limpar o formulário (issue 245/247) reaplica o estado do tipo vazio.
- Endpoint de opções fora do ar → sem `tipos`: campos ficam visíveis, sem notas ("Salvar" já fica desabilitado pela falha, issue 237).

### Cenário de Erro
- Não há gravação nesta issue; falha da leitura das opções segue o tratamento da issue 237.

## Banco de Dados

Não se aplica.

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio-validacao.js` — `NOTA_MANUAL`, `AVISO_VENDA_SEM_TRECHO` e `formularioPorTipo()` (derivado de `TIPOS` + `CAMPOS_POR_TIPO`).
- **Modificar:** `tests/funis-relatorio-validacao.test.js` — teste de `formularioPorTipo`.
- **Modificar:** `functions/api/funis-relatorio-opcoes.js` — inclui `tipos: formularioPorTipo()` na resposta.
- **Modificar:** `public/dash/index.html` — id `funisrel-funil-tracking-wrap` no rótulo do funil do tracking; notas sem texto fixo (vem do servidor); `aplicarTipoFunisRel()` ligado ao `change` do tipo, ao `input` do trecho, ao desenho das opções e à limpeza do formulário.

## Reuso (pesquisado na base)

- `CAMPOS_POR_TIPO` / `campoAplica` (issue 240) — fonte única do "campo vale para o tipo".
- Padrão `aplicarPadrao()` da aba Links (esconder campo é conveniência; quem garante é o backend).

## Checklist

- [x] `formularioPorTipo()` com campos, nota do Manual e aviso de venda sem trecho
- [x] Teste de `formularioPorTipo`
- [x] `/api/funis-relatorio-opcoes` devolve `tipos`
- [x] Origem só aparece em Lead + MQL; funil do tracking some em Venda na Greenn
- [x] Nota do Manual exibida com o texto do servidor
- [x] Aviso de Venda na Greenn sem trecho aparece e some conforme o trecho
- [x] Formulário limpo volta ao estado sem tipo
- [x] `npm test` passando
