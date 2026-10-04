# 393: E-mails saem do formato por blocos; modelos antigos convertidos

**Tipo:** Implementação
**Página:** Modelos e todos os envios: agenda, campanhas, fluxos, teste (spec `spec-editor-email.md`, módulos 5 na parte da versão só texto, 6 e 7)

## Descrição

Trocar o corpo de texto do modelo pelo formato por blocos (título, texto, botão, divisória, espaço; imagem entra na 395), montar o e-mail final e a versão só texto a partir dos blocos, converter sozinhos todos os modelos salvos (parágrafo vira texto, [[Texto | link]] vira botão, cabeçalho padrão = logo de hoje) e ligar agenda, campanhas, fluxos e teste ao formato novo, sem parar nenhum envio.

## Pronto quando

Os 5 modelos da agenda estão em blocos, o e-mail de teste de cada um sai igual ao de antes (mesmo texto, links e campos), e agenda, campanhas e fluxos seguem enviando; o resumo do disparo continua apontando "sem nome" quando algum bloco usa o nome.

## Cenários

### Happy Path
1. O corpo do modelo passa a ser um **documento de blocos** guardado na mesma coluna `corpo` (JSON com `formato: "blocos"`): cabeçalho (`padrao` | `proprio` | `sem`, fundo), fundo do e-mail e a lista de blocos (os do cabeçalho personalizado marcados com `zona: "cab"`).
2. `montarEmail` monta o HTML a partir do documento: cabeçalho (o padrão vem da configuração `cabecalho_padrao`; sem ela, a logo de hoje, 150 px à esquerda), blocos, rodapé comum e descadastro. Também gera a versão só texto.
3. Os campos `{{...}}` continuam funcionando em título, texto, botão (texto e link) e texto alternativo; com `valores = null` (campanhas pela Bulk API) os marcadores ficam para o Postmark preencher, como hoje.
4. Imagem no bloco guarda a **chave** da biblioteca (não o endereço): o endereço é montado na hora com o domínio de quem envia (`site`), então e-mails de produção apontam para produção.
5. Uma conversão única (`POST /api/email/modelos { acao: 'converter_formato' }`, idempotente) troca o corpo antigo de todos os modelos pelo documento: parágrafos seguidos viram um bloco de texto (negrito e links preservados), `[[Texto | link]]` vira bloco de botão com as mesmas cores, cabeçalho padrão.

### Edge Cases
- Modelo ainda no formato antigo (entre o deploy e a conversão, ou criado por código antigo): o servidor converte na hora de montar; nada deixa de sair.
- HTML do bloco de texto é limpo no servidor: só `p, br, b, i, a, ul, li`; `a` só com `https://`, `http://`, `mailto:` ou um campo; o resto vira texto.
- Bloco de tipo desconhecido é descartado na validação.
- Corpo sem nenhum bloco no corpo do e-mail: não salva ("O modelo precisa de pelo menos um bloco no corpo").
- O teste de e-mail da Configuração (corpo fixo em texto) continua usando o formato antigo, convertido na hora.

### Cenário de Erro
- Documento corrompido (JSON inválido): tratado como texto antigo, para o e-mail sair mesmo assim.
- Link sem https:// em botão, imagem ou texto: erro com o rótulo do bloco ("Botão 1: link sem https://").

## Arquivos

- **Criar:** `functions/api/_email-blocos.js` — o documento: tipos e padrões de cada bloco, `lerDocumento` (JSON ou texto antigo), `converterLegado`, `normalizarDocumento` (limpa e valida), `htmlDosBlocos`, `textoDosBlocos`, `linksDoDocumento`, `chavesDeImagens`, cabeçalho padrão.
- **Modificar:** `functions/api/_email-render.js` — `montarEmail` monta a partir do documento (mesma assinatura); `linksDoCorpo` passa a ler o documento.
- **Modificar:** `functions/api/_email-modelos.js` — validação do documento (campos, links por bloco, pelo menos um bloco), corpo guardado normalizado, `converterModelos`.
- **Modificar:** `functions/api/email/modelos.js` — prévia aceita o documento (objeto ou texto); ação `converter_formato`.
- **Criar:** `tests/email-blocos.test.js` — conversão fiel (texto e links iguais ao antigo), limpeza do HTML, campos com e sem valores, imagens pela chave e domínio, cabeçalho padrão/próprio/sem, versão só texto, validação.
- **Modificar:** testes existentes que montam e-mail, se o HTML mudar de forma (as asserções são sobre conteúdo, não layout).

## Checklist

- [ ] `_email-blocos.js` com documento, conversão, limpeza e montagem
- [ ] `montarEmail` e validação dos modelos usando o documento
- [ ] Conversão `converter_formato` idempotente
- [ ] Testes novos e antigos passando
- [ ] Conversão rodada no remoto depois do editor novo (394) no ar, conferindo o teste de cada modelo da agenda
