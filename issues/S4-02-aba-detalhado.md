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

## Cenários

### Happy Path
1. A usuária clica em **Detalhado** no menu Resultados (logo depois de Visão geral).
2. A tela mostra exatamente o que a Visão geral mostrava antes: manchete, quadros, taxas, painel por funil, funil da agenda, metas, investimento/receita/ROAS, leads por dia, leads por funil e conversão por LP.
3. Período, comparação e filtro de funil do topo valem como valiam (`FILTROS.detalhado` igual ao da Visão geral antiga).
4. O link fica no endereço (`#detalhado?p=7&f=...`), sobrevive ao recarregar.

### Edge Cases
- Link antigo `#visao` continua abrindo a Visão geral (agora a nova).
- Os atalhos internos da tela antiga (régua de metas → "ver o detalhe" na aba Leads, links de Funis do relatório) seguem iguais, porque apontam para outras abas.

### Cenário de Erro
- Falha de carga na aba Detalhado mostra o mesmo aviso "Não foi possível carregar os dados desta aba" com "Tentar de novo" (ciclo `render()` de sempre).

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S4-16 | manual | roteiro abaixo | a aba Detalhado mostra os mesmos blocos e números da Visão geral de antes |

### Roteiro manual — CA-S4-16
1. No dash no ar, escolha "Últimos 7 dias" e "Todos os funis".
2. Clique em **Detalhado** no menu Resultados.
3. Confira que aparecem manchete, quadros (Leads, Leads novos, Conversão geral, CPL, CPL lead novo, reuniões), taxas de passagem, painel por funil, funil da agenda, metas, investimento/receita/ROAS, leads por dia, leads por funil e conversão por LP, com os mesmos números que a Visão geral mostrava antes da mudança.
4. Troque para um funil no filtro do topo e confira que os números mudam como mudavam antes.

## Banco de Dados

Não se aplica.

## Arquivos

- **Modificar:** `public/dash/index.html` — (1) o conteúdo atual de `#secao-visao` passa para `<section id="secao-detalhado">` sem mudar os ids internos (`#visao-herois`, `#visao-taxas`…); `#secao-visao` fica só com `#visao-reuniao`; (2) a função de hoje `R.visao` vira `R.detalhado`, sem mudança de conta; o novo `R.visao` desenha a Visão geral da reunião (nesta issue, o protótipo; dados reais na S4-03); (3) link `<a href="#detalhado" data-secao="detalhado">Detalhado</a>` no grupo Resultados, depois de Visão geral; (4) `detalhado: 'Detalhado'` em `TITULOS` e `detalhado: { periodo: true, compara: true, funil: true }` em `FILTROS`; (5) a regra `.visao-proto` sai (a Visão geral já não tem o conteúdo antigo para esconder).

## Dependências Externas

Nenhuma.

## Checklist

- [x] Seção `secao-detalhado` com o conteúdo antigo e `secao-visao` só com o contêiner novo
- [x] `R.detalhado` com a função antiga; `R.visao` novo
- [x] Menu, `TITULOS` e `FILTROS`
- [x] Conferir no navegador que Detalhado mostra a tela antiga
