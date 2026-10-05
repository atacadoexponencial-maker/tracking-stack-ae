# 405: Relatório da semana com a parte calculada

**Tipo:** Implementação
**Página:** Aba Argo › Relatório da semana (spec `spec-relatorio-semanal-argo.md`, módulos 3 e 4, sem análise escrita)

## Descrição

Montar o pacote de fatos da semana (resultados por funil e por anúncio com comparações e meta, o que foi feito na conta, vereditos, testes, contexto, semana atípica, separação de preço e mix, amostra insuficiente, fontes com problema, anúncio novo sem teste), cada fato com etiqueta, e mostrar na aba a parte calculada do relatório, gerada por um botão. Ainda sem IA.

## Pronto quando

Ela clica em gerar e vê o relatório da semana passada com o painel por funil comparado à semana anterior, à média de 4 semanas e à meta, as ações e vereditos da semana com link para a proposta, os testes com link para a ficha, os avisos (contexto velho, fonte indisponível, semana atípica) e o pacote inteiro com as etiquetas. Um funil sem meta mostra "sem meta cadastrada", uma fonte fora mostra "indisponível", nunca zero. Os números batem com o que o dash mostra para o mesmo período.

## Cenários

### Happy Path
`gerarRelatorio` coleta as fontes (`_argo-relatorio-fontes.js`), monta o pacote (`_argo-relatorio-pacote.js`) e grava em `argo.relatorios`. A aba lê `GET /api/argo/relatorio` e desenha cabeçalho, painel por funil (anterior, média de 4 semanas, meta, sinal), o que foi feito na conta (com veredito e link para a proposta), anúncios com mais gasto (com taxa de junção), testes e anúncios novos sem teste. O botão "Gerar agora/Gerar de novo" chama `POST acao=gerar`.

### Edge Cases
- Fonte fora: vira fato "indisponível" e aviso no topo; nunca zero.
- Funil sem meta: "sem meta cadastrada". Custo sem leads: "sem leads"; sem gasto: "sem gasto".
- Menos de 10 leads, ou gasto abaixo do piso do Argo: marca "amostra pequena" e sinal neutro.
- Tentativa de ação não aplicada (monitor repetindo) não entra no que foi feito.
- Semana atípica: evento do contexto na semana ou gasto total 30% fora da média das 4 anteriores.

### Cenário de Erro
Falha geral vira linha `falhou` com mensagem genérica (o detalhe vai só para o log).

## Banco de Dados

- `argo.relatorios` (migration `gestor-ae/migrations/argo/0010_relatorio_semanal.sql`, aplicada em 04/10).

## Arquivos

- **Criar:** `functions/api/_argo-relatorio-semana.js`, `_argo-relatorio-pacote.js`, `_argo-relatorio-fontes.js`, `_argo-relatorio-gerar.js`, `argo/relatorio.js`.
- **Criar:** `tests/argo-relatorio-pacote.test.js`.
- **Modificar:** `public/dash/argo-relatorio.js` (do protótipo para os dados reais) e `public/dash/index.html`.

## Checklist

- [x] Pacote de fatos com etiqueta por fato e fonte com problema como indisponível
- [x] Comparações (anterior, média de 4 semanas somando antes de dividir, meta semanal proporcional)
- [x] Sinais, amostra pequena, semana atípica, preço e mix, variações como fatos prontos
- [x] Ações, vereditos, recusadas, mudanças manuais; anúncios por gasto e taxa de junção; anúncios novos sem teste
- [x] Tela com a parte calculada e gerar pelo botão
- [x] Conferido com dados reais (semana de 28/09 a 04/10: 96 fatos em ~8 s, nenhuma fonte fora)

## Implementação (04/10/2026)

Números conferidos contra as fontes reais. Relatórios de teste gerados com `origem = 'teste'` e apagados no fim.
