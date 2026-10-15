# S1-03: Últimos 30 dias e mês corrente, com números reais

**Tipo:** Implementação
**Página:** Aba "Cloudflare" do dash
**Spec:** `spec-uso-cloudflare.md`

## Descrição

Estender a leitura da S1-02 para os últimos 30 dias e o mês corrente, com o total de requisições e os estouros de CPU de cada dia, e ligar os blocos "Últimos 30 dias" e "Mês corrente" a esses números reais. Com isso a aba fica completa e vai para conferência com o painel da Cloudflare.

## Pronto quando

A gestora abre a aba "Cloudflare" e vê, com números reais, cada um dos últimos 30 dias (requisições, estouros de CPU e o teto de referência) e o acumulado do mês. Ela confere os números com o painel da Cloudflare e o visual no computador e no celular.

## Critérios de aceite

- **CA-S1-02** (automática) — O dia da barra é o dia que o teto usa. Dado que são 21h30 de Brasília (00h30 UTC), o dia que terminou às 21h teve 80.000 requisições e houve 500 desde as 21h, quando a gestora abre a aba, então a barra de hoje mostra 500, e as 80.000 aparecem no dia anterior da lista dos 30 dias. A aba informa que o contador zera às 21h de Brasília.
- **CA-S1-04** (automática) — Lista dos últimos 30 dias com total e estouros de CPU. Dado que em 12/10 a conta fez 9.649 requisições, das quais 874 estouraram a CPU, quando a gestora abre a aba, então a linha de 12/10 mostra 9.649 requisições e 874 estouros, os 30 dias mais recentes aparecem e o teto de 100 mil aparece como referência.
- **CA-S1-05** (automática) — Dia sem nenhuma requisição aparece como zero. Dado que a Cloudflare não devolveu nenhuma requisição para um dos últimos 30 dias, mas a leitura deu certo, quando a gestora abre a aba, então esse dia aparece com 0 requisições e 0 estouros, e não some da lista.
- **CA-S1-06** (automática) — Total acumulado do mês sem comparação com limite. Dado que de 1º até hoje a conta somou 150.000 requisições e 3.000 estouros de CPU, quando a gestora abre a aba, então o bloco do mês mostra 150.000 requisições e 3.000 estouros, sem barra nem porcentagem de limite.
- **CA-S1-11** (manual) — Os números batem com o painel da Cloudflare. Dado que a aba está no ar com a credencial de produção, quando a gestora compara o total de ontem e o de hoje da aba com a página de uso de Workers & Pages no painel da Cloudflare, então os números são iguais, com tolerância de alguns minutos de atraso.
- **CA-S1-12** (manual) — A aba segue o visual do dash. Dado que a aba está no ar, quando a gestora abre no computador e no celular, então a aba segue a direção "Etiqueta" do dash, a barra e a lista dos 30 dias são legíveis nos dois e não há rolagem lateral.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-02 | O mês corrente e os dias da lista seguem o relógio UTC, o mesmo do teto. Um dia na lista vai das 21h de Brasília do dia anterior até as 21h. | confirmada | Marcelle, 15/10 |
| SUP-S1-03 | Ela cria na Cloudflare uma credencial só de leitura de Analytics da conta, que fica guardada no servidor. A credencial que o agente usa nas investigações vence em poucas horas e não serve. | confirmada | Marcelle, 15/10: ela cria a credencial |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S1-03 | Mostrar os estouros de CPU? | respondida | Sim, por dia. Marcelle, 15/10 |
| PER-S1-05 | Contra o que comparar o mês? | respondida | Nada, só o acumulado. Marcelle, 15/10 |
