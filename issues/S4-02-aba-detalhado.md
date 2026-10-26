# S4-02: Aba Detalhado com a Visão geral antiga

**Tipo:** Implementação
**Página:** Aba Detalhado
**Spec:** `spec-visao-geral-reuniao-semanal.md`

## Descrição

Criar no menu a aba **Detalhado**, logo depois de Visão geral, com tudo o que a Visão geral
mostra hoje (manchete, quadros, metas, painel por funil, taxas, funil da agenda,
investimento, receita, ROAS, gráfico diário, leads por funil, LPs), obedecendo ao período e
ao filtro de funil do topo. Atalhos que hoje apontam para blocos da Visão geral passam a
apontar para onde o bloco ficou.

## Pronto quando

No dash no ar, clicar em Detalhado abre a tela antiga com os mesmos números que a Visão
geral mostrava antes, para o mesmo período e funil.

## Critérios de aceite

- **CA-S4-16** (manual) — Aba Detalhado mostra a Visão geral antiga. Dado o dash no ar depois da mudança, quando a usuária clica em Detalhado, então vê os mesmos blocos e os mesmos números que a Visão geral mostrava antes, para o mesmo período e funil.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S4-07 | A manchete em frase ("X leads nos últimos 7 dias…") sai da Visão geral e vai para a aba Detalhado. | invalidada | A manchete fica na Visão geral (usuária, 26/10/2026); a aba Detalhado também a tem, por ser cópia da tela antiga |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S4-03 | Para onde vão os blocos que saem da Visão geral? | respondida | Nova aba "Detalhado" (usuária, 26/10/2026) |
