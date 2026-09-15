# 242: Validação de unicidade opção do CRM × origem do lead

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Implementar no servidor a validação das opções do CRM, incluindo a regra de sobreposição de origem entre funis ativos que compartilham a mesma opção.

## Comportamentos cobertos

- Sem opção do CRM: "Escolha ao menos uma opção do campo Funil do CRM."
- Opção que não existe no CRM ao salvar: "Essa opção não existe no CRM."
- Mesma opção com "Tráfego pago" em um e "Qualquer origem exceto tráfego pago" no outro: aceito
- Mesma opção com origens que se sobrepõem (mesma origem, ou "Qualquer origem" junto de outra): "A opção <opção> com essa origem já pertence ao bloco <nome>."
- Mesma opção num funil "Manual" ou "Venda na Greenn" e em qualquer outro ativo: mesma mensagem (esses tipos ocupam a opção inteira)

## Cenários

### Happy Path
1. Quem grava chama `validarOpcoesCrm({ tipo, origem_lead }, opcoes, outros, { opcoesCrm })`, com tipo e origem já validados (issue 240) e as opções atuais do CRM (`lerOpcoesFunilCrm`, issue 237).
2. `opcoes` = ids marcados no formulário. Cada id é conferido nas opções atuais do CRM e ganha o **nome que o CRM dá** (o nome enviado pela tela não é confiado).
3. Sem sobreposição → `{ valor: [{ id, nome }] }`, pronto para `JSON.stringify` em `opcoes_crm`.

### Edge Cases
- Lista ausente, vazia ou só com ids vazios → "Escolha ao menos uma opção do campo Funil do CRM."
- Aceita ids ou objetos `{ id }`; ids repetidos contam uma vez; ordem preservada.
- Id que não está nas opções atuais do CRM → "Essa opção não existe no CRM."
- `opcoesCrm: null` (reativação, issue 251): não confere existência; usa o nome gravado que vier no objeto.
- Mesma opção em outro funil **ativo**, os dois `lead_mql`:
  - `trafego_pago` × `exceto_trafego_pago` → aceito (cada card cai em um só);
  - mesma origem nos dois → "A opção <opção> com essa origem já pertence ao bloco <nome>.";
  - `qualquer` de um lado e qualquer origem do outro → mesma recusa.
- Mesma opção quando um dos dois é `manual` ou `venda_greenn` → mesma recusa (esses tipos ocupam a opção inteira).
- Mesma opção em funil arquivado → não conflita.
- `opcoes_crm` ilegível em outra linha → tratada como sem opções (`lerOpcoesCrmGravadas`), sem derrubar a validação.

### Cenário de Erro
- Recusa devolve `{ erro }`; o endpoint responde 400 (issue 245). CRM fora do ar no momento de gravar é tratado pelo endpoint (issue 245), não aqui.

## Banco de Dados

Não se aplica (lê `opcoes_crm` das linhas já carregadas; formato JSON `[{id, nome}]` da migration 0039).

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio-validacao.js` — `origensSobrepoem(a, b)` e `validarOpcoesCrm`.
- **Modificar:** `tests/funis-relatorio-validacao.test.js` — testes de opção do CRM × origem.

## Reuso (pesquisado na base)

- `lerOpcoesCrmGravadas` de `functions/api/_funis-relatorio.js` (leitura tolerante de `opcoes_crm`).
- Formato `{ id, nome }` de `extrairOpcoesFunil` (`functions/api/_crm-opcoes-funil.js`).

## Checklist

- [x] Sem opção → "Escolha ao menos uma opção do campo Funil do CRM."
- [x] Opção fora do CRM → "Essa opção não existe no CRM." (nome vem do CRM)
- [x] `trafego_pago` × `exceto_trafego_pago` aceito
- [x] Mesma origem ou `qualquer` → "A opção <opção> com essa origem já pertence ao bloco <nome>."
- [x] `manual`/`venda_greenn` ocupam a opção inteira
- [x] Arquivados não conflitam; checagem de existência desligável
- [x] Testes
- [x] `npm test` passando
