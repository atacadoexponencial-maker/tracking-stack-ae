# 240: Validação do tipo de medição e da origem do lead

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Implementar no servidor a obrigatoriedade do tipo de medição e as regras dos campos que dependem do tipo: a origem do lead e o funil do tracking.

## Comportamentos cobertos

- Sem tipo de medição: "Escolha o tipo de medição."
- Tipo "Lead do formulário + MQL" sem origem: "Escolha a origem do lead."
- Tipo "Manual" ou "Venda na Greenn": valor da origem do lead descartado ao salvar
- Tipo "Venda na Greenn": valor do funil do tracking descartado ao salvar (não se aplica — decisão 9 da spec)

## Cenários

### Happy Path
1. Quem grava chama `validarTipoEOrigem({ tipo, origem_lead, funil_tracking })`.
2. Tipo `lead_mql` com origem válida → `{ valor: { tipo: 'lead_mql', origem_lead: 'trafego_pago' } }`.
3. Tipo `manual` → `origem_lead: null` (o que veio é descartado).
4. Tipo `venda_greenn` → `origem_lead: null`; e `campoAplica('venda_greenn', 'funil_tracking')` é `false`, então o funil do tracking é descartado (a checagem dele é da issue 241, que usa essa mesma tabela).

### Edge Cases
- Tipo ausente, vazio ou fora de `lead_mql` / `manual` / `venda_greenn` → "Escolha o tipo de medição." (tipo desconhecido não é aceito silenciosamente).
- Tipo com espaços nas pontas → aparado antes de conferir.
- `lead_mql` sem origem, com origem vazia ou fora de `trafego_pago` / `exceto_trafego_pago` / `qualquer` → "Escolha a origem do lead."
- `manual` / `venda_greenn` com origem inválida no corpo → ignorada (o campo não se aplica; nada é recusado por um campo que some da tela).
- A tabela `CAMPOS_POR_TIPO` é a fonte única de "qual campo vale para qual tipo" — a issue 246 a expõe para a tela esconder os campos, sem regra duplicada no front.

### Cenário de Erro
- Recusa devolve `{ erro }` com a mensagem da spec; o endpoint (issue 245) responde 400.

## Banco de Dados

Não se aplica. Os valores devolvidos respeitam os CHECKs já existentes da migration 0039 (`origem_lead` NULL fora do `lead_mql`; `funil_tracking` NULL no `venda_greenn`).

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio-validacao.js` — `CAMPOS_POR_TIPO`, `campoAplica(tipo, campo)` e `validarTipoEOrigem(entrada)`.
- **Modificar:** `tests/funis-relatorio-validacao.test.js` — testes de tipo e origem.

## Reuso (pesquisado na base)

- `TIPOS` e `ORIGENS` de `functions/api/_funis-relatorio.js` (issue 238) — as mesmas chaves que a lista já rotula; nada de segunda lista.

## Checklist

- [x] `CAMPOS_POR_TIPO` com `funil_tracking` e `origem_lead` por tipo
- [x] Sem tipo / tipo desconhecido → "Escolha o tipo de medição."
- [x] `lead_mql` sem origem válida → "Escolha a origem do lead."
- [x] `manual` e `venda_greenn` descartam a origem
- [x] `venda_greenn` marca o funil do tracking como não aplicável
- [x] Testes
- [x] `npm test` passando
