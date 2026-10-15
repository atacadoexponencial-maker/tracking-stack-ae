# S1-02: Uso de hoje contra o teto, com números reais

**Tipo:** Implementação
**Página:** Aba "Cloudflare" do dash
**Spec:** `spec-uso-cloudflare.md`

## Descrição

Ler da Cloudflare o consumo de Functions de hoje da conta inteira, guardar a leitura por 15 minutos e ligar os blocos "Hoje contra o teto", "Por projeto" e o rodapé de origem do protótipo a esses números reais, protegidos pela chave do dash.

## Pronto quando

A gestora abre a aba "Cloudflare" e vê o consumo real de hoje da conta contra 100 mil, com a cor da folga, quanto cada projeto consumiu e o horário da última leitura. Se a Cloudflare falhar, a aba diz que está indisponível e por quê. Os blocos de 30 dias e do mês continuam com o exemplo do protótipo.

## Critérios de aceite

- **CA-S1-01** (automática) — A barra de hoje soma todos os projetos da conta. Dado que hoje (dia UTC) o tracking-ae fez 30.000 requisições de Functions e o painel fez 5.000, quando a gestora abre a aba Cloudflare, então a barra de hoje mostra 35.000 de 100.000 (35%), e não só o número do tracking-ae.
- **CA-S1-03** (automática) — Consumo de hoje separado por projeto. Dado que hoje o tracking-ae fez 30.000 requisições e o painel 5.000, quando a gestora abre a aba, então abaixo da barra aparecem "tracking-ae 30.000" e depois "painel 5.000", do maior para o menor, e os valores somam o total da barra.
- **CA-S1-07** (automática) — Horário da última leitura visível. Dado que os números foram lidos da Cloudflare às 14h05 de Brasília, quando a gestora abre a aba, então o rodapé mostra "lido às 14:05" (horário de Brasília).
- **CA-S1-08** (automática) — Abrir a aba várias vezes não gera consulta nova a cada abertura. Dado que os números foram lidos da Cloudflare há menos de 15 minutos, quando a aba é aberta de novo, então os números vêm da última leitura, a Cloudflare não é consultada outra vez e o horário do rodapé não muda.
- **CA-S1-09** (automática) — Sem a chave do dash não há números. Dado que alguém pede os números de uso sem a chave do dash, ou com uma chave errada, quando o pedido chega, então a resposta é recusa de acesso e não traz nenhum número.
- **CA-S1-10** (automática) — Falha na Cloudflare aparece como indisponível, nunca como zero. Dado que a Cloudflare está fora do ar, recusou a credencial ou devolveu erro, quando a gestora abre a aba, então a aba diz que os números de uso estão indisponíveis e por quê (ex.: "credencial recusada"), e nenhum bloco mostra 0.
- **CA-S1-13** (automática) — A barra muda de cor perto do teto. Dado que o consumo de hoje é de 59.999, 60.000, 80.000 ou 80.001 requisições, quando a gestora abre a aba, então a barra fica verde em 59.999, amarela em 60.000 e em 80.000 e vermelha em 80.001, com a palavra "folga", "atenção" ou "perto do teto", nessa ordem.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-01 | Números com até 15 minutos de atraso servem para o uso dela (a aba não precisa de tempo real). | confirmada | Marcelle, 15/10 |
| SUP-S1-03 | Ela cria na Cloudflare uma credencial só de leitura de Analytics da conta, que fica guardada no servidor. A credencial que o agente usa nas investigações vence em poucas horas e não serve. | confirmada | Marcelle, 15/10: ela cria a credencial |
| SUP-S1-04 | As chamadas dos crons da VPS contam como requisições de Functions e aparecem misturadas ao resto, sem separação própria. | confirmada | Marcelle, 15/10 |
| SUP-S1-05 | A barra de hoje não muda de cor nem dá alerta perto do teto. Mostra só número e porcentagem. | invalidada | Marcelle, 15/10: a barra muda de cor (verde até 60%, amarelo de 60% a 80%, vermelho acima de 80%), ver CA-S1-13 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S1-01 | Qual é o plano da conta? | respondida | Free, 100 mil por dia. Marcelle, 15/10 |
| PER-S1-02 | O que conta como requisição? | respondida | Só Functions. Marcelle, 15/10 |
| PER-S1-06 | Alerta no Slack? | respondida | Não, só a tela. Marcelle, 15/10 |
| PER-S1-07 | Total da conta ou só o tracking-ae? | respondida | Total da conta e o consumo de cada projeto. Marcelle, 15/10 |
