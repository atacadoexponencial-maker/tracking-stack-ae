# 266: Aba Greenn reconhece campanhas pelo trecho do cadastro

**Tipo:** Implementação
**Página:** Módulo 3 — Migração do reconhecimento do workshop pago
**Spec:** spec-feedback-marketing.md

## Descrição

Trocar o padrão fixo `workshop-pago` da aba Greenn pelo trecho do funil ativo do tipo "Venda na Greenn", sem mudar nenhum número exibido hoje.

## Comportamentos cobertos

- Reconhecimento pelo trecho, sem diferenciar maiúsculas e minúsculas; o padrão fixo deixa de existir
- Conferência de equivalência: mesmos investimento, receita, vendas, ROAS e custo por venda, por campanha e no resumo, para qualquer período
- Alterar o trecho: vale na próxima abertura
- Filtro de datas, exclusão de teste interno e contagem pela última atualização continuam como hoje
- Classificação manual da aba Meta Ads continua funcionando

## Cenários

### Happy Path
1. A usuária abre a aba Greenn; `/api/greenn` lê o funil ATIVO do tipo `venda_greenn` em `funis_relatorio` (`nome`, `trecho_campanha`).
2. O endpoint passa o trecho para `calcularGreenn({ ..., trechoCampanha })`.
3. Uma campanha de `ad_spend` entra na lista (mesmo sem venda) quando o nome dela CONTÉM o trecho, sem diferenciar maiúsculas/minúsculas e tratando o trecho como texto literal (`includes`, mesma comparação de `_funis-relatorio-conflitos.js`).
4. Com o cadastro inicial (trecho `workshop-pago`), a resposta é idêntica à do padrão fixo `/workshop-pago/i`: mesmos investimento, receita, vendas, ROAS e custo por venda, por campanha e no resumo.

### Edge Cases
- Trecho alterado no cadastro: vale na próxima abertura (lido a cada chamada, sem cache).
- Trecho com caracteres especiais de regex (`.`, `+`, `(`): comparado como texto; `a.b` não casa `axb`.
- Trecho com espaços nas pontas: ignorados (`trim`), como na validação do cadastro.
- Sem funil de venda ativo, ou funil sem trecho: nenhuma campanha entra só por ter gastado; vendas e campanhas QUE VENDERAM continuam listadas (a faixa de aviso é da issue 267).
- Filtro de datas (ciclo inteiro), exclusão de teste interno e contagem pela última atualização: intocados.
- Classificação manual da aba Meta Ads: não é lida nem alterada aqui (continua como hoje).
- Mais de um funil de venda ativo (a validação impede): usa o primeiro pela posição.

### Cenário de Erro
- Tabela `funis_relatorio` inexistente (produção antes da migration 0039): o erro `no such table: funis_relatorio` é tratado como "nenhum funil de venda" e a aba segue funcionando. Qualquer outro erro de banco continua virando 500, como hoje.

## Arquivos

- **Modificar:** `functions/api/_greenn-metricas.js` — remove `PADRAO_CAMPANHA_PRODUTO`; `calcularGreenn` recebe `trechoCampanha`; exporta a função pura `campanhaDoProduto(nome, trecho)`.
- **Modificar:** `functions/api/greenn.js` — lê o funil ativo `venda_greenn` (índice `situacao, posicao`), tolera tabela inexistente e passa o trecho ao cálculo.
- **Modificar:** `functions/api/_funis-relatorio-validacao.js` — só o comentário que cita o padrão fixo que deixou de existir.
- **Modificar:** `tests/greenn-metricas.test.js` — testes do reconhecimento pelo trecho e prova de equivalência com o padrão antigo.

## Checklist

- [x] `PADRAO_CAMPANHA_PRODUTO` removido (nenhuma referência no código)
- [x] `calcularGreenn` recebe o trecho como parâmetro e continua puro
- [x] Comparação sem caixa e literal (sem regex)
- [x] Sem trecho: lista só vendas e campanhas que venderam
- [x] `/api/greenn` lê o funil ativo de venda com índice, sem varredura
- [x] Tabela inexistente não derruba `/api/greenn` (documentado no código)
- [x] Teste de equivalência padrão antigo × trecho do cadastro com os nomes reais
- [x] Equivalência conferida com dados reais do D1 remoto (só SELECT)
- [x] `npm test` verde
