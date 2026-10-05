# 404: Números dos testes e "pronto para ler"

**Tipo:** Implementação
**Página:** Aba Argo › Testes (spec `spec-relatorio-semanal-argo.md`, módulo 2, indicador de leitura)

## Descrição

Cada teste rodando passa a mostrar os números de cada lado (tirados dos anúncios, conjuntos ou do A/B ligados) e o indicador de leitura com quanto falta de duração e amostra, usando as mesmas réguas de piso do Argo; ao atingir os mínimos, o teste passa sozinho para "pronto para ler".

## Pronto quando

Na ficha de um teste rodando ela vê os números de cada lado e "faltam X dias e Y leads"; um teste que atinge os mínimos aparece como "pronto para ler" sem ninguém mexer; um teste de página mostra os números do A/B ligado.

## Cenários

### Happy Path
Cada `GET /api/argo/testes` calcula os números dos testes ativos (rodando e pronto) e a leitura (`dias`, `amostra`, `falta_dias`, `falta_amostra`, `pronto`). Quem atinge os dois mínimos passa sozinho para `pronto`, com `pronto_em` e uma linha "Atingiu os mínimos: pronto para ler." no histórico.

### Edge Cases
- Teste de página: visitas e leads do A/B ligado; amostra = visitas do lado com menos visitas.
- Teste de conta por conjunto: soma os anúncios do conjunto; leads pelo nome do anúncio no CRM (`utm_content`).
- Anúncio sem gasto no período ainda conta os leads pelo nome escolhido.
- Meta ou CRM fora: `numeros.ok = false` com aviso; a leitura fica sem amostra e o teste nunca vira pronto por falta de dado.

### Cenário de Erro
Falha num teste não derruba os outros: cada um tem o seu `numeros`.

## Banco de Dados

- `argo.testes.pronto_em` e `argo.testes_historico` (migration 0009).

## Arquivos

- **Criar:** `functions/api/_argo-testes-numeros.js`: números de cada lado e a passagem para pronto.
- **Criar:** `functions/api/_ab-contagens.js`: a contagem do A/B, extraída de `ab-tests.js` para as duas telas lerem o mesmo número.
- **Modificar:** `functions/api/ab-tests.js`: usa `contarExposicoesAb`.
- **Criar:** `tests/argo-testes-numeros.test.js`.

## Checklist

- [x] Números de página pela contagem do A/B, sem cópia da consulta
- [x] Números de conta por anúncio e por conjunto (Meta + CRM)
- [x] Leitura com os dois mínimos e passagem automática para pronto, com histórico
- [x] Fonte fora vira aviso, nunca zero
- [x] Conferido com dados reais (teste de conta com início recuado virou pronto; histórico gravado)

## Implementação (04/10/2026)

Feito junto da 403 (o GET da lista já devolve os números). Suíte inteira verde depois da extração da contagem do A/B.
