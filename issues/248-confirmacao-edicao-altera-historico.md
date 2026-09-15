# 248: Confirmação ao editar campos que alteram relatórios passados

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Pedir confirmação antes de gravar mudanças em funil do tracking, opção do CRM, trecho ou tipo de um funil que já apareceu em relatórios.

## Comportamentos cobertos

- Confirmação com "Esta mudança também altera os números de relatórios passados, se forem consultados de novo." — cancelar não grava
- Editar só o nome: grava sem pedir confirmação

## Cenários

### Happy Path
1. Em modo edição, a usuária muda o funil do tracking (ou opção do CRM, trecho, tipo) e clica em "Salvar".
2. A tela manda `{ acao: 'editar', ... }` sem `confirmado`.
3. O servidor confere versão e valida (issue 247); se a mudança atinge o que define os números (`precisaConfirmarEdicao`), **não grava** e responde `200 { confirmar: 'Esta mudança também altera os números de relatórios passados, se forem consultados de novo.' }`.
4. A tela mostra esse texto numa confirmação; "OK" reenvia o mesmo corpo com `confirmado: true` e o servidor grava; "Cancelar" não grava e o formulário continua em edição.

### Edge Cases
- Só o nome mudou → grava direto, sem pedir confirmação.
- Nada mudou → grava direto (só atualiza a data), sem confirmação.
- Opções do CRM na mesma coleção em outra ordem → não é mudança.
- Trecho só com diferença de caixa (`workshop-pago` → `Workshop-Pago`) → não é mudança: o reconhecimento na campanha não diferencia caixa.
- Origem do lead alterada → pede confirmação: é a origem, combinada com a opção do CRM, que decide quais cards contam (decisão 5), então também altera relatórios passados.
- "Funil que já apareceu em relatórios": todo funil gravado entra, porque o endpoint aceita qualquer período passado — qualquer funil já pode ter sido usado numa consulta. Não há registro de consultas para distinguir.
- A decisão de pedir confirmação é do servidor; a tela não compara campos.
- Recusa de validação vem **antes** da confirmação (ninguém confirma algo que depois seria recusado).

### Cenário de Erro
- Versão desatualizada entre a pergunta e o "OK" → o reenvio recebe o 409 da issue 247; nada é sobrescrito.
- Falha de rede no reenvio → "Não foi possível salvar. Tente de novo."

## Banco de Dados

Não se aplica (mesmo UPDATE da issue 247).

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio-validacao.js` — `CONFIRMACAO_EDICAO` e `precisaConfirmarEdicao(atual, novo)`.
- **Modificar:** `tests/funis-relatorio-validacao.test.js` — testes de `precisaConfirmarEdicao`.
- **Modificar:** `functions/api/funis-relatorio.js` — `editarFunil` devolve `{ confirmar }` sem gravar quando a mudança exige e `confirmado !== true`.
- **Modificar:** `public/dash/index.html` — no `submit`, resposta com `confirmar` abre `confirm()` com o texto do servidor e reenvia com `confirmado: true`.

## Reuso (pesquisado na base)

- `lerOpcoesCrmGravadas` (`_funis-relatorio.js`) para comparar as opções gravadas.
- O dash não tem componente próprio de confirmação (nenhuma aba usa diálogo de confirmação hoje); segue-se o `confirm()` nativo do navegador, com o texto vindo do servidor.

## Checklist

- [x] `precisaConfirmarEdicao`: tipo, funil do tracking, opções do CRM (sem ordem), origem e trecho (sem caixa)
- [x] Só nome (ou nada) mudou → sem confirmação
- [x] Servidor responde `{ confirmar }` sem gravar; grava com `confirmado: true`
- [x] Tela pede confirmação com o texto do servidor; cancelar não grava
- [x] Testes
- [x] `npm test` passando
