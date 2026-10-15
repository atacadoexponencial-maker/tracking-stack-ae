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

## Cenários

### Happy Path
1. A gestora abre a aba. A mesma chamada `GET /api/cloudflare-uso` da S1-02 passa a trazer também `dias` (30 itens) e `mes`.
2. Se não houver leitura guardada, o servidor faz **uma única** consulta GraphQL. A janela vai do menor entre "hoje − 29 dias" e "dia 1º do mês" (UTC) até agora, e a consulta tem quatro partes:
   - hoje por projeto (a mesma da S1-02);
   - requisições por **dia** (`date`) em `pagesFunctionsInvocationsAdaptiveGroups` e em `workersInvocationsAdaptive`, agrupadas **só por dia** (agrupar por dia e status junto faz a Cloudflare amostrar: 14/10 dava 8.050 em vez de 7.848);
   - estouros por dia, com filtro `status: "exceededResources"`, nos dois datasets.
3. O servidor monta os 30 dias, do mais antigo para hoje. Dia sem nenhuma linha entra com 0 e 0. O mês é a soma de requisições e estouros do dia 1º do mês (UTC) até hoje. Tudo é guardado junto, no mesmo cache de 15 minutos.
4. A aba desenha o gráfico e a tabela com os dias reais, as etiquetas do mês e tira os selos "EXEMPLO".

### Edge Cases
- **Logo depois das 21h de Brasília:** o "hoje" (UTC) acabou de virar. O dia que terminou vai para a lista como dia anterior, e a barra mostra só o que veio depois das 21h.
- **Dia 31:** a janela vai do dia 1º até hoje (31 dias), dentro do limite da Cloudflare de 32 dias por consulta.
- **Começo do mês (dia 1º a 3):** o mês soma só os poucos dias do mês, embora a lista mostre 30 dias.

### Cenário de Erro
- O mesmo da S1-02: qualquer falha da consulta (que agora é uma só) deixa a aba inteira como indisponível, com o motivo e sem nenhum número.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S1-02 | automática | `tests/cloudflare-uso.test.js` | às 00:30 UTC de 16/10, 500 requisições hoje e 80.000 em 15/10: `hoje.requisicoes` é 500, o item de 15/10 em `dias` tem 80.000 e `zera_as` diz 21h de Brasília |
| CA-S1-04 | automática | `tests/cloudflare-uso.test.js` | `dias` tem 30 itens terminando hoje, o de 12/10 com 9.649 requisições e 874 estouros, e `teto` é 100.000 |
| CA-S1-05 | automática | `tests/cloudflare-uso.test.js` | um dia sem linha na resposta da Cloudflare aparece em `dias` com 0 e 0, e a lista continua com 30 itens |
| CA-S1-06 | automática | `tests/cloudflare-uso.test.js` | o `mes` soma só do dia 1º até hoje (150.000 e 3.000), ignora os dias do mês anterior que estão na lista e não traz teto nem porcentagem |
| CA-S1-11 | manual | roteiro abaixo | os totais de ontem e de hoje batem com o painel da Cloudflare |
| CA-S1-12 | manual | roteiro abaixo | o visual da aba no computador e no celular |

### Roteiro manual — CA-S1-11
1. Abra o dash → Diagnóstico → Cloudflare e anote o total de hoje e o de ontem (tabela "ver os 30 dias em tabela").
2. No painel da Cloudflare, abra Workers & Pages → aba de uso/métricas da conta (Requests), com o período em "últimas 24 h" ou por dia.
3. Compare. Os números devem ser iguais. Uma diferença de poucos minutos é aceitável, porque a aba guarda a leitura por 15 minutos e o painel mostra o horário dele.

### Roteiro manual — CA-S1-12
1. Abra a aba no computador. Ela deve seguir o visual do resto do dash (etiquetas, régua, fios), sem os selos "EXEMPLO".
2. Abra no celular. A barra de hoje e a lista dos 30 dias devem ser legíveis, a tabela dos dias vira lista e não pode haver rolagem para o lado.

## Banco de Dados

Nenhum.

## Arquivos

- **Modificar:** `functions/api/_cloudflare-uso.js` — a consulta passa a pedir também os dias e os estouros (uma chamada só), com a janela do menor entre hoje − 29 e o dia 1º. Novas funções: `montarDias` (30 dias com zero onde faltar) e `montarMes`. A resposta ganha `dias` e `mes`.
- **Modificar:** `public/dash/cloudflare.js` — tira `DIAS_EXEMPLO`, `MES_EXEMPLO` e os selos "EXEMPLO" e desenha `d.dias` e `d.mes`.
- **Modificar:** `tests/cloudflare-uso.test.js` — acrescenta os testes de CA-S1-02, 04, 05 e 06. A Cloudflare falsa da S1-02 passa a devolver também as partes de dias e estouros, sem mudar o que os testes da S1-02 conferem.

## Dependências Externas

- A mesma API GraphQL da S1-02. Limite conferido em 15/10: no máximo 32 dias por consulta ("4w4d").

## Checklist

- [x] Estender `functions/api/_cloudflare-uso.js` (consulta, dias, mês)
- [x] Desenhar dias e mês reais em `public/dash/cloudflare.js`
- [x] Testes de CA-S1-02, 04, 05 e 06 em `tests/cloudflare-uso.test.js` e suíte inteira passando
- [ ] Publicar e conferir a rota no ar
