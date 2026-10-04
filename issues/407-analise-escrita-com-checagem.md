# 407: Análise escrita pela IA, com checagem antes de publicar

**Tipo:** Implementação
**Página:** Aba Argo › Relatório da semana (spec `spec-relatorio-semanal-argo.md`, módulos 4 e 7)

## Descrição

A IA passa a escrever o resumo, a leitura das ações, a leitura dos testes e os pontos de atenção a partir só do pacote de fatos, citando as etiquetas; a checagem automática confere números, citações, formato, amostra, leitura antecipada, causa sem veredito, semana atípica e fonte indisponível; reprovou, a IA tenta mais uma vez; reprovou de novo, sai só a parte calculada; violações isoladas viram relatório parcial. O registro de checagem fica visível na aba.

## Pronto quando

O relatório da semana mostra a análise escrita com etiquetas que levam ao fato, fato e leitura com aparência diferente, e a situação "verificada". Uma análise forçada com número inventado ou com vencedor declarado em teste não pronto é barrada: aparece "parcial" (bloco removido e dito qual) ou "não passou na checagem", e ela vê no registro cada violação. Nenhum texto que reprovou aparece no relatório.
